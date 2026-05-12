/**
 * Agent 2 — Data Collection.
 *
 * Responsibilities (per docs/agent-architecture.md):
 *   - Given a slot schema and routing context, fulfill slots from
 *     connected systems (mocked Greenhouse + Workday for PoC).
 *   - Evaluate `requiredIf` conditions before declaring a slot "missing".
 *   - Batch missing-data asks (return all at once, don't iterate).
 *   - Never auto-fetch sensitive slots — always route to specialist.
 *
 * For PoC, "connected systems" are JSON fixtures in corpus/mock-systems/.
 */
import type { CorpusTemplate } from '../corpus';
import {
  findCandidateById,
  findWorkerByCandidate,
  getLegalEntities,
} from '../mock-systems';

export type CollectDataInput = {
  slotSchema: CorpusTemplate['slots'];
  routingContext: Record<string, unknown>;
  /** Greenhouse candidate ID or null. */
  candidateRef: string | null;
  /** Anything the specialist already provided. */
  knownContext: Record<string, unknown>;
};

export type FilledSlot = {
  slot: string;
  value: unknown;
  source: 'greenhouse' | 'workday' | 'specialist_input' | 'derived';
  confidence: number;
};

export type MissingSlot = {
  slot: string;
  reason: 'not_in_systems' | 'low_confidence' | 'requires_specialist' | 'sensitive_pii';
  askPrompt: string;
};

export type CollectDataResult = {
  filled: FilledSlot[];
  missing: MissingSlot[];
  /** Slots Agent 2 thinks we should also be collecting; not in current schema. */
  suggested: Array<{ slot: string; rationale: string }>;
};

export async function collectData(input: CollectDataInput): Promise<CollectDataResult> {
  const { slotSchema, routingContext, candidateRef, knownContext } = input;

  // Pull source data
  const candidate = candidateRef ? await findCandidateById(candidateRef) : null;
  const worker = candidateRef ? await findWorkerByCandidate(candidateRef) : null;
  const legalEntities = await getLegalEntities();

  // Combined context: routing keys + already-known values from specialist input
  const fullContext: Record<string, unknown> = { ...routingContext, ...knownContext };

  const filled: FilledSlot[] = [];
  const missing: MissingSlot[] = [];

  for (const slot of slotSchema) {
    // Skip slots whose `requiredIf` condition is not satisfied (slot doesn't apply)
    if (slot.requiredIf && !isRequiredByCondition(slot.requiredIf, fullContext)) {
      continue;
    }

    // A slot is required-now if either `required: true` OR a `requiredIf`
    // condition is satisfied for the current routing context.
    const isRequiredNow =
      slot.required ||
      (slot.requiredIf !== undefined && isRequiredByCondition(slot.requiredIf, fullContext));

    // Already provided by specialist?
    if (slot.key in knownContext) {
      filled.push({
        slot: slot.key,
        value: knownContext[slot.key],
        source: 'specialist_input',
        confidence: 1.0,
      });
      continue;
    }

    // Sensitive slots: never auto-fetch
    if (slot.sensitive) {
      if (isRequiredNow) {
        missing.push({
          slot: slot.key,
          reason: 'sensitive_pii',
          askPrompt: slot.askPrompt,
        });
      }
      continue;
    }

    // Try the source hint
    const fetched = await tryFetchFromSource(slot, candidate, worker, legalEntities, fullContext);
    if (fetched) {
      filled.push(fetched);
    } else if (slot.default !== undefined) {
      filled.push({
        slot: slot.key,
        value: slot.default,
        source: 'derived',
        confidence: 0.8,
      });
    } else if (isRequiredNow) {
      missing.push({
        slot: slot.key,
        reason:
          slot.sourceHint === 'specialist' ? 'requires_specialist' : 'not_in_systems',
        askPrompt: slot.askPrompt,
      });
    }
    // Non-required slots that aren't found are simply omitted, not flagged.
  }

  return { filled, missing, suggested: [] };
}

/**
 * Evaluates whether a slot is required given a `requiredIf` predicate.
 * Predicate format: `{ "key": expectedValue }` — all entries must match.
 */
