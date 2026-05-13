/**
 * Concrete LLM hooks for the compose pipeline.
 *
 * extractRecordUpdates — Haiku call that maps natural-language input
 * to a Partial<EmploymentRecord>. The system prompt declares the schema
 * shape; the user message is the specialist's prose plus any prior turns
 * for multi-turn context.
 *
 * fillFreeText — Opus call bounded by a clause's freeTextSlots[].instructions.
 * Returns plain prose, NOT JSON. Trimmed to maxChars when set.
 */
import {
  MODEL_HAIKU,
  MODEL_OPUS,
  cachedSystem,
  extractText,
  getLLMClient,
  parseJsonResponse,
} from '../anthropic';
import type { FieldDelta, LuminaDocument } from './document';
import type { EmploymentRecord } from './employment-record';

const EXTRACT_SYSTEM = `You are the extraction step for Lumina, an HR document automation system.

Your job is to map a specialist's natural-language description into structured updates to the EmploymentRecord schema. Output strict JSON conforming to the shape below. Omit any field you cannot extract with high confidence — do not invent.

Schema shape (omit fields you can't determine):

{
  "jurisdiction": {
    "country": "<ISO-3: FIN | USA | DEU | POL | AUS | SRB | GBR | ...>",
    "brand": "<wolt | doordash | deliveroo>"
  },
  "employee": {
    "fullName": "<string>",
    "dateOfBirth": "<YYYY-MM-DD>",
    "address": { "street": "...", "postalCode": "...", "city": "...", "country": "<ISO-3>" },
    "nationality": "<ISO-3>",
    "personalIdentifier": { "kind": "fi_henkilotunnus | us_ssn | uk_ni_number | de_steuer_id | au_tfn | pl_pesel | generic", "value": "...", "label": "<only if kind=generic>" },
    "email": "...",
    "phone": "..."
  },
  "employer": {
    "legalName": "...",
    "registrationId": { "kind": "fi_business_id | us_ein | de_handelsregister | au_abn | pl_nip | generic", "value": "..." },
    "registeredAddress": { ... },
    "signatory": { "name": "...", "title": "..." },
    "brand": "wolt | doordash | deliveroo"
  },
  "position": {
    "title": "...",
    "duties": ["...", "..."],
    "reportsTo": "...",
    "workLocation": { "kind": "fixed | hybrid | remote | multi_site", ... },
    "classification": { "tier": "operational | supervisor | specialist | manager | executive", "payGrade": "..." }
  },
  "terms": {
    "startDate": "<YYYY-MM-DD>",
    "termType": "indefinite | fixed_term | fixed_term_to_permanent",
    "endDate": "<YYYY-MM-DD>",
    "fixedTermReason": "...",
    "trialPeriod": { "months": <number> },
    "noticePeriod": { "source": "statutory | cba | contract", "days": <number> }
  },
  "schedule": {
    "averageWeeklyHours": <number>,
    "scheduleType": "standard | shiftwork | shiftwork_with_night | on_call | part_time",
    "sundayWorkConsent": <bool>,
    "overtimeAllowed": <bool>
  },
  "compensation": {
    "structure": "hourly | monthly_fixed | annual_fixed | commission | mixed",
    "base": { "amount": <number>, "currency": "EUR | USD | GBP | AUD | PLN | ..." },
    "payGrade": "...",
    "payFrequency": "weekly | bi_weekly | monthly | annual"
  },
  "flags": {
    "cbaApplicable": <bool>,
    "cbaName": "...",
    "sponsorshipRequired": <bool>,
    "rightToWorkVerified": <bool>
  }
}

Brand-country defaults: wolt → FIN, doordash → USA, deliveroo → GBR. Apply when the specialist names one but not the other.

Critical rules:
1. NEVER invent values. Omit any field not clearly stated or strongly implied.
2. Currency must match the country's reasonable default (EUR for FIN/DEU/POL, USD for USA, GBP for GBR, AUD for AUS). If the user names a different currency, use what they said.
3. ISO-3 country codes only. ISO 8601 dates only. Currencies as their 3-letter ISO codes.
4. Output only JSON. No prose, no fences.`;

export async function extractRecordUpdates(
  message: string,
  existing: EmploymentRecord | null,
  history?: Array<{ role: 'user' | 'assistant'; content: string }>
): Promise<Partial<EmploymentRecord>> {
  const client = getLLMClient();

  // Pass the existing record (if any) as context so the model can extract DELTAS
  // rather than re-extracting everything. Useful for slot-asking turns.
  const userPrompt = existing
    ? `Existing record context:\n${JSON.stringify(existing, null, 2)}\n\nUpdate from specialist:\n${message}`
    : message;

  const resp = await client.chat.completions.create({
    model: MODEL_HAIKU,
    max_tokens: 2048,
    messages: [
      { role: 'system', content: cachedSystem([EXTRACT_SYSTEM]) },
      ...(history ?? []).map((h) => ({ role: h.role as 'user' | 'assistant', content: h.content })),
      { role: 'user', content: userPrompt },
    ],
  });

  try {
    const out = parseJsonResponse<Partial<EmploymentRecord>>(extractText(resp));
    return pruneEmpty(out);
  } catch {
    return {};
  }
}

/**
 * Free-text fill — Opus, bounded by the slot's instructions. The clause
 * itself provides the legal frame; this only fills the marked free-text
 * blank (e.g., the duties bullet list).
 */
