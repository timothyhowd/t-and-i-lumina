# Lumina architecture — v2 proposal

> **Status:** Proposal, not yet adopted. Sketch built alongside v1 in `app/lib/data-model/`. The v1 agent stack (`app/lib/agents/`) remains the running architecture until this is reviewed and adopted.
>
> **Triggered by:** Cross-document analysis (`docs/cross-doc-analysis.md`, 2026-05-12) confirmed that data fields are largely universal across countries/brands/doc-types and that variance lives in clause text, not slot schemas.

## The thesis

The current architecture (v1) treats every `(country, brand, doc_type)` triple as its own template with its own slot schema. That makes sense IF the data shape genuinely varies per triple. It doesn't. The analysis sampled 17 documents across 5 countries and 3 doc types: ~12 data fields recur in every employment agreement; country adds 1–3 fields on top; the variance is overwhelmingly in clause prose and citations, not in slot structure.

**Doc-type, not country, is the primary axis of slot variance.** A termination drops ~30% of EA slots; country diff between FI and PL adds maybe two fields. Today's architecture has the dimensions backwards.

## Three layers

```
┌──────────────────────────────────────────────────────┐
│  Layer 3 — CLAUSES (jurisdiction-specific data)      │
│  Markdown templates + regulation citations           │
│  app/lib/data-model/clauses/<iso>.ts                 │
└────────────────────┬─────────────────────────────────┘
                     │
                     │ selected by
                     ▼
┌──────────────────────────────────────────────────────┐
│  Layer 2 — JURISDICTION RULES (per country × type)   │
│  Required fields, validators, clause selection       │
│  app/lib/data-model/jurisdictions/<iso>.ts           │
└────────────────────┬─────────────────────────────────┘
                     │
                     │ operates on
                     ▼
┌──────────────────────────────────────────────────────┐
│  Layer 1 — EMPLOYMENT RECORD (universal data model)  │
│  One schema, all countries, all doc types            │
│  app/lib/data-model/employment-record.ts             │
└──────────────────────────────────────────────────────┘
```

### Layer 1 — `EmploymentRecord` (universal)

Canonical state of an employment relationship at a point in time. ~30 attributes, optional where they vary by jurisdiction. One type, used by every doc type.

```ts
EmploymentRecord {
  recordId, recordVersion,
  jurisdiction: { country, brand },
  employee: Person,
  employer: LegalEntity,
  position: Position,
  terms: EmploymentTerms,
  schedule: WorkSchedule,
  compensation: Compensation,
  flags: EmploymentFlags,
  metadata
}
```

National identifiers are a discriminated union (`fi_henkilotunnus | us_ssn | uk_ni_number | ...`) — same concept, different format, one type. Documents reference a record by `{ recordId, recordVersion }`; addendums describe `FieldDelta[]` against a frozen version.

### Layer 2 — Jurisdiction rules (per country × doc type)

One rule object per `(country, doc_type)` combination. Says:

- Which `FieldPath`s must be populated (required fields).
- Which validators apply (max trial period, currency, conditional requirements).
- Which clauses are pulled in, in what order, under what conditions.
- Which statutes anchor the citations.

Example structure for FIN × employment_agreement is ~70 lines (see `app/lib/data-model/jurisdictions/fin.ts`). Adding a new country = one new file at this layer + clause library entries; no data-model changes.

### Layer 3 — Clause library

The actual legal prose. Markdown with `{{record.path}}` placeholders and `{{#if record.path}}...{{/if}}` conditionals. Per-country files at `app/lib/data-model/clauses/<iso>.ts`.

Clauses are **data, not generated text**. Claude composes documents by selecting and rendering clauses; it does not invent legal wording. Free-text slots (e.g., the duties bullet list) are bounded by per-slot guidance + max-char limits.

This is the architectural fix that lets us claim "real regulation grounding" instead of "[⚠ Citation pending legal review]" placeholders. The clause body cites a specific section of a specific statute; the citations block lists every statute referenced.

## How a request flows through v2

User: *"New Wolt Finland hire — Aino Mäkinen, Helsinki, €3,400/month, permanent, starts August 1, 2026."*

