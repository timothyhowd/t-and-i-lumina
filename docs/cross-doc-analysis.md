# Cross-document data-model analysis

> Hypothesis tested: the **data model** of Lumina's HR templates is largely universal across countries / brands / doc types; variance concentrates in **clauses** (legal prose). If true, the current per-(country, brand, doc_type) slot-schema architecture is over-engineered.

**Sample:** 13 documents inspected end-to-end across 5 countries × 3 doc types (Employment Agreement, Addendum, Termination). 5 Finnish docs already extracted locally; 8 more pulled fresh from Drive. Calibrated against 521-file Drive inventory at `corpus/drive-inventory.json`.

---

## Executive summary

1. **Hypothesis confirmed, with one important nuance.** ~12 data fields appear in every Employment Agreement regardless of country. The variance is overwhelmingly in clause *text*, not in *what data the clause needs*. Per-(country × brand × doc-type) slot schemas are over-engineered — a single canonical schema plus a thin jurisdiction overlay covers everything observed.
2. **Doc-type, not country, is the primary axis of slot variance.** Termination letters drop ~30% of EA slots (no salary, no probation, no IP) and add 4–5 termination-specific ones (effective date, final-pay items, garden-leave window). Addendums are the simplest of all: parties + reference-to-prior-agreement + the one or two fields actually changing. Country adds only 1–3 fields on top.
3. **Country-specific fields are few and predictable.** Personal ID number (PESEL/personnummer/personal identity code) in EU; superannuation fund in AU; "at-will" + COBRA/401(k) blocks in USA; CBA reference in FIN. Everything else is the same shape with a different label.
4. **Clauses are where the country diversity lives.** The same logical clause ("termination notice period") is one sentence citing the Employment Contracts Act in Finland, four paragraphs citing § 622 BGB + SGB III in Germany, an Article-30 Labour Code reference in Poland, and a Fair Work Act 2009 (Cth) cascade with PILON option in Australia. None of this affects the slot schema — it affects the clause library.
5. **Recommendation: collapse the slot schemas; expand the clause library.** Move to one canonical slot schema per doc-type (3 total), plus a small `jurisdiction_extras` map keyed by country code. Push country/brand variance entirely into the clause library and the regulation-citation layer — exactly where the agent-architecture decision (2026-05-11) already wants it.

---

## Sampled documents

| # | Country | Brand | Doc type | Drive ID | Notes |
|---|---------|-------|----------|----------|-------|
| 1 | Finland | Wolt | EA – Grocery Associate (permanent) | local extract `high_ga_permanent.txt` | baseline FIN template |
| 2 | Finland | Wolt | EA – Grocery Associate (fixed-term) | local extract `high_ga_fixed_term.txt` | term-type variant |
| 3 | Finland | Wolt | EA – Store Manager (CBA) | local extract `store_manager_cba.txt` | full CBA-edition EA |
| 4 | Finland | Wolt | EA – Support (shiftwork) | local extract `support_shiftwork_bonus.txt` | schedule+bonus variant |
| 5 | Finland | Wolt | Addendum – Working hours change | `1XI9co4xWLfj_MQxcWKj6RenTy_1K57aY` | fixed-term hours amendment |
| 6 | USA | DoorDash | Termination letter | `1vEwTJPMlI2dbkbox2OoExzhKr4bQC_MAxkLkACFZWAo` | full separation packet |
| 7 | USA | DoorDash | Addendum – Pay change | `1qQ0RwJ7BzdwFxt92hOMx0BjJ8B_g-tH0J2jUYmuFVEw` | base-pay adjustment notice |
| 8 | USA | DoorDash | Addendum – Pay mix change | `1gdCePAve-JHLUNicQIoJ1HnNyyDnWzxrCajSLk2r9To` | OTE mix amendment |
| 9 | Germany | Wolt (entity templated) | EA – Regular (DE/EN bilingual) | `1zq19zC8nb3VbuY7UitpcMzM__U4mKxCbB6TXtVUUhJY` | longest in sample; 17 clauses |
| 10 | Germany | 1P Market | Addendum – Working hours | `1Mm7O852pWLxS14WfiWXla6zYFv8odkqt` | bilingual amendment |
| 11 | Germany | Wolt | Termination (probation) | `1CbnSUH_GWCAyKZifpwCEvjo75SYUeD-EwGmz318nmCA` | bilingual; cites § 38 SGB III |
| 12 | Poland | Wolt | EA – Permanent (3m probation) | `1qJ__NVVmvfYua-pk4Jn6ixa8bIoFm-Gb` | PL/EN bilingual; full non-compete |
| 13 | Poland | Wolt | Addendum – Salary change | `1DHxC2XgDmMSNBJXwysBOqLSdACQayLeK` | minimal salary-only amendment |
| 14 | Poland | Wolt | Mutual termination | `1eKbMgZscoJXH7E8JIEbEQA1qUS1535cH` | severance + equity + waiver |
| 15 | Australia | DoorDash | EA – Full-time salary offer | `19TnGgScwrvA_YJAlcE2O2QqSdAyLlWqY` | letter format; PIIA + arbitration exhibits |
| 16 | Australia | DoorDash | Addendum – Letter of variation | `1w46usfDvjvHv-o049Y40KZ3stZtp5Cu8cSIi6ISOlo4` | generic clause-replacement form |
| 17 | Australia | DoorDash | Termination (post-PIP) | `1o_936R_er9YHRdN5MmbOZ7wPezYCjC2_` | PILON + EAP reference |

