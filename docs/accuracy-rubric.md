# Lumina accuracy rubric — v0.1

> **Purpose.** A consistent way to score employment documents produced by
> Lumina (or by anyone else — counsel, consultancy, a competing prototype)
> so that "is this good enough?" stops being a vibe and becomes a number.
>
> **When to use.** Score every PoC milestone draft. Score consultancy
> outputs when we get them. Score side-by-side comparisons. Threshold for
> "acceptable for the People Ops test" is set at the bottom.

## How to score

Each dimension is rated 1–5 against a checklist of yes/no observations. A
dimension's score is the share of checks that pass, mapped onto:

| Score | Meaning |
|---|---|
| 5 | All checks pass; no concerns |
| 4 | Minor issues; nothing a competent reviewer would block on |
| 3 | Real issues; counsel would mark up several spots |
| 2 | Material defects; substantial rewrite expected |
| 1 | Not fit to put in front of anyone |

Final score is the **weighted average** across the eight dimensions.
Round to one decimal place. Show the dimension breakdown alongside the
total — totals alone hide the failure mode.

---

## Dimension 1 — Legal correctness *(weight 3.0)*

Does the document cite the correct law for what it says?

Checks:
- [ ] Every regulation citation refers to a real statute (verifiable, not invented)
- [ ] Cited sections actually contain the text the clause is invoking
- [ ] No statute from one jurisdiction appears in another country's document
- [ ] Statutory limits (trial-period cap, notice ladder, etc.) are honored or surfaced
- [ ] Mandatory disclosures for the document type are present (e.g., FIN's Section 2(4) further-details block; § 38 SGB III in German termination letters)

**Why weight 3.0:** This is the bet. If Lumina's output cites the wrong
statute, the comparison against any reasonable counsel-authored document
is over before it starts.

## Dimension 2 — Jurisdiction fit *(weight 2.5)*

Does the document read like it belongs in the target legal tradition?

Checks:
- [ ] Required jurisdiction-specific clauses present (FIN: CBA reference where applicable; DEU: § 622 BGB notice cascade, bilingual with German prevailing; USA: at-will disclaimer; PL: Article 30 Labour Code)
- [ ] Absent clauses are correctly absent (no FIN CBA reference in a US offer letter)
- [ ] Tone matches jurisdictional convention (USA letters are short and at-will-led; DEU contracts are formal and § -numbered; FIN documents are clause-numbered and CBA-aware)
- [ ] Language requirements respected (DEU: bilingual DE/EN with German binding; PL: Polish prevails)
- [ ] Currency, calendar, and address format match locale

**Why weight 2.5:** A document that's technically accurate but reads
wrong for the country still fails the smell test with a local reviewer.

## Dimension 3 — Completeness *(weight 2.0)*

Are all data fields populated correctly, with no placeholders leaking
into the final prose?

Checks:
- [ ] No `[MISSING: ...]` placeholders in the rendered draft
- [ ] All record fields the rule marks `required` are populated
- [ ] Signature block has both names + titles, not blank lines
- [ ] Citations block at the bottom is present and non-empty
- [ ] Watermark + document id stripe present

## Dimension 4 — Data accuracy *(weight 2.0)*

Did the extraction step capture what the user said correctly?

Checks:
- [ ] Names spelled correctly (diacritics, case)
- [ ] Dates correctly parsed (ISO 8601; year matches user intent)
- [ ] Amounts and currencies correct (not "180000 USD bi_weekly" when input said annual)
- [ ] Address parts split correctly (street vs city vs postal code vs region)
- [ ] No invented values where the user didn't supply them

## Dimension 5 — Prose quality *(weight 1.5)*

Is the language professional, neutral, and free of model artifacts?

Checks:
- [ ] Sentences are complete and grammatical
- [ ] No marketing or self-referential tone
- [ ] No invented duties, benefits, or commitments
- [ ] No repeated content (paraphrased duplicates of the same clause)
- [ ] Free-text slots stay within their guidance (e.g. duties = bullet list, not paragraphs)
- [ ] Enum values rendered as human text where surfaced (`bi-weekly` not `bi_weekly`)

## Dimension 6 — Formatting *(weight 1.0)*

Does it look like a document, not a chat dump?

Checks:
- [ ] Section headings consistent (numbered, capitalized as expected by jurisdiction)
- [ ] Paragraph breaks render correctly
- [ ] No residual conditional whitespace ("§ 1 ... \n\n\n § 2 ...")
- [ ] Signature block formatting matches jurisdictional convention
- [ ] Citation block is visually separated from the body

## Dimension 7 — Brand & entity fit *(weight 1.5)*

Is this the right legal entity, signatory, and brand voice?

Checks:
- [ ] Legal entity name matches the actual operating entity (not just "Wolt")
- [ ] Business / registration ID present and well-formed for the jurisdiction
- [ ] Signatory name + title appear correctly
- [ ] Brand-aligned tone (Wolt informal-formal Nordic; DoorDash terse US offer letter style; Deliveroo UK statute-led)
- [ ] No cross-brand bleed (no DoorDash signatory on a Wolt document)

## Dimension 8 — Defensibility under review *(weight 2.0)*

Would a counsel reviewer or specialist let this through with edits, or
would they reject it wholesale?

Checks:
- [ ] No statements that could create legal exposure (over-promising, missing required disclosures)
- [ ] No prose that contradicts statutory baselines
- [ ] Citations specific enough to verify in a few minutes
- [ ] Watermark and unverified-status notice present so the reviewer knows what they're looking at
- [ ] Counsel could mark up, not throw out

**Why weight 2.0:** This is the proxy for "Could People Ops actually
use this?" Even a draft that scores well on the technical dimensions
fails here if a reviewer would block the whole thing on principle.

---

## Total score interpretation

Weights sum to **15.5**. The maximum raw score is 5 × 15.5 = 77.5;
report final scores normalized to 5.0.

| Final | Verdict |
|---|---|
| ≥ 4.5 | Production-trajectory. Counsel review + minor edits would clear this. |
| 4.0 – 4.49 | PoC-ready for the People Ops side-by-side test. Defensible vs a competent consultancy output. |
| 3.5 – 3.99 | Architecture is right; clause text needs counsel-led revision. |
| 3.0 – 3.49 | Useful for demos and concept validation; not ready for comparison against a consultancy. |
| < 3.0 | Don't show externally. |

**Target for the PoC's stated north star ("compare against the consultant
and verify quality"): ≥ 4.0.** Anything lower is still a credible product
demo but is not a credible quality comparison.

---

## Scoring protocol

When you score a draft:

1. Copy the rubric checklist into a fresh scoring sheet (or append to
   the bottom of this file under a dated `## Score: YYYY-MM-DD <scenario>`
   heading).
2. Read the document end-to-end before scoring any dimension. Don't
   score in isolation.
3. For each dimension, work through the checks. Mark each ✅ / ❌ / N/A.
4. The dimension score is `(passes / applicable) × 5`, rounded to the
   nearest 0.5.
5. Multiply by the dimension weight, sum, divide by 15.5, report the
   normalized 5.0 score plus the per-dimension breakdown.
6. Write one paragraph of qualitative notes: what worked, what didn't,
   what would have to change to lift the lowest dimension.

Two people scoring independently should land within 0.3 of each other.
If you don't, the rubric needs tightening (open an item in
[`docs/DECISIONS-PENDING.md`](./DECISIONS-PENDING.md)).

