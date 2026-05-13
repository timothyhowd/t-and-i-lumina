/**
 * Compose pipeline — v2.
 *
 * Replaces the Agent 1 / Agent 2 / Agent 3 split with a cleaner flow that
 * operates on the universal EmploymentRecord:
 *
 *   1. Update the record from natural language (Haiku).
 *   2. Validate the record against jurisdiction rules.
 *   3. If fields are missing, return a slot-asking response.
 *   4. Select applicable clauses from the clause library.
 *   5. Resolve placeholders + ask Claude to fill any free-text slots (Opus).
 *   6. Assemble document, add watermark + citations, record provenance.
 *
 * Where Claude is invoked:
 *   - Step 1 (intent + extract): Haiku, fast and cheap. Pulls structured
 *     EmploymentRecord fields from messy specialist prose.
 *   - Step 5 (free-text slots): Opus, only for the bounded free-text slots
 *     declared in the clause definitions. NOT for generating whole clauses.
 *
 * Where Claude is NOT invoked:
 *   - Clause selection (deterministic, condition-driven).
 *   - Validation (rule-driven).
 *   - Placeholder resolution (pure string substitution).
 *
 * This is the architectural fix the cross-doc analysis recommends: clauses
 * are data, not generated text. Claude composes; counsel authors.
 */
import type { Clause, ClauseLibrary } from './clauses';
import type { LuminaDocument } from './document';
import type { EmploymentRecord } from './employment-record';
import type {
  JurisdictionRegistry,
  JurisdictionRule,
  ValidationResult,
} from './jurisdiction';
import { evaluateCondition } from './jurisdiction';
import { runValidator } from './validators';

/* ── public surface ───────────────────────────────────────────────────── */

export type ComposeDeps = {
  jurisdictions: JurisdictionRegistry;
  clauses: ClauseLibrary;
  /**
   * LLM hooks. Decoupled so tests can stub these. Production wiring lives in
   * lib/anthropic.ts and the agent-runtime files.
   */
  llm: {
    extractRecordUpdates: (
      message: string,
      existing: EmploymentRecord | null,
      history?: Array<{ role: 'user' | 'assistant'; content: string }>
    ) => Promise<Partial<EmploymentRecord>>;
    fillFreeText: (
      instructions: string,
      record: EmploymentRecord,
      document: LuminaDocument,
      maxChars?: number
    ) => Promise<string>;
  };
};

export type ComposeOutcome =
  | { kind: 'needs_input'; validation: ValidationResult; record: EmploymentRecord }
  | { kind: 'composed'; record: EmploymentRecord; body: string; citations: string; usedClauses: string[] };

/* ── the pipeline ─────────────────────────────────────────────────────── */

/**
 * One-shot: take a message + optional existing record, produce either a
 * draft or a list of missing fields.
 */
