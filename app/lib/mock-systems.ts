/**
 * Mock systems loader — reads Greenhouse and Workday fixtures
 * from corpus/mock-systems/.
 *
 * Per docs/POC-LIMITATIONS.md: PoC does not call real HRIS APIs. These
 * fixtures are shaped like the real responses so the swap to production
 * is mechanical when API access lands.
 */
import { promises as fs } from 'node:fs';
import path from 'node:path';

const MOCK_DIR = path.join(process.cwd(), '..', 'corpus', 'mock-systems');

export type GreenhouseCandidate = {
  id: string;
  first_name: string;
  last_name: string;
  phone_numbers: Array<{ value: string; type: string }>;
  addresses: unknown[];
  email_addresses: Array<{ value: string; type: string }>;
  applications: Array<{
    id: string;
    candidate_id: string;
    status: string;
    applied_at: string;
    jobs: Array<{ id: string; name: string }>;
    office: { id: string; name: string; location: { name: string } };
    offers: Array<{
      id: string;
      status: string;
      starts_at: string;
      ends_at?: string;
      custom_fields: Record<string, unknown>;
    }>;
  }>;
};

export type WorkdayWorker = {
  worker_id: string;
  external_candidate_ref: string;
  personal: { full_legal_name: string; preferred_name: string };
  position: {
    id: string;
    title: string;
    role_tier: 'operational' | 'supervisor' | 'specialist';
    manager_id: string;
  };
  employment: {
    hire_date: string;
    term_type: 'indefinite' | 'fixed_term' | 'fixed_term_to_permanent';
    end_date: string | null;
    trial_period_months: number;
  };
  location: { primary: string; type: string };
  compensation: {
    structure: 'hourly_paygrade' | 'monthly_fixed';
    pay_grade: string | null;
    base_pay: { amount: number; currency: string; frequency: string } | null;
    hourly_rate: { amount: number; currency: string } | null;
    monthly_eur: number | null;
  };
  legal_entity: {
    id: string;
    legal_name: string;
    business_id: string;
    registered_address: string;
  };
  schedule: {
    weekly_hours_avg: number;
    schedule_type: string;
    weekend_premium_percent?: number;
  };
};

export type WorkdayLegalEntity = {
  id: string;
  brand: string;
  country: string;
  legal_name: string;
  business_id: string | null;
  registered_address: string | null;
  _note?: string;
};

let _gh: { candidates: GreenhouseCandidate[] } | null = null;
let _wd: { workers: WorkdayWorker[]; legal_entities: WorkdayLegalEntity[] } | null = null;

export async function getGreenhouseCandidates(): Promise<GreenhouseCandidate[]> {
  if (!_gh) {
    const raw = await fs.readFile(path.join(MOCK_DIR, 'greenhouse.json'), 'utf8');
    _gh = JSON.parse(raw);
  }
  return _gh!.candidates;
}

export async function getWorkdayWorkers(): Promise<WorkdayWorker[]> {
  if (!_wd) {
    const raw = await fs.readFile(path.join(MOCK_DIR, 'workday.json'), 'utf8');
    _wd = JSON.parse(raw);
  }
  return _wd!.workers;
}

export async function getLegalEntities(): Promise<WorkdayLegalEntity[]> {
  if (!_wd) {
    const raw = await fs.readFile(path.join(MOCK_DIR, 'workday.json'), 'utf8');
    _wd = JSON.parse(raw);
  }
  return _wd!.legal_entities;
}

export async function findWorkerByCandidate(candidateId: string): Promise<WorkdayWorker | null> {
  const workers = await getWorkdayWorkers();
  return workers.find((w) => w.external_candidate_ref === candidateId) ?? null;
}

export async function findCandidateById(id: string): Promise<GreenhouseCandidate | null> {
  const candidates = await getGreenhouseCandidates();
  return candidates.find((c) => c.id === id) ?? null;
}
