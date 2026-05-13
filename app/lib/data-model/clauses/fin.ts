/**
 * Finland — clause library (PoC samples).
 *
 * NOT for production. Clause bodies here are illustrative templates derived
 * from the corpus. Real production clauses must be authored or reviewed by
 * Finnish employment counsel before use.
 *
 * Placeholder syntax:
 *   {{record.path}}                       — resolves to a record field value
 *   {{#if record.path}}...{{/if}}         — conditional block
 *   {{#freeText "name"}}...{{/freeText}}  — Claude fills with guidance (see clause.freeTextSlots)
 */
import type { Clause } from '../clauses';

const ANCHORS = {
  ECA: {
    statute: 'Employment Contracts Act (Työsopimuslaki 55/2001)',
    url: 'https://www.finlex.fi/en/laki/kaannokset/2001/en20010055',
  },
  WHA: {
    statute: 'Working Hours Act (Työaikalaki 872/2019)',
    url: 'https://www.finlex.fi/en/laki/kaannokset/2019/en20190872',
  },
  AHA: {
    statute: 'Annual Holidays Act (Vuosilomalaki 162/2005)',
    url: 'https://www.finlex.fi/en/laki/kaannokset/2005/en20050162',
  },
};

const FIN_PARTIES: Clause = {
  clauseId: 'fin.parties',
  jurisdiction: 'FIN',
  topic: 'parties',
  applicableTo: ['employment_agreement', 'termination_letter'],
  body: `## 1. PARTIES

**Employer**
{{record.employer.legalName}} (Business ID {{record.employer.registrationId.value}})
{{record.employer.registeredAddress.street}}, {{record.employer.registeredAddress.postalCode}} {{record.employer.registeredAddress.city}}

**Employee**
{{record.employee.fullName}}
Born {{record.employee.dateOfBirth}}
{{record.employee.address.street}}, {{record.employee.address.postalCode}} {{record.employee.address.city}}`,
  citations: [{ ...ANCHORS.ECA, section: 'Ch.1 §3 (form and content)' }],
  reviewStatus: 'unverified',
};

const FIN_VALIDITY: Clause = {
  clauseId: 'fin.validity',
  jurisdiction: 'FIN',
  topic: 'validity',
  applicableTo: ['employment_agreement'],
  body: `## 2. VALIDITY OF THE EMPLOYMENT CONTRACT

{{#if record.terms.trialPeriod}}A trial period of {{record.terms.trialPeriod.months}} months applies, in accordance with Chapter 1 §4 of the Employment Contracts Act.{{/if}}

{{#if record.terms.termType.indefinite}}The employment relationship is valid until further notice and commences on {{record.terms.startDate}}.{{/if}}

{{#if record.terms.termType.fixed_term}}The employment relationship is a fixed-term contract commencing on {{record.terms.startDate}} and ending on {{record.terms.endDate}}. The justified reason for the fixed-term arrangement is: {{record.terms.fixedTermReason}}.{{/if}}`,
  citations: [{ ...ANCHORS.ECA, section: 'Ch.1 §3, §4' }],
  reviewStatus: 'unverified',
};

const FIN_TRIAL_PERIOD: Clause = {
  clauseId: 'fin.trial_period',
  jurisdiction: 'FIN',
  topic: 'trial_period',
  applicableTo: ['employment_agreement'],
  body: `During the trial period, either party may terminate the employment relationship without observing the period of notice, provided that the termination is not made on discriminatory or otherwise improper grounds (ECA Ch.1 §4).`,
  citations: [{ ...ANCHORS.ECA, section: 'Ch.1 §4' }],
  reviewStatus: 'unverified',
};

const FIN_WORKING_HOURS: Clause = {
  clauseId: 'fin.working_hours',
  jurisdiction: 'FIN',
  topic: 'working_hours',
  applicableTo: ['employment_agreement'],
  body: `## 3. WORKING HOURS

The Employee's average weekly working hours are {{record.schedule.averageWeeklyHours}} hours, organized according to a {{record.schedule.scheduleType}} schedule.

Working hours are governed by the Working Hours Act. The Employee agrees to perform additional work within the statutory limits, with remuneration paid in accordance with the applicable collective agreement.`,
  citations: [{ ...ANCHORS.WHA, section: '§5, §17 (regular working hours)' }],
  reviewStatus: 'unverified',
};

