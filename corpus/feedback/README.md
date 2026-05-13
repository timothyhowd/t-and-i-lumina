# Feedback corpus

This directory accumulates user observations on generated drafts.

## How it gets populated

Every draft in the UI ships with a `👍 / 👎 / note` widget beneath it
(see [`app/components/ChatBits.tsx::FeedbackWidget`](../../app/components/ChatBits.tsx)).
Clicking either thumb (with or without a written note) POSTs to
[`/api/feedback`](../../app/app/api/feedback/route.ts) which appends one
JSONL record to `runs.jsonl`.

## File layout

```
corpus/feedback/
├── README.md       ← this file (committed)
├── runs.jsonl      ← per-machine log (gitignored)
└── *.local.jsonl   ← any other local logs (gitignored)
```

`runs.jsonl` is **gitignored** — it accumulates with every reaction you
log, and the prompts you typed are echoed in each record. Keep it local.
If you want to share findings, the right move is to summarize in chat or
in `docs/`.

## Record schema (v0.1)

One JSON object per line. Fields:

| field | type | notes |
|---|---|---|
| `timestamp` | ISO 8601 string | when the user clicked submit |
| `documentId` | string | the EmploymentRecord id (e.g. `wkr_005`); links back to the source record in mock Workday for addendums/terminations, or a fresh `rec_*` for new EAs |
| `rating` | `"positive" \| "negative"` | thumb direction |
| `note` | string \| null | optional free text from the widget |
| `intent` | object \| null | `{ country, brand, docType, understoodAs }` — captured at draft time |
| `promptEcho` | string \| null | first ~240 chars of the user's prompt that triggered the draft |
| `specialistId` | string | always `demo-specialist` for now |

Example:

```jsonl
{"timestamp":"2026-05-13T15:42:11.123Z","documentId":"wkr_005","rating":"negative","note":"Notice-period clause doesn't reflect Aino's actual tenure","intent":{"country":"FIN","brand":"wolt","docType":"addendum"},"promptEcho":"Reduce Aino Mäkinen's hours from 37.5 to 30 starting June 1 2026","specialistId":"demo-specialist"}
```

## Reading the log

For ad-hoc analysis:

```bash
# Count thumbs
jq -r .rating corpus/feedback/runs.jsonl | sort | uniq -c

# All negative notes
jq -r 'select(.rating=="negative") | "\(.timestamp) [\(.intent.country)/\(.intent.docType)] \(.note)"' corpus/feedback/runs.jsonl

# By doc type
jq -r '.intent.docType' corpus/feedback/runs.jsonl | sort | uniq -c
```

## When to extract findings

When `runs.jsonl` accumulates more than ~10 entries, summarize the
patterns into a session log under `docs/` and clear the file. The
JSONL is a notebook, not a database — long-term findings belong in
prose.
