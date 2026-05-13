'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { AppHeader, type Brand } from '@/components/AppHeader';
import { Composer } from '@/components/Composer';
import {
  AssistantBubble,
  DraftArtifact,
  ExtractedCard,
  GapCard,
  QuickReplies,
  SLOT_LABELS,
  StatusPill,
  SummaryCard,
  Typewriter,
  UserBubble,
  presentSlotValue,
  type ExtractedRow,
} from '@/components/ChatBits';

/* ── API response shapes ──────────────────────────────────────────────── */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Intent = { country: string; brand: Brand; docType: string; understoodAs: string; routingContext: any };
type FilledSlot = { slot: string; value: unknown; source: string; confidence: number };
type MissingSlot = { slot: string; reason: string; askPrompt: string };
type ChatApiResp =
  | { kind: 'error'; error: string }
  | { kind: 'clarify'; intent: Intent; question: string; choices?: string[] }
  | { kind: 'gap'; intent: Intent; driveFolder: string; recommendation: { summary: string; options: Array<{ kind: string; description: string }> }; selection: { closestMatches: unknown } }
  | { kind: 'needs_input'; intent: Intent; templateId: string; templateVersion: string; filled: FilledSlot[]; missing: MissingSlot[]; applicableClauseGroups: string[] }
  | {
      kind: 'draft';
      intent: Intent;
      filled: FilledSlot[];
      documentId: string;
      watermark: string;
      draft: string;
      citationsBlock: string;
      provenance: Record<string, unknown>;
    };

type HistoryEntry = { role: 'user' | 'assistant'; content: string };

/* ── message graph ────────────────────────────────────────────────────── */
type Message =
  | { id: string; role: 'user'; text: string }
  | { id: string; role: 'assistant'; text: string; typewriter?: boolean }
  | { id: string; role: 'status'; state: 'in_progress' | 'done' | 'error'; text: string; brand?: Brand | null }
  | { id: string; role: 'extracted_card'; rows: ExtractedRow[]; brand: Brand | null }
  | { id: string; role: 'summary_card'; brand: Brand | null; docType: string; highlights: ExtractedRow[] }
  | { id: string; role: 'quick_replies'; choices: string[]; consumed: boolean }
  | { id: string; role: 'assistant_gap'; payload: Extract<ChatApiResp, { kind: 'gap' }>; intent: Intent; consumed: boolean };

let idCounter = 0;
const newId = () => `m-${++idCounter}`;

const EXAMPLE_PROMPTS = [
  'Create an employment agreement',
  'Modify an existing employee\'s contract',
  'Issue a termination letter',
  'Generate an employment certificate',
];

/* ── session state for ongoing slot-asking ────────────────────────────── */
type SlotAskingSession = {
  originalMessage: string;
  candidateRef: string | null;
  templateId: string;
  collected: Record<string, string>;
  queue: MissingSlot[];
  initialFilled: FilledSlot[];
  intent: Intent;
};

/* ── live preview state ───────────────────────────────────────────────── */
type PreviewState =
  | { kind: 'empty' }
  | { kind: 'collecting'; intent: Intent; filled: FilledSlot[]; collected: Record<string, string>; remaining: number }
  | { kind: 'draft'; payload: Extract<ChatApiResp, { kind: 'draft' }>; brand: Brand | null };

/* ── page ─────────────────────────────────────────────────────────────── */