## What this rubric does NOT measure

- **Process safety.** Whether a draft is signed-off, audit-trailed, or
  fits into Workday/DocuSign workflow is out of scope here. That's
  governance, not quality.
- **Aesthetic delight.** Look-and-feel is covered by
  [`heuristics-review.md`](./heuristics-review.md), not this rubric.
- **Speed.** "Was it produced quickly" is not a quality measure. A bad
  draft generated in 2 seconds is still a bad draft.

---

## Score: 2026-05-14 — Aino Mäkinen, FIN/Wolt employment agreement (Lumina v2, commit `b0f3cb1`)

Generated by typing *"Employment agreement for aino.makinen@wolt.com. Duties: take orders through Merchant app, pack groceries and hand them to customers and courier partners, manage inventory, maintain order and cleanliness of the store, other duties as assigned by the Employer."* into Lumina. The email lookup pre-filled Aino's record from mock Workday. Full draft text saved at `docs/score-runs/2026-05-14-aino-fin-wolt-ea.md`.

**Baseline for comparison:** `corpus/extracts/fin/high_ga_permanent.txt` — the actual Wolt FIN warehouse employment agreement currently in production use. Not consultancy output, but counsel-approved by Wolt's legal function and what Lumina must match or exceed structurally.

### Dimension scores

