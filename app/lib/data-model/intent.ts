/**
 * Intent routing — Haiku call that classifies a natural-language request
 * into (country, brand, docType, routingContext).
 *
 * Previously lived in `lib/agents/agent3.ts` (v1). Moved here as part of
 * v1 retirement. Only the routing step survived; v1's `extractSlots` and
 * `generateDraft` are replaced by the v2 compose pipeline.
 */
import {
  MODEL_HAIKU,
  cachedSystem,
  extractText,
  getLLMClient,
  parseJsonResponse,
} from '../anthropic';

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
routing parameters needed to select the right document.

Output strict JSON with this shape:

{
  "country": "<ISO-3 like FIN, USA, GBR, BRA, DEU, etc.>",
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

Brand-country defaults: Wolt → FIN; DoorDash → USA; Deliveroo → GBR.
If the specialist did not specify a brand but named a country, infer from
the brand-country defaults. Set fields to null if genuinely ambiguous.
Output only JSON. No prose, no fences.`;

export async function routeIntent(
  naturalLanguage: string,
  history?: Array<{ role: 'user' | 'assistant'; content: string }>
): Promise<RoutedIntent> {
  const client = getLLMClient();
  const resp = await client.chat.completions.create({
    model: MODEL_HAIKU,
    max_tokens: 1024,
    messages: [
      { role: 'system', content: cachedSystem([INTENT_SYSTEM]) },
      ...(history ?? []).map((h) => ({ role: h.role as 'user' | 'assistant', content: h.content })),
      { role: 'user', content: naturalLanguage },
    ],
  });
  return parseJsonResponse<RoutedIntent>(extractText(resp));
}
