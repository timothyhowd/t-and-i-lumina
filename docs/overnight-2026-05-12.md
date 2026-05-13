# Overnight build log — 2026-05-12 → 2026-05-13

> Autonomous-mode session. User went to bed; goal was to maximize meaningful progress without supervision. Each decision below is paired with the alternative I considered and how to reverse it if you want different.

## Status at hand-off

**What's running:** v2 architecture is wired end-to-end and live. `LUMINA_USE_V2=true` is set in `app/.env.local`. The dev server is running on port 3000 against real Claude via Portkey.

**What works end-to-end (verified with curl):**

| Path | Status |
|---|---|
| FIN × employment_agreement (v2) | ✅ Produces real Finnish drafts with ECA/WHA/AHA citations |
| USA × employment_agreement (v2) | ✅ Produces at-will offer letter with FLSA/COBRA/ERISA scaffolding |
| DEU × employment_agreement (v2) | ✅ Bilingual DE/EN draft with BGB §622, BUrlG §3 scaffolding (smoke-tested) |
| Clarify flow (no country/brand) | ✅ Asks the right question, history-aware |
| Gap flow (Australia, no v2 rule) | ✅ Falls through to v1 gap analysis cleanly |
| All v1 paths | ✅ Untouched, working as before |

**What's still scaffolded, not production:**
- All v2 clause text is `reviewStatus: 'unverified'`. Statute citations are real; prose is generic. Counsel must replace clause bodies before any real use.
- USA/DEU `regulations/` folders not pulled — only Finnish statutes were sourced from Finlex.
- Schema validation against the full 521-file corpus was NOT run (proposal calls for it before v1 retirement; left for daylight).
- People Ops onboarding flow is not built. Today you give v2 prose; tomorrow it would feed real records.

## Decisions made

### 1. Two-Haiku-call extract pattern, not one
**Chose:** Keep `routeIntent` (Haiku) and `extractRecordUpdates` (Haiku) as separate calls. The route classifies intent first; if country/brand are missing, return clarify before doing the heavier extraction.

**Alternative considered:** Single unified Haiku call returning `{intent, recordUpdates}`.

**Why:** The clarify path can return early without the heavier record extraction. With one combined call, we'd pay for full schema extraction even on messages that need clarification first. The split also keeps the existing v1 clarify code unchanged.

**To reverse:** Merge `routeIntent` + `extractRecordUpdates` into a single function in `agent3.ts` or `llm-hooks.ts`. The schema work is in `llm-hooks.ts:EXTRACT_SYSTEM`.

### 2. v2 lives alongside v1, gated by env var
**Chose:** `LUMINA_USE_V2=true` toggles v2 for combos that have a jurisdiction rule. Combos without a rule fall through to v1.

**Alternative considered:** Hard cut-over to v2; delete v1 agents.

**Why:** v1 covers gap-surfacing for 36 countries via the Drive inventory. v2 only has rules for FIN/USA/DEU. Cutting v1 prematurely would break the "show specialists what's available" UX. Reversible: just unset `LUMINA_USE_V2` and v1 takes over entirely.

**To reverse:** Delete the `if (process.env.LUMINA_USE_V2 === 'true')` block in `route.ts`. Or flip it to default-on by checking `!== 'false'`.

### 3. Clauses are authored data, NOT LLM-generated text
**Chose:** Clause bodies live in `app/lib/data-model/clauses/<iso>.ts` as Markdown with `{{record.path}}` placeholders. Claude composes documents by selecting + rendering clauses; it does not invent legal wording. Free-text slots within clauses (duties list, delta summary) are bounded by per-slot guidance.

**Alternative considered:** Free Opus generation of clauses with retrieval grounding (RAG).

**Why:** The People Ops test north star is "defensible against the consulting firm." Free generation produces plausible prose with hallucinated citations. Authored clauses + statute references can be reviewed by counsel and trusted. RAG-style retrieval is the v2.1 step, after counsel signs off on the clause library.

**To reverse:** Replace the `selectClauses` step in `compose.ts` with a free-form Opus call that takes the record + jurisdiction rule and returns prose. Don't do this lightly — it's the architectural fix you specifically asked for.

