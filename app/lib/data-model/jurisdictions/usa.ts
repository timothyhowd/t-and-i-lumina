/**
 * USA — jurisdiction rules.
 *
 * Per the cross-document analysis (docs/cross-doc-analysis.md):
 *   - USA does not use European-style employment contracts. The Drive's
 *     "Employment Agreements" folder for USA contains pay-change letters,
 *     not standalone EAs. DoorDash typically uses at-will offer letters
 *     plus equity/401k/PIIA exhibits.
 *   - Termination letters include US-specific concerns: COBRA, HSA/FSA,
 *     equity vesting cutoff, 401(k) handling.
 *   - Few statutory citations in templates themselves; the relevant law
 *     (Fair Labor Standards Act, ERISA, COBRA, state-specific overlays)
 *     is referenced indirectly.
 *
 * Clauses below are scaffolding marked `unverified` — they cite real US
 * statutes (where statutes apply) but the prose is generic and must be
 * replaced with counsel-approved text before production use.
 */
import type { JurisdictionRule } from '../jurisdiction';

const USA_ANCHORS = [
  { statute: 'Fair Labor Standards Act (29 U.S.C. §§ 201–219)', url: 'https://www.dol.gov/agencies/whd/flsa' },
  { statute: 'Consolidated Omnibus Budget Reconciliation Act (COBRA, 29 U.S.C. §§ 1161–1169)' },
  { statute: 'Employee Retirement Income Security Act (ERISA, 29 U.S.C. §§ 1001 et seq.)' },
];

export const USA_EMPLOYMENT_AGREEMENT: JurisdictionRule = {
  country: 'USA',
  docType: 'employment_agreement',

  requiredFields: [
    'employee.fullName',
    'employee.address',
    'employer.legalName',
    'employer.signatory',
    'position.title',
    'position.duties',
    'position.workLocation',
    'terms.startDate',
    'compensation.structure',
    'compensation.base',
    'flags.rightToWorkVerified',
  ],

  validators: [
    {
      path: 'compensation.base',
      kind: 'currency_must_be',
      params: { currency: 'USD' },
      message: 'USA offer letters must be denominated in USD.',
    },
    {
      path: 'flags.rightToWorkVerified',
      kind: 'required_when',
      params: {},
      message: 'I-9 / right-to-work verification must be on file before extending an offer.',
    },
  ],

  clauses: [
    { clauseId: 'usa.parties', order: 1, required: true },
    { clauseId: 'usa.at_will', order: 2, required: true },
    { clauseId: 'usa.offer_terms', order: 3, required: true },
    { clauseId: 'usa.duties', order: 4, required: true },
    { clauseId: 'usa.compensation', order: 5, required: true },
    { clauseId: 'usa.benefits_summary', order: 6 },
    { clauseId: 'usa.piia_reference', order: 7, required: true },
    { clauseId: 'usa.signature', order: 99, required: true },
  ],

  regulationAnchors: USA_ANCHORS,
};

export const USA_ADDENDUM: JurisdictionRule = {
  country: 'USA',
  docType: 'addendum',

  requiredFields: ['employee.fullName', 'employer.legalName', 'employer.signatory'],

  validators: [],

  clauses: [
    { clauseId: 'usa.addendum_recital', order: 1, required: true },
    { clauseId: 'usa.addendum_delta', order: 2, required: true },
    { clauseId: 'usa.at_will_reaffirmation', order: 3, required: true },
    { clauseId: 'usa.signature', order: 99, required: true },
  ],

  regulationAnchors: USA_ANCHORS,
};

export const USA_TERMINATION_LETTER: JurisdictionRule = {
  country: 'USA',
  docType: 'termination_letter',

  requiredFields: [
    'employee.fullName',
    'employer.legalName',
    'employer.signatory',
  ],

  validators: [],

  clauses: [
    { clauseId: 'usa.termination_parties', order: 1, required: true },
    { clauseId: 'usa.termination_reason', order: 2, required: true },
    { clauseId: 'usa.final_pay', order: 3, required: true },
    { clauseId: 'usa.cobra_notice', order: 4 },
    { clauseId: 'usa.equity_handling', order: 5 },
    { clauseId: 'usa.retirement_handling', order: 6 },
    { clauseId: 'usa.signature', order: 99, required: true },
  ],

  regulationAnchors: USA_ANCHORS,
};

export const USA_RULES = [USA_EMPLOYMENT_AGREEMENT, USA_ADDENDUM, USA_TERMINATION_LETTER];
