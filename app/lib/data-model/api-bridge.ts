/**
 * Bridge between v2 compose() and the v1 /api/chat response shapes.
 *
 * Goal: keep the frontend contract identical so v2 can be flipped on without
 * any client-side changes. The frontend renders `needs_input` and `draft`
 * shapes; we translate compose() outcomes into those.
 */
import type { ComposeOutcome } from './compose';
import type { LuminaDocument } from './document';
import type { Brand, DocumentType, EmploymentRecord, ISOCountry } from './employment-record';
import type { ValidationResult } from './jurisdiction';

/* ── intent → document skeleton ───────────────────────────────────────── */

/**
 * Build a minimal LuminaDocument from the routed intent. For doc types
 * whose payload is essentially just basedOn, this is trivial. For
 * addendums/terminations, we stub the payload — populating the rich payload
 * (deltas, termination reason, etc.) is a v2.1 concern once those flows
 * are wired into the chat UI.
 */
export function buildDocumentFromIntent(intent: {
  docType: DocumentType;
}): LuminaDocument {
  const basedOn = { recordId: 'pending', recordVersion: 1 };
  switch (intent.docType) {
    case 'employment_agreement':
      return { documentType: 'employment_agreement', basedOn };
    case 'addendum':
      return { documentType: 'addendum', basedOn, changes: [] };
    case 'termination_letter':
      return {
        documentType: 'termination_letter',
        basedOn,
        termination: {
          reason: 'mutual',
          lastWorkingDay: '',
          noticeGivenOn: '',
        },
      };
    case 'warning_letter':
      return {
        documentType: 'warning_letter',
        basedOn,
        warning: {
          level: 'written_first',
          issueDescription: '',
          correctiveActionExpected: '',
        },
      };
    case 'employment_certificate':
      return { documentType: 'employment_certificate', basedOn };
    case 'nda':
      return { documentType: 'nda', basedOn, nda: { scope: 'general' } };
    case 'travel_letter':
      return {
        documentType: 'travel_letter',
        basedOn,
        travel: {
          destination: { street: '', postalCode: '', city: '', country: 'FIN' },
          purpose: '',
          dateRange: { from: '', to: '' },
          visaSupportRequested: false,
        },
      };
  }
}

/* ── intent → starting record (seed for first turn) ───────────────────── */

/**
 * Build a seed EmploymentRecord from intent. Fields the user didn't supply
 * are left blank/sensible-defaulted — validate() will surface what's missing.
 */
export function seedRecordFromIntent(
  intent: { country: ISOCountry; brand: Brand },
  specialistId: string
): EmploymentRecord {
  const now = new Date().toISOString();
  const blankAddress = { street: '', postalCode: '', city: '', country: intent.country };
  return {
    recordId: `rec_${Math.random().toString(36).slice(2, 12)}`,
    recordVersion: 1,
    jurisdiction: { country: intent.country, brand: intent.brand },
    employee: {
      fullName: '',
      dateOfBirth: '',
      address: blankAddress,
    },
    employer: {
      legalName: '',
      registrationId: { kind: 'generic', label: '', value: '' },
      registeredAddress: blankAddress,
      signatory: { name: '', title: '' },
      brand: intent.brand,
    },
    position: {
      title: '',
      duties: [],
      workLocation: { kind: 'fixed', address: blankAddress },
    },
    terms: {
      startDate: '',
      termType: 'indefinite',
    },
    schedule: {
      averageWeeklyHours: 37.5,
      scheduleType: 'standard',
    },
    compensation: {
      structure: 'monthly_fixed',
      base: { amount: 0, currency: defaultCurrency(intent.country) },
      payFrequency: 'monthly',
    },
    flags: {},
    metadata: {
      createdAt: now,
      updatedAt: now,
      createdBy: specialistId,
      draftStatus: 'draft',
    },
  };
}