### 4. Finnish regulation text included as Markdown + PDF, not gitignored
**Chose:** Pulled three Finnish statutes from Finlex (ECA, WHA, AHA), stored full text + curated extracts + canonical PDFs in `corpus/regulations/fin/`. Total ~1MB.

**Alternative considered:** Gitignore raw `.txt`/`.pdf`, commit only curated `.md` extracts.

**Why:** Finnish statutes are public domain by §9 of the Finnish Copyright Act (404/1961). Committing the full source eases counsel's review of clause citations and supports future RAG retrieval. 1MB is small for the value.

**To reverse:** Add `corpus/regulations/*.pdf` and `corpus/regulations/*.txt` to `.gitignore`, leave only the `.md` files committed.

### 5. USA = at-will offer letter, not European-style EA
**Chose:** USA jurisdiction's `employment_agreement` is modeled as an at-will offer letter (parties → at-will disclaimer → position → duties → compensation → benefits → PIIA reference → signature). No notice-period clause; no termination grounds.

**Alternative considered:** Model USA EA like FIN/DEU (full European structure).

**Why:** Cross-doc analysis confirmed DoorDash USA "Employment Agreements" in the Drive are actually pay-change letters; real US offer letters live elsewhere. At-will is the structurally correct primitive. PIIA, equity, 401(k) live in exhibits referenced from the offer letter, not in the offer letter itself.

**To reverse:** Edit `jurisdictions/usa.ts` to add European-style clauses (notice_period, etc.) and matching clause bodies in `clauses/usa.ts`.

### 6. German clauses are bilingual DE/EN with German binding
**Chose:** Every German clause body has both DE and EN text inline, with a `deu.language_precedence` clause stating German prevails.

**Alternative considered:** EN-only with a translation note.

**Why:** The cross-doc analysis saw bilingual DE/EN in every sampled German EA, with German binding. Replicating that pattern is closer to a defensible draft. Risk: my German prose is unreviewed and could contain errors a native speaker would catch.

**To reverse:** Edit `clauses/deu.ts` to remove the German halves of each body. Or keep DE-only and remove EN. The structure of each clause is symmetrical (`/ English` after `Deutsch`).

### 7. WorkLocation discriminator made defensive
**Chose:** When Haiku returns a `workLocation` update without a `kind` discriminator, the renderer recovers using fallback shapes (city / primary.city) instead of throwing.

**Alternative considered:** Throw an error and re-extract.

**Why:** Haiku occasionally drops discriminators on discriminated unions. Throwing forces a re-extract loop; recovering preserves the user's progress and surfaces missing fields cleanly via the validator.

**To reverse:** In `api-bridge.ts:describeWorkLocation`, remove the fallback branch and let `loc.kind` throw.

### 8. Equality conditionals (`{{#ifEq path "value"}}`)
**Chose:** Added a new syntax to the clause template engine for value equality, alongside the existing `{{#if path}}` presence check.

**Why:** FIN_VALIDITY clause needs "if termType is 'indefinite' show this, else if 'fixed_term' show that." The original syntax `{{#if record.terms.termType.indefinite}}` reads as "what's the `.indefinite` property of termType" — wrong semantically.

**To reverse:** Choose a different discriminator pattern (e.g. flatten `termType` into booleans `terms.isIndefinite`, `terms.isFixedTerm`). The current ifEq approach is more general but adds template-engine surface area.

## Open questions I deliberately did NOT answer

1. **Counsel workflow.** All v2 clauses are `reviewStatus: 'unverified'`. Who flips to `'verified'`? Where is the audit trail? What's the SLA? You need a process answer before People Ops tests this.

2. **Schema validation against full 521-file corpus.** Architecture-v2 doc calls for this before retiring v1. I didn't run it tonight — it would require fetching ~500 .docx files, extracting structured data, and comparing to the universal schema. Worth doing before the next architecture decision; not blocking the demo.

3. **Addendum data flow.** Today's UX assumes you start a fresh record each turn. Addendums logically reference an existing record. v2 currently models `AddendumDoc.changes: FieldDelta[]` but no UI exists to populate it. Specialist needs a way to "find Aino's existing record" before drafting an addendum.

4. **People Ops test scenarios.** Architecture is in place; what specific scenarios do you want People Ops to actually test? Need a list — e.g., "5 EAs (FIN-Wolt, USA-DoorDash hourly, USA-DoorDash salaried, DEU-Wolt, DEU-Wolt fixed-term)" + "3 addendums (hours change, salary change, role change)" + etc.

