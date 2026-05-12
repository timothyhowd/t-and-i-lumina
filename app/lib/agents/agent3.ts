/**
 * Agent 3 — Generate Documents.
 *
 * Owns the specialist conversation and orchestrates Agents 1 and 2.
 *
 * Routes LLM calls via DoorDash's Portkey gateway (OpenAI-compatible
 * chat-completions interface — see lib/anthropic.ts). Three jobs:
 *   1. Intent routing (Haiku) — natural language → routing context.
 *   2. Draft generation (Opus) — slot values + clause intents → text.
 *   3. Gap-bridging (Opus) — when the requested template doesn't
 *      exist, propose an adaptation from the closest match.
 *
 * Per docs/POC-LIMITATIONS.md:
 *   - All output is watermarked.
 *   - Provenance is recorded before any draft is shown.
 *   - Generation is blocked unless LUMINA_POC_MODE=true.
 */
import { assertPocMode } from '../poc-guard';
import {
  MODEL_HAIKU,
  MODEL_OPUS,
  cachedSystem,
  extractText,
  getLLMClient,
  parseJsonResponse,
} from '../anthropic';
import {
  corpusSnapshotId,
  newDocumentId,
  recordProvenance,
  type GenerationProvenance,
} from '../provenance';
import type { CorpusTemplate } from '../corpus';
import type { FilledSlot, MissingSlot } from './agent2';

// ── 1. Intent routing ───────────────────────────────────────────────────

export type RoutedIntent = {
  country: string;
  brand: string;
  docType: string;
  routingContext: Record<string, unknown>;
  /** A short echo of how we understood the request, for the chat UI. */
  understoodAs: string;
  /** When low confidence, the specialist should confirm before we act. */
  confidence: number;
};

const INTENT_SYSTEM = `You are the intent router for Lumina, an HR document automation system.

Given a specialist's natural-language request, extract the structured
routing parameters needed to select the right template.

Output strict JSON with this shape:

{
  "country": "<ISO-3 like FIN, USA, UK, BRA, DEU, etc.>",
  "brand": "<wolt | doordash | deliveroo>",
  "docType": "<employment_agreement | termination_letter | warning_letter | employment_certificate | nda | addendum | travel_letter>",
  "routingContext": {
    "termType": "<indefinite | fixed_term | fixed_term_to_permanent | null>",
    "roleTier": "<operational | supervisor | specialist | null>",
    "scheduleType": "<standard | shiftwork_excl_night | shiftwork_with_night | on_call | part_time | null>",
    "legalEntity": "<entity_id_if_known_or_null>",
    "compensationStructure": "<hourly_paygrade | monthly_fixed | null>"
  },
  "understoodAs": "<one-sentence echo of the request, plain English>",
  "confidence": <0..1>
}

Brand-country defaults: Wolt → FIN; DoorDash → USA; Deliveroo → UK.
If the specialist did not specify a brand but named a country, infer from
the brand-country defaults. Set fields to null if genuinely ambiguous.
Output only JSON. No prose, no fences.`;

export async function routeIntent(naturalLanguage: string): Promise<RoutedIntent> {
  const client = getLLMClient();
  const resp = await client.chat.completions.create({
    model: MODEL_HAIKU,
    max_tokens: 1024,
    messages: [
      { role: 'system', content: cachedSystem([INTENT_SYSTEM]) },
      { role: 'user', content: naturalLanguage },
    ],
  });
  return parseJsonResponse<RoutedIntent>(extractText(resp));
}

// ── 1b. Slot extraction (open-ended natural-language pre-fill) ──────────

/**
 * Pull any slot values the user front-loaded into their natural-language
 * description. Reduces the number of follow-up questions to only what's
 * truly missing.
 *
 * Example input:
 *   "Tim Howd lives at 48 Arrowwood St. We're offering him $500k/year."
 * Example output:
 *   { "employee.full_name": "Tim Howd",
 *     "employee.address": "48 Arrowwood St",
 *     "compensation.monthly_eur": null  // skipped — wrong currency for slot
 *   }
 */