export default function DraftPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [composerValue, setComposerValue] = useState('');
  const [busy, setBusy] = useState(false);
  const [candidateRef] = useState<string>('');
  const [session, setSession] = useState<SlotAskingSession | null>(null);
  const [activeBrand, setActiveBrand] = useState<Brand | null>(null);
  const [pendingSummary, setPendingSummary] = useState(false);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [preview, setPreview] = useState<PreviewState>({ kind: 'empty' });
  const scrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
  }, [messages]);

  const isEmpty = messages.length === 0;

  const pushMessage = (m: Message) => setMessages((prev) => [...prev, m]);
  const updateStatusToDone = (id: string, text?: string, brand?: Brand | null) =>
    setMessages((prev) =>
      prev.map((m) =>
        m.id === id && m.role === 'status'
          ? { ...m, state: 'done', text: text ?? m.text, ...(brand !== undefined ? { brand } : {}) }
          : m
      )
    );

  /**
   * Mark a chip/gap-card as consumed so it visually grays out after the user
   * selects an option. Keeps the choice visible (for context) but prevents
   * re-selection.
   */
  const consumeMessage = (id: string) =>
    setMessages((prev) =>
      prev.map((m) =>
        m.id === id && (m.role === 'quick_replies' || m.role === 'assistant_gap')
          ? { ...m, consumed: true }
          : m
      )
    );

  /**
   * Send a quick-reply or gap-card button selection as if the user had typed
   * it. Shares the same downstream flow as submit().
   */
  async function sendChoice(messageId: string, text: string) {
    if (busy) return;
    consumeMessage(messageId);
    pushMessage({ id: newId(), role: 'user', text });
    const updatedHistory = [...history, { role: 'user' as const, content: text }];
    setHistory(updatedHistory);
    await runChatApi(text, candidateRef || null, {}, updatedHistory);
  }

  /* ── primary submit handler ───────────────────────────────────────── */
  async function submit() {
    const text = composerValue.trim();
    if (!text || busy) return;
    setComposerValue('');

    // Mid-slot-asking? Treat input as the answer to the current slot.
    if (session && session.queue.length > 0) {
      const currentSlot = session.queue[0];
      pushMessage({ id: newId(), role: 'user', text });
      const collected = { ...session.collected, [currentSlot.slot]: text };
      const queueAfter = session.queue.slice(1);
      const updatedSession = { ...session, collected, queue: queueAfter };

      setPreview({
        kind: 'collecting',
        intent: session.intent,
        filled: session.initialFilled,
        collected,
        remaining: queueAfter.length,
      });

      if (queueAfter.length > 0) {
        const next = queueAfter[0];
        setSession(updatedSession);
        await acknowledgeAndAsk(next, queueAfter.length);
      } else {
        setSession(updatedSession);
        showSummaryCard(updatedSession);
      }
      return;
    }

    pushMessage({ id: newId(), role: 'user', text });
    const updatedHistory = [...history, { role: 'user' as const, content: text }];
    setHistory(updatedHistory);
    await runChatApi(text, candidateRef || null, {}, updatedHistory);
  }

  /* ── core API call + response handling ────────────────────────────── */
  async function runChatApi(
    message: string,
    candRef: string | null,
    specialistInput: Record<string, unknown>,
    currentHistory: HistoryEntry[],
    options: { suppressFreshStatuses?: boolean } = {}
  ) {
    setBusy(true);
    const lookingId = newId();
    if (!options.suppressFreshStatuses) {
      pushMessage({ id: lookingId, role: 'status', state: 'in_progress', text: 'Understanding what you need…' });
    }

    let resp: ChatApiResp;
    try {
      const r = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message,
          history: currentHistory.slice(0, -1), // send history excluding the current message (already in `message`)
          sessionState: { candidateRef: candRef, specialistInput, specialistId: 'demo-specialist' },
        }),
      });
      resp = (await r.json()) as ChatApiResp;
    } catch (err) {
      if (!options.suppressFreshStatuses) updateStatusToDone(lookingId, 'Failed to reach the server');
      pushMessage({ id: newId(), role: 'assistant', text: `Something went wrong: ${err instanceof Error ? err.message : String(err)}`, typewriter: true });
      setBusy(false);
      return;
    }

    if (resp.kind === 'error') {
      if (!options.suppressFreshStatuses) updateStatusToDone(lookingId, 'Hit a wall');
      pushMessage({ id: newId(), role: 'assistant', text: resp.error, typewriter: true });
      setBusy(false);
      return;
    }

    /* CLARIFY — missing country/brand, ask before doing anything else */
    if (resp.kind === 'clarify') {
      const understood = resp.intent.understoodAs;
      if (!options.suppressFreshStatuses) updateStatusToDone(lookingId, understood ?? 'Got it');
      const fullQuestion = understood
        ? `${understood}\n\n${resp.question}`
        : resp.question;
      pushMessage({ id: newId(), role: 'assistant', text: fullQuestion, typewriter: true });
      if (resp.choices && resp.choices.length > 0) {
        pushMessage({ id: newId(), role: 'quick_replies', choices: resp.choices, consumed: false });
      }
      setHistory((prev) => [...prev, { role: 'assistant', content: fullQuestion }]);
      setBusy(false);
      return;
    }

    /* GAP */
    if (resp.kind === 'gap') {
      const brand = resp.intent.brand ?? null;
      setActiveBrand(brand);
      if (!options.suppressFreshStatuses) updateStatusToDone(lookingId, briefIntent(resp.intent), brand);
      pushMessage({ id: newId(), role: 'assistant_gap', payload: resp, intent: resp.intent, consumed: false });
      const assistantText = `No ${prettyDocType(resp.intent.docType)} template for ${resp.intent.country ?? 'that country'} yet.`;
      setHistory((prev) => [...prev, { role: 'assistant', content: assistantText }]);
      setBusy(false);
      return;
    }

    /* DRAFT */
    if (resp.kind === 'draft') {
      const brand = resp.intent.brand ?? null;
      setActiveBrand(brand);
      if (!options.suppressFreshStatuses) updateStatusToDone(lookingId, 'Drafted ✓', brand);
      pushMessage({ id: newId(), role: 'assistant', text: 'Done — your draft is ready in the preview panel.', typewriter: true });
      setPreview({ kind: 'draft', payload: resp, brand });
      setHistory((prev) => [...prev, { role: 'assistant', content: 'Draft generated.' }]);
      setBusy(false);
      return;
    }

    /* NEEDS_INPUT */
    if (resp.kind === 'needs_input') {
      const brand = resp.intent.brand ?? null;
      setActiveBrand(brand);
      if (!options.suppressFreshStatuses) updateStatusToDone(lookingId, briefIntent(resp.intent), brand);

      const extractedRows = filledToExtractedRows(resp.filled);
      if (extractedRows.length > 0) {
        pushMessage({ id: newId(), role: 'status', state: 'done', text: `Captured ${extractedRows.length} field${extractedRows.length === 1 ? '' : 's'}`, brand });
        pushMessage({ id: newId(), role: 'extracted_card', rows: extractedRows, brand });
      }

      setPreview({
        kind: 'collecting',
        intent: resp.intent,
        filled: resp.filled,
        collected: {},
        remaining: resp.missing.length,
      });

      const queue = [...resp.missing];
      if (queue.length === 0) {
        const sessionState: SlotAskingSession = {
          originalMessage: message,
          candidateRef: candRef,
          templateId: resp.templateId,
          collected: {},
          queue: [],
          initialFilled: resp.filled,
          intent: resp.intent,
        };
        showSummaryCard(sessionState);
        setBusy(false);
        return;
      }

      const firstSlot = queue[0];
      const askText = queue.length === 1
        ? `One last thing. ${firstSlot.askPrompt}`
        : `Just need ${queue.length} more thing${queue.length === 1 ? '' : 's'}. ${firstSlot.askPrompt}`;
      pushMessage({ id: newId(), role: 'assistant', text: askText, typewriter: true });
      setHistory((prev) => [...prev, { role: 'assistant', content: askText }]);

      setSession({
        originalMessage: message,
        candidateRef: candRef,
        templateId: resp.templateId,
        collected: {},
        queue,
        initialFilled: resp.filled,
        intent: resp.intent,
      });
      setBusy(false);
      return;
    }

    setBusy(false);
  }

  /* ── one-off acknowledgements between slot questions ──────────────── */
  async function acknowledgeAndAsk(nextSlot: MissingSlot, remainingCount: number) {
    const acks = ['Got it. ', 'Thanks. ', 'Noted. ', 'Okay. ', ''];
    const ack = acks[Math.floor(Math.random() * acks.length)];
    const prefix = remainingCount === 1 ? `${ack}One more — ` : `${ack}`;
    const text = `${prefix}${nextSlot.askPrompt}`;
    pushMessage({ id: newId(), role: 'assistant', text, typewriter: true });
    setHistory((prev) => [...prev, { role: 'assistant', content: text }]);
  }

  /* ── summary card flow ────────────────────────────────────────────── */
  function showSummaryCard(s: SlotAskingSession) {
    const allFilled: Record<string, unknown> = {};
    for (const f of s.initialFilled) allFilled[f.slot] = f.value;
    for (const [k, v] of Object.entries(s.collected)) allFilled[k] = v;

    const highlights = highlightOrder
      .filter((k) => allFilled[k] !== undefined && allFilled[k] !== null && allFilled[k] !== '')
      .map((k) => ({
        label: SLOT_LABELS[k] ?? k,
        value: presentSlotValue(k, allFilled[k]),
        source: 'message' as const,
      }));

    setPendingSummary(true);
    pushMessage({
      id: newId(),
      role: 'summary_card',
      brand: s.intent.brand ?? null,
      docType: s.intent.docType,
      highlights,
    });
  }

  async function confirmAndDraft() {
    if (!session) return;
    setPendingSummary(false);
    pushMessage({ id: newId(), role: 'status', state: 'in_progress', text: 'Drafting…', brand: activeBrand });
    setBusy(true);
    const allInput = { ...session.collected };
    await runChatApi(session.originalMessage, session.candidateRef, allInput, history, { suppressFreshStatuses: true });
    setSession(null);
  }

  function dismissSummaryForEdit() {
    setPendingSummary(false);
    setMessages((prev) => {
      let i = -1;
      for (let k = prev.length - 1; k >= 0; k--) {
        if (prev[k].role === 'summary_card') { i = k; break; }
      }
      if (i === -1) return prev;
      const next = [...prev];
      next.splice(i, 1);
      return next;
    });
    pushMessage({ id: newId(), role: 'assistant', text: 'Sure — what would you like to add or change?', typewriter: true });
  }

  function reset() {
    setMessages([]);
    setComposerValue('');
    setSession(null);
    setActiveBrand(null);
    setPendingSummary(false);
    setBusy(false);
    setHistory([]);
    setPreview({ kind: 'empty' });
    idCounter = 0;
  }

  const placeholder = useMemo(() => {
    if (pendingSummary) return 'Or tell me something to change before drafting…';
    if (session && session.queue.length > 0) return 'Type your answer…';
    if (messages.length === 0) return 'Describe the document you need in plain English…';
    return 'Reply, or describe a different document…';
  }, [session, pendingSummary, messages.length]);

  const hasPreview = preview.kind !== 'empty';

  /* ── render ────────────────────────────────────────────────────────── */
  return (
    <div className="flex h-screen flex-col bg-bg">
      <AppHeader activeBrand={activeBrand} onBrandChange={setActiveBrand} />

      <div className="flex flex-1 overflow-hidden">
        {/* ── Left: chat ── */}
        <div className={`flex flex-col ${hasPreview ? 'w-1/2 border-r border-line' : 'w-full'} transition-all duration-300`}>
          <div ref={scrollRef} className="flex-1 overflow-y-auto">
            <div className="mx-auto max-w-2xl px-5 py-8 space-y-4">
              {isEmpty ? <EmptyState onPick={(s) => setComposerValue(s)} /> : null}

              {messages.map((m) => {
                if (m.role === 'user') return <UserBubble key={m.id}>{m.text}</UserBubble>;
                if (m.role === 'status')
                  return (
                    <StatusPill key={m.id} state={m.state} brand={m.brand}>
                      {m.text}
                    </StatusPill>
                  );
                if (m.role === 'assistant')
                  return (
                    <AssistantBubble key={m.id}>
                      {m.typewriter ? <Typewriter text={m.text} /> : m.text}
                    </AssistantBubble>
                  );
                if (m.role === 'extracted_card')
                  return <ExtractedCard key={m.id} rows={m.rows} brand={m.brand} />;
                if (m.role === 'summary_card')
                  return (
                    <SummaryCard
                      key={m.id}
                      brand={m.brand}
                      docType={m.docType}
                      highlights={m.highlights}
                      onConfirm={confirmAndDraft}
                      onEdit={dismissSummaryForEdit}
                      drafting={busy}
                    />
                  );
                if (m.role === 'assistant_gap') {
                  const p = m.payload;
                  return (
                    <GapCard
                      key={m.id}
                      intent={m.intent}
                      options={p.recommendation.options}
                      consumed={m.consumed}
                      onChoose={(text) => sendChoice(m.id, text)}
                      onStartOver={reset}
                    />
                  );
                }
                if (m.role === 'quick_replies') {
                  return (
                    <QuickReplies
                      key={m.id}
                      choices={m.choices}
                      consumed={m.consumed}
                      onChoose={(text) => sendChoice(m.id, text)}
                    />
                  );
                }
                return null;
              })}

              {busy && !pendingSummary && <AssistantBubble thinking />}
            </div>
          </div>

          <div className="border-t border-line bg-card/80 backdrop-blur">
            <div className="mx-auto max-w-2xl px-5 py-3">
              {!isEmpty && (
                <div className="flex items-center justify-end text-[12px] text-muted mb-2">
                  <button
                    onClick={reset}
                    className="hover:text-ink-2 inline-flex items-center gap-1.5 transition-colors"
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M3 12a9 9 0 109-9 9.75 9.75 0 00-6.74 2.74L3 8" />
                      <path d="M3 3v5h5" />
                    </svg>
                    Start over
                  </button>
                </div>
              )}
              <Composer
                value={composerValue}
                onChange={setComposerValue}
                onSubmit={submit}
                disabled={busy && !pendingSummary}
                placeholder={placeholder}
              />
              <p className="mt-2 text-center text-[11px] text-muted">
                Lumina drafts are unverified. Specialist sign-off required before any execution.
              </p>
            </div>
          </div>
        </div>

        {/* ── Right: live preview ── */}
        {hasPreview && (
          <div className="w-1/2 overflow-y-auto bg-bg/50">
            <LivePreview preview={preview} />
          </div>
        )}
      </div>
    </div>
  );
}