1. **Intent + extract (Haiku)** — Map the message to `Partial<EmploymentRecord>` updates: `{ employee.fullName, employer.brand, jurisdiction.country, compensation.base, terms.termType, terms.startDate, ... }` and a target doc type (`employment_agreement`).
2. **Merge into record** — If no existing record, initialize. Bump version. Persist.
3. **Lookup jurisdiction rule** — `jurisdictions.get('FIN', 'employment_agreement')` returns `FIN_EMPLOYMENT_AGREEMENT`.
4. **Validate** — Walk `rule.requiredFields`. Missing fields surface as `validation.missing` (drives the "needs_input" UX). Validators run conditional checks (trial-period cap, currency must be EUR, fixed-term reason required when term is fixed).
5. **Select clauses** — Iterate `rule.clauses`, filter by `appliesWhen` against the record, sort by `order`. Returns `[fin.parties, fin.validity, fin.working_hours, fin.duties, fin.compensation, fin.annual_leave, fin.notice_period, fin.signature]` (no trial period block — Aino's record didn't request one).
6. **Render** — Substitute `{{record.employee.fullName}}` → "Aino Mäkinen", resolve conditionals, invoke Opus only for free-text slots (the duties bullet list). Assemble.
7. **Citations** — Collect every `Clause.citations[]` + `rule.regulationAnchors[]`, dedupe, render as a block. References the Employment Contracts Act, Working Hours Act, Annual Holidays Act with section anchors.

Steps 3–5 and 7 are pure functions. Steps 1 and 6 are bounded LLM calls. No step asks Claude to draft a clause from scratch.

## What v2 fixes that v1 doesn't

| Concern | v1 (current) | v2 (proposed) |
|---|---|---|
| Adding a new country | New slot schema per (country × brand × doc-type) | One jurisdiction file + clause file |
| Clause grounding | Claude generates → `[⚠ Citation pending legal review]` | Clause text is authored data with real statute citations |
| Addendums | Need a separate addendum schema per template | `FieldDelta[]` against any record version — generic |
| Comparing same clause across countries | Hard — clauses live inside different schemas | Trivial — `clauseLibrary.byTopic('notice_period')` |
| People-Ops test viability | Output looks plausible but isn't defensible | Output cites real statutes, can be reviewed by counsel before broader use |
| Conflating data with prose | Yes — schema and template fused | No — three clean layers |

## Migration path (not green-field)

1. **Land the types alongside v1.** Done — `app/lib/data-model/*` is the sketch. No production code imports it yet.
2. **Write the FIN × employment_agreement rule and clauses.** Done in sketch form. Counsel review needed to flip `reviewStatus: 'unverified'` → `'verified'`.
3. **Implement `compose()` against the new types.** Replace the Agent 1/2/3 split. Keep the existing `/api/chat` route shape; only the orchestrator behind it changes.
4. **Wire one path end-to-end** (FIN × employment_agreement) and verify output matches or improves on the v1 draft for the same input.
5. **Add USA, Germany, Poland, Australia jurisdiction files** (one file each, ~50 lines per country). Cross-doc analysis already characterized what each needs.
6. **Retire v1.** Delete `app/lib/agents/agent1.ts`, `agent2.ts`, the slot-schema JSON, and the corpus inventory's "unparsed_but_in_corpus" branch — v2 doesn't need them.

Estimated effort: 2-3 sessions to land step 3, 1 session per country for step 5. Counsel review of clause text is the actual long pole, not the code.

## Open questions

1. **Regulation text in the corpus.** v2 makes citations real, but the underlying statutory text still has to live somewhere — either in the clause file as `quotedText`, in a parallel `regulations/<iso>.md` corpus, or pulled at runtime via retrieval. Recommendation: in-corpus markdown extracts for the PoC (no retrieval infra needed); migrate to retrieval later.
2. **Brand layer.** The cross-doc analysis suggests brand variance is mostly cosmetic (logo, entity legal name, signatory) and lives in `config/legalEntities.ts` (per CLAUDE.md). Confirm with a Wolt × DoorDash × Deliveroo comparison once UK/Deliveroo templates are sourced.
3. **Schema validation against full corpus.** Cross-doc analysis sampled 17 of 521 files. Before retiring v1, run the universal schema against all 521 and confirm <10% of documents need >2 jurisdiction-specific fields.
4. **Counsel relationship.** The "clauses are authored data" model requires counsel to maintain the clause library. Need a workflow: who reviews? How are versions tracked? Where does the audit trail live?
5. **Addendum data flow.** Today's UX builds a full record each session; addendums logically reference an existing record. Need a way for People Ops to find an existing record (Greenhouse/Workday integration, or a manual lookup) before drafting an addendum.

## Where the real AI value lives in v2

Compared to v1 — where Claude is asked to do everything from intent routing to clause generation — v2 narrows Claude's job to three high-leverage tasks:

1. **Messy natural language → structured `Partial<EmploymentRecord>`.** Haiku-class. Genuine value: extraction is hard, schemas don't extract themselves.
2. **Reasoning over record + jurisdiction layer to surface gaps.** "You've set part-time hours but didn't confirm Sunday-work consent — Finland requires that for shiftwork." This is the non-deterministic reasoning the current architecture under-uses.
3. **Composing bounded free-text inside known clauses.** Duties description, delta summaries for addendums, gap-bridging recommendations. Never the legal frame; always inside it.

Claude is not asked to invent legal text. Counsel writes the clauses; Claude composes documents.
