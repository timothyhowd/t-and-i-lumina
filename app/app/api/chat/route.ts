/**
 * Chat orchestration endpoint — v2.
 *
 * POST /api/chat
 *
 * Body: { message: string, history?: [...], sessionState?: {...} }
 *
 * Flow:
 *   1. routeIntent (Haiku) → classify message into (country, brand, docType)
 *   2. If addendum/termination, look up the subject employee in mock Workday
 *      and pre-resolve the base record + document payload.
 *   3. If country/brand still missing (and no pre-resolved lookup), clarify.
 *   4. If a jurisdiction rule exists for (country, docType), run compose().
 *   5. Otherwise, surface gap using Drive inventory + Opus recommendation.
 */
import { NextResponse } from 'next/server';
import { isPocMode } from '@/lib/poc-guard';
import { compose } from '@/lib/data-model/compose';
import { clauseLibrary, jurisdictionRegistry } from '@/lib/data-model/registry';
import {
  buildDocumentFromIntent,
  seedRecordFromIntent,
  translateOutcome,
} from '@/lib/data-model/api-bridge';
import {
  extractDeltas,
  extractRecordUpdates,
  fillFreeText,
  identifySubjectEmployee,
} from '@/lib/data-model/llm-hooks';
import { findWorkerByIdentifier } from '@/lib/data-model/lookup';
import { routeIntent, type RoutedIntent } from '@/lib/data-model/intent';
import { surfaceGap } from '@/lib/data-model/gap';
import { getLatestDraft, looksLikeEdit, rememberDraft } from '@/lib/data-model/session-store';
import type {
  Brand,
  DocumentType,
  EmploymentRecord,
  ISOCountry,
} from '@/lib/data-model/employment-record';
import type {
  AddendumDoc,
  LuminaDocument,
  TerminationLetterDoc,
} from '@/lib/data-model/document';

export const runtime = 'nodejs';

type ChatRequest = {
  message: string;
  history?: Array<{ role: 'user' | 'assistant'; content: string }>;
  sessionState?: {
    candidateRef?: string | null;
    specialistInput?: Record<string, unknown>;
    specialistId?: string;
  };
};

// User-facing phrasing for each doc type. Used in clarify questions only;
// internal docType strings still use the technical names everywhere else.
const FRIENDLY_DOC: Record<string, string> = {
  employment_agreement: 'a new hire',
  addendum: 'a change to someone\'s contract',
  termination_letter: 'an end-of-employment letter',
  warning_letter: 'a written warning',
  employment_certificate: 'a proof-of-employment letter',
  nda: 'a confidentiality agreement',
  travel_letter: 'a travel or visa letter',
};

function buildClarify(intent: RoutedIntent): { question: string; choices: string[] } {
  const friendly = FRIENDLY_DOC[intent.docType] ?? 'this document';
  if (!intent.country && !intent.brand) {
    // Ask the human question (where is the person), not the system question
    // (which brand × country). The choices still scope the lookup but read
    // as locations, not as internal taxonomy.
    return {
      question: `Where is the person based? That tells me which laws apply.`,
      choices: ['Finland', 'United States', 'Germany', 'United Kingdom'],
    };
  }
  if (!intent.country) {
    return {
      question: `Which country is this for? That tells me which laws apply.`,
      choices: ['Finland', 'United States', 'Germany', 'United Kingdom'],
    };
  }
  return {
    question: `Which part of the business — Wolt, DoorDash, or Deliveroo?`,
    choices: ['Wolt', 'DoorDash', 'Deliveroo'],
  };
}

