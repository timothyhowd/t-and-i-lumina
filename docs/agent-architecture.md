# Lumina — Agent Architecture (PoC v0.1)

> Status: design draft. The contracts described here are the working agreement between the three agents and the corpus/template schema. Implementation lives in `app/` (to be scaffolded). The slot/clause schema lives in `corpus/templates/`.

---

## Mental model

Lumina is **three agents behind one conversation**.

The specialist talks to a single chat surface (`Agent 3 — Generate Documents`). That agent owns the conversation and orchestrates two upstream agents — one for templates and regulations (`Agent 1`), one for data (`Agent 2`). The specialist never talks to Agent 1 or 2 directly.

```
                       ┌───────────────────────────┐
                       │  Specialist (chat UI)     │
                       └────────────┬──────────────┘
                                    │
                          ┌─────────▼─────────┐
                          │  Agent 3          │
                          │  Generate Docs    │
                          │  (conversation +  │
                          │   orchestration)  │
                          └────┬──────────┬───┘
                  selectTemplate│          │collectData
                  logFeedback   │          │
                       ┌────────▼──┐  ┌────▼────────┐
                       │  Agent 1  │  │  Agent 2    │
                       │ Templates │  │ Data        │
                       │ + Regs    │  │ Collection  │
                       └────┬──────┘  └────┬────────┘
                            │              │
                  ┌─────────▼──────┐  ┌────▼────────┐
                  │ corpus/        │  │ mock-systems│
                  │ templates/     │  │ (gh/workday)│
                  └────────────────┘  └─────────────┘
```

---

## Agent 1 — Template Management

**Responsibility.** Owns the template library, the regulation index, and the relationship between them. Surfaces emerging regulation changes to legal for review. Versions every approved template.

### Capabilities

- Select the right template for a given (country, brand, doc type, context).
- Hold a versioned, approved library — every template carries an approval timestamp and approver.
- Watch regulation sources (Finlex, GOV.UK, US state APIs, etc.) on a cadence; surface candidate updates to legal with confidence and rationale.
- Accept feedback from Agent 3 about clause-level edits specialists requested; aggregate as input to future regulation/template updates.

### Human-in-the-loop

Legal reviews **proposed regulation-driven template updates** before they're applied. Generation never blocks on this — until approval lands, the active version remains the previously-approved one. The PoC does not run the regulation-watch loop in autonomous mode; we will gate it behind a confidence threshold (defined with legal) before the loop runs unattended.

### Interface (sketch)

```ts
// What Agent 3 asks for to pick a template
selectTemplate(input: {
  country: Country;
  brand: Brand;
  docType: DocType;
  context: Partial<RoutingContext>;
}): {
  templateId: string;
  version: string;
  status: 'approved' | 'draft-poc-unverified';
  approvedAt: ISO8601 | null;
  schema: TemplateSchema;     // routing axes, slots, clause groups
}

// What Agent 3 reports back after specialist sign-off
logTemplateFeedback(input: {
  templateId: string;
  version: string;
  feedbackType: 'edit_request' | 'clause_issue' | 'missing_clause';
  diff?: string;
  rationale?: string;
}): { ack: true }

// Agentic loop — not invoked by Agent 3; runs on cadence
scanForRegulationChanges(): {
  proposedUpdates: Array<{
    templateId: string;
    currentVersion: string;
    regulationDelta: RegulationDelta;
    proposedDiff: string;
    confidence: number;        // 0..1; gated against legal-review threshold
    rationale: string;
  }>;
}
```

---

## Agent 2 — Data Collection

**Responsibility.** Given a template's slot schema and what we know about the employee, fulfill as many slots as possible from connected systems; identify the missing ones; recommend slots the template *should* be asking for but isn't yet.

### Capabilities

- Query connected systems (Greenhouse, Workday) for known data points. (PoC: mocked with realistic shims.)
- Evaluate `requiredIf` conditions against routing context before declaring a slot "missing."
- Batch missing-data prompts into a single ask, not five separate ones.
- For `sensitive: true` slots (HETU, SSN, etc.) **never** auto-fetch; always route to the specialist.
- Learn over time which slots are routinely missing → recommends template additions back to Agent 1.

### Human-in-the-loop

None directly. Missing-data asks surface through Agent 3's conversation; the specialist responds there.

### Interface (sketch)