| # | Dimension | Weight | Score | Weighted |
|---|---|--:|--:|--:|
| 1 | Legal correctness | 3.0 | 3.5 | 10.5 |
| 2 | Jurisdiction fit | 2.5 | 3.0 | 7.5 |
| 3 | Completeness | 2.0 | 5.0 | 10.0 |
| 4 | Data accuracy | 2.0 | 5.0 | 10.0 |
| 5 | Prose quality | 1.5 | 4.5 | 6.75 |
| 6 | Formatting | 1.0 | 4.5 | 4.5 |
| 7 | Brand & entity fit | 1.5 | 4.0 | 6.0 |
| 8 | Defensibility | 2.0 | 3.0 | 6.0 |
| | | **15.5** | | **61.25** |

**Final: 61.25 / 15.5 = 3.95 / 5.0**

Lands one tick below the 4.0 threshold — *"Architecture is right; clause text needs counsel-led revision"* per the score band. Not yet PoC-ready for the People Ops side-by-side test, but trivially close.

### What's working (high-scoring dimensions)

- **Completeness (5.0):** Zero `[MISSING: ...]` placeholders. Every required field populated from the Workday lookup. Watermark + signature block + citations block all present.
- **Data accuracy (5.0):** Name with diacritic (Mäkinen), DOB, address parsed cleanly, start date matches the Workday record (2024-08-01), salary correct (3400 EUR monthly), employer entity correct (Wolt Services Oy + business ID).
- **Prose quality (4.5):** Duties bullets correctly normalized from the user's casual phrasing. Opus appropriately expanded "Merchant app" → "Merchant application." No invented duties.
- **Formatting (4.5):** Numbered sections, correct paragraph breaks, signature-block layout matches jurisdictional convention. Minor: trailing residual whitespace where conditionals don't fire.

### What's missing vs the production Wolt template

Reading Lumina's output side-by-side with `high_ga_permanent.txt`, four real gaps stand out:

1. **The Section 2(4) FURTHER DETAILS block is absent.** Finnish ECA requires the employer to disclose "key terms and conditions of employment" — place of work, pay period, applicable CBA name. The real template has this; Lumina doesn't.
2. **Section 8 COLLECTIVE AGREEMENT is absent.** Lumina HAS the clause (`fin.cba_binding`) but it only fires when `flags.cbaApplicable: true`. The seed record doesn't set this, and the Workday lookup doesn't infer it from role tier. Warehouse roles in Finland are essentially always CBA-bound.
3. **Section 9 OTHER TERMS AND CONDITIONS** (final-pay timing on the next payday) is absent. No Lumina clause models this yet.
4. **The opening "undertakes to carry out work designated by..." preamble** is missing. The real template uses this as a statement of consent that frames the whole document.

Each of these is a clause that exists or needs to be added in `clauses/fin.ts`, plus a rule update in `jurisdictions/fin.ts` to mark them required. Total work: ~30 minutes. Expected score lift: 3.95 → ~4.3-4.5.

### What the scoring exercise revealed

- Lumina's *architecture* is not the problem. Completeness, data accuracy, and formatting all score at the top.
- The shortfall is *clause coverage* — the FIN clause library is generic-defensible but doesn't include the structurally-required Finnish elements (Section 2(4) disclosure, CBA, final-pay terms).
- This is fixable in the clause library, with no architecture change required. Counsel review can happen against a more complete artifact and is therefore higher-value.

---

## Baseline-sourcing plan (since EY folder is empty)

The PoC's stated comparison target is "the consulting firm's outputs," and `Z - EY` in the shared Drive remains empty. Three concrete paths:

1. **Use the corpus baseline (recommended for now).** `corpus/extracts/fin/*.txt` contains five actual Wolt FIN templates already in production use. These are presumably counsel-or-consultancy approved by Wolt's legal function. Use them as the "what good looks like" baseline. Limitation: it's not external counsel, so the comparison reads as "Lumina vs. Wolt's prior-art templates" rather than "Lumina vs. EY." That's an honest framing.

2. **Source a public counsel-grade template.** Several Finnish HR services firms publish reference EA templates (Finnish Bar Association resources; SuomenYrittäjät; Tilisanomat). Pulling one or two and using as a supplementary baseline would broaden the comparison. Hand-pick rather than scrape; check usage terms.

3. **Request a single consultancy comparison sample.** Ask the EY contact directly for one representative output — a FIN/Wolt warehouse employment agreement — that we can use for the People Ops test. One document, not the full corpus they were originally contracted to produce. Much lower lift than the original ask.

For the PoC test as planned, **option 1 is the right starting point** — it's already in the repo, it's defensible as a baseline, and it doesn't depend on external coordination. Option 2 broadens the comparison once we have a baseline score. Option 3 should be requested in parallel but treated as a stretch outcome.

