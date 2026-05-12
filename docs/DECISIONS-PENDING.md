# Decisions pending — for Tim

Last updated: 2026-05-12. Most-blocking first. Each item has a recommendation; you can accept, edit, or override.

---

## 🔴 1. **Run `npm install` on this machine.** This is the only thing blocking you from `npm run dev`.

When I went to `npm install` the scaffold, the user-level Node.js wasn't on PATH (`which node` returned nothing). The cursor-agent has its own bundled node at `/usr/local/cursor-agent/node` but no npm. Trying to drive npm via that node failed with `MODULE_NOT_FOUND`.

**What to do:**
```bash
# Install Node 20 + npm (one of these):
brew install node@20
# or download from https://nodejs.org/

# Then:
cd ~/Development/lumina/app
npm install
cp .env.local.example .env.local
# Edit .env.local — add PORTKEY_API_KEY and confirm LUMINA_POC_MODE=true
npm run dev
# Open http://localhost:3000
```

See [`docs/SETUP.md`](./SETUP.md) for full setup.

---

## 🔴 2. ~~Data gap~~ **Was wrong. The corpus is much richer than I thought.**

I previously reported "only FIN has populated templates" based on spot-checks of nested subfolders. A full Drive walk reveals **521 files across 36 countries** (`corpus/inventory-summary.md`). 15+ countries have Employment Agreements; many more have terminations, addendums, warning letters, etc.

**Real remaining gaps (smaller than I claimed):**
- **UK has only 2 files** (1 employment certificate, 1 travel letter — no employment agreements). The Deliveroo/UK Employment Agreement demo path still needs separate sourcing.
- **Brazil has 1 loose file.** If you want Brazil for the legal-variance demo, source separately.
- **Norway, Netherlands, Luxembourg, Japan, India** all have ≤ 3 files each.

**My recommendation:** drop Brazil from the four-country plan. Replace with **Germany** (34 files, 15 employment agreements — strong coverage). Optionally also add **Poland** (37 files, 18 employment agreements — the most of any country). Cross-brand: USA/DoorDash works fine (6 EA + others); UK/Deliveroo still needs templates or we demo on a different doc type (Employment Certificate) instead.

**Decision needed:** Replace Brazil with Germany + Poland for the multi-country demo? Or keep pursuing Brazil templates separately?

---

## 🟡 3. Schema extraction is the bottleneck now, not data availability.

The architecture loads any slot schema in `corpus/templates/*.schema.json`. We currently have ONE: `fin-wolt-employment-agreement.schema.json`. The Drive has 110 employment agreements across countries — none of them have parsed slot schemas yet.

Two paths:
- **(a) Manual extraction.** Same process I used for FIN: download a representative template, diff it across variants, extract slots and clause groups. ~30 min per (country, doc_type).
- **(b) Agent-assisted extraction.** Build a "Template Onboarding" agent that takes a `.docx` and produces a slot schema. Higher upfront cost; pays back on every new template.

**My recommendation:** Do **(a)** for the next 3–4 (country, doc_type) combos to flesh out the demo (FIN/Wolt EmpAgr ✓, USA/DoorDash EmpAgr, GER/DoorDash or Wolt EmpAgr, FIN/Wolt termination). Defer (b) until we've felt the pain twice.

**Decision needed:** OK to spend ~2 hours extracting 3 more schemas? Or push to (b) directly?

---

## 🟡 4. ~~`Z - EY` empty~~ De-prioritized per your #1 pivot. Closed.

You asked to drop the side-by-side EY compare in favor of "ingest what we have, surface gaps as a feature." Architecture reflects this — Agent 1 returns a structured `not_in_corpus` response with closest-match recommendations, and Agent 3 calls Opus 4.7 for gap-bridging text.

---

## 🟡 5. ~~Brand color~~ Closed.

CLAUDE.md updated to `#009DE0` for Wolt. v1 prototype already had it right.

---

## 🟡 6. ~~GA / WM acronyms~~ Closed.

Recorded in [`docs/GLOSSARY.md`](./GLOSSARY.md): GA = Grocery Associate, WM = Wolt Market.

---

## 🟡 7. ~~Schema dual format~~ Closed — keeping dual.

Per your input. TS types serve developer/compiler; JSON serves runtime + LLM context (prompt-cacheable). Token-efficient via prompt caching of the schema as part of Agent 3's system prompt.

---

## 🟡 8. ~~SQLite vs JSONL~~ Closed — staying with JSONL.

Per your input. SQLite is engineering optimization; demo wow is UI-level provenance visualization. JSONL keeps the dependency surface tiny for PoC.

---

## 🟡 9. ~~Wire in Claude~~ Closed — wired with prompt caching from day one.

Models used:
- **Haiku 4.5** (`claude-haiku-4-5`) — intent routing, slot extraction
- **Opus 4.7** (`claude-opus-4-7`) — draft generation, gap-bridging

Adaptive thinking on Opus 4.7 generation (per `shared/model-migration.md`). No `temperature` / `top_p` (removed on 4.7). Server-side only; API key never reaches the browser.

---

## 🟡 10. **One UX decision worth flagging: gap-bridging mode.**

When the specialist asks for `(country, brand, docType)` we don't have, Agent 3 currently calls Opus 4.7 to *describe* the gap and propose options ("adapt closest match", "draft from scratch", "request template"). It does NOT yet automatically *do* the adaptation — that requires a separate flow.

**Two demo modes possible:**
- **(a) Describe-only** (current): show the gap + options as cards; specialist picks one manually.
- **(b) Auto-adapt**: when specialist picks "adapt closest match", Opus 4.7 reads the closest-country template's schema and produces a draft adapted for the new country. Higher demo wow; needs an additional API call + UX for the adapt step.

**My recommendation:** Ship (a) for the first demo. Add (b) once we've watched real specialists react to the gap-surfacing UX.

**Decision needed:** OK with describe-only for the first demo?

---

## Status of the PoC

**Built and ready to run** (after `npm install`):
- Three-agent architecture wired end-to-end (Templates / Data / Generate)
- One full slot schema: FIN Wolt Employment Agreement (22 slots, 5 routing axes, 5 clause groups)
- Mock Greenhouse + Workday fixtures with 4 fake personas
- Drive inventory (521 files, 36 countries) loaded for gap-surfacing
- Chat UI with three response types (gap / needs_input / draft)
- Watermark, provenance recording, env tripwire — all per `docs/POC-LIMITATIONS.md`
- Claude API wired with prompt caching, Haiku 4.5 + Opus 4.7

**Not yet built** (in priority order):
- Slot schemas for USA / GER / additional FIN doc types (decision #3)
- "Auto-adapt" gap-bridging mode (decision #10)
- Regulation-watch loop (Agent 1's scheduled job) — explicitly deferred per `docs/agent-architecture.md`
- Real Greenhouse/Workday integrations — explicitly deferred per `docs/POC-LIMITATIONS.md`

**Known broken/missing:**
- No way to run a build verification on this machine without Node installed (decision #1).
- The `(c) UK templates / Deliveroo` story (decision #2) is unresolved.