```ts
collectData(input: {
  slotSchema: SlotDefinition[];
  routingContext: RoutingContext;
  employeeRef?: string;          // Greenhouse / Workday ID
  knownContext: Record<string, unknown>;
}): {
  filled: Array<{
    slot: string;
    value: unknown;
    source: 'greenhouse' | 'workday' | 'specialist_input' | 'derived';
    confidence: number;
  }>;
  missing: Array<{
    slot: string;
    reason: 'not_in_systems' | 'low_confidence' | 'requires_specialist';
    askPrompt: string;
  }>;
  suggested: Array<{
    slot: string;
    rationale: string;
  }>;
}
```

---

## Agent 3 — Generate Documents

**Responsibility.** Owns the specialist conversation. Picks the doc type from natural-language intent. Calls Agent 1 to select a template. Calls Agent 2 to fill it. Asks the specialist for anything still missing. Renders the document. Routes for sign-off. Records provenance.

### Capabilities

- Conversational surface (the only one the specialist sees).
- Routes natural-language intent to (country, brand, doc type) — uses Claude Haiku for cheap classification.
- Renders the final document with watermark + provenance block (per `docs/POC-LIMITATIONS.md`).
- Records the **provenance triple**: `(templateVersion, corpusSnapshotId, regulationSnapshotId)` per generated doc.
- Captures specialist edits as feedback and routes to Agent 1.

### Human-in-the-loop

Specialist signs off on every generated document. The PoC does not include autonomous finalization. Specialist edits flow back to Agent 1 as template-feedback signals.

### Provenance contract

Every generated document carries a `provenance` block. If any component is missing, generation is **blocked**, not warned (per `docs/POC-LIMITATIONS.md` failure principle).

```ts
type GenerationProvenance = {
  documentId: string;
  templateId: string;
  templateVersion: string;
  corpusSnapshotId: string;
  regulationSnapshotId: string;     // may be null in PoC; that's OK
  generatedAt: ISO8601;
  specialistId: string;
  pocMode: true;                    // always true in PoC; gates real-system writes
};
```

For PoC storage, provenance records are appended one-per-line to `app/data/generations.jsonl`. No database until needed.

---

## Shared types

Live in [`corpus/templates/_types.ts`](../corpus/templates/_types.ts). The load-bearing ones:

- `TemplateSchema` — the manifest a template publishes (routing axes + slots + clause groups + baseline sections).
- `SlotDefinition` — one fill-slot, with type, source hint, ask prompt, and intent note.
- `ClauseGroup` — a bundle of clauses that appear conditionally based on routing context.
- `ClauseCondition` — `eq | in | all | any | not` over routing keys. Lets Agent 1 evaluate which clause groups apply without legal text leaking into config.

---

## End-to-end flow (one cycle)

```
specialist: "I need an employment agreement for a new Grocery Associate
            starting in Helsinki, fixed-term until December"

  Agent 3 → routes intent → (country=FIN, brand=wolt, docType=employment_agreement,
                              routingContext={ roleTier: operational, termType: fixed_term })
  Agent 3 → Agent 1.selectTemplate(...)
  Agent 1 → returns templateId=fin.wolt.employment_agreement, schema attached

  Agent 3 → Agent 2.collectData(schema.slots, routingContext, employeeRef)
  Agent 2 → returns { filled: [name, role.title, start_date],
                      missing: [hetu, address, salary, ...],
                      suggested: [] }

  Agent 3 → specialist (chat): "I have name, title, start date.
                                 I need: HETU, address, salary,
                                 fixed-term end date, fixed-term reason.
                                 Please provide."
  specialist → provides

  Agent 3 → evaluates clause groups (fixed_term_extras applies; senior_protections
            does not since roleTier=operational)
  Agent 3 → renders draft with watermark + provenance block + ⚠ on every
            citation that is not yet legal-approved
  Agent 3 → specialist signs off OR requests edits
  if edits → Agent 1.logTemplateFeedback(...)
  Agent 3 → appends provenance to generations.jsonl
```

---

## Why three agents and not four

Earlier sketch considered a fourth orchestrator above the three. We collapsed that into Agent 3 deliberately:

- The conversation is the user-facing surface; co-locating it with the orchestration keeps the model that *talks* to the specialist also responsible for *deciding what to fetch*.
- A separate orchestrator adds a layer without buying anything at PoC scale.
- If we later need a true orchestrator (e.g. for parallel workflows, scheduled actions), we lift it out of Agent 3 then.

---

## What this design does NOT yet decide

These remain open and are listed in `docs/DECISIONS-PENDING.md`:

- Whether Agent 1's regulation-watch loop runs in PoC scope or is deferred entirely.
- Concrete confidence threshold for surfacing regulation changes to legal.
- Whether the slot schema language ships as JSON, TypeScript, or both.
- Whether `app/data/generations.jsonl` is the right provenance store for PoC, or if we want SQLite from day one.