/* ── live preview panel ───────────────────────────────────────────────── */

function LivePreview({ preview }: { preview: PreviewState }) {
  if (preview.kind === 'collecting') {
    const { intent, filled, collected, remaining } = preview;
    const allFilled: Record<string, unknown> = {};
    for (const f of filled) allFilled[f.slot] = f.value;
    for (const [k, v] of Object.entries(collected)) allFilled[k] = v;

    const rows = highlightOrder
      .filter((k) => allFilled[k] !== undefined && allFilled[k] !== null && allFilled[k] !== '')
      .map((k) => ({ label: SLOT_LABELS[k] ?? k, value: presentSlotValue(k, allFilled[k]) }));

    return (
      <div className="p-6 space-y-4 animate-in fade-in duration-200">
        <div className="rounded-lg border border-line bg-card shadow-s1 overflow-hidden">
          <div className="px-5 py-3 border-b border-line bg-bg/40 flex items-center justify-between">
            <span className="text-[12px] uppercase tracking-wider text-muted">
              {prettyDocType(intent.docType)}
            </span>
            <span className="text-[11px] text-muted">
              {remaining > 0 ? `${remaining} field${remaining === 1 ? '' : 's'} remaining` : 'Ready to draft'}
            </span>
          </div>
          {rows.length > 0 && (
            <dl className="divide-y divide-line">
              {rows.map((r) => (
                <div key={r.label} className="grid grid-cols-[110px_1fr] items-center gap-3 px-5 py-2 text-[13.5px]">
                  <dt className="text-muted">{r.label}</dt>
                  <dd className="text-ink font-medium truncate">{r.value}</dd>
                </div>
              ))}
            </dl>
          )}
          <div className="px-5 py-4 space-y-2.5">
            {[80, 95, 70, 88, 60].map((w, i) => (
              <div key={i} className="h-2.5 rounded-full bg-line/60 animate-pulse" style={{ width: `${w}%`, animationDelay: `${i * 120}ms` }} />
            ))}
          </div>
        </div>
        <p className="text-center text-[12px] text-muted">Document preview will fill in as you answer questions</p>
      </div>
    );
  }

  if (preview.kind === 'draft') {
    const { payload, brand } = preview;
    return (
      <div className="p-6 animate-in fade-in duration-300">
        <DraftArtifact
          watermark={payload.watermark}
          documentId={payload.documentId}
          body={payload.draft}
          citations={payload.citationsBlock}
          provenance={payload.provenance}
          brand={brand}
        />
      </div>
    );
  }

  return null;
}

