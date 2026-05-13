# Finnish employment regulations — corpus reference

This directory holds the Finnish statutes that the FIN clause library cites. Sourced from [Finlex.fi](https://finlex.fi/en), the Finnish Ministry of Justice's official legal database.

**Legal status:** The texts here are the official **English translations** published by the Ministry of Economic Affairs and Employment. Per Finlex's standard disclaimer, "Legally binding only in Finnish and Swedish." The English versions are reliable for reference and for People Ops drafting but cannot themselves be cited as the authoritative source of law.

**Public domain:** Finnish statutes are public-domain official documents under §9 of the Finnish Copyright Act (404/1961). Storage and redistribution within this repository carries no licensing concerns.

## Files

| File | What it is |
|---|---|
| `employment-contracts-act.md` | Curated extract — the sections cited by the FIN clause library |
| `working-hours-act.md` | Curated extract — sections cited by working-hours and Sunday-work clauses |
| `annual-holidays-act.md` | Curated extract — sections cited by annual-leave clauses |
| `eca.txt`, `wha.txt`, `aha.txt` | Full text of each statute, machine-extracted from the Finlex PDF |
| `eca.pdf`, `wha.pdf`, `aha.pdf` | Original Finlex English-translation PDFs (canonical source) |

## How this corpus is used (and not used)

**Used by the v2 architecture:**
- `app/lib/data-model/clauses/fin.ts` cites these statutes by chapter/section. Each clause's `citations` array points to the section anchors below.
- `app/lib/data-model/jurisdictions/fin.ts` lists each act's URL as a `regulationAnchor`. The compose pipeline emits these in the document's citations block.

**Not (yet) used:**
- These markdown files are reference material. The compose pipeline does NOT retrieve text from them at runtime — clause bodies are authored data with hard-coded citations.
- A v2.1 step is to thread these through retrieval so Opus can quote statutory text verbatim in free-text slots (e.g., notice-period statutory ladder).

## Citation anchors used by the FIN clause library

| Clause id | Cites |
|---|---|
| `fin.parties` | ECA Ch.1 §3 (form and content) |
| `fin.validity` | ECA Ch.1 §3 (form), §4 (trial period) |
| `fin.trial_period` | ECA Ch.1 §4 |
| `fin.working_hours` | WHA §5 (general working time), §17 (Sunday work) |
| `fin.sunday_work` | WHA §17 |
| `fin.annual_leave` | AHA generally |
| `fin.notice_period` | ECA Ch.6 §3 (notice ladder) |
| `fin.cba_binding` | ECA Ch.2 §7 (generally binding CBAs) |
| `fin.termination_reason` | ECA Ch.7 §1, §2 (grounds for termination) |
| `fin.final_pay` | AHA §17 (compensation for unused holiday) |
| `fin.rehire` | ECA Ch.6 §6 (reemployment obligation) |
