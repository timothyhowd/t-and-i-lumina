/**
 * Worker lookup — mock Workday adapter.
 *
 * Translates the v1 mock Workday fixture into v2 EmploymentRecord shape.
 * This is the seam where, in production, a real Workday query would go.
 * For PoC, we read from `corpus/mock-systems/workday.json` and convert.
 *
 * The addendum flow needs this: when a specialist says "reduce Aino's
 * hours," we look up Aino's existing record so we can produce a delta
 * against it rather than asking the specialist to re-state everything.
 */
import path from 'node:path';
import { promises as fs } from 'node:fs';
import type { Brand, EmploymentRecord, ISOCountry, NationalIdentifier } from './employment-record';

type WorkdayWorker = {
  worker_id: string;
  personal: {
    full_legal_name: string;
    preferred_name?: string;
    date_of_birth?: string;
    home_address?: string;
  };
  position: {
    title: string;
    role_tier: string;
    manager_id?: string;
  };
  employment: {
    hire_date: string;
    term_type: string;
    end_date: string | null;
    trial_period_months: number | null;
  };
  location: { primary: string; type: string };
  compensation: {
    structure: string;
    pay_grade: string | null;
    base_pay: { amount: number; currency: string; frequency: string } | null;
    hourly_rate: { amount: number; currency: string } | null;
    monthly_eur: number | null;
  };
  legal_entity: {
    id: string;
    legal_name: string;
    business_id: string | null;
    registered_address: string;
  };
  schedule: {
    weekly_hours_avg: number;
    schedule_type: string;
  };
};

type WorkdayFixture = {
  workers: WorkdayWorker[];
};

let cache: WorkdayFixture | null = null;

async function loadWorkday(): Promise<WorkdayFixture> {
  if (cache) return cache;
  // Read from repo at runtime — server-only, so fs is fine.
  const p = path.join(process.cwd(), '..', 'corpus', 'mock-systems', 'workday.json');
  const fallback = path.join(process.cwd(), 'corpus', 'mock-systems', 'workday.json');
  const tryRead = async (q: string) => fs.readFile(q, 'utf8');
  let raw: string;
  try {
    raw = await tryRead(p);
  } catch {
    raw = await tryRead(fallback);
  }
  cache = JSON.parse(raw) as WorkdayFixture;
  return cache;
}

/**
 * Look up an existing worker by name. Matches by full name (case-insensitive)
 * or by any single token in the full name matching the query.
 * Returns the worker's record-shape, or null if no match.
 */
/**
 * Normalize a name for comparison: lowercase, strip diacritics (so "Mäkinen"
 * matches "Makinen"), collapse whitespace, strip apostrophes/punctuation.
 */
