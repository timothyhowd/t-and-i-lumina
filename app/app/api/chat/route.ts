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

export const runtime = 'nodejs';

type ChatRequest = {
  message: string;
  sessionState?: {
    candidateRef?: string | null;
    specialistInput?: Record<string, unknown>;
    specialistId?: string;
  };
};

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
    // Step 1: route the intent (Haiku)
    const intent: RoutedIntent = await routeIntent(message);

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
    return NextResponse.json({ kind: 'error', error: message }, { status: 500 });
  }
}