const FIN_SUNDAY_WORK: Clause = {
  clauseId: 'fin.sunday_work',
  jurisdiction: 'FIN',
  topic: 'sunday_work',
  applicableTo: ['employment_agreement'],
  body: `The Employee consents to Sunday work as defined in §17 of the Working Hours Act. Sunday work is remunerated at the rate established by the applicable collective agreement.`,
  citations: [{ ...ANCHORS.WHA, section: '§17 (Sunday work)' }],
  reviewStatus: 'unverified',
};

const FIN_DUTIES: Clause = {
  clauseId: 'fin.duties',
  jurisdiction: 'FIN',
  topic: 'duties',
  applicableTo: ['employment_agreement'],
  body: `## 4. DUTIES

The Employee is engaged as {{record.position.title}}. Duties include, among others:

{{#freeText "duties_description"}}{{/freeText}}

The Employer reserves the right to assign other duties consistent with the Employee's role and competence.`,
  citations: [],
  reviewStatus: 'unverified',
  freeTextSlots: [
    {
      name: 'duties_description',
      instructions:
        'Expand the duties list using the bullet points in record.position.duties. Use professional, neutral language. Each bullet on its own line, prefixed with a hyphen. Do not invent duties — only reformat what is given.',
      maxChars: 800,
    },
  ],
};

const FIN_COMPENSATION: Clause = {
  clauseId: 'fin.compensation',
  jurisdiction: 'FIN',
  topic: 'compensation',
  applicableTo: ['employment_agreement'],
  body: `## 5. REMUNERATION

The Employee's salary is {{record.compensation.base.amount}} {{record.compensation.base.currency}}, paid {{record.compensation.payFrequency}}{{#if record.compensation.payGrade}} (pay grade {{record.compensation.payGrade}}){{/if}}.

Salary is paid to a bank account designated by the Employee, in accordance with the Employer's prevailing salary-payment practice.`,
  citations: [],
  reviewStatus: 'unverified',
};

const FIN_ANNUAL_LEAVE: Clause = {
  clauseId: 'fin.annual_leave',
  jurisdiction: 'FIN',
  topic: 'annual_leave',
  applicableTo: ['employment_agreement'],
  body: `## 6. ANNUAL HOLIDAY

The annual holiday is governed by the Annual Holidays Act and the applicable collective agreement.`,
  citations: [{ ...ANCHORS.AHA }],
  reviewStatus: 'unverified',
};

const FIN_NOTICE_PERIOD: Clause = {
  clauseId: 'fin.notice_period',
  jurisdiction: 'FIN',
  topic: 'notice_period',
  applicableTo: ['employment_agreement', 'termination_letter'],
  body: `## 7. PERIOD OF NOTICE

The period of notice is governed by Chapter 6 §3 of the Employment Contracts Act and by the applicable collective agreement. The statutory minimum scales with length of service.`,
  citations: [{ ...ANCHORS.ECA, section: 'Ch.6 §3' }],
  reviewStatus: 'unverified',
};

const FIN_CBA_BINDING: Clause = {
  clauseId: 'fin.cba_binding',
  jurisdiction: 'FIN',
  topic: 'collective_agreement',
  applicableTo: ['employment_agreement', 'addendum', 'termination_letter'],
  body: `## 8. COLLECTIVE AGREEMENT

The collective agreement binding the Employer ({{record.flags.cbaName}}) and the prevailing law govern this employment relationship. Compliance with collective-agreement provisions on sick pay, annual holiday, working hours, and other terms continues after expiry until a successor agreement takes effect.`,
  citations: [{ ...ANCHORS.ECA, section: 'Ch.2 §7 (generally binding CBAs)' }],
  reviewStatus: 'unverified',
};

