/**
 * Gap surfacing — when v2 has no jurisdiction rule for a requested
 * (country, docType), surface the closest matches from the Drive
 * inventory and let Opus propose alternatives.
 *
 * Moved from v1's `agent1.selectTemplate` (closest-matches) and
 * `agent3.gapBridgeRecommend` (Opus call) as part of v1 retirement.
 * The Drive inventory loader (`lib/inventory.ts`) is reused as-is.
 */
import {
  MODEL_OPUS,
  cachedSystem,
  extractText,
  getLLMClient,
  parseJsonResponse,
} from '../anthropic';
import { DOC_TYPE_TO_DRIVE_FOLDER, suggestClosestMatches } from '../inventory';

export type GapResult = {
  driveFolder: string;
  closestMatches: {
    sameDocTypeOtherCountries: Array<{ country: string; count: number }>;
    otherDocTypesSameCountry: Array<{ docType: string; count: number }>;
  };
  recommendation: GapBridgeRecommendation;
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

export async function surfaceGap(input: {
  country: string;
  brand: string;
  docType: string;
}): Promise<GapResult> {
  const driveFolder = DOC_TYPE_TO_DRIVE_FOLDER[input.docType] ?? input.docType;
  const closestMatches = await suggestClosestMatches(input.country, driveFolder);

  const client = getLLMClient();
  const resp = await client.chat.completions.create({
    model: MODEL_OPUS,
    max_tokens: 1500,
    messages: [
      { role: 'system', content: cachedSystem([GAP_BRIDGE_SYSTEM]) },
      {
        role: 'user',
        content: JSON.stringify(
          { country: input.country, brand: input.brand, docType: input.docType, closestMatches },
          null,
          2
        ),
      },
    ],
  });
  const recommendation = parseJsonResponse<GapBridgeRecommendation>(extractText(resp));
  return { driveFolder, closestMatches, recommendation };
}