/* ── helpers ──────────────────────────────────────────────────────────── */

function EmptyState({ onPick }: { onPick: (s: string) => void }) {
  return (
    <div className="pt-16 pb-4 text-center">
      <div className="inline-flex items-center gap-2 mb-2">
        <span className="lumen-lg" aria-hidden />
        <span className="text-[13px] uppercase tracking-[0.18em] text-muted">Lumina</span>
      </div>
      <h1 className="text-[28px] font-semibold tracking-tight text-ink">What do you need to draft?</h1>
      <p className="mt-2 text-[15px] text-muted max-w-xl mx-auto">
        Describe it in plain English. I'll pick the right document type, fill what I can, and only ask for what's missing.
      </p>
      <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 gap-2 text-left">
        {EXAMPLE_PROMPTS.map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => onPick(p)}
            className="rounded-lg border border-line bg-card px-3.5 py-3 text-[13.5px] text-ink-2 shadow-s1 transition-all hover:border-accent/40 hover:shadow-s2"
          >
            {p}
          </button>
        ))}
      </div>
    </div>
  );
}

function briefIntent(intent: Intent): string {
  const docPretty = prettyDocType(intent.docType);
  const brandPretty =
    intent.brand === 'wolt' ? 'Wolt' : intent.brand === 'doordash' ? 'DoorDash' : intent.brand === 'deliveroo' ? 'Deliveroo' : intent.brand;
  return `${brandPretty} · ${intent.country} · ${docPretty}`;
}