export async function fillFreeText(
  instructions: string,
  record: EmploymentRecord,
  document: LuminaDocument,
  maxChars?: number
): Promise<string> {
  const client = getLLMClient();

  const system = `You are a drafting step in Lumina. Fill the requested free-text slot inside a legal clause.

Constraints:
- Follow the slot instructions exactly. Do NOT add commentary, headings, or framing.
- Stay strictly within the slot's scope. The surrounding clause provides the legal frame; you only fill the marked blank.
- Use plain, neutral, analytical language. No marketing tone.
- ${maxChars ? `Maximum ${maxChars} characters.` : 'Be concise.'}
- Output only the slot text, no JSON, no fences, no preamble.`;

  const userPrompt = `Slot instructions:\n${instructions}\n\nRecord context:\n${JSON.stringify(
    record,
    null,
    2
  )}\n\nDocument context:\n${JSON.stringify(document, null, 2)}`;

  const resp = await client.chat.completions.create({
    model: MODEL_OPUS,
    max_tokens: 2048,
    messages: [
      { role: 'system', content: cachedSystem([system]) },
      { role: 'user', content: userPrompt },
    ],
  });

  const text = extractText(resp).trim();
  if (maxChars && text.length > maxChars) {
    return text.slice(0, maxChars).trimEnd() + '…';
  }
  return text;
}

/* ── delta extraction (for addendums) ─────────────────────────────────── */

const SUBJECT_SYSTEM = `You are an extraction step. Given a natural-language HR request, identify the SUBJECT employee — the person the request is about.

Examples:
  "Reduce Aino's hours from 37.5 to 30" → { "subjectName": "Aino" }
  "Promote Jamie Park to Senior Staff" → { "subjectName": "Jamie Park" }
  "We need a new hire for the Helsinki team" → { "subjectName": null }
  "Sample Employee B is moving to a different role" → { "subjectName": "Sample Employee B" }

Output strict JSON: { "subjectName": "<name or null>" }
Only return the name. No prose, no fences.`;

/**
 * Identify the subject employee from a natural-language addendum/termination
 * request. Returns null when the request is about a new hire or unclear.
 */
export async function identifySubjectEmployee(message: string): Promise<string | null> {
  const client = getLLMClient();
  const resp = await client.chat.completions.create({
    model: MODEL_HAIKU,
    max_tokens: 256,
    messages: [
      { role: 'system', content: cachedSystem([SUBJECT_SYSTEM]) },
      { role: 'user', content: message },
    ],
  });
  try {
    const parsed = parseJsonResponse<{ subjectName: string | null }>(extractText(resp));
    return parsed.subjectName ?? null;
  } catch {
    return null;
  }
}

const DELTA_SYSTEM = `You are an extraction step. Given a specialist's natural-language change request and the employee's existing record, identify the field-level changes to be made.

Output strict JSON, an array of FieldDelta objects:

[
  {
    "path": "<dot path into EmploymentRecord, e.g. 'schedule.averageWeeklyHours' or 'compensation.base.amount' or 'position.title'>",
    "before": <previous value, from the existing record>,
    "after": <new value, from the request>,
    "effectiveDate": "<YYYY-MM-DD, or empty if not specified>",
    "reason": "<short reason, optional>"
  }
]

Common paths:
- schedule.averageWeeklyHours        (hours change)
- compensation.base.amount           (salary change)
- compensation.payFrequency          (pay frequency change)
- compensation.structure             (pay structure: hourly → salary, etc.)
- terms.termType                     (e.g. fixed_term → indefinite)
- terms.endDate                      (extending or removing a fixed-term end)
- position.title                     (role change)
- position.workLocation              (relocation)

Rules:
1. ONLY include fields actually changing in this request. If the request says "reduce hours," produce only the hours delta.
2. The "before" value comes from the existing record (which you'll see in the user message). If unknown, omit "before".
3. The "after" value comes from the request.
4. Use ISO 8601 (YYYY-MM-DD) for effectiveDate. If the request says "next month," resolve to the first day of next month relative to today.
5. NEVER invent changes. If the request is ambiguous, return an empty array [].
6. Output only JSON. No prose, no fences.`;

export async function extractDeltas(
  message: string,
  existingRecord: EmploymentRecord
): Promise<FieldDelta[]> {
  const client = getLLMClient();
  const today = new Date().toISOString().slice(0, 10);
  const userPrompt = `Today's date: ${today}\n\nExisting record:\n${JSON.stringify(
    existingRecord,
    null,
    2
  )}\n\nChange request:\n${message}`;

  const resp = await client.chat.completions.create({
    model: MODEL_HAIKU,
    max_tokens: 1024,
    messages: [
      { role: 'system', content: cachedSystem([DELTA_SYSTEM]) },
      { role: 'user', content: userPrompt },
    ],
  });
  try {
    const parsed = parseJsonResponse<FieldDelta[]>(extractText(resp));
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/* ── helpers ──────────────────────────────────────────────────────────── */

/**
 * Recursively drop empty objects, null, undefined, and empty strings from
 * the Haiku output. Keeps the partial record clean and prevents accidentally
 * overwriting valid fields with empty values during merge.
 */
function pruneEmpty<T>(obj: T): T {
  if (obj === null || obj === undefined) return obj;
  if (Array.isArray(obj)) {
    const filtered = obj.filter((v) => v !== null && v !== undefined && v !== '');
    return filtered as unknown as T;
  }
  if (typeof obj === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
      if (v === null || v === undefined || v === '') continue;
      if (typeof v === 'object' && !Array.isArray(v)) {
        const pruned = pruneEmpty(v);
        if (pruned && Object.keys(pruned).length > 0) out[k] = pruned;
      } else {
        out[k] = v;
      }
    }
    return out as T;
  }
  return obj;
}
