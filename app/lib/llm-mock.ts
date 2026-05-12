/**
 * Mock LLM client.
 *
 * Returns canned-but-plausible responses for the three Agent 3 LLM jobs
 * (intent routing, draft generation, gap-bridging) so the full flow can
 * be clicked through without the Portkey gateway being reachable.
 *
 * Activated by `LUMINA_USE_MOCK_LLM=true` in .env.local.
 *
 * Mock responses are clearly labeled `[MOCK]` so a viewer can't mistake
 * them for real Claude output. This is for development/demos when the
 * gateway is unavailable (no VPN, gateway down, no credentials yet).
 *
 * The mock implements the subset of the OpenAI SDK surface that
 * lib/agents/agent3.ts uses — no streaming, no tool use, just
 * non-streaming chat completions.
 */
import type OpenAI from 'openai';

type MockClient = Pick<OpenAI, 'chat'>;

export function isMockMode(): boolean {
  return process.env.LUMINA_USE_MOCK_LLM === 'true';
}

export function createMockLLMClient(): MockClient {
  return {
    chat: {
      completions: {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        create: (async (params: any) => {
          const userMsg = (params.messages?.find((m: any) => m.role === 'user')?.content ?? '') as string;
          const systemMsg = (params.messages?.find((m: any) => m.role === 'system')?.content ?? '') as string;

          let content = '[MOCK] no matched system prompt';
          if (typeof systemMsg === 'string') {
            if (systemMsg.includes('intent router')) {
              content = mockIntentResponse(userMsg);
            } else if (systemMsg.includes('extraction step')) {
              content = mockExtractResponse(userMsg);
            } else if (systemMsg.includes('drafting engine')) {
              content = mockDraftResponse(userMsg);
            } else if (systemMsg.includes('gap-analysis')) {
              content = mockGapResponse(userMsg);
            }
          }
          return makeChatCompletion(content);
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
        }) as any,
      },
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any;
}

function makeChatCompletion(content: string): OpenAI.Chat.Completions.ChatCompletion {
  return {
    id: 'mock-' + Math.random().toString(36).slice(2, 14),
    object: 'chat.completion',
    created: Math.floor(Date.now() / 1000),
    model: 'mock/no-real-llm',
    choices: [
      {
        index: 0,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        message: { role: 'assistant', content, refusal: null } as any,
        finish_reason: 'stop',
        logprobs: null,
      },
    ],
    usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
  };
}

function mockIntentResponse(userMsg: string): string {
  const lower = userMsg.toLowerCase();

  let country = 'FIN';
  let brand = 'wolt';
  let docType = 'employment_agreement';
  let termType: string | null = 'indefinite';
  let roleTier: string | null = 'operational';
  let scheduleType: string | null = 'standard';
  let compensationStructure: string | null = 'hourly_paygrade';

  // Country detection
  if (/\b(uk|britain|england|london)\b/.test(lower)) country = 'UK';
  if (/\b(usa|america|united states)\b/.test(lower)) country = 'USA';
  if (/\b(germany|german|berlin|munich)\b/.test(lower)) country = 'DEU';
  if (/\b(poland|polish|warsaw)\b/.test(lower)) country = 'POL';
  if (/\b(serbia|belgrade)\b/.test(lower)) country = 'SRB';
  if (/\b(helsinki|tampere|oulu|turku|finland|finnish)\b/.test(lower)) country = 'FIN';
  if (/\b(brazil|brazilian|são paulo|sao paulo)\b/.test(lower)) country = 'BRA';

  // Brand detection
  if (lower.includes('deliveroo')) brand = 'deliveroo';
  if (lower.includes('doordash')) brand = 'doordash';
  if (lower.includes('wolt')) brand = 'wolt';
  // Fall back to country defaults
  if (!lower.includes('wolt') && !lower.includes('doordash') && !lower.includes('deliveroo')) {
    if (country === 'USA') brand = 'doordash';
    if (country === 'UK') brand = 'deliveroo';
  }

  // Doc type detection
  if (/\b(terminat|fired|let go|dismiss)\b/.test(lower)) docType = 'termination_letter';
  if (/\b(warning|discipline|disciplinary|reprimand)\b/.test(lower)) docType = 'warning_letter';
  if (/\b(certificate|voe|verification of employment)\b/.test(lower)) docType = 'employment_certificate';
  if (/\b(nda|non-disclosure)\b/.test(lower)) docType = 'nda';
  if (/\b(addendum|annex)\b/.test(lower)) docType = 'addendum';
  if (/\b(visa|travel|invitation)\b/.test(lower)) docType = 'travel_letter';

  // Term type
  if (/\b(fixed[- ]?term|seasonal|temporary|temp\b)/.test(lower)) termType = 'fixed_term';
  if (/\b(conversion|fixed to permanent)\b/.test(lower)) termType = 'fixed_term_to_permanent';

  // Role tier
  if (/\b(store manager|supervisor|lead|manager)\b/.test(lower)) {
    roleTier = 'supervisor';
    compensationStructure = 'monthly_fixed';
  }
  if (/\b(engineer|product|director|head of)\b/.test(lower)) {
    roleTier = 'specialist';
    compensationStructure = 'monthly_fixed';
  }

  // Compensation signals override role-tier defaults. If the user names a
  // monthly EUR figure, the role can't be operational/hourly — switch to
  // monthly_fixed (and bump to supervisor tier so the slot becomes required).
  if (/\b(?:€|EUR|euros?)\s*\d|\d[\d,.]*\s*(?:€|EUR|euros?)\b/i.test(userMsg) &&
      /\b(?:per month|a month|\/month|monthly)\b/i.test(lower)) {
    compensationStructure = 'monthly_fixed';
    if (roleTier === 'operational') roleTier = 'supervisor';
  }

  // Schedule
  if (/\b(shift|night|weekend)\b/.test(lower)) scheduleType = 'shiftwork_excl_night';
  if (/\b(on[- ]call)\b/.test(lower)) scheduleType = 'on_call';
  if (/\bpart[- ]time\b/.test(lower)) scheduleType = 'part_time';

  return JSON.stringify({
    country,
    brand,
    docType,
    routingContext: { termType, roleTier, scheduleType, legalEntity: null, compensationStructure },
    understoodAs: `[MOCK] ${userMsg.slice(0, 120)}`,
    confidence: 0.85,
  });
}

/* Heuristic extraction — pattern-matches the most common slot values from a
   plain-English message. Real Claude would be far more accurate; this just
   demonstrates the open-ended-input UX in mock mode. */
function mockExtractResponse(userPromptJson: string): string {
  let message = '';
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let fields: Array<{ key: string; type: string; sensitive?: boolean; validation?: any; allowedValues?: unknown[] }> = [];
  try {
    const parsed = JSON.parse(userPromptJson);
    message = parsed.message ?? '';
    fields = parsed.fields ?? [];
  } catch {
    return '{}';
  }

  const extracted: Record<string, unknown> = {};
  const hasField = (key: string) => fields.find((f) => f.key === key);

  // ── Full name — two-or-more capitalized words ─────────────────────────
  // Look for explicit patterns first: "named X", "hired X", or just two-cap-words.
  if (hasField('employee.full_name')) {
    let name: string | null = null;
    const named = message.match(/\b(?:named|hired|hiring|name is|name's)\s+([A-Z][a-z]+(?:\s+[A-Z]\.?\s*[a-z]*)?(?:\s+[A-Z][a-z']+)+)/);
    if (named) name = named[1];
    if (!name) {
      // Fallback: any two-capitalized-word sequence not at start of sentence.
      // Skip common false positives like "Wolt Grocery" or "United States".
      const STOPWORDS = new Set([
        'Wolt', 'DoorDash', 'Deliveroo', 'Grocery', 'Associate', 'Store',
        'Manager', 'Customer', 'Support', 'Helsinki', 'Tampere', 'Oulu',
        'Turku', 'United', 'States', 'Kingdom', 'Finnish', 'German',
        'Polish', 'Lumina', 'Anthropic', 'Claude', 'Google', 'Microsoft',
        'New', 'Old', 'Lead', 'Senior', 'Junior', 'Head', 'Chief',
      ]);
      const matches = [...message.matchAll(/\b([A-Z][a-z']+\s+(?:[A-Z]\.?\s+)?[A-Z][a-z']+)\b/g)];
      for (const m of matches) {
        const parts = m[1].split(/\s+/);
        if (parts.some((p) => STOPWORDS.has(p.replace(/[.,]/g, '')))) continue;
        name = m[1];
        break;
      }
    }
    if (name) extracted['employee.full_name'] = name;
  }

  // ── Address ───────────────────────────────────────────────────────────
  // Anchor on a numeric street number followed by capitalized words, ending
  // at a known street-type keyword. Stops *at* the keyword to avoid bleeding
  // into the rest of the sentence.
  if (hasField('employee.address')) {
    const streetTypes = '(?:Street|St\\.?|Avenue|Ave\\.?|Road|Rd\\.?|Drive|Dr\\.?|Lane|Ln\\.?|Boulevard|Blvd\\.?|Way|Court|Ct\\.?|Place|Pl\\.?)';
    const addrMatch = message.match(
      new RegExp(`(?:lives at|address is|located at|residing at|address:?)\\s+(\\d+\\s+[A-Z][\\w'-]+(?:\\s+[A-Z][\\w'-]+){0,4}\\s+${streetTypes})\\b`, 'i')
    );
    if (addrMatch) {
      extracted['employee.address'] = addrMatch[1].trim();
    } else {
      // Fallback: free-standing "<num> <Street>" anywhere in the message.
      const fallback = message.match(
        new RegExp(`\\b(\\d+\\s+[A-Z][\\w'-]+(?:\\s+[A-Z][\\w'-]+){0,4}\\s+${streetTypes})\\b`, 'i')
      );
      if (fallback) extracted['employee.address'] = fallback[1].trim();
    }
  }

  // ── Role title — patterns like "as a/an <title>" or "for <title> role" ─
  if (hasField('role.title')) {
    const role = message.match(
      /(?:as an?\s+|for an?\s+|hiring an?\s+|the role of\s+|position of\s+)([A-Z]?[a-z]+(?:\s+[A-Z]?[a-z]+){0,3})(?:\s+(?:role|position|at|in|on|starting|who|for))/i
    );
    if (role) {
      const title = role[1].trim();
      // Capitalize meaningfully (Title Case)
      extracted['role.title'] = title.replace(/\b\w/g, (c) => c.toUpperCase());
    }
  }

  // ── Start date — ISO, "June 1", "starting <date>" ─────────────────────
  if (hasField('employment.start_date')) {
    const iso = message.match(/\b(20\d{2}-[01]\d-[0-3]\d)\b/);
    if (iso) {
      extracted['employment.start_date'] = iso[1];
    } else {
      const months = [
        'january', 'february', 'march', 'april', 'may', 'june',
        'july', 'august', 'september', 'october', 'november', 'december',
      ];
      const monthRe = new RegExp(
        `\\b(?:starting|starts|begin(?:ning|s)?|joining|joins)\\s+(?:on\\s+)?(${months.join('|')})\\s+(\\d{1,2})(?:,?\\s*(20\\d{2}))?`,
        'i'
      );
      const m = message.match(monthRe);
      if (m) {
        const monthIdx = months.indexOf(m[1].toLowerCase());
        const day = String(m[2]).padStart(2, '0');
        const year = m[3] ?? '2026';
        const mm = String(monthIdx + 1).padStart(2, '0');
        extracted['employment.start_date'] = `${year}-${mm}-${day}`;
      }
    }
  }

  // ── Compensation — only fill if currency matches slot ─────────────────
  // Slot is EUR-only; explicitly reject USD/dollar amounts.
  if (hasField('compensation.monthly_eur')) {
    let num: number | null = null;
    // Pattern A: number-then-currency ("5000 EUR", "€5,000")
    const a = message.match(/(\d[\d,.]{2,})\s*(?:€|EUR|euros?)\b/i);
    if (a) num = parseFloat(a[1].replace(/,/g, ''));
    // Pattern B: currency-then-number ("EUR 5000", "€5000")
    if (num === null) {
      const b = message.match(/(?:€|EUR\s+)(\d[\d,.]{2,})/i);
      if (b) num = parseFloat(b[1].replace(/,/g, ''));
    }
    if (num !== null && !isNaN(num) && num > 0) {
      extracted['compensation.monthly_eur'] = num;
    }
    // Note: $-denominated amounts ("$500,000,000 a year") are deliberately
    // ignored — the slot expects EUR. Real Claude would either convert (no)
    // or skip with a note. The mock just skips.
  }

  // ── Term type — fixed-term / indefinite signals ───────────────────────
  if (hasField('employment.term_type')) {
    const lower = message.toLowerCase();
    if (/\b(fixed[- ]?term|seasonal|through (?:december|the season)|until \d|six months)\b/.test(lower)) {
      extracted['employment.term_type'] = 'fixed_term';
    } else if (/\b(permanent|indefinite|full[- ]?time|long[- ]?term)\b/.test(lower)) {
      extracted['employment.term_type'] = 'indefinite';
    }
  }

  return JSON.stringify(extracted);
}

