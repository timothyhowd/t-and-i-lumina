/**
 * Jurisdiction layer — the rules that operate on a universal EmploymentRecord
 * to determine: (a) which fields are *required* for a given doc type in this
 * country, (b) what *validations* apply, and (c) which *clauses* from the
 * clause library are applicable.
 *
 * These rules are the only thing that has to change when adding a country.
 * The data model and the composition pipeline stay the same.
 */
import type { DocumentType, EmploymentRecord, FieldPath, ISOCountry } from './employment-record';

/* ── conditions ───────────────────────────────────────────────────────── */

/**
 * A predicate over the EmploymentRecord. Used to express things like:
 *   "trial period clause applies when terms.trialPeriod is set"
 *   "Sunday-work consent clause applies when scheduleType is shiftwork"
 *
 * The Compose pipeline evaluates these against a concrete record.
 */
export type Condition =
  | { eq: [FieldPath, unknown] }
  | { neq: [FieldPath, unknown] }
  | { in: [FieldPath, unknown[]] }
  | { present: FieldPath }
  | { absent: FieldPath }
  | { all: Condition[] }
  | { any: Condition[] }
  | { not: Condition };

/* ── validations ──────────────────────────────────────────────────────── */

/**
 * A validator's name plus its parameters. The validator implementation
 * lives in ./validators.ts (or inline in compose). Names are stable.
 *
 * Examples:
 *   { kind: 'max_trial_months', params: { max: 6 } }
 *   { kind: 'min_notice_days_by_tenure', params: { ladder: [...] } }
 *   { kind: 'currency_must_be', params: { currency: 'EUR' } }
 */
export type FieldValidator = {
  path: FieldPath;
  kind:
    | 'max_trial_months'
    | 'min_trial_months'
    | 'currency_must_be'
    | 'identifier_format'
    | 'min_weekly_hours'
    | 'max_weekly_hours'
    | 'required_when'
    | 'enum_subset';
  params?: Record<string, unknown>;
  /** Applies only when this condition is true. Optional. */
  appliesWhen?: Condition;
  /** Human-readable failure message for the UI. */
  message?: string;
};

/* ── clause references ────────────────────────────────────────────────── */

/**
 * A clause selection rule — references a clause by id in the clause library
 * and the condition under which it's pulled in. The clause body itself
 * lives in ./clauses/<country>.ts (Markdown with template placeholders).
 */
export type ClauseSelection = {
  /** Stable id, e.g. "fin.cba_binding" or "deu.probationary_period" */
  clauseId: string;
  /** Render position; clauses are emitted in this order. */
  order: number;
  /** Pulled in only when the condition is satisfied (or always, if omitted). */
  appliesWhen?: Condition;
  /** Marks this clause as legally required — surfaces if its data is missing. */
  required?: boolean;
};

/* ── the rule record ──────────────────────────────────────────────────── */

/**
 * Everything a jurisdiction-and-doc-type pair needs to validate a record and
 * select its clauses. One of these per (country, docType) combination.
 */
export type JurisdictionRule = {
  country: ISOCountry;
  docType: DocumentType;

  /** Fields that must be populated for this combo before composition. */
  requiredFields: FieldPath[];

  /** Validations beyond mere presence. */
  validators: FieldValidator[];

  /** Clauses to compose, in order. */
  clauses: ClauseSelection[];

  /**
   * Anchor statutes / regulation citations every clause should reference
   * when applicable. Used as input to the composer's RAG retrieval.
   */
  regulationAnchors: Array<{
    statute: string;                          // e.g. "Employment Contracts Act"
    sections?: string[];                      // e.g. ["Chapter 1 §3", "Chapter 6 §1"]
    url?: string;                             // canonical source if public
  }>;
};

/* ── lookup interface ─────────────────────────────────────────────────── */

/**
 * Registry of jurisdiction rules. Implementation just looks up by
 * (country, docType). Centralized here so the composer doesn't import
 * each country file directly.
 */
export interface JurisdictionRegistry {
  get(country: ISOCountry, docType: DocumentType): JurisdictionRule | null;
  listSupported(): Array<{ country: ISOCountry; docType: DocumentType }>;
}

/* ── validation result ────────────────────────────────────────────────── */

/**
 * What `validate(record, doc)` returns. Surfacing this in the UI is the
 * "you're missing X" experience — same as Agent 2's missing-slot list today,
 * but expressed against the universal record instead of bespoke schemas.
 */
export type ValidationResult = {
  ok: boolean;
  missing: Array<{ path: FieldPath; message: string }>;
  invalid: Array<{ path: FieldPath; validator: FieldValidator['kind']; message: string }>;
  /** Soft warnings — generation can proceed but specialist should see these. */
  warnings: Array<{ path: FieldPath; message: string }>;
};

/* ── condition evaluator (pure function, kept here for proximity) ─────── */

export function evaluateCondition(cond: Condition, record: EmploymentRecord): boolean {
  if ('eq' in cond) return readPath(record, cond.eq[0]) === cond.eq[1];
  if ('neq' in cond) return readPath(record, cond.neq[0]) !== cond.neq[1];
  if ('in' in cond) return cond.in[1].includes(readPath(record, cond.in[0]));
  if ('present' in cond) {
    const v = readPath(record, cond.present);
    return v !== undefined && v !== null && v !== '';
  }
  if ('absent' in cond) {
    const v = readPath(record, cond.absent);
    return v === undefined || v === null || v === '';
  }
  if ('all' in cond) return cond.all.every((c) => evaluateCondition(c, record));
  if ('any' in cond) return cond.any.some((c) => evaluateCondition(c, record));
  if ('not' in cond) return !evaluateCondition(cond.not, record);
  return false;
}

function readPath(record: EmploymentRecord, path: FieldPath): unknown {
  const segments = path.split('.');
  let cur: unknown = record;
  for (const seg of segments) {
    if (cur && typeof cur === 'object' && seg in cur) {
      cur = (cur as Record<string, unknown>)[seg];
    } else {
      return undefined;
    }
  }
  return cur;
}