function prettyDocType(d: string): string {
  return ({
    employment_agreement: 'Employment agreement',
    termination_letter: 'Termination letter',
    warning_letter: 'Warning letter',
    employment_certificate: 'Employment certificate',
    nda: 'NDA',
    addendum: 'Addendum',
    travel_letter: 'Travel letter',
  } as Record<string, string>)[d] ?? d.replace(/_/g, ' ');
}

function filledToExtractedRows(filled: FilledSlot[]): ExtractedRow[] {
  const rows: ExtractedRow[] = [];
  for (const f of filled) {
    const label = SLOT_LABELS[f.slot];
    if (!label) continue;
    if (f.source === 'derived' && BORING_DERIVED.has(f.slot)) continue;
    rows.push({
      label,
      value: presentSlotValue(f.slot, f.value),
      source:
        f.source === 'specialist_input'
          ? 'message'
          : f.source === 'derived'
          ? 'derived'
          : 'system',
    });
  }
  rows.sort((a, b) => {
    const ai = highlightOrder.findIndex((k) => SLOT_LABELS[k] === a.label);
    const bi = highlightOrder.findIndex((k) => SLOT_LABELS[k] === b.label);
    return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
  });
  return rows;
}

const BORING_DERIVED = new Set([
  'trial_period.months',
  'working_hours.average_weekly',
  'annual_leave.additional_days',
  'collective_agreement.name',
  'non_solicit.months',
  'liquidated_damages.months_salary',
]);

const highlightOrder = [
  'employee.full_name',
  'role.title',
  'working_place',
  'employment.start_date',
  'employment.fixed_term_end_date',
  'employment.term_type',
  'compensation.monthly_eur',
  'compensation.hourly_rate_eur',
  'compensation.hourly_pay_grade',
  'employee.address',
  'employee.personal_id_code',
];
