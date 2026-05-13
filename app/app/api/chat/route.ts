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
import { findWorkerByName } from '@/lib/data-model/lookup';
import { routeIntent, type RoutedIntent } from '@/lib/data-model/intent';
import { surfaceGap } from '@/lib/data-model/gap';
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

const DOC_LABELS: Record<string, string> = {
  employment_agreement: 'employment agreement',
  addendum: 'addendum',
  termination_letter: 'termination letter',
  warning_letter: 'warning letter',
  employment_certificate: 'employment certificate',
  nda: 'NDA',
  travel_letter: 'travel/visa letter',
};

function buildClarifyQuestion(intent: RoutedIntent): string {
  const doc = DOC_LABELS[intent.docType] ?? intent.docType.replace(/_/g, ' ');
  if (!intent.country && !intent.brand) {
    return `For ${article(doc)} ${doc} like this — which country and brand (Wolt, DoorDash, or Deliveroo) are we working with?`;
  }
  if (!intent.country) {
    const b = intent.brand === 'wolt' ? 'Wolt' : intent.brand === 'doordash' ? 'DoorDash' : 'Deliveroo';
    return `Which country is this ${b} ${doc} for?`;
  }
  return `Which brand is this for — Wolt, DoorDash, or Deliveroo?`;
}

function article(word: string): string {
  return /^[aeiou]/i.test(word) ? 'an' : 'a';
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
    // 1. Classify intent (Haiku).
    let intent: RoutedIntent = await routeIntent(message, body.history);

    // 2. Fast path for delta docs: look up the subject employee in mock Workday.
    //    If found, the record carries jurisdiction, so we can skip the clarify step.
    let preResolvedBaseRecord: EmploymentRecord | null = null;
    let preResolvedDocument: LuminaDocument | null = null;
    if (intent.docType === 'addendum' || intent.docType === 'termination_letter') {
      const subjectName = await identifySubjectEmployee(message);
      if (subjectName) {
        const existing = await findWorkerByName(subjectName);
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
          } else {
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
        }
      }
    }

    // 3. Clarify if we still don't know country/brand for a known doc type.
    if (intent.docType && (!intent.country || !intent.brand) && !preResolvedBaseRecord) {
      return NextResponse.json({
        kind: 'clarify',
        intent,
        question: buildClarifyQuestion(intent),
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
