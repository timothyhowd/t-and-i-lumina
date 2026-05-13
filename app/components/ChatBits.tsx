'use client';

import { useEffect, useState } from 'react';

export type Brand = 'wolt' | 'doordash' | 'deliveroo';

const BRAND_COLOR: Record<Brand, string> = {
  wolt: '#009DE0',
  doordash: '#EB1700',
  deliveroo: '#00CCBC',
};

const BRAND_LABEL: Record<Brand, string> = {
  wolt: 'Wolt',
  doordash: 'DoorDash',
  deliveroo: 'Deliveroo',
};

/* ── bubbles ───────────────────────────────────────────────────────── */

export function UserBubble({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex justify-end animate-in fade-in slide-in-from-bottom-1 duration-200">
      <div className="max-w-[78%] rounded-lg rounded-br-sm bg-ink px-3.5 py-2.5 text-[14.5px] leading-6 text-white whitespace-pre-wrap break-words shadow-s1">
        {children}
      </div>
    </div>
  );
}

export function AssistantBubble({
  children,
  thinking = false,
}: {
  children?: React.ReactNode;
  thinking?: boolean;
}) {
  return (
    <div className="flex items-start gap-3 animate-in fade-in slide-in-from-bottom-1 duration-200">
      <Lumen />
      <div className="max-w-[82%] rounded-lg rounded-tl-sm bg-card border border-line px-3.5 py-2.5 text-[14.5px] leading-6 text-ink-2 whitespace-pre-wrap break-words shadow-s1">
        {thinking ? <ThinkingDots /> : children}
      </div>
    </div>
  );
}

function Lumen() {
  return (
    <div className="mt-1.5 shrink-0">
      <span className="lumen" aria-hidden />
    </div>
  );
}

function ThinkingDots() {
  return (
    <span className="inline-flex gap-1 items-center h-6">
      <span className="h-1.5 w-1.5 rounded-full bg-muted/60 animate-bounce [animation-delay:0ms]" />
      <span className="h-1.5 w-1.5 rounded-full bg-muted/60 animate-bounce [animation-delay:150ms]" />
      <span className="h-1.5 w-1.5 rounded-full bg-muted/60 animate-bounce [animation-delay:300ms]" />
    </span>
  );
}

/* ── status pills ──────────────────────────────────────────────────── */

export function StatusPill({
  state,
  children,
  brand,
}: {
  state: 'in_progress' | 'done' | 'error';
  children: React.ReactNode;
  brand?: Brand | null;
}) {
  const dot =
    state === 'in_progress'
      ? 'bg-muted/60 animate-pulse'
      : state === 'done'
      ? 'bg-emerald-500'
      : 'bg-stop';
  const brandStyle = brand
    ? { color: BRAND_COLOR[brand], borderColor: `${BRAND_COLOR[brand]}30` }
    : {};
  return (
    <div className="pl-7 flex items-center gap-2 text-[12.5px]">
      <span
        className={`inline-flex items-center gap-2 rounded-full border border-line bg-card px-2.5 py-0.5 text-muted ${
          brand ? '!border-current' : ''
        }`}
        style={brandStyle}
      >
        <span className={`inline-block h-1.5 w-1.5 rounded-full ${dot}`} />
        <span className="tracking-tight">{children}</span>
      </span>
    </div>
  );
}

/* ── typewriter ────────────────────────────────────────────────────── */

export function Typewriter({
  text,
  onComplete,
  speed = 7,
}: {
  text: string;
  onComplete?: () => void;
  speed?: number;
}) {
  const [n, setN] = useState(0);
  useEffect(() => {
    if (n >= text.length) {
      onComplete?.();
      return;
    }
    const t = setTimeout(() => setN((x) => Math.min(x + 1, text.length)), speed);
    return () => clearTimeout(t);
  }, [n, text, speed, onComplete]);
  return <>{text.slice(0, n)}</>;
}

