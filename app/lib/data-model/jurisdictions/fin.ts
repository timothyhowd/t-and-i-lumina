/**
 * Finland — jurisdiction rules.
 *
 * Concrete worked example. Other countries follow the same shape.
 *
 * Real citations (not yet verified for production):
 *   - Employment Contracts Act (Työsopimuslaki 55/2001)
 *   - Working Hours Act (Työaikalaki 872/2019)
 *   - Annual Holidays Act (Vuosilomalaki 162/2005)
 */
import type { JurisdictionRule } from '../jurisdiction';

const COMMON_ANCHORS = [
  {
    statute: 'Employment Contracts Act (Työsopimuslaki 55/2001)',
    url: 'https://www.finlex.fi/en/laki/kaannokset/2001/en20010055',
  },
  {
    statute: 'Working Hours Act (Työaikalaki 872/2019)',
    url: 'https://www.finlex.fi/en/laki/kaannokset/2019/en20190872',
  },
  {
    statute: 'Annual Holidays Act (Vuosilomalaki 162/2005)',
    url: 'https://www.finlex.fi/en/laki/kaannokset/2005/en20050162',
  },
];

export const FIN_EMPLOYMENT_AGREEMENT: JurisdictionRule = {
  country: 'FIN',
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
      message: 'Finnish law caps the trial period at 6 months.',
    },
    {
      path: 'compensation.base',
      kind: 'currency_must_be',
      params: { currency: 'EUR' },
      message: 'Finnish employment agreements must be denominated in EUR.',
    },
    {
      path: 'terms.endDate',
      kind: 'required_when',
      params: {},
      appliesWhen: { in: ['terms.termType', ['fixed_term', 'fixed_term_to_permanent']] },
      message: 'Fixed-term agreements require an end date.',
    },
    {
      path: 'terms.fixedTermReason',
      kind: 'required_when',
      params: {},
      appliesWhen: { eq: ['terms.termType', 'fixed_term'] },
      message: 'Finnish law requires a documented reason for fixed-term agreements (ECA Ch.1 §3a).',
    },
    {
      path: 'schedule.sundayWorkConsent',
      kind: 'required_when',
      params: {},
      appliesWhen: { in: ['schedule.scheduleType', ['shiftwork', 'shiftwork_with_night']] },
      message: 'Sunday-work consent is required for shiftwork roles (Working Hours Act §17).',
    },
  ],

  clauses: [
    { clauseId: 'fin.parties', order: 1, required: true },
    { clauseId: 'fin.validity', order: 2, required: true },
    { clauseId: 'fin.trial_period', order: 3, appliesWhen: { present: 'terms.trialPeriod' } },
    { clauseId: 'fin.working_hours', order: 4, required: true },
    {
      clauseId: 'fin.sunday_work',
      order: 5,
      appliesWhen: { in: ['schedule.scheduleType', ['shiftwork', 'shiftwork_with_night']] },
    },
    { clauseId: 'fin.duties', order: 6, required: true },
    { clauseId: 'fin.compensation', order: 7, required: true },
    { clauseId: 'fin.annual_leave', order: 8, required: true },
    { clauseId: 'fin.notice_period', order: 9, required: true },
    {
      clauseId: 'fin.cba_binding',
      order: 10,
      appliesWhen: { eq: ['flags.cbaApplicable', true] },
      required: true,
    },
    { clauseId: 'fin.signature', order: 99, required: true },
  ],

  regulationAnchors: COMMON_ANCHORS,
};

export const FIN_ADDENDUM: JurisdictionRule = {
  country: 'FIN',
  docType: 'addendum',

  requiredFields: [
    'employee.fullName',
    'employer.legalName',
    'employer.signatory',
  ],

  validators: [
    {
      path: 'terms.trialPeriod',
      kind: 'max_trial_months',
      params: { max: 6 },
      appliesWhen: { present: 'terms.trialPeriod' },
      message: 'Trial period cap still applies if extended via addendum.',
    },
  ],

  clauses: [
    { clauseId: 'fin.addendum_recital', order: 1, required: true },
    { clauseId: 'fin.addendum_delta', order: 2, required: true },
    {
      clauseId: 'fin.cba_binding',
      order: 3,
      appliesWhen: { eq: ['flags.cbaApplicable', true] },
    },
    { clauseId: 'fin.signature', order: 99, required: true },
  ],

  regulationAnchors: COMMON_ANCHORS,
};

export const FIN_TERMINATION_LETTER: JurisdictionRule = {
  country: 'FIN',
  docType: 'termination_letter',

  requiredFields: [
    'employee.fullName',
    'employer.legalName',
    'employer.signatory',
  ],

  validators: [
    {
      path: 'terms.noticePeriod',
      kind: 'min_trial_months',
      params: { ladder: 'fin_statutory' },
      message: 'Notice period must meet ECA Ch.6 §3 minimums tied to length of service.',
    },
  ],

  clauses: [
    { clauseId: 'fin.parties', order: 1, required: true },
    { clauseId: 'fin.termination_reason', order: 2, required: true },
    { clauseId: 'fin.notice_period', order: 3, required: true },
    { clauseId: 'fin.final_pay', order: 4, required: true },
    { clauseId: 'fin.rehire', order: 5 },
    { clauseId: 'fin.signature', order: 99, required: true },
  ],

  regulationAnchors: COMMON_ANCHORS,
};

export const FIN_RULES = [
  FIN_EMPLOYMENT_AGREEMENT,
  FIN_ADDENDUM,
  FIN_TERMINATION_LETTER,
];
