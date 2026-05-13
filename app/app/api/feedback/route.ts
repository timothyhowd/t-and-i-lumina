/**
 * Feedback endpoint — appends a single feedback record to
 * corpus/feedback/runs.jsonl.
 *
 * Used by the FeedbackWidget on each generated draft. Captures per-draft
 * reactions (thumbs + optional note) plus the intent that produced the
 * draft, so feedback is interpretable later without re-running anything.
 */
import { NextResponse } from 'next/server';
import { promises as fs } from 'node:fs';
import path from 'node:path';

export const runtime = 'nodejs';

type FeedbackRequest = {
  documentId: string;
  rating: 'positive' | 'negative';
  note?: string;
  intent?: {
    country?: string;
    brand?: string;
    docType?: string;
    understoodAs?: string;
  };
  promptEcho?: string;          // first ~200 chars of the prompt that produced the draft
  specialistId?: string;
};

const FEEDBACK_DIR = path.join(process.cwd(), '..', 'corpus', 'feedback');
const FEEDBACK_FILE = path.join(FEEDBACK_DIR, 'runs.jsonl');

export async function POST(req: Request) {
  let body: FeedbackRequest;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid JSON' }, { status: 400 });
  }

  if (!body.documentId || !body.rating) {
    return NextResponse.json({ ok: false, error: 'documentId + rating required' }, { status: 400 });
  }
  if (body.rating !== 'positive' && body.rating !== 'negative') {
    return NextResponse.json({ ok: false, error: 'rating must be positive | negative' }, { status: 400 });
  }

  const entry = {
    timestamp: new Date().toISOString(),
    documentId: body.documentId,
    rating: body.rating,
    note: body.note?.trim() || null,
    intent: body.intent ?? null,
    promptEcho: body.promptEcho?.slice(0, 240) ?? null,
    specialistId: body.specialistId ?? 'demo-specialist',
  };

  try {
    await fs.mkdir(FEEDBACK_DIR, { recursive: true });
    await fs.appendFile(FEEDBACK_FILE, JSON.stringify(entry) + '\n', 'utf8');
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true, savedAt: entry.timestamp });
}
