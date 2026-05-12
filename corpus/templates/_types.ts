/**
 * Lumina template schema types — PoC v0.1.
 *
 * IMPORTANT: This file describes the *shape* of templates only. Per
 * docs/POC-LIMITATIONS.md option (ii), no legal prose lives in committed
 * artifacts. Slot schemas describe what data a template needs; clause
 * intents describe what a clause is *for*. The legal text itself stays
 * in legal's custody until counsel approves a version.
 */

// ── Routing: how the 3 agents agree on which template applies ───────────

export type Country = 'FIN' | 'USA' | 'UK' | 'BRA' | 'DEU' | string;
export type Brand = 'wolt' | 'doordash' | 'deliveroo';
export type DocType = 'employment_agreement' | 'offer_letter' | 'addendum' | 'termination_letter';

export type TermType = 'indefinite' | 'fixed_term' | 'fixed_term_to_permanent';

/**
 * Role tier drives which conditional clause groups apply.
 * Derived from observed FIN corpus: operational roles (Grocery Associate)
 * do not carry IP / Confidentiality / Non-compete clauses; supervisor and
 * specialist roles do.
 */
export type RoleTier = 'operational' | 'supervisor' | 'specialist';

export type ScheduleType =
  | 'standard'
  | 'shiftwork_excl_night'
  | 'shiftwork_with_night'
  | 'on_call'
  | 'part_time';

export type CompensationStructure = 'hourly_paygrade' | 'monthly_fixed';

/** A legal-entity record used by the brand/entity router. Lives in config. */
export interface LegalEntity {
  id: string;
  brand: Brand;
  country: Country;
  legalName: string;
  businessId: string;
  registeredAddress: string;
}

// ── Slot schema: what data a template needs ─────────────────────────────

export type SlotType = 'string' | 'text' | 'date' | 'number' | 'currency' | 'enum' | 'boolean' | 'address';
export type SourceHint = 'greenhouse' | 'workday' | 'specialist' | 'derived';

export interface SlotDefinition {
  /** Dotted key, e.g. "employee.full_name". */
  key: string;
  type: SlotType;
  required: boolean;
  /**
   * Sensitivity flag — slots flagged sensitive must come from the
   * specialist directly, never auto-fetched.
   */
  sensitive?: boolean;
  /** Default value when not provided. */
  default?: unknown;
  /** Enum values when type === 'enum'. */
  enum?: ReadonlyArray<string | number>;
  /** Validation rules (max value, regex, etc). */
  validation?: SlotValidation;
  /**
   * `requiredIf` lets a slot be conditionally required based on the
   * value of another slot or a routing axis.
   * Example: { 'employment.term_type': 'fixed_term' }
   */
  requiredIf?: Record<string, unknown>;
  /** Where Agent 2 should look first. */
  sourceHint: SourceHint;
  /** Human-readable question for the specialist when the slot is missing. */
  askPrompt: string;
  /**
   * Why this slot exists. Free-form note — *not* a legal citation.
   * Per option (ii), citations stay out of artifacts until counsel verifies.
   */
  intentNote?: string;
}

export interface SlotValidation {
  min?: number;
  max?: number;
  unit?: string;
  pattern?: string;
  currency?: string;
}

// ── Conditional clause groups: what content appears when ─────────────────

/**
 * A clause group is a bundle of clauses that appear together based on
 * a routing condition. Each clause has an *intent*, not legal text.
 */
export interface ClauseGroup {
  id: string;
  appliesWhen: ClauseCondition;
  /** Human-readable description of what this group does. */
  description: string;
  /** Intents only — what the clause is for, not what it says. */
  clauseIntents: string[];
}

export type ClauseCondition =
  | { all: ClauseCondition[] }
  | { any: ClauseCondition[] }
  | { not: ClauseCondition }
  | { eq: [string, unknown] }
  | { in: [string, ReadonlyArray<unknown>] };

// ── Template manifest: the top-level schema for one template ────────────

export interface TemplateSchema {
  $schemaVersion: 'lumina-v0.1';
  templateId: string;
  version: string;
  status: 'draft-poc-unverified' | 'legal-review' | 'approved';
  warning: string;

  selectors: {
    country: Country;
    brand: Brand;
    docType: DocType;
  };

  /**
   * Routing axes — keys that select which conditional clause groups
   * apply. These are *not* fill-slots; they're the prior context the
   * specialist establishes before generation begins.
   */
  routingAxes: ReadonlyArray<RoutingAxis>;

  /** Fill-slots — the data the template needs. */
  slots: ReadonlyArray<SlotDefinition>;

  /** Conditional clause groups. */
  clauseGroups: ReadonlyArray<ClauseGroup>;

  /** Sections always present, in render order. */
  baselineSections: ReadonlyArray<{ id: string; intentNote: string }>;

  /** Provenance — how this schema was derived. */
  derivation: {
    sourcedFrom: string[];
    derivedAt: string;
    derivedBy: string;
  };
}

export interface RoutingAxis {
  key: string;
  type: 'enum' | 'string' | 'boolean';
  values?: ReadonlyArray<string>;
  required: boolean;
  sourceHint: SourceHint;
  askPrompt: string;
  description: string;
}