const EXTRACT_SYSTEM = `You are an extraction step in Lumina, an HR document automation system.

The specialist described their need in plain English. The template their request maps to has the listed fields. Extract only the values you can identify with high confidence in the message.

Output strict JSON: { "<field.key>": <value>, ... }

Rules — these are non-negotiable:
1. NEVER invent values. If a field isn't clearly stated, omit it entirely.
2. Respect the field type. If type is "currency" and the user names a different currency than the field expects (per "validation.currency"), OMIT the field.
3. Respect "enum" / "allowedValues" — if the user's value doesn't match an allowed option, OMIT.
4. Use natural form for names ("Tim Howd"), full address strings ("48 Arrowwood Street, Helsinki").
5. Dates in ISO 8601 (YYYY-MM-DD) if explicit.
6. Skip "sensitive" fields unless the user explicitly stated the value — never guess.

Output only the JSON object. No prose, no fences, no markdown.`;

export async function extractSlots(
  message: string,
  slots: CorpusTemplate['slots']
): Promise<Record<string, unknown>> {
  const client = getLLMClient();
  const fieldsForPrompt = slots.map((s) => ({
    key: s.key,
    type: s.type,
    sensitive: s.sensitive ?? false,
    what: s.intentNote ?? s.askPrompt,
    ...(s.enum ? { allowedValues: s.enum } : {}),
    ...(s.validation ? { validation: s.validation } : {}),
  }));
  const userPrompt = JSON.stringify({ message, fields: fieldsForPrompt }, null, 2);
  const resp = await client.chat.completions.create({
    model: MODEL_HAIKU,
    max_tokens: 2048,
    messages: [
      { role: 'system', content: cachedSystem([EXTRACT_SYSTEM]) },
      { role: 'user', content: userPrompt },
    ],
  });
  try {
    const out = parseJsonResponse<Record<string, unknown>>(extractText(resp));
    // Drop nulls and empty strings — those signal "not extracted".
    return Object.fromEntries(
      Object.entries(out).filter(([, v]) => v !== null && v !== '' && v !== undefined)
    );
  } catch {
    return {};
  }
}

// ── 2. Draft generation ─────────────────────────────────────────────────

export type GenerateDraftInput = {
  template: CorpusTemplate;
  filled: FilledSlot[];
  missing: MissingSlot[];
  routingContext: Record<string, unknown>;
  applicableClauseGroups: string[];
  specialistId: string;
};

export type GenerateDraftOutput = {
  documentId: string;
  watermark: string;
  draft: string;
  citationsBlock: string;
  provenance: GenerationProvenance;
};

const GENERATION_SYSTEM = `You are the drafting engine for Lumina, an HR document automation system in PROOF-OF-CONCEPT phase.

You will be given:
- A template schema (slot definitions, clause-group intents, baseline sections — NO legal text).
- Filled slot values (real or fake — both are treated identically; this is a prototype).
- The list of applicable clause groups (derived from routing context).

Your job is to draft the document, section by section, using:
- The baseline sections in order.
- Each applicable clause group's "clauseIntents" as the description of what each clause should cover.
- The filled slots to fill in concrete values.

CRITICAL constraints — these are non-negotiable:
1. Every generated clause is a DRAFT only. Do not state or imply that any clause has been reviewed by counsel.
2. After every clause, append a citation marker in the form: \`[⚠ Citation pending legal review]\`.
3. Use plain, neutral, analytical legal-style language. No marketing tone.
4. If a slot value is missing or ambiguous, write \`[MISSING: <slot.key>]\` inline — do not invent a value.
5. Do NOT fabricate regulation citations. The post-clause marker above is the ONLY citation form allowed.
6. Format as plain Markdown, with section headings (\`## SECTION NAME\`) and numbered/bulleted clauses where the baseline structure indicates.

Output only the document body. Do not include preamble, watermark, or provenance — those are appended by the harness.`;