function mockDraftResponse(userPromptJson: string): string {
  // Try to extract the template title and filled slots from the user prompt
  // (which is itself a JSON payload generated by agent3.generateDraft).
  let templateId = 'unknown.template';
  let filled: Record<string, unknown> = {};
  try {
    const parsed = JSON.parse(userPromptJson);
    templateId = parsed.template?.templateId ?? templateId;
    filled = parsed.filledSlots ?? {};
  } catch {
    /* best-effort only */
  }

  const fill = (key: string, label: string) =>
    filled[key] !== undefined ? String(filled[key]) : `[MISSING: ${key}]`;

  return `## EMPLOYMENT AGREEMENT — MOCK DRAFT

> ⚠️ **Mock mode active.** No real LLM was called. To get a real Claude draft, set \`LUMINA_USE_MOCK_LLM=false\` in \`.env.local\` and restart.

Template: \`${templateId}\`

## 1. PARTIES
The Employer is identified below.
The Employee is **${fill('employee.full_name', 'employee.full_name')}**, residing at ${fill('employee.address', 'employee.address')}.
[⚠ Citation pending legal review]

## 2. TERM AND DUTIES
The employment relationship commences on **${fill('employment.start_date', 'employment.start_date')}**.
The Employee's position shall be **${fill('role.title', 'role.title')}**, performed at **${fill('working_place', 'working_place')}**.
[⚠ Citation pending legal review]

## 3. WORKING HOURS
The regular working hours of the Employee shall be on average **${fill('working_hours.average_weekly', 'working_hours.average_weekly')}** hours per week.
[⚠ Citation pending legal review]

## 4. REMUNERATION
The Employee's compensation is structured per pay grade **${fill('compensation.hourly_pay_grade', 'compensation.hourly_pay_grade')}**, at a rate of **${fill('compensation.hourly_rate_eur', 'compensation.hourly_rate_eur')}** EUR per hour at the time of signing.
[⚠ Citation pending legal review]

## 5. ANNUAL HOLIDAY
The annual holiday shall be governed by the Annual Holidays Act and the applicable collective agreement.
[⚠ Citation pending legal review]

## 6. COLLECTIVE AGREEMENT
The collective agreement applicable to this employment is: **${fill('collective_agreement.name', 'collective_agreement.name')}**.
[⚠ Citation pending legal review]

## SIGNATURES

Place: ____________ Date: ____________

Employee's signature: ____________

Employer's signature: ____________

---

*Mock content. Real draft would be generated by Claude Opus 4.7 over the Portkey gateway.*`;
}