export async function compose(
  input: {
    message: string;
    existingRecord: EmploymentRecord | null;
    document: LuminaDocument;
    history?: Array<{ role: 'user' | 'assistant'; content: string }>;
  },
  deps: ComposeDeps
): Promise<ComposeOutcome> {
  // 1. Update record from natural language.
  const updates = await deps.llm.extractRecordUpdates(
    input.message,
    input.existingRecord,
    input.history
  );
  const record = mergeRecord(input.existingRecord, updates);

  // 2. Look up jurisdiction rule for this (country, docType).
  const rule = deps.jurisdictions.get(record.jurisdiction.country, input.document.documentType);
  if (!rule) {
    throw new Error(
      `No jurisdiction rule for ${record.jurisdiction.country} × ${input.document.documentType}`
    );
  }

  // 3. Validate.
  const validation = validate(record, rule);
  if (!validation.ok) {
    return { kind: 'needs_input', validation, record };
  }

  // 4. Select applicable clauses.
  const selected = selectClauses(record, rule, deps.clauses);

  // 5. Render. Free-text slots invoke the LLM; placeholders are pure substitution.
  const rendered: string[] = [];
  for (const clause of selected) {
    rendered.push(await renderClause(clause, record, input.document, deps));
  }
  // Collapse residual blank lines that conditional resolution leaves behind.
  const body = rendered
    .join('\n\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/^[ \t]+$/gm, '');

  // 6. Citations.
  const citations = buildCitationsBlock(selected, rule);

  return {
    kind: 'composed',
    record,
    body,
    citations,
    usedClauses: selected.map((c) => c.clauseId),
  };
}

/* ── steps (pure where possible) ──────────────────────────────────────── */

/**
 * Merge updates into an existing record, bumping the version. New records
 * are initialized from a partial — the caller is responsible for ensuring
 * required-by-type fields are present before composition succeeds.
 */
function mergeRecord(
  base: EmploymentRecord | null,
  updates: Partial<EmploymentRecord>
): EmploymentRecord {
  if (!base) {
    return {
      recordId: cryptoRandomId(),
      recordVersion: 1,
      metadata: {
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        createdBy: 'demo-specialist',
        draftStatus: 'draft',
      },
      ...updates,
    } as EmploymentRecord;
  }
  // Deep merge — preserves discriminators (e.g. workLocation.kind) when Haiku
  // returns an update that only sets sub-fields. Arrays and primitives replace
  // wholesale; only plain objects are recursed.
  const merged = deepMerge(base, updates) as EmploymentRecord;
  merged.recordVersion = base.recordVersion + 1;
  merged.metadata = { ...base.metadata, ...(updates.metadata ?? {}), updatedAt: new Date().toISOString() };
  return merged;
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return v !== null && typeof v === 'object' && !Array.isArray(v);
}

function deepMerge(a: unknown, b: unknown): unknown {
  if (!isPlainObject(a) || !isPlainObject(b)) return b === undefined ? a : b;
  const out: Record<string, unknown> = { ...a };
  for (const [k, v] of Object.entries(b)) {
    if (v === undefined) continue;
    if (isPlainObject(out[k]) && isPlainObject(v)) {
      out[k] = deepMerge(out[k], v);
    } else {
      out[k] = v;
    }
  }
  return out;
}

/**
 * Run jurisdiction validators against the record.
 *
 * Equivalent to today's Agent 2 collectData() but driven by jurisdiction
 * rules instead of bespoke per-template slot lists.
 */
export function validate(
  record: EmploymentRecord,
  rule: JurisdictionRule
): ValidationResult {
  const missing: ValidationResult['missing'] = [];
  const invalid: ValidationResult['invalid'] = [];

  for (const path of rule.requiredFields) {
    if (!isPopulated(readPath(record, path))) {
      missing.push({ path, message: `${path} is required for ${rule.country} ${rule.docType}.` });
    }
  }

  for (const v of rule.validators) {
    const outcome = runValidator(v, record);
    if (outcome.ok) continue;
    if (v.kind === 'required_when') {
      missing.push({ path: v.path, message: outcome.message });
    } else {
      invalid.push({ path: v.path, validator: v.kind, message: outcome.message });
    }
  }

  return {
    ok: missing.length === 0 && invalid.length === 0,
    missing,
    invalid,
    warnings: [],
  };
}

/**
 * Pick clauses for this (country, docType) whose appliesWhen condition is
 * satisfied by the record. Deterministic — no LLM. Ordered by clause.order.
 */
export function selectClauses(
  record: EmploymentRecord,
  rule: JurisdictionRule,
  library: ClauseLibrary
): Clause[] {
  return rule.clauses
    .filter((sel) => !sel.appliesWhen || evaluateCondition(sel.appliesWhen, record))
    .sort((a, b) => a.order - b.order)
    .map((sel) => {
      const clause = library.get(sel.clauseId);
      if (!clause) throw new Error(`Missing clause in library: ${sel.clauseId}`);
      return clause;
    });
}

/**
 * Render one clause: resolve `{{record.path}}` and `{{document.path}}`
 * placeholders, evaluate `{{#if ...}}...{{/if}}` blocks, and invoke the LLM
 * for any declared `{{#freeText "name"}}...{{/freeText}}` slots.
 */
async function renderClause(
  clause: Clause,
  record: EmploymentRecord,
  document: LuminaDocument,
  deps: ComposeDeps
): Promise<string> {
  let body = clause.body;

  // 1. Pure placeholder substitution. Real impl uses a proper template
  //    engine; this signature shows the contract.
  body = resolvePlaceholders(body, { record, document });

  // 2. Conditional blocks.
  body = resolveConditionals(body, record);

  // 3. Free-text slots — each invokes the LLM with the clause's guidance.
  if (clause.freeTextSlots) {
    for (const slot of clause.freeTextSlots) {
      const filled = await deps.llm.fillFreeText(slot.instructions, record, document, slot.maxChars);
      body = body.replace(
        new RegExp(`\\{\\{#freeText "${slot.name}"\\}\\}\\{\\{/freeText\\}\\}`),
        filled
      );
    }
  }

  return body;
}

function buildCitationsBlock(clauses: Clause[], rule: JurisdictionRule): string {
  const cites = new Map<string, Set<string>>();
  for (const c of clauses) {
    for (const cite of c.citations) {
      const set = cites.get(cite.statute) ?? new Set<string>();
      if (cite.section) set.add(cite.section);
      cites.set(cite.statute, set);
    }
  }
  for (const a of rule.regulationAnchors) {
    const set = cites.get(a.statute) ?? new Set<string>();
    for (const s of a.sections ?? []) set.add(s);
    cites.set(a.statute, set);
  }
  const lines = ['## CITATIONS', ''];
  for (const [statute, sections] of cites.entries()) {
    const sectionList = Array.from(sections).join('; ');
    lines.push(`- ${statute}${sectionList ? ` — ${sectionList}` : ''}`);
  }
  return lines.join('\n');
}

/* ── helpers (stub bodies — production impls in companion files) ──────── */

/**
 * Paths whose enum values should be humanized on render
 * (e.g. "bi_weekly" → "bi-weekly", "fixed_term" → "fixed term").
 */
const HUMANIZE_PATHS = new Set([
  'compensation.payFrequency',
  'compensation.structure',
  'terms.termType',
  'schedule.scheduleType',
  'position.classification.tier',
]);

function humanizeEnum(value: string): string {
  return value.replace(/_/g, value.includes('bi_') ? '-' : ' ');
}

function resolvePlaceholders(
  template: string,
  ctx: { record: EmploymentRecord; document: LuminaDocument }
): string {
  return template.replace(/\{\{([a-z][a-zA-Z0-9._\[\]"]*)\}\}/g, (_, path) => {
    const root = path.startsWith('record.') ? ctx.record : path.startsWith('document.') ? ctx.document : null;
    if (!root) return `{{${path}}}`;
    // Split on dots, then strip [N] brackets — `changes.[0].effectiveDate`
    // and `changes.0.effectiveDate` both resolve.
    const rest = path.split('.').slice(1).map((s: string) => s.replace(/^\[(\d+)\]$/, '$1'));
    let cur: unknown = root;
    for (const seg of rest) {
      if (cur === null || cur === undefined) return `[MISSING: ${path}]`;
      if (Array.isArray(cur)) {
        const idx = Number(seg);
        if (!Number.isFinite(idx) || idx < 0 || idx >= cur.length) return `[MISSING: ${path}]`;
        cur = cur[idx];
      } else if (typeof cur === 'object' && seg in (cur as object)) {
        cur = (cur as Record<string, unknown>)[seg];
      } else {
        return `[MISSING: ${path}]`;
      }
    }
    if (cur === undefined || cur === null) return `[MISSING: ${path}]`;
    const tail = rest.join('.');
    if (typeof cur === 'string' && HUMANIZE_PATHS.has(tail)) {
      return humanizeEnum(cur);
    }
    return String(cur);
  });
}

function resolveConditionals(template: string, record: EmploymentRecord): string {
  // Equality check first — {{#ifEq record.path "value"}}...{{/ifEq}}
  let out = template.replace(
    /\{\{#ifEq record\.([a-zA-Z0-9._]+) "([^"]+)"\}\}([\s\S]*?)\{\{\/ifEq\}\}/g,
    (_, path: string, expected: string, body: string) => {
      const v = readPath(record, path);
      return String(v) === expected ? body : '';
    }
  );
  // Presence check — {{#if record.path}}...{{/if}}
  out = out.replace(
    /\{\{#if record\.([a-zA-Z0-9._]+)\}\}([\s\S]*?)\{\{\/if\}\}/g,
    (_, path: string, body: string) => {
      const v = readPath(record, path);
      if (v === undefined || v === null || v === false || v === '') return '';
      if (Array.isArray(v) && v.length === 0) return '';
      if (typeof v === 'object' && Object.keys(v as object).length === 0) return '';
      return body;
    }
  );
  return out;
}

function readPath(obj: EmploymentRecord | unknown, path: string): unknown {
  const segments = path.split('.');
  let cur: unknown = obj;
  for (const seg of segments) {
    if (cur && typeof cur === 'object' && seg in (cur as object)) {
      cur = (cur as Record<string, unknown>)[seg];
    } else {
      return undefined;
    }
  }
  return cur;
}

function cryptoRandomId(): string {
  return 'rec_' + Math.random().toString(36).slice(2, 12);
}

/**
 * Deep "is this populated" check — handles nested objects whose sub-fields
 * may all be empty stubs. Seed records contain those stubs to satisfy the
 * type system; the validator needs to see through them.
 */
function isPopulated(value: unknown): boolean {
  if (value === undefined || value === null || value === '') return false;
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === 'object') {
    return Object.values(value as Record<string, unknown>).some((v) => isPopulated(v));
  }
  return true;
}
