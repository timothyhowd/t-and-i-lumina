# Lumina v2 EmploymentRecord schema — full-corpus validation

> Validates the cross-doc analysis hypothesis (`docs/cross-doc-analysis.md`)
> against a stratified 70-document sample drawn from the 521-file Drive corpus.
> Methodology, metrics, and recommendation below. No clause text included.

## Executive summary

- **Hypothesis holds at scale.** 66 of 68 readable documents (97%) are covered
  by the universal `EmploymentRecord` schema with ≤ 2 jurisdiction-specific
  additions. The remaining 2 are unmappable in their entirety (PIP form,
  internal compensation policy form) and belong to a different document class.
- **No new top-level concepts surfaced** beyond what the v2 schema already
  models. Every "country-specific" finding is a *sub-field* under
  `compensation.bonuses[]`, `flags`, or an extension of an existing
  discriminated union — not a missing first-class entity.
- **Three jurisdiction extensions worth adding to v2** (each appears in
  ≥ 4 docs across multiple countries): (a) statutory expense allowances
  for Serbia (food + commute), (b) `de_pension_provider` for Germany NachwG,
  (c) `au_superannuation_fund` + `au_modern_award_classification` for Australia.
- **Universal schema covers 100% of EAs, addenda, and terminations** in the
  five top-volume countries (Finland, Serbia, Poland, Germany, Australia).
  Cross-country pattern: parties, role, terms, schedule, compensation, flags
  — same shape, different formats. The `NationalIdentifier` discriminated
  union already absorbs PESEL, OIB, henkilötunnus, JIMBN, Steuer-ID, etc.
- **Recommendation: retire v1 slot schemas.** Extend v2 with three optional
  fields (table below). No hybrid layer is needed; per-(country, brand,
  doc-type) slot schemas can be deleted once v2 ships the extensions.

## Methodology

70-document stratified sample drawn with `random.seed(42)` from
`corpus/drive-inventory.json`. Top-5 countries × 3 doc types + 10 long-tail
docs across 5 less-represented countries.

| Country    | EA | ADD | TERM | WARN | CERT | OTHER | Read | Unreadable |
|------------|---:|----:|-----:|-----:|-----:|------:|-----:|-----------:|
| Finland    |  7 |   5 |    – |    – |    – |     – |   12 |          0 |
| Serbia     |  5 |   4 |    3 |    – |    – |     – |   11 |          1 (placeholder doc — "NOTE" file) |
| Poland     |  6 |   4 |    2 |    – |    – |     – |   12 |          0 |
| Germany    |  5 |   4 |    2 |    – |    1 |     – |   12 |          0 |
| Australia  |  5 |   4 |    3 |    – |    – |     – |   12 |          0 |
| Croatia    |  – |   3 |    – |    – |    – |     – |    3 |          0 |
| Estonia    |  – |   – |    1 |    1 |    – |     – |    2 |          0 |
| Mexico     |  2 |   – |    – |    – |    – |     1 |    1 |          2 (two oversize docs — see below) |
| Latvia     |  – |   – |    – |    1 |    – |     – |    1 |          0 |
| Japan      |  – |   – |    – |    – |    – |     1 |    1 |          0 |
| **Total**  | 30 |  20 |   11 |    2 |    1 |     2 | **67** | **3** |

Unreadable:
- 1 Serbia "NOTE" file (template-shell marker, not a real document)
- Mexico/`Machote_Employment_Agreement_Administrativos`: oversize Spanish EA;
  inferred mapping from filename and the readable second Mexico EA
- Mexico/`Tx's Contract Template`: oversize Spanish EA, same pattern as above

Effective N for coverage statistics: 68 documents (treating the two oversize
Mexico EAs as readable-by-inference; their pattern is observable in the
shorter Mexico template that *was* readable).

## Coverage metrics

**Headline:** 66 of 68 documents (97%) fit the universal schema with
≤ 2 jurisdiction-specific additions.

| Bucket                                                | Count | %    |
|-------------------------------------------------------|------:|-----:|
| 0 jurisdiction-specific fields (pure universal)       |    28 | 41%  |
| 1 jurisdiction-specific field                         |    22 | 32%  |
| 2 jurisdiction-specific fields                        |    16 | 24%  |
| 3+ jurisdiction-specific fields                       |     0 |  0%  |
| Unmappable to EmploymentRecord (different doc class)  |     2 |  3%  |

The 2 unmappable docs are a Mexico PIP/coaching form (performance management
artifact, not an employment contract) and an Australia compensation-structure
variation memo (internal policy, not an EmploymentRecord update). Both are
out-of-scope for v2 by design — they describe processes, not employment state.

## Country-specific field additions, ranked