const FIN_SIGNATURE: Clause = {
  clauseId: 'fin.signature',
  jurisdiction: 'FIN',
  topic: 'signature',
  applicableTo: ['employment_agreement', 'addendum', 'termination_letter', 'employment_certificate', 'nda', 'warning_letter', 'travel_letter'],
  body: `## SIGNATURES

Place: _______________   Date: _______________

\\
Employee: _______________      Employer: _______________
{{record.employee.fullName}}      {{record.employer.signatory.name}}, {{record.employer.signatory.title}}`,
  citations: [],
  reviewStatus: 'unverified',
};

const FIN_ADDENDUM_RECITAL: Clause = {
  clauseId: 'fin.addendum_recital',
  jurisdiction: 'FIN',
  topic: 'addendum_recital',
  applicableTo: ['addendum'],
  body: `## ADDENDUM TO EMPLOYMENT AGREEMENT

This addendum modifies the employment agreement between {{record.employer.legalName}} and {{record.employee.fullName}}, effective {{document.changes.[0].effectiveDate}}. All terms of the original agreement not modified by this addendum remain in full force and effect.`,
  citations: [],
  reviewStatus: 'unverified',
};

const FIN_ADDENDUM_DELTA: Clause = {
  clauseId: 'fin.addendum_delta',
  jurisdiction: 'FIN',
  topic: 'addendum_delta',
  applicableTo: ['addendum'],
  body: `## CHANGES

{{#freeText "delta_summary"}}{{/freeText}}`,
  citations: [],
  reviewStatus: 'unverified',
  freeTextSlots: [
    {
      name: 'delta_summary',
      instructions:
        'Render document.changes as a numbered list. For each change, state the field being modified, the previous value, the new value, and the effective date. Use neutral legal-style language. Reference any statutory caps that constrain the change (e.g. Working Hours Act for hours changes).',
      maxChars: 1200,
    },
  ],
};

const FIN_TERMINATION_REASON: Clause = {
  clauseId: 'fin.termination_reason',
  jurisdiction: 'FIN',
  topic: 'termination_reason',
  applicableTo: ['termination_letter'],
  body: `## TERMINATION

The employment relationship is terminated for the following reason: {{document.termination.reason}}. Last working day: {{document.termination.lastWorkingDay}}. Notice was given on {{document.termination.noticeGivenOn}}.`,
  citations: [{ ...ANCHORS.ECA, section: 'Ch.7 (grounds for termination)' }],
  reviewStatus: 'unverified',
};

const FIN_FINAL_PAY: Clause = {
  clauseId: 'fin.final_pay',
  jurisdiction: 'FIN',
  topic: 'final_pay',
  applicableTo: ['termination_letter'],
  body: `## FINAL PAY

Final pay, including any accrued annual leave payout, will be paid on the next regular pay date following the last working day.`,
  citations: [{ ...ANCHORS.AHA, section: '§17 (compensation for unused holiday)' }],
  reviewStatus: 'unverified',
};

const FIN_REHIRE: Clause = {
  clauseId: 'fin.rehire',
  jurisdiction: 'FIN',
  topic: 'rehire',
  applicableTo: ['termination_letter'],
  body: `Where the termination is on grounds of redundancy, the Employer's reemployment obligation under ECA Ch.6 §6 applies for the statutory period.`,
  citations: [{ ...ANCHORS.ECA, section: 'Ch.6 §6 (reemployment obligation)' }],
  reviewStatus: 'unverified',
};

export const FIN_CLAUSES: Clause[] = [
  FIN_PARTIES,
  FIN_VALIDITY,
  FIN_TRIAL_PERIOD,
  FIN_WORKING_HOURS,
  FIN_SUNDAY_WORK,
  FIN_DUTIES,
  FIN_COMPENSATION,
  FIN_ANNUAL_LEAVE,
  FIN_NOTICE_PERIOD,
  FIN_CBA_BINDING,
  FIN_SIGNATURE,
  FIN_ADDENDUM_RECITAL,
  FIN_ADDENDUM_DELTA,
  FIN_TERMINATION_REASON,
  FIN_FINAL_PAY,
  FIN_REHIRE,
];
