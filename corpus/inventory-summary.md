# Drive corpus inventory — summary

> Auto-generated from `corpus/drive-inventory.json` on 2026-05-12.
> Re-run by walking the Drive (folder ID `0AGC8z3-x7H0kUk9PVA`) with the script in `scripts/`; do not hand-edit this file.

## Headline

**521 files across 36 countries**, organized by 8–10 standard doc-type subfolders per country. This is the corpus Lumina ingests; the gap-surfacing UX (DECISIONS-PENDING.md #1) operates against this inventory.

## Files per doc-type folder

| Count | Folder |
|---|---|
| 158 | Addendums - Annexes |
| 110 | Employment Agreements |
| 69 | Termination documents |
| 53 | Other |
| 51 | Employment certificates |
| 20 | Business travel - Visa - Invitation letters |
| 18 | Warning letters - Disciplinary actions |
| 15 | NDAs |
| 11 | Employment certificates *(trailing-space duplicate folder)* |
| 4 | Termination documents NONE |
| 2 | Addendums *(trailing-space duplicate)* |
| 2 | Employment certificates *(trailing-space duplicate)* |
| 2 | Employment certificates NONE |
| 1 | Warning letters *(trailing-space duplicate)* |
| 1–5 | Loose root-level docs (Mexico mostly: PIPs, resignation letters, modification agreements) |

> ⚠️ **Folder-name hygiene issue.** Multiple "trailing-space" duplicates and "NONE"-suffixed empty folders exist (likely template-shell remnants). Worth flagging in the demo as another concrete maintenance burden the corpus has accumulated.

## Country × Doc-type matrix

Top-10 countries by total file count:

| Country | EmpAgr | Term | Warn | EmpCert | NDA | Addenda | Travel | Other | Total |
|---|--:|--:|--:|--:|--:|--:|--:|--:|--:|
| Serbia | 9 | 5 | 2 | 5 | 1 | 13 | 5 | 7 | 47 |
| Poland | 18 | 2 | – | 1 | 1 | 5 | 1 | 9 | 37 |
| Germany | 15 | 2 | – | 3 | – | 11 | 2 | 1 | 34 |
| Finland | 15 | – | – | 2 | 3 | 8 | 1 | – | 29 |
| Australia | 13 | 3 | 1 | – | – | 5 | – | 5 | 27 |
| Denmark | – | 7 | 8 | – | – | 9 | – | 1 | 25 |
| Slovenia | 4 | 2 | – | 2 | 2 | 11 | – | 2 | 23 |
| Greece | – | 2 | – | 8 | 2 | 7 | – | 2 | 21 |
| Romania | 2 | 2 | – | 5 | – | 4 | – | 7 | 20 |
| Czechia | – | 7 | – | 2 | – | 10 | – | – | 19 |

## Countries with Employment Agreements specifically

`Poland 18 · Finland 15 · Germany 15 · Australia 13 · Serbia 9 · Bulgaria 7 · USA 6 · Austria 5 · Slovenia 4 · Israel 4 · Mexico 3 · Romania 2 · North Macedonia 2 · Albania 4 · Slovakia 1 · Canada 1 · Kosovo 1`

That's **15+ countries with a usable employment-agreement starting point**, including all of the original target four (FIN, USA, Germany, Brazil ❌ Brazil has zero EmpAgr — Brazil has only 1 root-level doc).

## Countries with thin or zero coverage

- **UK**: 2 files only (1 EmpCert, 1 Travel). No Employment Agreements. **Note for the cross-brand demo: Deliveroo (UK) cannot be demoed on Employment Agreements; would need to use another doc type or source UK templates separately.**
- **Brazil**: 1 loose root file. No usable doc-type templates. If we want Brazil for legal-variance demo, need to source separately.
- **Netherlands, Norway, Sweden, Luxembourg, Japan, Hungary, India**: ≤ 3 files each.

## What this changes

1. **Earlier "data gap" claim is wrong.** I previously concluded "only Finland has populated templates." That was based on spot-checks of `Employment Agreements > High/Low Volume hires` subfolders. The bulk of the corpus lives at the *direct* doc-type level (e.g. `Germany > Employment Agreements > [template.docx]`) — not nested in High/Low Volume.
2. **The user's #1 pivot is fully validated by the data.** Gap-surfacing for missing (country, doc_type) combos is meaningful because 30 of 36 countries have *some* coverage but *different* coverage.
3. **Demo narrative refocused.** Cross-country switching is real on Employment Agreements (15+ countries). Cross-doc-type switching is real (Termination, Warning Letters, etc.).
4. **UK / Deliveroo gap is still real for Employment Agreements.** Decision needed on how to handle.