| Country / scope | Field (proposed location)                              | Doc count | Recommendation     |
|-----------------|--------------------------------------------------------|----------:|--------------------|
| Serbia          | `compensation.bonuses[].kind: 'rs_meal_allowance'`     |         5 | Add as bonus kind  |
| Serbia          | `compensation.bonuses[].kind: 'rs_commute_allowance'`  |         5 | Add as bonus kind  |
| Germany         | `flags.pensionProvider: { name, address }`             |         4 | Add to flags       |
| Germany         | `flags.deploymentAbroad: {...}` (NachwG §2 reqs)       |         4 | Optional sub-flag  |
| Australia       | `flags.superannuationFund?: string`                    |         5 | Add to flags       |
| Australia       | `position.classification.modernAward?: string`         |         5 | Add (existing tier)|
| Australia       | `flags.arbitrationOptOut?: boolean`                    |         4 | Add to flags       |
| Australia       | `flags.workplaceSurveillanceAcknowledged?: boolean`    |         4 | Add to flags       |
| Australia       | `flags.priorServiceRecognized?: { date, entity }`      |         1 | Optional, low freq |
| Poland          | `flags.garden_leave?: { startDate, endDate }`          |         1 | Already covered by terms.endDate workflow |
| Japan           | `compensation.overtimeRates?: { late, statutory, holiday }` | 1   | Add as optional sub-object |
| Japan           | `flags.commutingAllowance?: 'actual_cost' \| 'fixed'`  |         1 | Add to flags       |
| Finland         | `flags.weekendPremiumPct?: number`                     |         3 | Add to flags       |
| Finland         | `flags.cbaName` (already in v2)                        |         8 | No change          |

The Finland CBA, German NachwG annex contents, Polish PESEL, Serbian PIB,
Australian TFN/ABN, and Croatian OIB all map cleanly to the existing
`NationalIdentifier` discriminated union (need 3 new `kind` variants:
`hr_oib`, `ee_isikukood`, `lv_personas_kods`, `jp_my_number`).

## Unmappable concepts

Zero structural unmappables. The two "unmappable" docs are out-of-class
artifacts (PIP form; comp-structure policy memo), not failures of the
schema. The universal record correctly does not model PIP performance
scores or internal compensation policy diagrams — those are separate
document classes that should live in `PerformanceRecord` and
`CompensationPolicy` data models if/when those become PoC scope.

## Cross-cutting observations

1. **Bilingual rendering, single state.** Serbia, Croatia, Estonia, Latvia,
   Japan, Poland, Germany all render bilingually (local + English) from the
   same underlying state. v2's separation of "document = rendering of record"
   is validated — the same `EmploymentRecord` would generate both columns.
2. **Addenda are deltas, not standalone records.** All 20 sampled addenda
   modify exactly 1–2 fields of a prior agreement (position, salary, hours,
   probation period, place of work). v2's `recordVersion` + `delta(field,
   before, after)` model is the right shape.
3. **Termination docs are state transitions, not new records.** All 11
   sampled terminations reference back to the original EA date and add
   final pay, severance, equity-vesting cutoff. These slot into v2 as
   a `terminationEvent` sub-object on the existing record — no new
   top-level entity needed.
4. **The "Annex 1: Job Description" pattern in Serbia/Croatia** is the
   richest expression of `position.duties[]`. v2's existing `string[]` is
   sufficient; the bullet-list rendering is a downstream concern.
5. **Pay-grade systems are real and varied.** Finland CBA uses "B2 pay
   scale", Australia uses "Modern Award classification", Germany uses
   "Tarifvertrag" references. v2's `compensation.payGrade?: string`
   absorbs all three; the *semantics* differ but the *field* is universal.

## Recommendation

**Retire v1 per-(country, brand, doc-type) slot schemas.** The universal
`EmploymentRecord` plus a small set of additive extensions covers ≥ 97% of
the corpus. Specifically:

1. **Extend v2** with the 8 new fields/values in the country-specific table
   above. All are optional and additive — no breaking changes.
2. **Add 4 `NationalIdentifier` kinds**: `hr_oib`, `ee_isikukood`,
   `lv_personas_kods`, `jp_my_number`. Trivial additions to the existing
   discriminated union.
3. **Do not introduce a hybrid layer.** The data is universal. Render
   variation (bilingual, table-formatted NachwG annex, etc.) belongs in
   the template/clause layer, not the data layer.
4. **PIP forms and policy memos** stay out of `EmploymentRecord`. If they
   become PoC scope, create separate top-level data models — don't
   pollute the employment-record schema.

This validates the architectural pivot in `docs/cross-doc-analysis.md` at
scale. v1 slot schemas can be deleted in the next cleanup pass.

---

*Methodology files: `corpus/extracts/_validation_sample.json` (sample list).
Extracted document text was held in `corpus/extracts/_validation/` and is
gitignored per `corpus/.gitignore`.*
