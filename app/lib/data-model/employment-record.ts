/**
 * Universal Employment Record — v2 data model.
 *
 * One canonical schema for "everything about an employment relationship,"
 * shared across all countries, brands, and document types.
 *
 * Design principles:
 *   - Data is universal. Clauses are jurisdiction-specific. This file is
 *     the universal layer. Jurisdiction-specific behaviour lives in
 *     ./jurisdiction.ts and ./clauses/*.
 *   - Concepts, not labels. "Business ID" / "EIN" / "Handelsregister" are
 *     all the same concept (a company-registration identifier) with
 *     different formats. We model the concept once with a discriminated
 *     union for the format.
 *   - Optional > required. The universal record only requires what's truly
 *     universal (parties, role, start date, comp). Jurisdiction rules
 *     promote optionals to required for specific (country, doc type) pairs.
 *   - Versioned. Records carry a `recordVersion` so addendums can describe
 *     `delta(field, before, after)` against a specific frozen state.
 */

export type ISOCountry =
  | 'FIN' | 'USA' | 'DEU' | 'POL' | 'AUS' | 'SRB' | 'CZE' | 'GRC'
  | 'DNK' | 'SVN' | 'ROU' | 'GBR' | 'BRA' | 'CAN' | 'MEX' | 'AUT'
  | 'BGR' | 'ISR' | 'ALB' | 'MKD' | 'XKK' | 'SVK' | 'NLD' | 'NOR'
  | 'SWE' | 'LUX' | 'JPN' | 'HUN' | 'IND' | 'HRV' | 'EST' | 'LVA'
  | 'LTU';

export type ISOCurrency = 'EUR' | 'USD' | 'GBP' | 'AUD' | 'PLN' | 'CZK' | 'DKK' | 'SEK' | 'NOK' | 'HUF' | 'RON' | 'BRL' | 'JPY' | 'INR';

export type Brand = 'wolt' | 'doordash' | 'deliveroo';

export type DocumentType =
  | 'employment_agreement'
  | 'addendum'
  | 'termination_letter'
  | 'warning_letter'
  | 'employment_certificate'
  | 'nda'
  | 'travel_letter';

/* ── building blocks ──────────────────────────────────────────────────── */

export type PostalAddress = {
  street: string;
  postalCode: string;
  city: string;
  region?: string;
  country: ISOCountry;
};

/**
 * National identifier — same concept, different formats per jurisdiction.
 * The `kind` discriminator carries the validation rule.
 */
export type NationalIdentifier =
  | { kind: 'fi_henkilotunnus'; value: string }       // Finland: DDMMYY-XXXX
  | { kind: 'us_ssn'; value: string }                  // USA: XXX-XX-XXXX
  | { kind: 'us_ein'; value: string }                  // USA (employer): XX-XXXXXXX
  | { kind: 'uk_ni_number'; value: string }            // UK: AA######A
  | { kind: 'de_steuer_id'; value: string }            // Germany: 11 digits
  | { kind: 'de_handelsregister'; value: string }      // Germany (employer)
  | { kind: 'fi_business_id'; value: string }          // Finland: NNNNNNN-N
  | { kind: 'au_tfn'; value: string }                  // Australia tax file no
  | { kind: 'au_abn'; value: string }                  // Australia business no
  | { kind: 'pl_pesel'; value: string }                // Poland personal no
  | { kind: 'pl_nip'; value: string }                  // Poland tax id
  | { kind: 'generic'; label: string; value: string }; // escape hatch

export type Money = {
  amount: number;
  currency: ISOCurrency;
};

/* ── parties ──────────────────────────────────────────────────────────── */

export type Person = {
  fullName: string;
  dateOfBirth: string;                       // ISO 8601 YYYY-MM-DD
  address: PostalAddress;
  nationality?: ISOCountry;
  /** Local identifier (henkilötunnus, SSN, NI number, etc.) */
  personalIdentifier?: NationalIdentifier;
  email?: string;
  phone?: string;
};

export type LegalEntity = {
  legalName: string;
  registrationId: NationalIdentifier;         // discriminator carries the format
  registeredAddress: PostalAddress;
  signatory: { name: string; title: string };
  brand: Brand;
};

/* ── role + terms ─────────────────────────────────────────────────────── */

export type WorkLocation =
  | { kind: 'fixed'; address: PostalAddress }
  | { kind: 'hybrid'; primary: PostalAddress; remoteAllowed: true }
  | { kind: 'remote'; nominalAddress?: PostalAddress }
  | { kind: 'multi_site'; sites: PostalAddress[] };