export async function generateDraft(input: GenerateDraftInput): Promise<GenerateDraftOutput> {
  assertPocMode();

  const documentId = newDocumentId();
  const generatedAt = new Date().toISOString();
  const corpusId = await corpusSnapshotId();

  const userPrompt = JSON.stringify(
    {
      template: {
        templateId: input.template.templateId,
        version: input.template.version,
        selectors: input.template.selectors,
        slots: input.template.slots,
        baselineSections: input.template.baselineSections,
        clauseGroups: input.template.clauseGroups.filter((g) =>
          input.applicableClauseGroups.includes(g.id)
        ),
      },
      filledSlots: Object.fromEntries(input.filled.map((s) => [s.slot, s.value])),
      missingSlots: input.missing.map((m) => m.slot),
      routingContext: input.routingContext,
    },
    null,
    2
  );

  const client = getLLMClient();
  const resp = await client.chat.completions.create({
    model: MODEL_OPUS,
    max_tokens: 8192,
    messages: [
      { role: 'system', content: cachedSystem([GENERATION_SYSTEM]) },
      { role: 'user', content: userPrompt },
    ],
  });

  const draftBody = extractText(resp);

  // Hard-coded watermark — per POC-LIMITATIONS.md, cannot be turned off.
  const watermark = `LUMINA PROTOTYPE — NOT FOR EXECUTION — ${generatedAt}`;

  const citationsBlock =
    `\n\n---\n\n## CITATIONS\n\n` +
    `Every clause in this draft is marked \`[⚠ Citation pending legal review]\`. ` +
    `No regulation references have been verified by counsel. ` +
    `See docs/POC-LIMITATIONS.md.\n`;

  const provenance: GenerationProvenance = {
    documentId,
    templateId: input.template.templateId,
    templateVersion: input.template.version,
    corpusSnapshotId: corpusId,
    regulationSnapshotId: null,
    generatedAt,
    specialistId: input.specialistId,
    pocMode: true,
  };
  await recordProvenance(provenance);

  return { documentId, watermark, draft: draftBody, citationsBlock, provenance };
}

// ── 3. Gap-bridging recommendation ──────────────────────────────────────

export type GapBridgeInput = {
  country: string;
  brand: string;
  docType: string;
  closestMatches: {
    sameDocTypeOtherCountries: Array<{ country: string; count: number }>;
    otherDocTypesSameCountry: Array<{ docType: string; count: number }>;
  };
};

export type GapBridgeRecommendation = {
  summary: string;
  options: Array<{
    kind: 'closest_country' | 'related_doc_type' | 'from_scratch' | 'request_template';
    description: string;
  }>;
};

const GAP_BRIDGE_SYSTEM = `You are the gap-analysis assistant for Lumina.

A specialist requested a document type for a country/brand combination
for which no template exists in the corpus. Your job is to propose 2–4
concrete options the specialist could take, given the closest-match
inventory provided.

Output strict JSON:

{
  "summary": "<one paragraph plain-English explanation of the gap>",
  "options": [
    {"kind": "closest_country | related_doc_type | from_scratch | request_template",
     "description": "<one to two sentence explanation, naming the specific country / doc-type / etc.>"}
  ]
}

Tone: neutral, factual. Surface real legal-tradition differences if relevant.
Output only JSON. No prose outside the JSON.`;

export async function gapBridgeRecommend(input: GapBridgeInput): Promise<GapBridgeRecommendation> {
  const client = getLLMClient();
  const resp = await client.chat.completions.create({
    model: MODEL_OPUS,
    max_tokens: 1500,
    messages: [
      { role: 'system', content: cachedSystem([GAP_BRIDGE_SYSTEM]) },
      { role: 'user', content: JSON.stringify(input, null, 2) },
    ],
  });
  return parseJsonResponse<GapBridgeRecommendation>(extractText(resp));
}
