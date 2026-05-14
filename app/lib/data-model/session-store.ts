/**
 * In-memory session store — tracks the latest record per specialist session
 * so that post-draft follow-ups can be routed as edits against the existing
 * draft instead of fresh classifications.
 *
 * PoC scope only. Production should use a real session store (Redis, DB,
 * cookie-encoded JWT) — but for a single-user demo, an in-process Map is
 * the right primitive.
 *
 * The lifecycle is dead-simple:
 *   - After `compose()` returns a `composed` outcome, the route stores the
 *     resulting record + document keyed by specialistId.
 *   - On the next turn, the route checks the store BEFORE classifying intent.
 *     If a previous draft exists and the new message looks like an edit
 *     ("actually...", "change...", "make it...", "fix..."), it routes the
 *     message as a delta against the stored record.
 *
 * The store is bounded — we keep only the last 3 sessions to avoid leaks.
 */
import type { LuminaDocument } from './document';
import type { EmploymentRecord } from './employment-record';

type LatestDraft = {
  record: EmploymentRecord;
  document: LuminaDocument;
  docType: string;
  understoodAs: string;
  storedAt: number;
};

const store = new Map<string, LatestDraft>();
const MAX_SESSIONS = 3;

export function rememberDraft(specialistId: string, draft: Omit<LatestDraft, 'storedAt'>): void {
  // Evict the oldest if we're at the cap and this is a new session
  if (store.size >= MAX_SESSIONS && !store.has(specialistId)) {
    const oldest = Array.from(store.entries()).sort((a, b) => a[1].storedAt - b[1].storedAt)[0];
    if (oldest) store.delete(oldest[0]);
  }
  store.set(specialistId, { ...draft, storedAt: Date.now() });
}

export function getLatestDraft(specialistId: string): LatestDraft | null {
  return store.get(specialistId) ?? null;
}

export function forgetDraft(specialistId: string): void {
  store.delete(specialistId);
}

/**
 * Heuristic — does this look like an edit instruction rather than a fresh
 * document request? Triggers only when a prior draft is on file (caller
 * checks that). Conservative on purpose: false positives here would
 * silently mutate a draft when the user actually wanted something new.
 */
const EDIT_PATTERNS = [
  /^actually\b/i,
  /^wait\b/i,
  /^let me/i,
  /\bchange (?:the\s+|that)?/i,
  /\bmake (?:it|the|that)\b/i,
  /\bupdate (?:the|that)\b/i,
  /\bfix (?:the|that)\b/i,
  /\bcorrect (?:the|that)\b/i,
  /\bshould (?:be|read|say)\b/i,
  /\binstead of\b/i,
  /^(?:no,|nope,|not)\s+/i,
];

export function looksLikeEdit(message: string): boolean {
  const m = message.trim();
  if (m.length < 4) return false;
  // Very long messages are almost certainly fresh requests, not edits
  if (m.length > 400) return false;
  return EDIT_PATTERNS.some((p) => p.test(m));
}