function isRequiredByCondition(
  requiredIf: Record<string, unknown>,
  ctx: Record<string, unknown>
): boolean {
  for (const [key, expected] of Object.entries(requiredIf)) {
    if (ctx[key] !== expected) return false;
  }
  return true;
}

/**
 * Attempts to fulfill a slot from the configured source.
 * Returns null if the slot couldn't be filled — caller decides whether
 * that's missing-required or simply absent.
 */
async function tryFetchFromSource(
  slot: CorpusTemplate['slots'][number],
  candidate: Awaited<ReturnType<typeof findCandidateById>>,
  worker: Awaited<ReturnType<typeof findWorkerByCandidate>>,
  legalEntities: Awaited<ReturnType<typeof getLegalEntities>>,
  ctx: Record<string, unknown>
): Promise<FilledSlot | null> {
  const slotKey = slot.key;

  // Map slot keys to fetch logic. The mapping is intentionally explicit —
  // a dynamic "look up <key> in greenhouse" is a footgun for PII.
  switch (slotKey) {
    case 'employee.full_name': {
      if (worker) return mk(slotKey, worker.personal.full_legal_name, 'workday', 0.95);
      if (candidate) return mk(slotKey, `${candidate.first_name} ${candidate.last_name}`, 'greenhouse', 0.9);
      return null;
    }
    case 'employment.start_date': {
      if (worker) return mk(slotKey, worker.employment.hire_date, 'workday', 0.95);
      if (candidate) {
        const offer = candidate.applications[0]?.offers[0];
        if (offer) return mk(slotKey, offer.starts_at, 'greenhouse', 0.85);
      }
      return null;
    }
    case 'employment.fixed_term_end_date': {
      if (worker?.employment.end_date) return mk(slotKey, worker.employment.end_date, 'workday', 0.95);
      const offer = candidate?.applications[0]?.offers[0];
      if (offer?.ends_at) return mk(slotKey, offer.ends_at, 'greenhouse', 0.85);
      return null;
    }
    case 'role.title': {
      if (worker) return mk(slotKey, worker.position.title, 'workday', 0.95);
      if (candidate) {
        const job = candidate.applications[0]?.jobs[0];
        if (job) return mk(slotKey, job.name, 'greenhouse', 0.85);
      }
      return null;
    }
    case 'working_place': {
      if (worker) return mk(slotKey, worker.location.primary, 'workday', 0.95);
      if (candidate) {
        const office = candidate.applications[0]?.office;
        if (office) return mk(slotKey, office.name, 'greenhouse', 0.85);
      }
      return null;
    }
    case 'compensation.monthly_eur': {
      if (worker?.compensation.monthly_eur) {
        return mk(slotKey, worker.compensation.monthly_eur, 'workday', 0.95);
      }
      return null;
    }
    case 'compensation.hourly_rate_eur': {
      if (worker?.compensation.hourly_rate) {
        return mk(slotKey, worker.compensation.hourly_rate.amount, 'workday', 0.95);
      }
      return null;
    }
    case 'compensation.hourly_pay_grade': {
      if (worker?.compensation.pay_grade) {
        return mk(slotKey, worker.compensation.pay_grade, 'workday', 0.95);
      }
      return null;
    }
    case 'schedule.weekend_premium_percent': {
      if (worker?.schedule.weekend_premium_percent) {
        return mk(slotKey, worker.schedule.weekend_premium_percent, 'workday', 0.95);
      }
      return null;
    }
    case 'working_hours.average_weekly': {
      if (worker?.schedule.weekly_hours_avg) {
        return mk(slotKey, worker.schedule.weekly_hours_avg, 'workday', 0.95);
      }
      return null;
    }
    case 'collective_agreement.name': {
      // Derived: based on role tier + legal entity (PoC stub)
      const tier = ctx.roleTier;
      if (tier === 'operational') {
        return mk(slotKey, "Commercial sector's collective agreement (warehouse workers)", 'derived', 0.7);
      }
      if (tier === 'supervisor') {
        return mk(slotKey, 'Warehouse and Transportation Supervisors', 'derived', 0.7);
      }
      return null;
    }
    default:
      return null;
  }
}

function mk(slot: string, value: unknown, source: FilledSlot['source'], confidence: number): FilledSlot {
  return { slot, value, source, confidence };
}