function defaultCurrency(country: ISOCountry): EmploymentRecord['compensation']['base']['currency'] {
  switch (country) {
    case 'USA': return 'USD';
    case 'GBR': return 'GBP';
    case 'AUS': return 'AUD';
    case 'POL': return 'PLN';
    case 'CZE': return 'CZK';
    case 'DNK': return 'DKK';
    case 'SWE': return 'SEK';
    case 'NOR': return 'NOK';
    case 'HUN': return 'HUF';
    case 'ROU': return 'RON';
    case 'BRA': return 'BRL';
    case 'JPN': return 'JPY';
    case 'IND': return 'INR';
    default: return 'EUR';
  }
}

/* ── compose outcome → v1 chat response ───────────────────────────────── */

type V1NeedsInput = {
  kind: 'needs_input';
  intent: { country: string; brand: string; docType: string; understoodAs: string; routingContext: Record<string, unknown> };
  templateId: string;
  templateVersion: string;
  applicableClauseGroups: string[];
  filled: Array<{ slot: string; value: unknown; source: string; confidence: number }>;
  missing: Array<{ slot: string; reason: string; askPrompt: string }>;
};

type V1Draft = {
  kind: 'draft';
  intent: { country: string; brand: string; docType: string; understoodAs: string; routingContext: Record<string, unknown> };
  filled: Array<{ slot: string; value: unknown; source: string; confidence: number }>;
  documentId: string;
  watermark: string;
  draft: string;
  citationsBlock: string;
  provenance: Record<string, unknown>;
};

export function translateOutcome(
  outcome: ComposeOutcome,
  context: {
    intentEcho: { country: string; brand: string; docType: string; understoodAs: string; routingContext: Record<string, unknown> };
    specialistId: string;
  }
): V1NeedsInput | V1Draft {
  if (outcome.kind === 'needs_input') {
    return {
      kind: 'needs_input',
      intent: context.intentEcho,
      templateId: `v2.${outcome.record.jurisdiction.country.toLowerCase()}.${context.intentEcho.docType}`,
      templateVersion: `r${outcome.record.recordVersion}`,
      applicableClauseGroups: [],
      filled: flattenRecord(outcome.record),
      missing: missingFromValidation(outcome.validation),
    };
  }

  const now = new Date().toISOString();
  return {
    kind: 'draft',
    intent: context.intentEcho,
    filled: flattenRecord(outcome.record),
    documentId: outcome.record.recordId,
    watermark: `LUMINA v2 PROTOTYPE — NOT FOR EXECUTION — ${now}`,
    draft: outcome.body,
    citationsBlock: `\n\n---\n\n${outcome.citations}\n\nClauses used: ${outcome.usedClauses.join(', ')}`,
    provenance: {
      documentId: outcome.record.recordId,
      recordVersion: outcome.record.recordVersion,
      jurisdiction: outcome.record.jurisdiction,
      clausesUsed: outcome.usedClauses,
      generatedAt: now,
      specialistId: context.specialistId,
      pocMode: true,
      schemaVersion: 'v2',
    },
  };
}

/* ── helpers ──────────────────────────────────────────────────────────── */

/**
 * Flatten an EmploymentRecord into v1-shape `filled` rows.
 * Maps the v2 dot-paths back to v1 slot names where the frontend has labels
 * for them (see SLOT_LABELS in ChatBits.tsx). Skips empty values.
 */
function flattenRecord(
  record: EmploymentRecord
): Array<{ slot: string; value: unknown; source: string; confidence: number }> {
  const out: Array<{ slot: string; value: unknown; source: string; confidence: number }> = [];
  const push = (slot: string, value: unknown) => {
    if (value === undefined || value === null || value === '') return;
    out.push({ slot, value, source: 'specialist_input', confidence: 1 });
  };

  push('employee.full_name', record.employee.fullName);
  push('employee.address', formatAddress(record.employee.address));
  push('employee.date_of_birth', record.employee.dateOfBirth);
  push('role.title', record.position.title);
  push('employment.start_date', record.terms.startDate);
  push('employment.fixed_term_end_date', record.terms.endDate);
  push('employment.term_type', record.terms.termType);
  if (record.compensation.structure === 'monthly_fixed') {
    push('compensation.monthly_eur', record.compensation.base.amount);
  } else if (record.compensation.structure === 'hourly') {
    push('compensation.hourly_rate_eur', record.compensation.base.amount);
  }
  push('working_place', describeWorkLocation(record.position.workLocation));
  push('working_hours.average_weekly', record.schedule.averageWeeklyHours);
  if (record.flags.cbaName) push('collective_agreement.name', record.flags.cbaName);
  if (record.terms.trialPeriod) push('trial_period.months', record.terms.trialPeriod.months);

  return out;
}

