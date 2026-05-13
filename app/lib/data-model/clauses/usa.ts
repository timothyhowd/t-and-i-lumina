/**
 * USA — clause library (PoC scaffolding).
 *
 * Minimal viable clauses. Scaffolds the architecture's USA path. NOT
 * production-grade prose — every clause is `reviewStatus: 'unverified'`
 * and must be replaced with counsel-approved text before use.
 */
import type { Clause } from '../clauses';

const ANCHORS = {
  FLSA: { statute: 'Fair Labor Standards Act (29 U.S.C. §§ 201–219)', url: 'https://www.dol.gov/agencies/whd/flsa' },
  COBRA: { statute: 'Consolidated Omnibus Budget Reconciliation Act (COBRA, 29 U.S.C. §§ 1161–1169)' },
  ERISA: { statute: 'Employee Retirement Income Security Act (ERISA, 29 U.S.C. §§ 1001 et seq.)' },
};

const USA_PARTIES: Clause = {
  clauseId: 'usa.parties',
  jurisdiction: 'USA',
  topic: 'parties',
  applicableTo: ['employment_agreement', 'addendum', 'termination_letter'],
  body: `**To:** {{record.employee.fullName}}, {{record.employee.address.street}}, {{record.employee.address.city}}{{#if record.employee.address.region}}, {{record.employee.address.region}}{{/if}}{{#if record.employee.address.postalCode}} {{record.employee.address.postalCode}}{{/if}}

**From:** {{record.employer.legalName}}, {{record.employer.registeredAddress.street}}, {{record.employer.registeredAddress.city}}{{#if record.employer.registeredAddress.region}}, {{record.employer.registeredAddress.region}}{{/if}}{{#if record.employer.registeredAddress.postalCode}} {{record.employer.registeredAddress.postalCode}}{{/if}}`,
  citations: [],
  reviewStatus: 'unverified',
};

const USA_AT_WILL: Clause = {
  clauseId: 'usa.at_will',
  jurisdiction: 'USA',
  topic: 'validity',
  applicableTo: ['employment_agreement'],
  body: `## EMPLOYMENT IS AT WILL

Your employment with {{record.employer.legalName}} is "at-will," meaning that either you or the Company may terminate the employment relationship at any time, for any reason or no reason, with or without notice. Nothing in this letter or in any other communication, written or oral, will modify the at-will nature of your employment, except a writing signed by an authorized officer of the Company that explicitly does so.`,
  citations: [],
  reviewStatus: 'unverified',
};

const USA_AT_WILL_REAFFIRM: Clause = {
  clauseId: 'usa.at_will_reaffirmation',
  jurisdiction: 'USA',
  topic: 'validity',
  applicableTo: ['addendum'],
  body: `This addendum does not alter the at-will nature of your employment with {{record.employer.legalName}}.`,
  citations: [],
  reviewStatus: 'unverified',
};

const USA_OFFER_TERMS: Clause = {
  clauseId: 'usa.offer_terms',
  jurisdiction: 'USA',
  topic: 'validity',
  applicableTo: ['employment_agreement'],
  body: `## POSITION AND START DATE

Position: {{record.position.title}}
Start date: {{record.terms.startDate}}
Work location: {{#freeText "work_location_summary"}}{{/freeText}}`,
  citations: [],
  reviewStatus: 'unverified',
  freeTextSlots: [
    {
      name: 'work_location_summary',
      instructions: 'Describe the work location based on record.position.workLocation. One sentence. If kind=remote, say "Remote, with nominal address [city, state]". If kind=hybrid, name the primary city and note hybrid. If kind=fixed, give street and city.',
      maxChars: 200,
    },
  ],
};

const USA_DUTIES: Clause = {
  clauseId: 'usa.duties',
  jurisdiction: 'USA',
  topic: 'duties',
  applicableTo: ['employment_agreement'],
  body: `## DUTIES

In your role as {{record.position.title}}, your duties will include:

{{#freeText "duties_description"}}{{/freeText}}

The Company may modify your duties at any time, consistent with your role and experience.`,
  citations: [],
  reviewStatus: 'unverified',
  freeTextSlots: [
    {
      name: 'duties_description',
      instructions: 'Render record.position.duties as a hyphen-prefixed bullet list. Each bullet on its own line. Use neutral, professional language. Do not invent duties.',
      maxChars: 800,
    },
  ],
};

const USA_COMPENSATION: Clause = {
  clauseId: 'usa.compensation',
  jurisdiction: 'USA',
  topic: 'compensation',
  applicableTo: ['employment_agreement'],
  body: `## COMPENSATION

Your base compensation will be {{record.compensation.base.amount}} {{record.compensation.base.currency}} {{record.compensation.payFrequency}}, less applicable withholdings, paid on the Company's regular pay schedule.`,
  citations: [ANCHORS.FLSA],
  reviewStatus: 'unverified',
};

const USA_BENEFITS_SUMMARY: Clause = {
  clauseId: 'usa.benefits_summary',
  jurisdiction: 'USA',
  topic: 'compensation',
  applicableTo: ['employment_agreement'],
  body: `## BENEFITS

You will be eligible to participate in the Company's benefits programs (medical, dental, vision, 401(k), and other plans), subject to the terms and conditions of each plan. The Company reserves the right to modify or terminate benefit plans at any time.`,
  citations: [ANCHORS.ERISA],
  reviewStatus: 'unverified',
};