export async function POST(req: Request) {
  if (!isPocMode()) {
    return NextResponse.json(
      {
        kind: 'error',
        error:
          'POC mode is off. Set LUMINA_POC_MODE=true in .env.local. See docs/POC-LIMITATIONS.md.',
      },
      { status: 503 }
    );
  }
  if (!process.env.PORTKEY_API_KEY) {
    return NextResponse.json(
      {
        kind: 'error',
        error: 'PORTKEY_API_KEY is not set. See docs/SETUP.md.',
      },
      { status: 503 }
    );
  }

  let body: ChatRequest;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ kind: 'error', error: 'Invalid JSON body' }, { status: 400 });
  }

  const message = body.message?.trim();
  if (!message) {
    return NextResponse.json({ kind: 'error', error: 'message is required' }, { status: 400 });
  }

  const specialistId = body.sessionState?.specialistId ?? 'demo-specialist';

  try {
    // 0. Post-draft edit shortcut.
    //    If the previous turn produced a draft and THIS message looks like an
    //    edit instruction ("actually start date is July 15"), route it as a
    //    delta against the existing record instead of fresh classification.
    //    This is the keystone for Principle 5 — corrections feel natural.
    const latest = getLatestDraft(specialistId);
    if (latest && looksLikeEdit(message)) {
      const editDeltas = await extractDeltas(message, latest.record);
      if (editDeltas.length > 0) {
        // Apply deltas to the record, bumping the version
        const updatedRecord = applyDeltas(latest.record, editDeltas);
        const rule = jurisdictionRegistry.get(
          updatedRecord.jurisdiction.country,
          latest.docType as DocumentType
        );
        if (rule) {
          const outcome = await compose(
            {
              message: 'Apply the documented edits and re-render.',
              existingRecord: updatedRecord,
              document: latest.document,
              history: body.history,
            },
            {
              jurisdictions: jurisdictionRegistry,
              clauses: clauseLibrary,
              llm: { extractRecordUpdates, fillFreeText },
            }
          );
          if (outcome.kind === 'composed') {
            rememberDraft(specialistId, {
              record: outcome.record,
              document: latest.document,
              docType: latest.docType,
              understoodAs: `Edited: ${editDeltas.map((d) => d.path).join(', ')}`,
            });
          }
          return NextResponse.json(
            translateOutcome(outcome, {
              intentEcho: {
                country: updatedRecord.jurisdiction.country,
                brand: updatedRecord.jurisdiction.brand,
                docType: latest.docType,
                understoodAs: `Applied edits: ${editDeltas
                  .map((d) => `${d.path} → ${JSON.stringify(d.after)}`)
                  .join('; ')}`,
                routingContext: {},
              },
              specialistId,
            })
          );
        }
      }
      // If we couldn't extract any deltas, fall through to normal classification.
    }

    // 1. Classify intent (Haiku).
    let intent: RoutedIntent = await routeIntent(message, body.history);

    // 2. Identify any existing-employee subject in the message.
    //    For deltas (addendum/termination), ALWAYS lookup by whatever identifier
    //    is found.  For new docs (EA, certificate, NDA, travel), only lookup when
    //    the identifier is deterministic (email or worker_id) — a bare name on a
    //    new-hire request is more likely a new person than a lookup.
    let preResolvedBaseRecord: EmploymentRecord | null = null;
    let preResolvedDocument: LuminaDocument | null = null;
    const subject = await identifySubjectEmployee(message);

    const shouldLookup =
      subject.identifier &&
      (intent.docType === 'addendum' ||
        intent.docType === 'termination_letter' ||
        intent.docType === 'employment_certificate' ||
        // For EA / NDA / travel, only lookup on deterministic identifiers
        subject.identifierKind === 'email' ||
        subject.identifierKind === 'worker_id');

    if (shouldLookup && subject.identifier) {
      const existing = await findWorkerByIdentifier(subject.identifier);
      if (existing) {
        preResolvedBaseRecord = existing;
        intent = {
          ...intent,
          country: existing.jurisdiction.country,
          brand: existing.jurisdiction.brand,
        };
        if (intent.docType === 'addendum') {
          const deltas = await extractDeltas(message, existing);
          preResolvedDocument = {
            documentType: 'addendum',
            basedOn: { recordId: existing.recordId, recordVersion: existing.recordVersion },
            changes: deltas,
          } as AddendumDoc;
        } else if (intent.docType === 'termination_letter') {
          preResolvedDocument = {
            documentType: 'termination_letter',
            basedOn: { recordId: existing.recordId, recordVersion: existing.recordVersion },
            termination: {
              reason: 'mutual',
              lastWorkingDay: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
              noticeGivenOn: new Date().toISOString().slice(0, 10),
            },
          } as TerminationLetterDoc;
        }
        // For EA / certificate / NDA / travel, the buildDocumentFromIntent default
        // below is fine — we just want the base record pre-filled from Workday.
      }
    }

    // 3. Clarify if we still don't know country/brand for a known doc type.
    if (intent.docType && (!intent.country || !intent.brand) && !preResolvedBaseRecord) {
      const c = buildClarify(intent);
      return NextResponse.json({
        kind: 'clarify',
        intent,
        question: c.question,
        choices: c.choices,
      });
    }

    const country = intent.country as ISOCountry;
    const docType = intent.docType as DocumentType;
    const intentEcho = {
      country: intent.country,
      brand: intent.brand,
      docType: intent.docType,
      understoodAs: intent.understoodAs,
      routingContext: intent.routingContext,
    };

    // 4. If we have a jurisdiction rule, run compose().
    const rule = jurisdictionRegistry.get(country, docType);
    if (rule) {
      const baseRecord =
        preResolvedBaseRecord ??
        seedRecordFromIntent({ country, brand: intent.brand as Brand }, specialistId);
      const document = preResolvedDocument ?? buildDocumentFromIntent({ docType });

      const outcome = await compose(
        { message, existingRecord: baseRecord, document, history: body.history },
        {
          jurisdictions: jurisdictionRegistry,
          clauses: clauseLibrary,
          llm: { extractRecordUpdates, fillFreeText },
        }
      );
      if (outcome.kind === 'composed') {
        rememberDraft(specialistId, {
          record: outcome.record,
          document,
          docType: intent.docType,
          understoodAs: intent.understoodAs,
        });
      }
      return NextResponse.json(translateOutcome(outcome, { intentEcho, specialistId }));
    }

    // 5. No rule for this combo — surface gap using Drive inventory.
    const gap = await surfaceGap({
      country: intent.country,
      brand: intent.brand,
      docType: intent.docType,
    });
    return NextResponse.json({
      kind: 'gap',
      intent: intentEcho,
      selection: { status: 'no_rule', closestMatches: gap.closestMatches },
      driveFolder: gap.driveFolder,
      recommendation: gap.recommendation,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const stack = err instanceof Error ? err.stack : '';
    console.error('[api/chat] error:', message, '\n', stack);
    return NextResponse.json(
      { kind: 'error', error: message, stack: stack?.split('\n').slice(0, 8) },
      { status: 500 }
    );
  }
}

/**
 * Apply a list of FieldDeltas to an EmploymentRecord. Used by the
 * post-draft edit shortcut to mutate the stored record before re-rendering.
 * Bumps recordVersion. Updates metadata.updatedAt.
 */
import type { FieldDelta } from '@/lib/data-model/document';

function applyDeltas(record: EmploymentRecord, deltas: FieldDelta[]): EmploymentRecord {
  const cloned: EmploymentRecord = JSON.parse(JSON.stringify(record));
  for (const d of deltas) {
    setDeepPath(cloned, d.path, d.after);
  }
  cloned.recordVersion = (cloned.recordVersion ?? 1) + 1;
  cloned.metadata = {
    ...cloned.metadata,
    updatedAt: new Date().toISOString(),
  };
  return cloned;
}

function setDeepPath(obj: unknown, path: string, value: unknown): void {
  const segments = path.split('.');
  let cur: Record<string, unknown> = obj as Record<string, unknown>;
  for (let i = 0; i < segments.length - 1; i++) {
    const seg = segments[i];
    if (typeof cur[seg] !== 'object' || cur[seg] === null) {
      cur[seg] = {};
    }
    cur = cur[seg] as Record<string, unknown>;
  }
  cur[segments[segments.length - 1]] = value;
}