/* ── extracted card ────────────────────────────────────────────────── */

export type ExtractedRow = { label: string; value: string; source: 'message' | 'system' | 'derived' };

export function ExtractedCard({
  rows,
  brand,
}: {
  rows: ExtractedRow[];
  brand: Brand | null;
}) {
  if (rows.length === 0) return null;
  const accent = brand ? BRAND_COLOR[brand] : 'var(--accent)';
  return (
    <div className="ml-7 animate-in fade-in slide-in-from-bottom-1 duration-200">
      <div className="rounded-lg border border-line bg-card shadow-s1 overflow-hidden">
        <div className="flex items-center gap-2 px-4 py-2.5 border-b border-line bg-bg/40 text-[12px] uppercase tracking-wider text-muted">
          <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: accent }} />
          What I picked up
        </div>
        <dl className="divide-y divide-line">
          {rows.map((r) => (
            <div key={r.label} className="grid grid-cols-[120px_1fr_auto] items-center gap-3 px-4 py-2 text-[13.5px]">
              <dt className="text-muted">{r.label}</dt>
              <dd className="text-ink truncate font-medium">{r.value}</dd>
              <span className="text-[10.5px] uppercase tracking-wider text-muted/80 font-medium">
                {r.source === 'message' ? 'from message' : r.source === 'system' ? 'from systems' : 'default'}
              </span>
            </div>
          ))}
        </dl>
      </div>
    </div>
  );
}

/* ── summary card (preflight before drafting) ──────────────────────── */

