/**
 * Germany — jurisdiction rules.
 *
 * Per the cross-document analysis (docs/cross-doc-analysis.md):
 *   - Longest EA in the sample (17 clauses), bilingual DE/EN with German binding.
 *   - § 622 BGB notice cascade with reciprocity clause.
 *   - § 38 SGB III duty-to-register-for-work on termination.
 *   - § 3 BUrlG vacation minimum (24 working days = 4 weeks).
 *   - § 69b UrhG IP rights assignment for employee inventions.
 *   - § 5 GeschGehG confidentiality (trade secrets).
 *   - § 31a UrhG unknown-use carveout.
 *   - Vertragsstrafe (contractual penalty) clauses commonly attached to
 *     non-compete (Wettbewerbsverbot) — quantified at one gross monthly
 *     salary per breach in the sample.
 *
 * Clauses below are scaffolding marked `unverified`. Citations to actual
 * German statutes are real; prose is generic and requires counsel review.
 */
import type { JurisdictionRule } from '../jurisdiction';

const DEU_ANCHORS = [
  { statute: 'Bürgerliches Gesetzbuch (BGB)', url: 'https://www.gesetze-im-internet.de/bgb/' },
  { statute: 'Bundesurlaubsgesetz (BUrlG)', url: 'https://www.gesetze-im-internet.de/burlg/' },
  { statute: 'Sozialgesetzbuch III (SGB III)', url: 'https://www.gesetze-im-internet.de/sgb_3/' },
  { statute: 'Geschäftsgeheimnisgesetz (GeschGehG)', url: 'https://www.gesetze-im-internet.de/geschgehg/' },
  { statute: 'Urheberrechtsgesetz (UrhG)', url: 'https://www.gesetze-im-internet.de/urhg/' },
  { statute: 'Gesetz über Arbeitnehmererfindungen (ArbnErfG)', url: 'https://www.gesetze-im-internet.de/arbnerfg/' },
];

export const DEU_EMPLOYMENT_AGREEMENT: JurisdictionRule = {
  country: 'DEU',
  docType: 'employment_agreement',

  requiredFields: [
    'employee.fullName',
    'employee.dateOfBirth',
    'employee.address',
    'employer.legalName',
    'employer.registrationId',
    'employer.signatory',
    'position.title',
    'position.duties',
    'position.workLocation',
    'terms.startDate',
    'terms.termType',
    'schedule.averageWeeklyHours',
    'compensation.structure',
    'compensation.base',
  ],

  validators: [
    {
      path: 'terms.trialPeriod',
      kind: 'max_trial_months',
      params: { max: 6 },
      message: 'German Probezeit is capped at 6 months (§ 622 BGB).',
    },
    {
      path: 'compensation.base',
      kind: 'currency_must_be',
      params: { currency: 'EUR' },
      message: 'German employment agreements must be denominated in EUR.',
    },
    {
      path: 'terms.endDate',
      kind: 'required_when',
      params: {},
      appliesWhen: { eq: ['terms.termType', 'fixed_term'] },
      message: 'Befristete Arbeitsverhältnisse require an end date (§ 15 TzBfG).',
    },
    {
      path: 'terms.fixedTermReason',
      kind: 'required_when',
      params: {},
      appliesWhen: { eq: ['terms.termType', 'fixed_term'] },
      message: 'Befristete Arbeitsverhältnisse require a Sachgrund per § 14 Abs. 1 TzBfG (unless under § 14 Abs. 2 sachgrundlose Befristung is invoked).',
    },
    {
      path: 'schedule.averageWeeklyHours',
      kind: 'max_weekly_hours',
      params: { max: 48 },
      message: 'Regular weekly working time may not exceed 48 hours (§ 3 ArbZG).',
    },
  ],

  clauses: [
    { clauseId: 'deu.parties', order: 1, required: true },
    { clauseId: 'deu.term', order: 2, required: true },
    { clauseId: 'deu.probation', order: 3, appliesWhen: { present: 'terms.trialPeriod' } },
    { clauseId: 'deu.duties', order: 4, required: true },
    { clauseId: 'deu.place_of_work', order: 5, required: true },
    { clauseId: 'deu.working_hours', order: 6, required: true },
    { clauseId: 'deu.compensation', order: 7, required: true },
    { clauseId: 'deu.annual_leave', order: 8, required: true },
    { clauseId: 'deu.sickness_pay', order: 9, required: true },
    { clauseId: 'deu.notice_period', order: 10, required: true },
    { clauseId: 'deu.ip_assignment', order: 11, required: true },
    { clauseId: 'deu.confidentiality', order: 12, required: true },
    { clauseId: 'deu.data_protection', order: 13, required: true },
    { clauseId: 'deu.governing_law', order: 14, required: true },
    { clauseId: 'deu.language_precedence', order: 15, required: true },
    { clauseId: 'deu.signature', order: 99, required: true },
  ],

  regulationAnchors: DEU_ANCHORS,
};

export const DEU_ADDENDUM: JurisdictionRule = {
  country: 'DEU',
  docType: 'addendum',

  requiredFields: ['employee.fullName', 'employer.legalName', 'employer.signatory'],

  validators: [],

  clauses: [
    { clauseId: 'deu.addendum_recital', order: 1, required: true },
    { clauseId: 'deu.addendum_delta', order: 2, required: true },
    { clauseId: 'deu.governing_law', order: 3, required: true },
    { clauseId: 'deu.signature', order: 99, required: true },
  ],

  regulationAnchors: DEU_ANCHORS,
};

export const DEU_TERMINATION_LETTER: JurisdictionRule = {
  country: 'DEU',
  docType: 'termination_letter',

  requiredFields: ['employee.fullName', 'employer.legalName', 'employer.signatory'],

  validators: [],

  clauses: [
    { clauseId: 'deu.termination_parties', order: 1, required: true },
    { clauseId: 'deu.termination_reason', order: 2, required: true },
    { clauseId: 'deu.notice_period', order: 3, required: true },
    { clauseId: 'deu.sgb3_registration_duty', order: 4, required: true },
    { clauseId: 'deu.final_pay', order: 5, required: true },
    { clauseId: 'deu.signature', order: 99, required: true },
  ],

  regulationAnchors: DEU_ANCHORS,
};

export const DEU_RULES = [DEU_EMPLOYMENT_AGREEMENT, DEU_ADDENDUM, DEU_TERMINATION_LETTER];
