/**
 * Documents in the v2 model are RENDERINGS of an EmploymentRecord plus a
 * doc-type-specific payload. Addendums describe deltas. Terminations describe
 * end-of-relationship facts. NDAs reference the record but add their own
 * scope-of-confidentiality fields. Etc.
 *
 * Crucially: a Document is NOT a place to store data that lives on the
 * EmploymentRecord. Don't duplicate employee.fullName here. Reference the
 * record by id+version and rely on composition to render the universal data.
 */
import type {
  DocumentType,
  EmploymentRecord,
  Money,
  PostalAddress,
} from './employment-record';

export type RecordRef = {
  recordId: string;
  recordVersion: number;
};

/* ── delta description (used by addendums) ────────────────────────────── */

/**
 * A field change. The path is the same dot-path the jurisdiction layer uses;
 * before/after are JSON-serializable values typed loosely on purpose — the
 * runtime checks them against the EmploymentRecord schema at compose time.
 */
export type FieldDelta = {
  path: string;                               // e.g. "schedule.averageWeeklyHours"
  before: unknown;
  after: unknown;
  effectiveDate: string;                      // ISO 8601
  reason?: string;
};

/* ── doc-type-specific payloads ───────────────────────────────────────── */

export type EmploymentAgreementDoc = {
  documentType: 'employment_agreement';
  basedOn: RecordRef;
  /** Optional: an externally-prepared offer letter that supersedes defaults. */
  offerLetterId?: string;
};

export type AddendumDoc = {
  documentType: 'addendum';
  basedOn: RecordRef;
  changes: FieldDelta[];
  /** Free-text rationale, optional. */
  context?: string;
};

export type TerminationLetterDoc = {
  documentType: 'termination_letter';
  basedOn: RecordRef;
  termination: {
    reason: 'mutual' | 'employer_initiated' | 'employee_initiated' | 'fixed_term_end' | 'misconduct' | 'redundancy';
    lastWorkingDay: string;                   // ISO 8601
    noticeGivenOn: string;                    // ISO 8601
    finalPay?: Money;
    accruedLeavePayout?: Money;
    /** Severance, garden leave, etc. — jurisdiction-validated. */
    severance?: { months: number; amount?: Money };
    rehireEligible?: boolean;
  };
};

export type WarningLetterDoc = {
  documentType: 'warning_letter';
  basedOn: RecordRef;
  warning: {
    level: 'verbal_documented' | 'written_first' | 'written_final';
    issueDescription: string;
    correctiveActionExpected: string;
    reviewDate?: string;
  };
};

export type EmploymentCertificateDoc = {
  documentType: 'employment_certificate';
  basedOn: RecordRef;
  /** Some jurisdictions allow opt-in performance evaluation; default off. */
  includePerformanceEvaluation?: boolean;
  /** Date range, defaults to start-to-present. */
  range?: { from: string; to?: string };
};

export type NdaDoc = {
  documentType: 'nda';
  basedOn: RecordRef;
  nda: {
    scope: 'general' | 'project_specific';
    projectDescription?: string;
    durationMonths?: number;                  // post-termination; statutory cap varies
    governingLaw?: string;
  };
};

export type TravelLetterDoc = {
  documentType: 'travel_letter';
  basedOn: RecordRef;
  travel: {
    destination: PostalAddress;
    purpose: string;
    dateRange: { from: string; to: string };
    visaSupportRequested: boolean;
  };
};

export type LuminaDocument =
  | EmploymentAgreementDoc
  | AddendumDoc
  | TerminationLetterDoc
  | WarningLetterDoc
  | EmploymentCertificateDoc
  | NdaDoc
  | TravelLetterDoc;

/* ── compose input ────────────────────────────────────────────────────── */

/**
 * The full input to the composition step — a record + doc-type-specific
 * payload. The compose pipeline (./compose.ts) reads jurisdiction rules
 * for the (country, docType) pair, selects clauses, and renders prose.
 */
export type ComposeInput = {
  record: EmploymentRecord;
  document: LuminaDocument;
};

/** Convenience predicate. */
export function isDocType<T extends DocumentType>(
  doc: LuminaDocument,
  type: T
): doc is Extract<LuminaDocument, { documentType: T }> {
  return doc.documentType === type;
}