export type Position = {
  title: string;
  duties: string[];                           // bullet list, jurisdiction-neutral
  reportsTo?: string;
  workLocation: WorkLocation;
  /** Internal tier, used for pay-band routing and CBA evaluation. */
  classification?: {
    tier: 'operational' | 'supervisor' | 'specialist' | 'manager' | 'executive';
    payGrade?: string;                        // brand-specific code, e.g. "B2"
  };
};

export type EmploymentTerms = {
  startDate: string;                          // ISO 8601
  termType: 'indefinite' | 'fixed_term' | 'fixed_term_to_permanent';
  endDate?: string;                           // required when termType is fixed
  fixedTermReason?: string;
  trialPeriod?: { months: number };           // jurisdiction-validated (max varies)
  noticePeriod?: {
    /** Where the notice rule comes from. Statutory & CBA defer to law text. */
    source: 'statutory' | 'cba' | 'contract';
    days?: number;                            // only when source = contract
  };
};

export type WorkSchedule = {
  averageWeeklyHours: number;
  scheduleType: 'standard' | 'shiftwork' | 'shiftwork_with_night' | 'on_call' | 'part_time';
  sundayWorkConsent?: boolean;
  overtimeAllowed?: boolean;
};

export type Compensation = {
  structure: 'hourly' | 'monthly_fixed' | 'annual_fixed' | 'commission' | 'mixed';
  base: Money;
  /** For pay-grade systems (FIN warehouse, etc.) — the grade code itself. */
  payGrade?: string;
  payFrequency: 'weekly' | 'bi_weekly' | 'monthly' | 'annual';
  bonuses?: Array<{ label: string; structure: 'fixed' | 'percentage' | 'discretionary'; amount?: Money }>;
};

/* ── jurisdictional flags ─────────────────────────────────────────────── */

/**
 * Flags that *toggle* jurisdiction-specific behaviour but live on the universal
 * record. Empty by default; populated by either user input or by automated
 * inference (e.g. CBA applicability from role + country).
 */
export type EmploymentFlags = {
  /** Finland / EU mostly: is a CBA binding? */
  cbaApplicable?: boolean;
  /** Which CBA, if known. */
  cbaName?: string;
  /** Worker requires visa/work-permit sponsorship. */
  sponsorshipRequired?: boolean;
  /** Background check completed (varies by jurisdiction whether required). */
  backgroundCheckCompleted?: boolean;
  /** Right-to-work documentation on file (UK/USA specific). */
  rightToWorkVerified?: boolean;
};

/* ── the universal record ─────────────────────────────────────────────── */

/**
 * The canonical state of an employment relationship at a point in time.
 * Documents are RENDERINGS of this state; addendums are DELTAS against
 * a prior version of it.
 */
export type EmploymentRecord = {
  recordId: string;                           // ULID/UUID
  recordVersion: number;                      // bumped on every committed change

  /** Where this employment is anchored — drives jurisdiction-layer lookups. */
  jurisdiction: { country: ISOCountry; brand: Brand };

  employee: Person;
  employer: LegalEntity;
  position: Position;
  terms: EmploymentTerms;
  schedule: WorkSchedule;
  compensation: Compensation;
  flags: EmploymentFlags;

  metadata: {
    createdAt: string;                        // ISO 8601
    updatedAt: string;
    createdBy: string;                        // specialist id
    /** True until counsel signs off. PoC default. */
    draftStatus: 'draft' | 'pending_review' | 'approved';
  };
};

/* ── helper: deep field-path access ───────────────────────────────────── */

/**
 * Dot-path access into an EmploymentRecord — used by jurisdiction rules to
 * say "this field is required" without hard-coding the type. Kept narrow on
 * purpose; the jurisdiction layer should only need a small set of paths.
 */
export type FieldPath =
  | 'employee.fullName'
  | 'employee.dateOfBirth'
  | 'employee.address'
  | 'employee.personalIdentifier'
  | 'employee.nationality'
  | 'employer.legalName'
  | 'employer.registrationId'
  | 'employer.signatory'
  | 'position.title'
  | 'position.duties'
  | 'position.workLocation'
  | 'position.classification'
  | 'terms.startDate'
  | 'terms.termType'
  | 'terms.endDate'
  | 'terms.fixedTermReason'
  | 'terms.trialPeriod'
  | 'terms.noticePeriod'
  | 'schedule.averageWeeklyHours'
  | 'schedule.scheduleType'
  | 'schedule.sundayWorkConsent'
  | 'compensation.structure'
  | 'compensation.base'
  | 'compensation.payGrade'
  | 'compensation.payFrequency'
  | 'flags.cbaApplicable'
  | 'flags.cbaName'
  | 'flags.sponsorshipRequired'
  | 'flags.rightToWorkVerified';