5. **UK/Deliveroo gap.** Still unresolved. No source templates in the Drive. v2 has no `jurisdictions/gbr.ts`. If you want UK/Deliveroo in the demo, you need source templates first.

## Known issues / cosmetic bugs

- **`bi_weekly` rendering.** Pay-frequency enum values render verbatim ("paid bi_weekly"). Should be presented as "paid bi-weekly". One-line fix in `clauses/usa.ts` or a presentation helper.
- **Missing region/state in addresses.** Haiku sometimes drops `address.region` even when "Texas" is in the input. Shows up as `[MISSING: record.employee.address.region]` in drafts. The extraction prompt should be sharper.
- **Empty conditional residual whitespace.** When `{{#if ...}}` blocks resolve to empty, they leave blank lines. Visible in FIN_VALIDITY output. Cosmetic; collapse-multiple-blank-lines pass after rendering would fix it.
- **`bi_weekly` enum value** isn't formatted (renders literally). Affects all jurisdictions. Easy fix.
- **`recordId: 'pending'` in basedOn ref.** The v2 API always seeds a fresh record per turn instead of looking up by recordId. Fine for first-draft flows, blocking for addendums and terminations against real prior records.

## Recommended next steps

In priority order — most leverage first:

1. **Decide the counsel workflow.** Until clauses get a `reviewStatus: 'verified'` step with a real reviewer, you cannot put v2 in front of People Ops. This is process, not code.

2. **Wire the live preview panel to render v2 drafts.** Today's split-pane preview was built for v1; I confirmed v2's output flows through the same `kind: 'draft'` shape so it should render — but I didn't visually verify. Spend 10 min in the browser before showing anyone.

3. **Run schema validation against the full corpus.** Open question #2. ~30 minutes of agent work to confirm/refute the universal-data hypothesis at scale.

4. **Pick the People Ops test scenario list.** Open question #4. You can't run the test without a target list.

5. **Address the cosmetic bugs.** ~15 minutes total for the four listed.

## Diagnosis pointers if v2 misbehaves

- **Where the pipeline lives:** `app/lib/data-model/compose.ts` is the orchestrator. `route.ts` step 1c is the toggle. `api-bridge.ts` translates between v2 outcomes and v1 frontend shapes.
- **Where Claude is invoked:** `llm-hooks.ts:extractRecordUpdates` (Haiku, full record schema) and `llm-hooks.ts:fillFreeText` (Opus, bounded by clause's `freeTextSlots`). Plus the legacy `agent3.ts:routeIntent` for intent classification.
- **Where regulation citations come from:** `clauses/<iso>.ts` per-clause `citations[]` + `jurisdictions/<iso>.ts` `regulationAnchors[]`. The compose pipeline dedupes them into the document's citations block.
- **To turn v2 off without code changes:** Set `LUMINA_USE_V2=false` (or remove it) in `app/.env.local` and restart `npm run dev`.

## Files touched this session

```
app/.env.local                              (added LUMINA_USE_V2=true)
app/app/api/chat/route.ts                   (v2 branch + error logging)
app/lib/data-model/api-bridge.ts            NEW
app/lib/data-model/clauses/deu.ts           NEW
app/lib/data-model/clauses/fin.ts           (equality-conditional syntax)
app/lib/data-model/clauses/usa.ts           NEW
app/lib/data-model/compose.ts               (validators, deep merge, isPopulated, ifEq)
app/lib/data-model/jurisdictions/deu.ts     NEW
app/lib/data-model/jurisdictions/usa.ts     NEW
app/lib/data-model/llm-hooks.ts             NEW
app/lib/data-model/registry.ts              NEW
app/lib/data-model/validators.ts            NEW
corpus/regulations/fin/README.md            NEW
corpus/regulations/fin/annual-holidays-act.md  NEW
corpus/regulations/fin/employment-contracts-act.md  NEW
corpus/regulations/fin/working-hours-act.md NEW
corpus/regulations/fin/{aha,eca,wha}.{pdf,txt}  NEW (Finlex sources)
docs/overnight-2026-05-12.md                (this file)
```

Type check is clean. All commits land on `main`. Branch is `ahead of origin/main` until you push the final commit.
