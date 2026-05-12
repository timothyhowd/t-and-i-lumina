# Mock systems

JSON fixtures shaped like real Greenhouse and Workday API responses, used by Agent 2 (Data Collection) during PoC.

## Why this exists

Per [`docs/POC-LIMITATIONS.md`](../../docs/POC-LIMITATIONS.md), the PoC does not call real HRIS systems. Agent 2 reads these JSON files as if they were live API responses. When the PoC graduates and real API credentials become available, the swap is mechanical: Agent 2's logic stays put; only the fetch layer changes.

## Conventions

- **Fake personas only.** Names follow the pattern `Test Tester`, `Sample Employee A`, `Demo Persona 1`. No real names — not even hypothetical ones a stranger could mistake for a real person.
- **Real legal entities are OK** (they're public). The mock employees work for them in the fixtures.
- **Real city/address strings are OK** for entities. Mock employees never live at real addresses.
- **JSON shape mirrors the real API** as closely as we can without paying for an integration. Where we guess, the field is annotated with `_note: "shape-guess; verify when real API access lands"`.

## Files

- `greenhouse.json` — candidates and offers, shaped like Greenhouse's `/candidates` and `/offers` responses.
- `workday.json` — workers, positions, and compensation, shaped like Workday's WQL output.
- `personas.md` — human-readable directory of which mock personas exist, with what attributes, used for which test scenarios.

## What lives where (mapping to slots)

The slot schema in `corpus/templates/fin-wolt-employment-agreement.schema.json` specifies a `sourceHint` for every slot. This is the contract between Agent 2 and the fixtures:

| slot | sourceHint | found in |
|------|------------|----------|
| `employee.full_name` | greenhouse | `greenhouse.json → candidates[].first_name + last_name` |
| `employee.address` | specialist | (not in fixtures — must be asked of the specialist) |
| `employee.personal_id_code` | specialist | (sensitive — never auto-fetched) |
| `employment.start_date` | workday | `workday.json → workers[].hire_date` |
| `role.title` | greenhouse | `greenhouse.json → candidates[].application.role.title` |
| `compensation.monthly_eur` | workday | `workday.json → workers[].compensation.base_pay` |
| `working_place.value` | workday | `workday.json → workers[].location.primary` |

Fields not represented in either fixture are slots that must come from the specialist directly (sensitive PII, structural choices like `termType`, etc.) — that's by design, not an omission.
