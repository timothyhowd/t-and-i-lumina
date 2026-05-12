# Mock personas

A small set of fake-but-realistic personas for end-to-end testing. Use these instead of inventing new ones in tests; reusing a fixed set keeps test scenarios reproducible.

> All personas are fictitious. Names follow the `Test Tester` / `Sample Employee A` convention from `docs/POC-LIMITATIONS.md`. Any resemblance to real persons is unintentional and should be reported so the persona is renamed.

## Persona 1 — Test Tester (operational, FIN)

- **Use for:** baseline FIN Grocery Associate scenario; tests the operational-tier clause routing.
- **Greenhouse:** candidate `cand_001`, applied for "Grocery Associate" at Wolt Services Oy.
- **Workday:** worker `wkr_001`, hire date 2026-06-01, location Helsinki, hourly pay-grade B2.
- **Slot status:** filled — full_name, role.title, start_date, work_location, compensation.hourly_rate. Missing — personal_id_code, address (specialist must provide).

## Persona 2 — Sample Employee A (supervisor, FIN)

- **Use for:** FIN Store Manager scenario; tests the senior-protections clause group (IP / Confidentiality / Non-compete / Liquidated damages).
- **Greenhouse:** candidate `cand_002`, applied for "Store Manager" at Wolt Services Oy.
- **Workday:** worker `wkr_002`, hire date 2026-07-15, location Helsinki metropolitan area, fixed monthly EUR.
- **Slot status:** filled — full_name, role.title, start_date, work_location, compensation.monthly_eur. Missing — personal_id_code, address (specialist must provide).

## Persona 3 — Demo Persona 1 (operational, FIN, fixed-term)

- **Use for:** fixed-term contract scenario; tests `termType=fixed_term` routing (fixed_term_extras clause group).
- **Greenhouse:** candidate `cand_003`, applied for "Grocery Associate" at Wolt Services Oy.
- **Workday:** worker `wkr_003`, hire date 2026-08-01, location Tampere, hourly pay-grade B2, end date 2026-12-31.
- **Slot status:** filled — full_name, role.title, start_date, end_date, work_location, compensation.hourly_rate. Missing — personal_id_code, address, fixed_term_reason (specialist must provide).

## Persona 4 — Sample Employee B (supervisor, FIN, shiftwork)

- **Use for:** Support Associate / shiftwork scenario; tests both `senior_protections` and `shiftwork_premiums` clause groups composing.
- **Greenhouse:** candidate `cand_004`, applied for "Customer Support Lead" at Wolt Oy.
- **Workday:** worker `wkr_004`, hire date 2026-09-15, location Helsinki, schedule shiftwork excluding nightwork, weekend premium 8%.
- **Slot status:** filled — full_name, role.title, start_date, work_location, schedule_type, weekend_premium, compensation.monthly_eur. Missing — personal_id_code, address (specialist must provide).