function formatAddress(a: EmploymentRecord['employee']['address']): string {
  if (!a.street && !a.city) return '';
  return [a.street, a.postalCode, a.city].filter(Boolean).join(', ');
}

function describeWorkLocation(loc: EmploymentRecord['position']['workLocation'] | undefined): string {
  if (!loc) return '';
  // Defensive: Haiku sometimes returns an unsmurfed object without the kind discriminator.
  // Try to recover from common shapes before giving up.
  if (!('kind' in loc)) {
    const generic = loc as Record<string, unknown>;
    if (typeof generic.city === 'string') return generic.city;
    if (typeof generic.primary === 'object' && generic.primary && 'city' in (generic.primary as object)) {
      return String((generic.primary as { city?: unknown }).city ?? 'on-site');
    }
    return '';
  }
  switch (loc.kind) {
    case 'fixed': return loc.address?.city || 'on-site';
    case 'hybrid': return `${loc.primary?.city ?? ''} (hybrid)`.trim();
    case 'remote': return 'remote';
    case 'multi_site': return `${loc.sites?.length ?? 0} sites`;
    default: return '';
  }
}

function missingFromValidation(
  v: ValidationResult
): Array<{ slot: string; reason: string; askPrompt: string }> {
  const out: Array<{ slot: string; reason: string; askPrompt: string }> = [];
  for (const m of v.missing) {
    out.push({
      slot: pathToSlotName(m.path),
      reason: 'required_by_jurisdiction',
      askPrompt: friendlyAsk(m.path, m.message),
    });
  }
  for (const inv of v.invalid) {
    out.push({
      slot: pathToSlotName(inv.path),
      reason: `invalid_${inv.validator}`,
      askPrompt: friendlyAsk(inv.path, inv.message),
    });
  }
  return out;
}

function pathToSlotName(path: string): string {
  // employee.fullName → employee.full_name to align with v1 slot label map
  return path
    .replace(/([A-Z])/g, '_$1')
    .toLowerCase()
    .replace('terms.', 'employment.')
    .replace('position.', 'role.');
}

function friendlyAsk(path: string, fallback: string): string {
  const friendly: Record<string, string> = {
    'employee.fullName': "What's the employee's full name?",
    'employee.dateOfBirth': "What's the employee's date of birth?",
    'employee.address': "What's the employee's home address?",
    'employee.personalIdentifier': "What's the employee's personal identifier (e.g., Finnish henkilötunnus)?",
    'employer.legalName': 'Which legal entity is the employer?',
    'employer.signatory': "Who signs on the employer's behalf — name and title?",
    'position.title': "What's the role title?",
    'position.duties': 'What are the main duties? A short bullet list is fine.',
    'position.workLocation': "Where will they work? City or address.",
    'terms.startDate': "What's the start date?",
    'terms.endDate': "What's the end date of the fixed-term?",
    'terms.fixedTermReason': "What's the documented reason for the fixed-term arrangement?",
    'schedule.averageWeeklyHours': 'How many hours per week on average?',
    'schedule.sundayWorkConsent': 'Will the role include Sunday work? Yes or no.',
    'compensation.base': "What's the salary amount and currency?",
    'compensation.structure': 'Is compensation hourly, monthly salary, or annual salary?',
  };
  return friendly[path] ?? fallback;
}
