# Lumina — HR Document Automation

> 🔍 **REVIEW:** Confirm this mission statement matches how you describe it to leadership. Edit freely.

**Mission.** Lumina is a proof-of-concept for AI-driven HR document generation across DoorDash, Wolt, and Deliveroo entities. The near-term goal is to demonstrate end-to-end document drafting from natural-language input — grounded in the historical template inventory — accurate enough to compare side-by-side with the consulting firm's outputs.

The longer-term goal is a layered platform that drafts employment documents through a specialist-supervised conversation, citing templates, precedent, and regulation in real time.

---

## Project state

- **Phase:** Proof of concept. Pre-production. No real Workday / DocuSign / Greenhouse integrations yet.
- **Origin:** Started as a series of HTML prototypes exploring four paradigms (template engine, RAG-generated, regulation-native, conversational co-pilot). The recommendation that emerged is a layered stack with a conversational surface and multiple engines underneath.
- **Live demo:** `demo/lumina.html` — single-file HTML, open in browser.
- **Exploration artifacts:** `prototypes/` — original 4 paradigm prototypes + comparison/index. Keep them; useful for "how we got here" context with new stakeholders.

> 🔍 **REVIEW:** If/when you decide to retire any of the prototypes, drop them from this list.

---

## Architecture decision

**Path B — real web app, PoC first.**

Migrating the standalone HTML prototype into a Next.js + TypeScript + Tailwind app with Anthropic API calls on the server side. Production-grade resilience (auth, rate limiting, audit, real integrations) is deliberately deferred until the PoC validates generation quality vs. the consulting firm's output.

> 🔍 **REVIEW:** Confirm Path B is still right. The two main alternatives:
> - **Path A** — keep iterating in single-file HTML, add a thin Node backend for LLM calls. Faster to a usable thing; less reusable long-term.
> - **Path C** — build as a Claude Agent SDK app with tools (Workday/DocuSign/Drive as tool calls). Most aligned with the conceptual model; least conventional infra; harder to demo to non-technical stakeholders.

### Stack (planned)

- **Frontend + Backend:** Next.js 15 (app router), TypeScript, Tailwind CSS
- **LLM:** Anthropic API via `@anthropic-ai/sdk`, server-side only (API key never reaches the browser)
- **Models:** Claude Opus 4.7 for generation; Claude Haiku 4.5 for cheap classification / routing
- **Corpus:** File-based for PoC. Markdown extracts from the historical templates in the policy Drive, indexed in-memory. Future: proper vector store.
- **State:** In-memory + URL state for PoC. No database until needed.
- **Hosting:** TBD. Vercel is the default fast path; internal infra is the right answer once we leave PoC.
- **Auth:** Skip for PoC. Add SSO when this leaves PoC.

> 🔍 **REVIEW:** Push back on any of these if internal infra / security folks already have constraints we should accommodate from day one.

---

## Key decisions made

- **Layered stack > single paradigm.** Conversational surface (v4-style) is primary; templates, RAG, and regulation citations are engines underneath.
- **Templates are not the unit of work.** The unit is "what does the specialist need?" — Lumina picks the right template / corpus slice / regulation slice based on context.
- **Humans always in the loop.** Lumina drafts; specialists sign off. No autonomous finalization.
- **Brand switching is structural** (logo, entity, address); jurisdictional content routes through the regulation/template layer.
- **No invented citations.** Every regulation reference must trace to a real source. If we don't have it, we say so.

---

## Open questions

> 🔍 **REVIEW:** Add to this list, close items as decisions land. New sessions will read these and not relitigate.

- Which countries are in scope for the PoC? FIN is most complete; US + UK round out the three brands. Recommend starting with FIN only and adding US once accuracy is proven.
- How do we evaluate "accuracy" for the side-by-side compare with the consulting firm? Need an explicit rubric in `docs/accuracy-rubric.md` before the compare runs.
- Where does the corpus live during PoC? File-based seems right; vector store later. Open: do we extract once into Markdown, or read .docx files at runtime?
- Hosting destination for the PoC demo — internal or Vercel?
- Side-by-side compare: do we have the consulting firm's outputs in hand yet, or are we generating in parallel?

---

## Conventions

### Visual & brand
- **Brand colors:** DoorDash #EB1700, Wolt #00C2E8, Deliveroo #00CCBC. Used only on letterhead / branded surfaces.
- **Letterheads:** always include real legal entity name + business ID + registered address. These live in a single config — never hardcode.

### Content & language
- **Citations on every clause.** A draft without a citations block is not shippable.
- **Lumina speaks plainly.** No marketing tone. Surfaces constraints (pension thresholds, CBA rules, sponsorship requirements) as guidance — specialist decides.
- **Neutral analytical voice** in all internal artifacts (decision memos, READMEs, anything that might be shared). No "I'd recommend" — write "the recommendation is."
- **No named individuals** from internal conversations in artifacts intended for external review.

### Code
- **TypeScript strict mode.** All app code.
- **Functional React.** Server Components by default; Client Components only where interactivity demands.
- **No premature abstraction.** PoC code should be obvious before it's elegant.
- **Single config files** for things that change across brands/countries — `config/brands.ts`, `config/legalEntities.ts`, etc.

---

## What NOT to do

- ❌ Don't reintroduce names from prior conversations in any user-facing artifact.
- ❌ Don't ship a draft without a citations block, even if empty.
- ❌ Don't bypass the specialist sign-off flow.
- ❌ Don't hardcode brand colors, addresses, or legal entities — they live in one config.
- ❌ Don't fabricate regulation citations. If a source doesn't exist, say so or flag it as a gap.
- ❌ Don't run real Workday / DocuSign API calls during PoC. Mock with realistic shims.
- ❌ Don't commit API keys. Use `.env.local`; secrets stay out of git.

---

## File map

```
lumina/
├── CLAUDE.md            ← this file (project memory; loaded automatically)
├── README.md            ← brief public-facing description
├── .claude/
│   ├── settings.json    ← project-level Claude Code config
│   └── agents/          ← custom subagents for specialty tasks
├── .gitignore
├── demo/
│   └── lumina.html      ← current single-file standalone demo
├── prototypes/          ← exploration artifacts; keep for context
├── app/                 ← Next.js app (to be scaffolded next session)
├── corpus/              ← Markdown extracts of historical templates (to be built)
└── docs/                ← decision records, accuracy rubric, internal notes
```

---

## How to work in this repo

- **Start sessions in this directory.** CLAUDE.md loads automatically.
- **Architecture questions:** ask before implementing; don't rebuild things based on a guess about intent.
- **High-risk changes** (legal language, regulation citations, brand identity, anything user-facing for leadership): treat as gated. Verify with a real source before shipping; ask for explicit approval before pushing.
- **Commit early, commit often.** PoC = lots of small iterations. Helpful commit messages > clever ones.
- **Use the subagents** in `.claude/agents/` for specialty checks — legal-review hygiene, template conformance, etc. Invoke by name.

---

## Side-by-side accuracy compare (the near-term north star)

The deliverable that justifies this work:

1. Pick N representative scenarios across countries / document types.
2. Generate via Lumina.
3. Generate via the consulting firm's process.
4. Score both against a shared rubric (`docs/accuracy-rubric.md` — to be created).
5. Publish the comparison.

> 🔍 **REVIEW:** Confirm this is still the framing. Adjust N, scenarios, rubric scope.

---

*Last updated: see git log. Major architectural changes should bump a short note here under "Decisions made."*
