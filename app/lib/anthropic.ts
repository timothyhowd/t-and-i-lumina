/**
 * LLM client for Lumina.
 *
 * Talks to Anthropic Claude via DoorDash's internal Portkey gateway
 * (`cybertron-service-gateway.doordash.team`), which exposes an
 * OpenAI-compatible `/v1/chat/completions` interface. Per the
 * announcement: model slugs follow `@provider/model_slug` format.
 *
 * Configuration (set in .env.local):
 *   PORTKEY_API_KEY          — required. The gateway API key.
 *   LUMINA_MODEL_OPUS        — optional, defaults to the slug below.
 *   LUMINA_MODEL_HAIKU       — optional, defaults to the slug below.
 *   LUMINA_GATEWAY_BASE_URL  — optional, defaults to the prod gateway.
 *
 * Server-side only. The Portkey key never reaches the browser.
 *
 * Trade-offs vs the Anthropic-native SDK (worth knowing):
 *   - Prompt caching (`cache_control: ephemeral`) is dropped. Portkey
 *     does not expose Anthropic's cache headers through the OpenAI
 *     compat layer. Tokens cost more per turn; PoC scope can absorb it.
 *   - Adaptive thinking (`thinking: adaptive`) is dropped. Opus 4.7 will
 *     run without extended reasoning. Most Lumina tasks are short enough
 *     that this is not load-bearing.
 *   - `output_config.effort` is dropped. Defaults apply.
 *   - If/when DoorDash's gateway exposes Anthropic-native passthrough,
 *     this module is the only place we'd swap back. The rest of the
 *     codebase imports `getLLMClient`, `cachedSystem`, `extractText`,
 *     `parseJsonResponse` — none of which leak the underlying shape.
 */
import OpenAI from 'openai';
import { createMockLLMClient, isMockMode } from './llm-mock';

export const MODEL_OPUS = process.env.LUMINA_MODEL_OPUS ?? '@anthropic/claude-opus-4-7';
export const MODEL_HAIKU = process.env.LUMINA_MODEL_HAIKU ?? '@anthropic/claude-haiku-4-5';

// Legacy aliases for callers still importing the old constant names.
export const ANTHROPIC_MODEL_OPUS = MODEL_OPUS;
export const ANTHROPIC_MODEL_HAIKU = MODEL_HAIKU;

const DEFAULT_GATEWAY_URL = 'https://cybertron-service-gateway.doordash.team/v1';

let _client: OpenAI | ReturnType<typeof createMockLLMClient> | null = null;

export function getLLMClient(): OpenAI {
  if (_client) return _client as OpenAI;
  // Mock mode short-circuits before any real network call is made.
  if (isMockMode()) {
    _client = createMockLLMClient();
    return _client as OpenAI;
  }
  const apiKey = process.env.PORTKEY_API_KEY;
  if (!apiKey) {
    throw new Error(
      'PORTKEY_API_KEY is not set. Add it to .env.local, or set LUMINA_USE_MOCK_LLM=true. See docs/SETUP.md.'
    );
  }
  const baseURL = process.env.LUMINA_GATEWAY_BASE_URL ?? DEFAULT_GATEWAY_URL;
  _client = new OpenAI({
    apiKey,
    baseURL,
    // Portkey's documented auth header. The OpenAI SDK additionally sends
    // Authorization: Bearer <apiKey>; that is harmless — the gateway
    // accepts either form, and they carry the same value here.
    defaultHeaders: { 'x-portkey-api-key': apiKey },
    timeout: 30_000,
    maxRetries: 1,
  });
  return _client as OpenAI;
}

/**
 * Kept for source compatibility with the old Anthropic-native client.
 * Now a thin wrapper: collapses the system prompt to a single string,
 * since OpenAI chat completions don't have a multi-block system field.
 * Prompt caching is no longer available on this path.
 */
export function cachedSystem(blocks: string[]): string {
  return blocks.join('\n\n');
}

/** Extract text content from a chat-completions response. */
export function extractText(response: OpenAI.Chat.Completions.ChatCompletion): string {
  return response.choices[0]?.message?.content ?? '';
}

/**
 * Parse a JSON object out of a model response. Tolerates:
 *   - code-fence wrap (```json ... ```)
 *   - trailing prose after the JSON value (Haiku occasionally appends
 *     an explanation despite "no prose" instructions)
 *   - leading prose before the JSON value
 *
 * Strategy: try a strict parse first. On failure, locate the first
 * balanced top-level `{...}` or `[...]` and parse that.
 */
export function parseJsonResponse<T = unknown>(text: string): T {
  const stripped = text
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();
  try {
    return JSON.parse(stripped) as T;
  } catch {
    const extracted = extractFirstJsonValue(stripped);
    if (extracted !== null) return JSON.parse(extracted) as T;
    throw new Error(
      `Model response was not valid JSON. First 200 chars: ${stripped.slice(0, 200)}`
    );
  }
}

/**
 * Find the first balanced {} or [] block at any depth. Handles strings
 * and escapes correctly so braces inside quoted text don't fool us.
 */
function extractFirstJsonValue(text: string): string | null {
  // Find the first opening bracket
  let start = -1;
  let opener = '';
  for (let i = 0; i < text.length; i++) {
    if (text[i] === '{' || text[i] === '[') {
      start = i;
      opener = text[i];
      break;
    }
  }
  if (start === -1) return null;
  const closer = opener === '{' ? '}' : ']';
  let depth = 0;
  let inString = false;
  let escape = false;
  for (let i = start; i < text.length; i++) {
    const ch = text[i];
    if (escape) { escape = false; continue; }
    if (inString) {
      if (ch === '\\') escape = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') { inString = true; continue; }
    if (ch === opener) depth++;
    else if (ch === closer) {
      depth--;
      if (depth === 0) return text.slice(start, i + 1);
    }
  }
  return null;
}

/**
 * Back-compat: the legacy `getAnthropicClient()` name returns the LLM
 * client. Callers that still import this should be migrated to
 * `getLLMClient()` over time.
 */
export const getAnthropicClient = getLLMClient;
