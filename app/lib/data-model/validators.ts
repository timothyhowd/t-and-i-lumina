/**
 * Validators — pure functions that check fields against jurisdiction rules.
 *
 * Each validator returns `null` if the field is valid, or a string describing
 * the failure if not. The compose pipeline aggregates these into
 * ValidationResult.invalid.
 *
 * Keep these small and dumb. Anything that needs context beyond the record
 * (e.g. "checking against statutory ladder by tenure") still lives here but
 * the lookup table comes from the jurisdiction rule's params.
 */
import type { EmploymentRecord } from './employment-record';
import type { FieldValidator } from './jurisdiction';
import { evaluateCondition } from './jurisdiction';

type ValidatorOutcome = { ok: true } | { ok: false; message: string };

const OK: ValidatorOutcome = { ok: true };

function readPath(record: EmploymentRecord, path: string): unknown {
  const segments = path.split('.');
  let cur: unknown = record;
  for (const seg of segments) {
    if (cur && typeof cur === 'object' && seg in (cur as object)) {
      cur = (cur as Record<string, unknown>)[seg];
    } else {
      return undefined;
    }
  }
  return cur;
}

/**
 * Top-level dispatch. `applies` decides whether the validator runs at all
 * (handles the `appliesWhen` condition). `check` runs the actual logic.
 */
export function runValidator(
  validator: FieldValidator,
  record: EmploymentRecord
): ValidatorOutcome {
  if (validator.appliesWhen && !evaluateCondition(validator.appliesWhen, record)) return OK;
  return check(validator, record);
}

function check(validator: FieldValidator, record: EmploymentRecord): ValidatorOutcome {
  const value = readPath(record, validator.path);
  const params = validator.params ?? {};
  const fail = (msg: string): ValidatorOutcome => ({
    ok: false,
    message: validator.message ?? msg,
  });

  switch (validator.kind) {
    case 'max_trial_months': {
      const max = Number(params.max ?? 0);
      const trial = value as { months?: number } | undefined;
      if (!trial) return OK; // absence is handled by presence checks elsewhere
      const months = Number(trial.months ?? 0);
      if (max > 0 && months > max) {
        return fail(`Trial period (${months} months) exceeds the ${max}-month cap.`);
      }
      return OK;
    }

    case 'min_trial_months': {
      const min = Number(params.min ?? 0);
      const trial = value as { months?: number } | undefined;
      if (!trial) return OK;
      const months = Number(trial.months ?? 0);
      if (min > 0 && months < min) {
        return fail(`Trial period (${months} months) below the ${min}-month minimum.`);
      }
      return OK;
    }

    case 'currency_must_be': {
      const required = params.currency as string | undefined;
      const money = value as { currency?: string } | undefined;
      if (!money || !required) return OK;
      if (money.currency !== required) {
        return fail(`Currency must be ${required} (got ${money.currency}).`);
      }
      return OK;
    }

    case 'identifier_format': {
      const allowedKinds = (params.kinds as string[] | undefined) ?? [];
      const identifier = value as { kind?: string } | undefined;
      if (!identifier) return OK;
      if (allowedKinds.length > 0 && !allowedKinds.includes(identifier.kind ?? '')) {
        return fail(
          `Identifier kind '${identifier.kind}' not allowed here. Expected one of: ${allowedKinds.join(', ')}.`
        );
      }
      return OK;
    }

    case 'min_weekly_hours': {
      const min = Number(params.min ?? 0);
      const hours = Number(value);
      if (!Number.isFinite(hours)) return OK;
      if (hours < min) return fail(`Weekly hours (${hours}) below minimum (${min}).`);
      return OK;
    }

    case 'max_weekly_hours': {
      const max = Number(params.max ?? 0);
      const hours = Number(value);
      if (!Number.isFinite(hours)) return OK;
      if (max > 0 && hours > max) return fail(`Weekly hours (${hours}) above maximum (${max}).`);
      return OK;
    }

    case 'required_when': {
      // The `appliesWhen` already gated us. Just check presence here.
      if (value === undefined || value === null || value === '') {
        return fail(`Required when this context applies.`);
      }
      return OK;
    }

    case 'enum_subset': {
      const allowed = (params.allowed as string[] | undefined) ?? [];
      if (value === undefined || value === null) return OK;
      if (!allowed.includes(String(value))) {
        return fail(`Value must be one of: ${allowed.join(', ')}.`);
      }
      return OK;
    }

    default: {
      // Unknown validator kind — skip rather than fail. Logged in dev.
      return OK;
    }
  }
}
