/**
 * Chat orchestration endpoint.
 *
 * POST /api/chat
 *
 * Body: { message: string, sessionState?: ChatSessionState }
 *
 * Returns a streamed text response or a JSON payload depending on the
 * stage of the conversation. Per docs/POC-LIMITATIONS.md, generation
 * requires LUMINA_POC_MODE=true.
 */
import { NextResponse } from 'next/server';
import { isPocMode } from '@/lib/poc-guard';
import {
  extractSlots,
  gapBridgeRecommend,
  generateDraft,
  routeIntent,
  type RoutedIntent,
} from '@/lib/agents/agent3';
import { selectTemplate } from '@/lib/agents/agent1';
import { collectData } from '@/lib/agents/agent2';
import { DOC_TYPE_TO_DRIVE_FOLDER } from '@/lib/inventory';
import { compose } from '@/lib/data-model/compose';
import { clauseLibrary, jurisdictionRegistry } from '@/lib/data-model/registry';
import {
  buildDocumentFromIntent,
  seedRecordFromIntent,
  translateOutcome,
} from '@/lib/data-model/api-bridge';
import { extractDeltas, extractRecordUpdates, fillFreeText, identifySubjectEmployee } from '@/lib/data-model/llm-hooks';
import { findWorkerByName } from '@/lib/data-model/lookup';
import type { Brand, DocumentType, ISOCountry } from '@/lib/data-model/employment-record';
import type { AddendumDoc, TerminationLetterDoc } from '@/lib/data-model/document';

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
  const candidateRef = body.sessionState?.candidateRef ?? null;
  const specialistInput = body.sessionState?.specialistInput ?? {};

  try {
    // Step 1: route the intent (Haiku) — pass history so multi-turn context is preserved
    let intent: RoutedIntent = await routeIntent(message, body.history);

    // Step 1b (v2 fast-path for delta docs): if docType is addendum/termination,
    // try to identify the subject employee and look up their existing record.
    // The record carries jurisdiction (country + brand), so we can skip the
    // clarify step entirely when the employee is found.
    let preResolvedBaseRecord: import('@/lib/data-model/employment-record').EmploymentRecord | null = null;
    let preResolvedDocument: import('@/lib/data-model/document').LuminaDocument | null = null;
    if (
      process.env.LUMINA_USE_V2 === 'true' &&
      (intent.docType === 'addendum' || intent.docType === 'termination_letter')
    ) {
      const subjectName = await identifySubjectEmployee(message);
      if (subjectName) {
        const existing = await findWorkerByName(subjectName);
        if (existing) {
          preResolvedBaseRecord = existing;
          // Override intent country/brand from the record we found.
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

    // Step 1c: if we understood a doc type but are missing country/brand, ask
    // before gap analysis. Skipped when we pre-resolved via employee lookup.
    if (intent.docType && (!intent.country || !intent.brand) && !preResolvedBaseRecord) {
      return NextResponse.json({
        kind: 'clarify',
        intent,
        question: buildClarifyQuestion(intent),
      });
    }

    // Step 1d (v2 path): when LUMINA_USE_V2=true, route through the universal
    // EmploymentRecord + jurisdiction-layer pipeline. Only fires if a rule
    // exists for this (country, docType). Falls back to v1 otherwise.
    if (process.env.LUMINA_USE_V2 === 'true') {
      const v2Country = intent.country as ISOCountry;
      const v2DocType = intent.docType as DocumentType;
      const rule = jurisdictionRegistry.get(v2Country, v2DocType);
      if (rule) {
        const baseRecord =
          preResolvedBaseRecord ??
          seedRecordFromIntent({ country: v2Country, brand: intent.brand as Brand }, specialistId);
        const document =
          preResolvedDocument ?? buildDocumentFromIntent({ docType: v2DocType });

        const outcome = await compose(
          { message, existingRecord: baseRecord, document, history: body.history },
          {
            jurisdictions: jurisdictionRegistry,
            clauses: clauseLibrary,
            llm: { extractRecordUpdates, fillFreeText },
          }
        );
        return NextResponse.json(
          translateOutcome(outcome, {
            intentEcho: {
              country: intent.country,
              brand: intent.brand,
              docType: intent.docType,
              understoodAs: intent.understoodAs,
              routingContext: intent.routingContext,
            },
            specialistId,
          })
        );
      }
      // No v2 rule for this combo — fall through to v1.
    }

    // Step 2: find a template
    const selection = await selectTemplate({
      country: intent.country,
      brand: intent.brand,
      docType: intent.docType,
      routingContext: intent.routingContext,
    });

    // Branch A: no template + no corpus → gap-bridge recommendation
    if (selection.status === 'not_in_corpus' || selection.status === 'unparsed_but_in_corpus') {
      const driveFolder = DOC_TYPE_TO_DRIVE_FOLDER[intent.docType] ?? intent.docType;
      const recommendation = await gapBridgeRecommend({
        country: intent.country,
        brand: intent.brand,
        docType: intent.docType,
        closestMatches: selection.closestMatches,
      });
      return NextResponse.json({
        kind: 'gap',
        intent,
        selection,
        driveFolder,
        recommendation,
      });
    }

    // Branch B: template found — extract from natural language, then collect
    //
    // The extraction step is the difference between a form and a conversation.
    // It pulls slot values out of the original message ("Tim Howd lives at
    // 48 Arrowwood Street") so the system only asks for what's truly missing.
    // specialistInput (slot-asking replies in chat) wins on conflict.
    const extracted = await extractSlots(message, selection.template.slots);
    const knownContext = { ...extracted, ...specialistInput };

    const data = await collectData({
      slotSchema: selection.template.slots,
      routingContext: intent.routingContext,
      candidateRef,
      knownContext,
    });

    // If anything required is still missing, return without generating.
    if (data.missing.length > 0) {
      return NextResponse.json({
        kind: 'needs_input',
        intent,
        templateId: selection.template.templateId,
        templateVersion: selection.template.version,
        applicableClauseGroups: selection.applicableClauseGroups,
        filled: data.filled,
        missing: data.missing,
      });
    }

    // Branch C: everything in hand — generate the draft
    const draft = await generateDraft({
      template: selection.template,
      filled: data.filled,
      missing: data.missing,
      routingContext: intent.routingContext,
      applicableClauseGroups: selection.applicableClauseGroups,
      specialistId,
    });

    return NextResponse.json({
      kind: 'draft',
      intent,
      filled: data.filled,
      ...draft,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const stack = err instanceof Error ? err.stack : '';
    console.error('[api/chat] error:', message, '\n', stack);
    return NextResponse.json({ kind: 'error', error: message, stack: stack?.split('\n').slice(0, 8) }, { status: 500 });
  }
}
