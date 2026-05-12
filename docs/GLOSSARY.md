# Lumina glossary

Short, authoritative expansions of internal acronyms and project terms. Add to it; don't re-derive.

## Project terms

| Term | Expansion / meaning |
|------|---------------------|
| **Lumina** | This project. AI-driven HR document automation across DoorDash / Wolt / Deliveroo. See [CLAUDE.md](../CLAUDE.md). |
| **PoC** | Proof of Concept. The current phase; see [POC-LIMITATIONS.md](./POC-LIMITATIONS.md). |
| **The three agents** | Agent 1 Template Management, Agent 2 Data Collection, Agent 3 Generate Documents. See [agent-architecture.md](./agent-architecture.md). |
| **Provenance triple** | `(templateVersion, corpusSnapshotId, regulationSnapshotId)` recorded per generated document. |
| **Slot** | A typed fillable field in a template (e.g. `employee.full_name`, `compensation.monthly_eur`). See `corpus/templates/_types.ts`. |
| **Clause group** | A bundle of related clauses that appear together based on a routing condition (e.g. `senior_protections` applies when `roleTier ∈ [supervisor, specialist]`). |
| **Routing axis** | A key that drives which template / which clause groups apply (e.g. `termType`, `roleTier`, `scheduleType`). Not a fill-slot. |
| **Source hint** | Where Agent 2 should look first for a slot value: `greenhouse`, `workday`, `specialist`, or `derived`. |

## Corpus naming conventions (Wolt FIN templates)

These are the acronym expansions used in filenames in the shared Drive.

| Acronym | Expansion |
|---------|-----------|
| **FIN** | Finland |
| **WM** | Wolt Market (the grocery business unit) |
| **GA** | Grocery Associate (a role in WM) |
| **CBA** | Collective Bargaining Agreement |

## Finnish-employment-law terms encountered

Confirmed via observed corpus, not legally verified. Do not cite section numbers from here — see [POC-LIMITATIONS.md](./POC-LIMITATIONS.md).

| Term | Meaning |
|------|---------|
| **HETU** | Henkilötunnus — Finnish personal identity code. Slot `employee.personal_id_code`. Sensitive PII. |
| **ECA** | Employment Contracts Act (Työsopimuslaki) — primary Finnish employment statute. |
| **TyEL** | Workers' Pensions Act regime — Finnish mandatory employer pension. |
| **Lomaraha** | Holiday bonus — common Finnish CBA-provided supplement to annual leave pay. |

## External tools / systems referenced

| Name | Role in Lumina |
|------|----------------|
| **Greenhouse** | Applicant tracking system. Source for early-stage candidate + offer data. Mocked in `corpus/mock-systems/greenhouse.json` during PoC. |
| **Workday** | HRIS / payroll. Source for post-offer worker data: position, compensation, location, legal entity. Mocked in `corpus/mock-systems/workday.json` during PoC. |
| **DocuSign** | Signature routing. Not integrated in PoC. |
| **Finlex** | Finnish statutory database (finlex.fi). Reference source for regulation-watch on Finnish law. Not actively integrated in PoC. |
| **EY** | The consulting firm running the current template-maintenance process. The PoC's eventual side-by-side comparison target — currently blocked by absence of EY outputs in the shared Drive. |