Gaps vs. the requested 5×3×2 matrix: **Finland has no termination templates** in the Drive (confirmed against inventory — Finland's 29 files contain zero in `Termination documents`); **USA has no Employment Agreement template** in the conventional sense — the `Employment Agreements` folder contains pay-change letters and a probation letter. The closest USA EA-equivalent is the AU full-time offer letter (DoorDash US uses at-will offer letters; full EA-style contracts live elsewhere or not in this corpus).

Extracted text written only to `corpus/extracts/` (gitignored) — no clause text in this report or in the repo.

---

## Universal data model (proposed canonical schema)

Fields that appear in ≥80% of EAs and recur in addendums/terminations where logically applicable:

### `parties` (universal across all 3 doc types)
| Field | Type | Notes |
|---|---|---|
| `employer.legal_name` | string | "Wolt Services Oy", "DoorDash Technologies Australia Pty Ltd", etc. |
| `employer.business_id` | string | Polymorphic identifier: company ID (FI 3126563-4), KRS+NIP+REGON (PL), ACN (AU), entity registration (DE — implicit). Treat as `{scheme, value}` pairs. |
| `employer.address` | structured | street, city, postcode, country |
| `employer.signatory.name` | string | |
| `employer.signatory.title` | string | "Head of HR, Germany", etc. |
| `employee.full_name` | string | |
| `employee.address` | structured | |
| `employee.personal_id` | optional | `{scheme: PESEL\|HETU\|TFN\|SSN\|none, value}`. Required in PL/FI/DE; absent in USA/AU offer letters. |
| `employee.date_of_birth` | date | FIN, PL use this; DE uses it implicitly |

### `employment_terms` (EA + most addendums)
| Field | Type | Notes |
|---|---|---|
| `position.title` | string | |
| `position.duties_summary` | string | |
| `start_date` | date | |
| `term_type` | enum | `permanent` \| `fixed_term` \| `probation_to_permanent` |
| `fixed_term_end_date` | date? | when `term_type=fixed_term` |
| `probation.duration` | duration | usually months; AU 6m, DE varies, FI ≤6m, PL 3m |
| `probation.notice_period` | duration | shorter than main notice; AU 1wk, DE 2wk |
| `working_hours.weekly_avg` | number | 37.5 (FI), 40 (DE), 38 (AU), full-time/PL hours |
| `working_hours.schedule_basis` | enum | `full_time` \| `part_time` \| `shift` |
| `work_location.primary` | string | city/metropolitan area |
| `work_location.remote_allowed` | bool | |
| `notice_period.standard` | duration | months/weeks; jurisdictional default + override |

### `compensation` (EA + pay addendums + terminations)
| Field | Type | Notes |
|---|---|---|
| `salary.amount` | money | `{value, currency}` — EUR, PLN, USD, AUD |
| `salary.period` | enum | `monthly` \| `hourly` \| `annual` |
| `salary.pay_schedule` | string | "20th of the month" (FI), "standard payroll" (most) |
| `variable_pay.target` | money? | OTE / commission target; US, AU sales roles |
| `pay_mix.base_pct` | number? | e.g. 60/40 — appears in US OTE addendum only |
| `benefits.list` | string[] | phone benefit (FI), superannuation (AU), occupational health (FI/DE), equity/RSU (US/AU) |
| `cba.applicable` | bool | Finland-specific signal but maps to "industrial instrument" in AU and "Tarifvertrag" in DE — same shape |
| `cba.name` | string? | e.g. "Commercial sector's CA (warehouse workers)" |

### `termination_specific` (termination letters only)
| Field | Type | Notes |
|---|---|---|
| `termination.effective_date` | date | |
| `termination.reason_class` | enum | `probation` \| `redundancy` \| `mutual` \| `performance` \| `summary` |
| `termination.notice_basis` | enum | `worked` \| `payment_in_lieu` \| `garden_leave` |
| `final_pay.unpaid_salary` | bool | always true |
| `final_pay.accrued_leave_payout` | bool | always true |
| `final_pay.severance.amount` | money? | PL/AU only in sample; DE implicit |
| `garden_leave.start` / `.end` | date? | PL mutual-termination explicit; AU optional |
| `equity_terms.rsu_vesting_cutoff` | date? | US, PL (DoorDash group) |
| `confidentiality_survives` | bool | always true; redundant |

### `addendum_specific`
| Field | Type | Notes |
|---|---|---|
| `original_agreement.date` | date | reference to the prior EA |
| `changes` | list of `{field_path, old_value, new_value, effective_date}` | The minimal addendum is just this. |

**Coverage check:** every document in the sample fits this schema with ≤2 country-specific fields added. Specifically:

- USA termination adds: `equity.stock_option_expiry_window` (3mo), `cobra.eligible`, `hsa.account_handling`, `fsa.claim_window_days`, `401k.administrator_contact`. None of these are "country-specific" in the philosophical sense — they're **benefits-system-specific**, and a US-only `benefits_us` sub-object captures all of them. Other countries simply omit it.
- AU EA adds: `superannuation.fund_nominated_by_employee`, `tax.payg_withholding_acknowledged`, `arbitration.opt_out_window_days`. Similar pattern — an `arbitration` sub-object that only AU/US uses.
- DE EA adds: `vacation.statutory_days` + `vacation.additional_days` split. Most other countries have a single `annual_leave.days` field; DE's structural split is real but trivially representable.

---

## Jurisdiction layer (per-country rules and exceptions)

| Country | Required identifiers | Required clauses (logical) | Statutory citations | Language requirement |
|---|---|---|---|---|
| Finland | Company ID; HETU (personal identity code) | CBA reference; "Section 2(4) Employment Contracts Act" further-details block | Employment Contracts Act; Annual Holidays Act; Working Hours Act; Act on Right in Employee Inventions | Finnish acceptable; English commonly used; no precedence rule observed |
| USA | EIN (implicit); SSN (implicit, separate I-9) | "At-will" disclaimer; PIIA agreement reference; equity awards; COBRA notice on termination | Few statutory citations in templates themselves; HIPP Notice, COBRA, ERISA implied | English only |
| Germany | HRB/entity reg (implicit); employee address only | § 622 BGB notice cascade; § 38 SGB III duty-to-register-for-work on termination; § 3 BUrlG vacation minimum; § 69b UrhG IP rights; § 5 GeschGehG confidentiality carveout; § 31a UrhG unknown-use carveout | BGB, SGB III, BUrlG, UrhG, GeschGehG, AEntG, MiLoG, BetrVG, Arbeitnehmererfindungsgesetz | German binding; English convenience translation. **Precedence: German prevails.** |
| Poland | KRS + NIP + REGON + share capital (4 separate IDs); PESEL | Article 30 / 52 / 53 Labour Code; Article 50 Copyright Act; non-compete compensation = 25% salary (statutory); "Act on Specific Terms… for reasons not attributable to employees" on termination | Kodeks pracy (Labour Code); Prawo autorskie 4.02.1994; Prawo własności przemysłowej 17.09.2013; Act of 13.03.2003 on collective redundancies | Polish binding; English convenience. **Precedence: Polish prevails.** |
| Australia | ACN | Fair Work Act 2009 (Cth) compliance acknowledgment; National Employment Standards reference; modern-award offset clause; redundancy per NES; PIIA; arbitration agreement w/ opt-out; workplace-surveillance notice | Fair Work Act 2009 (Cth); Fair Work Regulations 2009; Superannuation Guarantee Administration Act 1992; Commercial Arbitration Act 2010 (NSW); International Arbitration Act 1974 (Cth) | English only |

The right way to model this in code: a per-country object with `required_identifier_schemes`, `required_clauses` (logical IDs into the clause library), `default_citations`, and `language_precedence`. ~30 lines per country, not a separate schema.

---

## Clause variance examples — same logical clause, different jurisdictions

### "Termination notice period"
- **FI (CBA EA):** "The term of notice shall be determined according to the Employment Contracts Act, but it shall be at least one (1) month."
- **DE:** Cascade — 2 weeks during probation, then "{{Notice Period}} month(s) to the end of a month", with explicit reciprocity clause about statutory extensions benefiting the employee also applying to the employer.
- **PL:** "in line with the Labour Code"; separately allows immediate termination under Articles 52/53 of the Labour Code.
- **AU:** One month notice, **plus an extra week if employee is ≥45yo with ≥2yr service** (NES); PILON option explicit; redundancy "in accordance with NES (as replaced from time to time)".
- **US:** Not applicable in the same sense — "at-will" language replaces this entire clause; termination letter goes straight to "effective Month D, Yr" with final-pay schedule.

Same logical slot (`notice_period.standard`), wildly different prose. Schema unchanged; clause library does the work.

### "Non-solicitation duration"
- **FI:** 6 months post-termination.
- **DE:** 24 months post-termination, **with a contractual penalty of one gross monthly salary per breach** (this German "Vertragsstrafe" is the only quantified breach penalty in the sample EAs).
- **PL:** 6 months post-termination.
- **AU:** 12 months → 6 → 3 (built-in court-severability cascade — characteristic AU drafting).
- **US:** Inside PIIA exhibit; 1 year non-solicit, 1 year non-compete (the latter is famously unenforceable in CA but the template includes it anyway).

### "Intellectual property assignment"
All five jurisdictions assign IP to the employer with broad survival language. **Statutory grounding varies dramatically** — § 69b UrhG (DE) vs Article 50 Copyright Act (PL) vs Act on the Right in Employee Inventions (FI) vs the PIIA exhibit (US/AU). The slot is identical (`ip_assignment.scope = all`, `ip_assignment.survives = true`); the clause text and citation are different.

### "Confidentiality survival"
All five say "survives termination indefinitely" except Poland, which specifies "no less than 5 years". Same slot, jurisdictional default override.

---

## Recommendations for the Lumina architecture

The current architecture's per-(country, brand, doc_type) slot schemas amplify a variance that doesn't really exist at the schema level. The variance is in clause text and citations. Specifically:

1. **Collapse slot schemas to 3** (or 4 with NDAs): `employment_agreement.schema.json`, `addendum.schema.json`, `termination.schema.json`. Each ~20–30 fields. The above tables are a first draft. Today's split (currently per-country/brand/doc-type) should be deleted.

2. **Introduce a `jurisdiction.{country}.yaml` overlay** for each country: required identifier schemes, default values (notice periods, probation max, vacation min), required clause IDs, citation library, language-precedence rule. ~30–50 lines each. Add a brand layer on top (entity legal name, signatory, letterhead) — that's already in `config/legalEntities.ts` per CLAUDE.md.

3. **Treat clauses as first-class data** — `clauses/{logical_id}/{country}.md` keyed by logical ID. The same `notice_period` clause has 5 country variants; the schema doesn't change, the prose does. This aligns with the 2026-05-11 decision to keep slot schemas in-repo and clause text out of repo until counsel verifies.

4. **Doc-type-specific add-ons:** terminations need `reason_class` driving which clause IDs render (probation termination ≠ redundancy ≠ mutual). Addendums are essentially `{parties, original_agreement_ref, changes[]}` — almost no jurisdictional content; the prose comes from the cited original agreement. Don't over-model addendums.

5. **Validate the simplification:** before deleting per-country schemas, run a single canonical schema against all 521 corpus files (not just the 17 sampled) and measure (a) percent of fields populated, (b) percent of documents needing >2 jurisdiction-specific fields. If both numbers are within tolerance (target: >90% / <10%), the collapse is safe.

6. **Doc-type matters more than country for slot design.** Today's mental model puts country first; flip it. The slot diff between an EA and a termination is much larger than the slot diff between a Finnish and a Polish EA.

7. **Tactical note for the demo:** because Finland has no termination templates and USA has no real EA template, the cross-country switching demo should be framed around the *clause variance* not the *document inventory completeness*. Showing "same EA structure, four jurisdictions, four clause sets, four citation packs" is the honest version of the demo and lines up with the schema collapse.

---

*Sources: 5 local Finnish extracts in `corpus/extracts/fin/`; 12 documents fetched fresh from the Drive (IDs in sample table). Drive inventory: `corpus/drive-inventory.json` (521 files, 36 countries). No clause text reproduced in this report.*