function mockGapResponse(userPromptJson: string): string {
  let country = 'unknown';
  let brand = 'unknown';
  let docType = 'unknown';
  let closestSameDocType: Array<{ country: string; count: number }> = [];
  let closestSameCountry: Array<{ docType: string; count: number }> = [];
  try {
    const parsed = JSON.parse(userPromptJson);
    country = parsed.country ?? country;
    brand = parsed.brand ?? brand;
    docType = parsed.docType ?? docType;
    closestSameDocType = parsed.closestMatches?.sameDocTypeOtherCountries ?? [];
    closestSameCountry = parsed.closestMatches?.otherDocTypesSameCountry ?? [];
  } catch {
    /* best-effort */
  }

  const options: Array<{ kind: string; description: string }> = [];
  if (closestSameDocType.length > 0) {
    const top = closestSameDocType[0];
    options.push({
      kind: 'closest_country',
      description: `[MOCK] Adapt the ${top.country} template for ${docType} (${top.count} files available) to fit ${country}'s legal regime. The specialist would review for jurisdiction-specific differences.`,
    });
  }
  if (closestSameCountry.length > 0) {
    const top = closestSameCountry[0];
    options.push({
      kind: 'related_doc_type',
      description: `[MOCK] ${country} has templates for ${top.docType} (${top.count} files) — if a related document type would serve, start there.`,
    });
  }
  options.push({
    kind: 'from_scratch',
    description: `[MOCK] Draft a ${country} ${brand} ${docType} from scratch with a specialist. Lumina would request legal review before any approval workflow.`,
  });
  options.push({
    kind: 'request_template',
    description: `[MOCK] File a template-onboarding request so this combo is added to the corpus for future use.`,
  });

  return JSON.stringify({
    summary: `[MOCK] No template exists for (${country}, ${brand}, ${docType}). The corpus has ${closestSameDocType.length} other countries with ${docType} templates and ${closestSameCountry.length} other doc types within ${country}. Real Claude would reason about the closest legal-regime match; for now, this is canned.`,
    options,
  });
}
