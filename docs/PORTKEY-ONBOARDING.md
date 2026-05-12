# Portkey / Cybertron onboarding — handoff brief

> Single-source-of-truth doc for the GenAI Gateway onboarding the Lumina PoC needs. Pick this up at the top of any new session to know exactly where we are and what's next.

---

## TL;DR

The Lumina app is built, tested end-to-end against a mock LLM, and ready to hit real Claude through DoorDash's internal Portkey gateway. **The remaining blocker is org/IT — not code.** We need a Portkey API key, which requires being on an eligible team in Employee Directory → joining a workspace via ML Workbench → accepting a Portkey email invite → copying the resulting key.

Last action taken: **requested access to a leaf-node team** at  
[`https://employee-directory.doordash.team/t/c38c44b2-c841-478f-86a8-f6763a22a0cf`](https://employee-directory.doordash.team/t/c38c44b2-c841-478f-86a8-f6763a22a0cf)

Waiting on approval + sync (~1 hour after approval lands).

---

## Status snapshot

| Item | Status |
|---|---|
| Node 20+ installed | ✅ |
| `npm install` complete | ✅ |
| App builds clean (`npm run typecheck` / `npm run build`) | ✅ |
| Dev server runs (`npm run dev` → http://localhost:3000) | ✅ |
| Tailscale VPN — logged into `doordash.com` tailnet | ✅ |
| Gateway TCP reachability (`cybertron-service-gateway.doordash.team`) | ✅ (returns 401 — gateway sees us, but no valid key yet) |
| Mock-mode E2E flow in browser | ✅ |
| Real Claude calls via Portkey | ⏸ blocked on the items below |
| Employee Directory team — leaf-node, eligible | ⏸ access just requested |
| ML Workbench → Join Workspace | ⏸ pending team approval |
| Portkey invite accepted | ⏸ pending workspace join |
| `.env.local` populated with real `PORTKEY_API_KEY` + correct model slugs | ⏸ pending API key issuance |

---

## What's blocking us (in order)

### 1. Team membership

DevConsole sees no group membership for `timothy.howd` (the `Member of` and `Related Groups` fields are empty). Employee Directory has them on `People` (the parent), which is **not a leaf node** — that's why ML Workbench's "Join Workspace" dropdown surfaces nothing.

Access has been requested at [`https://employee-directory.doordash.team/t/c38c44b2-c841-478f-86a8-f6763a22a0cf`](https://employee-directory.doordash.team/t/c38c44b2-c841-478f-86a8-f6763a22a0cf) (likely the People Product leaf team).

**When approved:** wait ~1 hour for sync from Employee Directory → asset-service → DevConsole. If still not visible in DevConsole after 6+ hours, post in `#ask-dev-console`.

### 2. ML Workbench → Join Workspace

Once team membership shows up in DevConsole:

1. Go to [`https://unity.doordash.com/suites/data/data-portal/ml-workbench/genai`](https://unity.doordash.com/suites/data/data-portal/ml-workbench/genai)
2. Acknowledge the GenAI policy (one-time)
3. Click **Join Workspace** in the top-right
4. Pick the **vertical + team** for the leaf
5. Submit

### 3. Accept Portkey invite

A Portkey invite email lands from `noreply@owls.portkey.ai`. **You must accept the *first* invite before joining any second workspace** — gateway only allows one outstanding invite per Portkey org at a time.

1. Click the link in the email
2. Choose **Single sign-on (SSO)**
3. Use `@doordash.com` email

### 4. Pull three values from Portkey

Go to [`https://app.portkey.ai`](https://app.portkey.ai) → select the new workspace in the top-left dropdown.

| Where | What to copy | Paste into `.env.local` as |
|---|---|---|
| **API Keys** tab | the personal key named `timothy_howd_dev`, type `user` | `PORTKEY_API_KEY` |
| **Model Catalog → AI Providers** | the Anthropic provider slug (workspace-specific — *not* literally `anthropic`) | half of `LUMINA_MODEL_OPUS` / `LUMINA_MODEL_HAIKU` |
| **Model Catalog → Models** | exact model names for `claude-opus-4-7` and `claude-haiku-4-5` | other half of those env vars |

Slug format: `@{provider_slug}/{model_name}` — both halves go together in the env var.

### 5. Flip out of mock mode

```bash
# In ~/Development/lumina/app/.env.local
LUMINA_USE_MOCK_LLM=false
PORTKEY_API_KEY=<paste real key>
LUMINA_MODEL_OPUS=@<provider_slug>/<opus_model_name>
LUMINA_MODEL_HAIKU=@<provider_slug>/<haiku_model_name>
LUMINA_POC_MODE=true   # leave this on — guardrail
```

Restart `npm run dev` (Next.js reads env at startup).

### 6. Smoke test

```bash
curl -sS -X POST http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -d '{"message":"New person on my team — Tim Howd, 48 Arrowwood Street, 5000 EUR/month, starts June 1, 2026","sessionState":{"specialistInput":{},"specialistId":"demo"}}' \
  | python3 -m json.tool
```

Expect `kind: needs_input` with real Claude-derived `understoodAs` and extracted slot values. If you get `"Connection error"` → VPN dropped (re-up Tailscale). If you get `401` → wrong key. If you get `404 model not found` → wrong slug.

---

## Key URLs reference

| What | URL |
|---|---|
| Onboarding doc (Ian's share) | https://docs.google.com/document/d/1BCC6c-CejJTRj0iuyfiyeEI_sGv8mS9MNLIObARxq5I/edit |
| Employee Directory profile | https://employee-directory.doordash.team/p |
| Employee Directory — team access request (pending) | https://employee-directory.doordash.team/t/c38c44b2-c841-478f-86a8-f6763a22a0cf |
| DevConsole (where leaf-node tags surface) | https://devconsole.doordash.team |
| ML Workbench GenAI tab | https://unity.doordash.com/suites/data/data-portal/ml-workbench/genai |
| Portkey UI (after invite accepted) | https://app.portkey.ai |
| Gateway endpoint (laptop / legacy DD) | `https://cybertron-service-gateway.doordash.team/v1` |
| Gateway endpoint (laptop / Pedregal US) | `https://cybertron-service-gateway.usw2.workloads.dash-compute.doordash.red:8443/v1` |
| Gateway endpoint (laptop / Pedregal EU — Wolt/Roo) | `https://cybertron-service-gateway.euw1.workloads.dash-compute.doordash.red:8443/v1` |
| GenAI Gateway FAQs | https://doordash.atlassian.net/wiki/spaces/Eng/pages/3717661428/GenAI+Gateway+FAQs |
| User onboarding flowchart | https://doordash.atlassian.net/wiki/spaces/Eng/pages/4302045589/GenAI+User+Onboarding+Flowchart |
| Python examples (gateway) | https://github.com/doordash/asgard/tree/master/services/genai-gateway-service/examples/python/model_catalogs |

## Slack channels

| Channel | When to post |
|---|---|
| `#ask-gen-ai` | GenAI Gateway / Portkey / model questions |
| `#ask-dev-console` | DevConsole / team membership / leaf-node status |
| `#ask-employee-directory` | Employee Directory sync issues |

---

## Architecture context for a new session

This is the minimum a fresh session needs to know about the code shape:

- The Anthropic SDK was **swapped for `openai` SDK** because DoorDash mandates routing all LLM traffic through Portkey, which exposes only the OpenAI-compatible `/v1/chat/completions` interface. Trade-off: lost prompt caching, adaptive thinking, and `effort` parameter (Anthropic-native features). See `app/lib/anthropic.ts`. If/when Portkey exposes Anthropic-native passthrough at `/v1/messages`, that's the only file to revisit.
- Mock LLM lives at `app/lib/llm-mock.ts`. Activated by `LUMINA_USE_MOCK_LLM=true` in `.env.local`. All mock responses are labeled `[MOCK]`.
- Three agents in `app/lib/agents/`:
  - `agent1.ts` — Template selection + gap-bridging
  - `agent2.ts` — Slot collection from mock Greenhouse/Workday + `requiredIf` evaluation
  - `agent3.ts` — Intent routing (Haiku), slot extraction from natural language (Haiku), draft generation (Opus), gap-bridging recommendations (Opus)
- API orchestrator at `app/app/api/chat/route.ts`. Chat surface at `app/app/draft/page.tsx`.
- Slot schemas in `corpus/templates/*.schema.json`. Only one populated so far: `fin-wolt-employment-agreement.schema.json`. Drive inventory at `corpus/drive-inventory.json` (521 files across 36 countries).

For the deeper design rationale see [`agent-architecture.md`](./agent-architecture.md). For the guardrail philosophy see [`POC-LIMITATIONS.md`](./POC-LIMITATIONS.md). For open product decisions see [`DECISIONS-PENDING.md`](./DECISIONS-PENDING.md).