const USA_PIIA: Clause = {
  clauseId: 'usa.piia_reference',
  jurisdiction: 'USA',
  topic: 'confidentiality',
  applicableTo: ['employment_agreement'],
  body: `## CONFIDENTIALITY AND INVENTIONS

As a condition of employment, you will be required to sign the Company's Proprietary Information and Inventions Agreement (PIIA), provided separately. The PIIA governs confidentiality, intellectual-property assignment, and post-employment obligations.`,
  citations: [],
  reviewStatus: 'unverified',
};

const USA_SIGNATURE: Clause = {
  clauseId: 'usa.signature',
  jurisdiction: 'USA',
  topic: 'signature',
  applicableTo: ['employment_agreement', 'addendum', 'termination_letter'],
  body: `## SIGNATURES

Accepted and agreed:

\\
{{record.employee.fullName}}                          Date: _______________

For {{record.employer.legalName}}:
{{record.employer.signatory.name}}, {{record.employer.signatory.title}}    Date: _______________`,
  citations: [],
  reviewStatus: 'unverified',
};

const USA_ADDENDUM_RECITAL: Clause = {
  clauseId: 'usa.addendum_recital',
  jurisdiction: 'USA',
  topic: 'addendum_recital',
  applicableTo: ['addendum'],
  body: `## ADDENDUM TO EMPLOYMENT TERMS

This addendum modifies the existing employment terms between {{record.employer.legalName}} and {{record.employee.fullName}}. All other terms remain in effect.`,
  citations: [],
  reviewStatus: 'unverified',
};

const USA_ADDENDUM_DELTA: Clause = {
  clauseId: 'usa.addendum_delta',
  jurisdiction: 'USA',
  topic: 'addendum_delta',
  applicableTo: ['addendum'],
  body: `## CHANGES

{{#freeText "delta_summary"}}{{/freeText}}`,
  citations: [],
  reviewStatus: 'unverified',
  freeTextSlots: [
    {
      name: 'delta_summary',
      instructions: 'Render document.changes as a numbered list. State the field, previous value, new value, and effective date for each change. Use neutral, professional language.',
      maxChars: 1200,
    },
  ],
};

const USA_TERM_PARTIES: Clause = {
  clauseId: 'usa.termination_parties',
  jurisdiction: 'USA',
  topic: 'parties',
  applicableTo: ['termination_letter'],
  body: `**To:** {{record.employee.fullName}}
**From:** {{record.employer.legalName}}
**Re:** Separation of employment`,
  citations: [],
  reviewStatus: 'unverified',
};

const USA_TERM_REASON: Clause = {
  clauseId: 'usa.termination_reason',
  jurisdiction: 'USA',
  topic: 'termination_reason',
  applicableTo: ['termination_letter'],
  body: `## SEPARATION

Your employment with {{record.employer.legalName}} will end effective {{document.termination.lastWorkingDay}}. Reason: {{document.termination.reason}}.`,
  citations: [],
  reviewStatus: 'unverified',
};

const USA_TERM_FINAL_PAY: Clause = {
  clauseId: 'usa.final_pay',
  jurisdiction: 'USA',
  topic: 'final_pay',
  applicableTo: ['termination_letter'],
  body: `## FINAL PAY

You will receive your final paycheck on the Company's next regular pay date or earlier as required by applicable state law. The final paycheck will include unpaid base salary through {{document.termination.lastWorkingDay}} and any accrued, unused paid time off.`,
  citations: [ANCHORS.FLSA],
  reviewStatus: 'unverified',
};

const USA_TERM_COBRA: Clause = {
  clauseId: 'usa.cobra_notice',
  jurisdiction: 'USA',
  topic: 'final_pay',
  applicableTo: ['termination_letter'],
  body: `## HEALTH-PLAN CONTINUATION (COBRA)

You may be eligible to continue your group health coverage under COBRA. A separate COBRA election notice will be provided by the Company's benefits administrator.`,
  citations: [ANCHORS.COBRA],
  reviewStatus: 'unverified',
};

const USA_TERM_EQUITY: Clause = {
  clauseId: 'usa.equity_handling',
  jurisdiction: 'USA',
  topic: 'final_pay',
  applicableTo: ['termination_letter'],
  body: `## EQUITY

Any unvested equity will be forfeited as of {{document.termination.lastWorkingDay}}. Vested options, if any, may be exercised in accordance with the terms of the applicable equity-plan documents and grant agreements.`,
  citations: [],
  reviewStatus: 'unverified',
};

const USA_TERM_RETIREMENT: Clause = {
  clauseId: 'usa.retirement_handling',
  jurisdiction: 'USA',
  topic: 'final_pay',
  applicableTo: ['termination_letter'],
  body: `## 401(k) PLAN

Information regarding your 401(k) plan balance, distribution options, and rollover procedures will be provided separately by the plan administrator.`,
  citations: [ANCHORS.ERISA],
  reviewStatus: 'unverified',
};

export const USA_CLAUSES: Clause[] = [
  USA_PARTIES,
  USA_AT_WILL,
  USA_AT_WILL_REAFFIRM,
  USA_OFFER_TERMS,
  USA_DUTIES,
  USA_COMPENSATION,
  USA_BENEFITS_SUMMARY,
  USA_PIIA,
  USA_SIGNATURE,
  USA_ADDENDUM_RECITAL,
  USA_ADDENDUM_DELTA,
  USA_TERM_PARTIES,
  USA_TERM_REASON,
  USA_TERM_FINAL_PAY,
  USA_TERM_COBRA,
  USA_TERM_EQUITY,
  USA_TERM_RETIREMENT,
];