function normalizeName(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')   // combining diacritical marks
    .toLowerCase()
    .replace(/['’]s\b/g, '')           // possessive 's
    .replace(/[^a-z0-9\s]/g, ' ')      // collapse punctuation to space
    .replace(/\s+/g, ' ')
    .trim();
}

export async function findWorkerByName(query: string): Promise<EmploymentRecord | null> {
  const data = await loadWorkday();
  const q = normalizeName(query);
  if (!q) return null;

  // Exact full-name match first
  const exact = data.workers.find(
    (w) => normalizeName(w.personal.full_legal_name) === q
  );
  if (exact) return workerToRecord(exact);

  // All-tokens-present match — "Aino Makinen" matches "Aino Mäkinen",
  // "Aino" alone also matches.
  const partial = data.workers.find((w) => {
    const name = normalizeName(w.personal.full_legal_name);
    const queryTokens = q.split(/\s+/).filter(Boolean);
    return queryTokens.every((t) => name.includes(t));
  });
  if (partial) return workerToRecord(partial);

  return null;
}

function workerToRecord(w: WorkdayWorker): EmploymentRecord {
  const country = guessCountry(w);
  const brand = guessBrand(w);
  const homeAddress = parseAddress(w.personal.home_address ?? '', country);
  const employerAddress = parseAddress(w.legal_entity.registered_address, country);

  const baseAmount =
    w.compensation.base_pay?.amount ?? w.compensation.monthly_eur ?? w.compensation.hourly_rate?.amount ?? 0;
  const baseCurrency = (w.compensation.base_pay?.currency ?? w.compensation.hourly_rate?.currency ?? defaultCurrency(country)) as EmploymentRecord['compensation']['base']['currency'];
  const payFreq = (w.compensation.base_pay?.frequency ?? 'monthly') as EmploymentRecord['compensation']['payFrequency'];
  const structure = mapCompStructure(w.compensation.structure);
  const termType = mapTermType(w.employment.term_type);
  const scheduleType = mapScheduleType(w.schedule.schedule_type);

  return {
    recordId: w.worker_id,
    recordVersion: 1,
    jurisdiction: { country, brand },
    employee: {
      fullName: w.personal.full_legal_name,
      dateOfBirth: w.personal.date_of_birth ?? '',
      address: homeAddress,
    },
    employer: {
      legalName: w.legal_entity.legal_name,
      registrationId: businessIdFor(country, w.legal_entity.business_id ?? ''),
      registeredAddress: employerAddress,
      signatory: { name: 'Mikko Korhonen', title: 'Head of People' },
      brand,
    },
    position: {
      title: w.position.title,
      duties: [],
      workLocation: { kind: 'fixed', address: employerAddress },
      classification: {
        tier: mapRoleTier(w.position.role_tier),
        ...(w.compensation.pay_grade ? { payGrade: w.compensation.pay_grade } : {}),
      },
    },
    terms: {
      startDate: w.employment.hire_date,
      termType,
      ...(w.employment.end_date ? { endDate: w.employment.end_date } : {}),
      ...(w.employment.trial_period_months
        ? { trialPeriod: { months: w.employment.trial_period_months } }
        : {}),
    },
    schedule: {
      averageWeeklyHours: w.schedule.weekly_hours_avg,
      scheduleType,
    },
    compensation: {
      structure,
      base: { amount: baseAmount, currency: baseCurrency },
      ...(w.compensation.pay_grade ? { payGrade: w.compensation.pay_grade } : {}),
      payFrequency: payFreq,
    },
    flags: {},
    metadata: {
      createdAt: w.employment.hire_date + 'T00:00:00Z',
      updatedAt: new Date().toISOString(),
      createdBy: 'workday-mock',
      draftStatus: 'approved',
    },
  };
}

/* ── helpers ──────────────────────────────────────────────────────────── */

function guessCountry(w: WorkdayWorker): ISOCountry {
  const addr = (w.legal_entity.registered_address || '').toLowerCase();
  if (addr.includes('finland') || addr.includes('helsinki') || addr.includes('tampere')) return 'FIN';
  if (addr.includes('usa') || addr.includes('united states') || addr.includes('san francisco')) return 'USA';
  if (addr.includes('germany') || addr.includes('berlin') || addr.includes('munich')) return 'DEU';
  if (addr.includes('uk') || addr.includes('united kingdom') || addr.includes('london')) return 'GBR';
  return 'FIN';
}

function guessBrand(w: WorkdayWorker): Brand {
  const id = w.legal_entity.id.toLowerCase();
  if (id.includes('wolt')) return 'wolt';
  if (id.includes('doordash')) return 'doordash';
  if (id.includes('deliveroo')) return 'deliveroo';
  return 'wolt';
}

function parseAddress(raw: string, country: ISOCountry): EmploymentRecord['employee']['address'] {
  const parts = raw.split(',').map((p) => p.trim()).filter(Boolean);
  if (parts.length >= 3) {
    const [street, cityPostal, ...rest] = parts;
    // "00100 Helsinki" → postalCode "00100", city "Helsinki"
    const cityPostalParts = cityPostal.split(/\s+/);
    let postalCode = '';
    let city = cityPostal;
    if (/^\d{4,6}$/.test(cityPostalParts[0])) {
      postalCode = cityPostalParts[0];
      city = cityPostalParts.slice(1).join(' ');
    } else if (/^\d{4,6}$/.test(cityPostalParts[cityPostalParts.length - 1])) {
      postalCode = cityPostalParts[cityPostalParts.length - 1];
      city = cityPostalParts.slice(0, -1).join(' ');
    }
    return { street, postalCode, city, country, ...(rest.length > 1 ? { region: rest[0] } : {}) };
  }
  return { street: raw, postalCode: '', city: '', country };
}

function defaultCurrency(country: ISOCountry): EmploymentRecord['compensation']['base']['currency'] {
  switch (country) {
    case 'USA': return 'USD';
    case 'GBR': return 'GBP';
    case 'AUS': return 'AUD';
    case 'POL': return 'PLN';
    default: return 'EUR';
  }
}

function businessIdFor(country: ISOCountry, value: string): NationalIdentifier {
  if (country === 'FIN') return { kind: 'fi_business_id', value };
  if (country === 'USA') return { kind: 'us_ein', value };
  if (country === 'DEU') return { kind: 'de_handelsregister', value };
  return { kind: 'generic', label: 'registration_id', value };
}

function mapCompStructure(s: string): EmploymentRecord['compensation']['structure'] {
  if (s === 'hourly_paygrade') return 'hourly';
  if (s === 'monthly_fixed') return 'monthly_fixed';
  if (s === 'annual_fixed') return 'annual_fixed';
  return 'monthly_fixed';
}

function mapTermType(t: string): EmploymentRecord['terms']['termType'] {
  if (t === 'fixed_term') return 'fixed_term';
  if (t === 'fixed_term_to_permanent') return 'fixed_term_to_permanent';
  return 'indefinite';
}

function mapScheduleType(s: string): EmploymentRecord['schedule']['scheduleType'] {
  if (s.includes('night')) return 'shiftwork_with_night';
  if (s.includes('shiftwork')) return 'shiftwork';
  if (s === 'on_call') return 'on_call';
  if (s === 'part_time') return 'part_time';
  return 'standard';
}

function mapRoleTier(t: string): NonNullable<EmploymentRecord['position']['classification']>['tier'] {
  if (t === 'operational') return 'operational';
  if (t === 'supervisor') return 'supervisor';
  if (t === 'specialist') return 'specialist';
  if (t === 'manager') return 'manager';
  if (t === 'executive') return 'executive';
  return 'specialist';
}