export function SummaryCard({
  brand,
  docType,
  highlights,
  onConfirm,
  onEdit,
  drafting,
}: {
  brand: Brand | null;
  docType: string;
  highlights: ExtractedRow[];
  onConfirm: () => void;
  onEdit: () => void;
  drafting: boolean;
}) {
  const accent = brand ? BRAND_COLOR[brand] : 'var(--accent)';
  return (
    <div className="ml-7 animate-in fade-in slide-in-from-bottom-2 duration-300">
      <div className="rounded-lg border border-line bg-card shadow-s2 overflow-hidden">
        <div className="h-1" style={{ backgroundColor: accent }} />
        <div className="px-5 py-4">
          <div className="flex items-baseline justify-between">
            <h3 className="text-[15px] font-semibold text-ink">Ready to draft</h3>
            <span className="text-[11.5px] text-muted uppercase tracking-wider">
              {brand ? BRAND_LABEL[brand] : ''} {docType ? '· ' + prettyDocType(docType) : ''}
            </span>
          </div>
          <dl className="mt-3 divide-y divide-line">
            {highlights.map((r) => (
              <div key={r.label} className="grid grid-cols-[110px_1fr] items-center gap-3 py-1.5 text-[13.5px]">
                <dt className="text-muted">{r.label}</dt>
                <dd className="text-ink font-medium truncate">{r.value}</dd>
              </div>
            ))}
          </dl>
          <div className="mt-4 flex gap-2">
            <button
              onClick={onConfirm}
              disabled={drafting}
              className="rounded-md bg-ink px-3.5 py-2 text-[13.5px] font-medium text-white shadow-s1 hover:bg-ink-2 disabled:opacity-60"
            >
              {drafting ? 'Drafting…' : 'Looks good — draft it'}
            </button>
            <button
              onClick={onEdit}
              disabled={drafting}
              className="rounded-md border border-line bg-card px-3.5 py-2 text-[13.5px] text-ink-2 hover:bg-bg/60 disabled:opacity-60"
            >
              Add a detail first
            </button>
          </div>
        </div>
      </div>
    </div>
  );
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

/* ── draft artifact ────────────────────────────────────────────────── */

export function DraftArtifact({
  watermark,
  documentId,
  body,
  citations,
  provenance,
  brand,
}: {
  watermark: string;
  documentId: string;
  body: string;
  citations: string;
  provenance: Record<string, unknown>;
  brand: Brand | null;
}) {
  const accent = brand ? BRAND_COLOR[brand] : 'var(--accent)';
  return (
    <div className="ml-7 mt-2 space-y-3 animate-in fade-in slide-in-from-bottom-2 duration-300">
      <div className="rounded-lg bg-card shadow-s2 overflow-hidden">
        {/* Watermark stripe */}
        <div className="draft-watermark-stripe text-white text-[10px] font-mono tracking-[0.18em] uppercase px-4 py-1.5 flex items-center justify-between">
          <span>{watermark}</span>
          <span className="opacity-80">{documentId.slice(-10)}</span>
        </div>
        {/* Brand color stripe */}
        <div className="h-0.5" style={{ backgroundColor: accent }} />
        <article
          className="px-10 py-8 text-[15px] leading-7 text-ink-2"
          style={{ fontFamily: '"Iowan Old Style", "Palatino Linotype", Palatino, Georgia, serif' }}
        >
          <DocBody markdown={body + citations} />
        </article>
      </div>
      <details className="text-[12px] text-muted">
        <summary className="cursor-pointer select-none hover:text-ink-2 inline-flex items-center gap-1.5">
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M9 6l6 6-6 6" />
          </svg>
          Provenance record
        </summary>
        <pre className="mt-2 rounded-md bg-bg border border-line p-3 font-mono text-[11px] overflow-x-auto text-ink-2">
          {JSON.stringify(provenance, null, 2)}
        </pre>
      </details>
    </div>
  );
}

function DocBody({ markdown }: { markdown: string }) {
  const lines = markdown.split('\n');
  const out: React.ReactNode[] = [];
  let para: string[] = [];
  let key = 0;
  const flush = () => {
    if (para.length) {
      out.push(<p key={`p-${key++}`} className="my-2.5" dangerouslySetInnerHTML={{ __html: inline(para.join(' ')) }} />);
      para = [];
    }
  };
  for (const raw of lines) {
    const line = raw.trimEnd();
    if (!line.trim()) {
      flush();
      continue;
    }
    if (line.startsWith('## ')) {
      flush();
      out.push(
        <h2 key={`h2-${key++}`} className="mt-7 mb-3 text-[12px] font-semibold tracking-[0.12em] uppercase text-ink">
          {line.slice(3)}
        </h2>
      );
    } else if (line.startsWith('# ')) {
      flush();
      out.push(
        <h1 key={`h1-${key++}`} className="mt-2 mb-4 text-xl font-semibold text-ink">
          {line.slice(2)}
        </h1>
      );
    } else if (line.startsWith('> ')) {
      flush();
      out.push(
        <blockquote key={`bq-${key++}`} className="my-3 border-l-4 border-warn bg-warn-soft px-3 py-2 not-italic text-[13.5px] text-ink-2" style={{ background: 'var(--warn-soft)', borderColor: 'var(--warn)' }}>
          <span dangerouslySetInnerHTML={{ __html: inline(line.slice(2)) }} />
        </blockquote>
      );
    } else if (line.startsWith('---')) {
      flush();
      out.push(<hr key={`hr-${key++}`} className="my-6 border-line" />);
    } else {
      para.push(line);
    }
  }
  flush();
  return <>{out}</>;
}

function inline(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/`([^`]+)`/g, '<code class="font-mono text-[12.5px] bg-bg px-1 py-0.5 rounded">$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong class="text-ink">$1</strong>')
    .replace(/\[⚠ Citation pending legal review\]/g, '<span class="inline-block ml-1 align-baseline text-[10px] font-mono text-warn bg-warn-soft border border-warn/30 px-1.5 py-0.5 rounded" style="color: var(--warn); background: var(--warn-soft); border-color: rgba(217, 119, 6, 0.3);">⚠ unverified</span>')
    .replace(/\[MISSING:\s*([^\]]+)\]/g, '<span class="inline-block bg-stop-soft border border-stop/30 text-stop text-[12px] font-mono px-1.5 py-0.5 rounded" style="color: var(--stop); background: var(--stop-soft); border-color: rgba(220, 38, 38, 0.3);">missing: $1</span>');
}

/* ── gap card ──────────────────────────────────────────────────────── */

type GapIntent = { country: string | null; brand: string | null; docType: string };

export function GapCard({
  intent,
  options,
}: {
  intent: GapIntent;
  options: Array<{ kind: string; description: string }>;
}) {
  const topTwo = options.slice(0, 2);
  const country = intent.country ?? 'that country';
  const docLabel = ({
    employment_agreement: 'employment agreement',
    addendum: 'addendum',
    termination_letter: 'termination letter',
    warning_letter: 'warning letter',
    employment_certificate: 'employment certificate',
    nda: 'NDA',
    travel_letter: 'travel/visa letter',
  } as Record<string, string>)[intent.docType] ?? intent.docType.replace(/_/g, ' ');

  return (
    <div className="ml-7 mt-1 animate-in fade-in slide-in-from-bottom-1 duration-200">
      <div className="rounded-lg border border-line bg-card px-4 py-3 shadow-s1 space-y-2.5">
        <p className="text-[13.5px] text-ink-2">
          No processed {docLabel} template for <span className="font-medium text-ink">{country}</span> yet — here's what I can do:
        </p>
        <div className="flex flex-wrap gap-2">
          {topTwo.map((opt, i) => (
            <button
              key={i}
              type="button"
              className="rounded-full border border-line bg-bg px-3 py-1 text-[12.5px] text-ink-2 shadow-s1 transition-all hover:border-accent/40 hover:bg-card hover:shadow-s2"
            >
              {prettyKind(opt.kind)}
            </button>
          ))}
        </div>
        {topTwo[0] && (
          <p className="text-[12.5px] text-muted leading-5">{topTwo[0].description}</p>
        )}
      </div>
    </div>
  );
}

function prettyKind(k: string): string {
  return ({
    closest_country: 'Adapt closest match',
    related_doc_type: 'Use related doc type',
    from_scratch: 'Draft from scratch',
    request_template: 'Request template',
  } as Record<string, string>)[k] ?? k.replace(/_/g, ' ');
}

/* ── shared helpers ────────────────────────────────────────────────── */

/** Convert a slot value into a presentable string. */
export function presentSlotValue(slot: string, value: unknown): string {
  if (value === null || value === undefined) return '—';
  if (slot.endsWith('start_date') || slot.endsWith('end_date') || slot.endsWith('date_of_birth')) {
    // ISO → "June 1, 2026"
    if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
      try {
        const d = new Date(value + 'T12:00:00');
        return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
      } catch {
        return String(value);
      }
    }
  }
  if (slot.startsWith('compensation.monthly_eur') && typeof value === 'number') {
    return `€${value.toLocaleString('en-US')}/month`;
  }
  if (slot.startsWith('compensation.hourly_rate') && typeof value === 'number') {
    return `€${value}/hour`;
  }
  return String(value);
}

export const SLOT_LABELS: Record<string, string> = {
  'employee.full_name': 'Name',
  'employee.address': 'Address',
  'employee.personal_id_code': 'Personal ID',
  'employee.date_of_birth': 'Date of birth',
  'employment.start_date': 'Start date',
  'employment.fixed_term_end_date': 'End date',
  'employment.fixed_term_reason': 'Fixed-term reason',
  'employment.term_type': 'Term type',
  'role.title': 'Role',
  'role.duties_description': 'Duties',
  'working_place': 'Work location',
  'working_hours.average_weekly': 'Weekly hours',
  'compensation.monthly_eur': 'Salary',
  'compensation.hourly_rate_eur': 'Hourly rate',
  'compensation.hourly_pay_grade': 'Pay grade',
  'collective_agreement.name': 'Collective agreement',
  'trial_period.months': 'Trial period',
};
