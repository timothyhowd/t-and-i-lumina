# Option C — batch eval harness (design only)

> **Status:** Not built. This is the sketch of what scaffolding would look like
> if/when we decide to invest. Read this when feedback from A (test-scenarios.md)
> and B (in-app widget) starts producing regression risk — i.e. when you find
> yourself wondering "did my last change break the FIN/Wolt EA path?"

## The thing we'd be building

A headless test runner that fires N scenarios through `/api/chat`, captures
outputs, and either:

1. **Snapshots them** for human review (cheap, fast feedback),
2. **Diffs them against a checked-in "golden" set** (regression detection), or
3. **Scores them with a rubric-driven LLM judge** (quality regression).

Three increasing levels of investment. Start at 1, only go further when there's
a real cost to stale baselines.

## Why not yet

- **The clauses are unverified.** Right now every draft has `reviewStatus: 'unverified'`. A "golden output" implies an authoritative form to diff against. Until counsel reviews the FIN clauses (or you formally accept the current scaffolding as a baseline), there's nothing legitimate to lock in.
- **Outputs are non-deterministic.** Opus generation is non-deterministic by default, and free-text slots (duties bullet list, addendum delta prose) drift between runs even with identical input. Exact-string diff would be 90% noise. We'd need either a semantic diff or a deterministic seed (which Portkey may not expose).
- **A + B already gives you the signal.** Manual scenarios + thumb reactions cover the common case where you change something and want to verify it didn't break the obvious paths. The eval harness earns its keep when N ≥ 30 scenarios make manual sweeps tedious.

When **A + B feel slow**, build C.

## Shape of the scaffolding

If you do build it, here's what the pieces look like.

### Repo layout

```
eval/
├── scenarios/
│   ├── 001-fin-wolt-ea.json            ← one scenario per file
│   ├── 002-fin-wolt-addendum-aino.json
│   ├── 003-usa-doordash-offer.json
│   └── ...
├── golden/                              ← committed expected outputs
│   ├── 001-fin-wolt-ea.txt
│   └── ...
├── runs/                                ← timestamped run outputs (gitignored)
│   ├── 2026-05-13T14-22-00/
│   │   ├── 001-fin-wolt-ea.txt
│   │   ├── 001-fin-wolt-ea.diff
│   │   └── summary.json
└── lib/
    ├── run-one.ts                       ← fires one scenario, captures output
    ├── diff-strategies.ts               ← exact / structural / semantic
    └── judge.ts                         ← LLM rubric scorer (level-3 only)
```

### Scenario file

```jsonc
// eval/scenarios/001-fin-wolt-ea.json
{
  "id": "001-fin-wolt-ea",
  "description": "Baseline FIN/Wolt employment agreement, indefinite, operational",
  "messages": [
    { "role": "user", "content": "New Wolt Finland hire — Aino Mäkinen ..." }
  ],
  "expect": {
    "kind": "draft",
    "intent": { "country": "FIN", "brand": "wolt", "docType": "employment_agreement" },
    "containsClauses": ["fin.parties", "fin.validity", "fin.working_hours", "fin.compensation", "fin.signature"],
    "mustCite": ["Employment Contracts Act", "Working Hours Act"],
    "mustNotCite": ["GDPR", "§ 622 BGB"]
  }
}
```

`expect` is the test assertion. Each field is checked independently:

- `kind` — the API response shape (exact match)
- `intent` — partial object match
- `containsClauses` — the `usedClauses` array on the draft response includes all
- `mustCite` — the citations block contains these substrings
- `mustNotCite` — the citations block does NOT contain these substrings (catches jurisdiction-bleed bugs)

Notice what's NOT here: clause-by-clause text. We don't diff Opus's prose. We diff
which clauses were SELECTED and which citations were EMITTED — those are
deterministic outputs of the v2 pipeline.

### Runner

```ts
// eval/lib/run-one.ts
import { readFile } from 'node:fs/promises';

export async function runScenario(scenarioPath: string, baseUrl: string) {
  const scenario = JSON.parse(await readFile(scenarioPath, 'utf8'));
  const userMessage = scenario.messages[scenario.messages.length - 1].content;
  const history = scenario.messages.slice(0, -1);

  const resp = await fetch(`${baseUrl}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message: userMessage, history, sessionState: {} }),
  });
  const data = await resp.json();

  const assertions = checkAssertions(data, scenario.expect);
  return { id: scenario.id, data, assertions };
}

function checkAssertions(data: any, expect: any): Array<{ ok: boolean; msg: string }> {
  const out: Array<{ ok: boolean; msg: string }> = [];
  if (expect.kind) {
    out.push({ ok: data.kind === expect.kind, msg: `kind=${expect.kind} got=${data.kind}` });
  }
  if (expect.intent) {
    for (const [k, v] of Object.entries(expect.intent)) {
      out.push({ ok: data.intent?.[k] === v, msg: `intent.${k}=${v} got=${data.intent?.[k]}` });
    }
  }
  if (expect.containsClauses && data.kind === 'draft') {
    for (const c of expect.containsClauses) {
      out.push({ ok: data.citationsBlock?.includes(c), msg: `contains clause ${c}` });
    }
  }
  if (expect.mustCite && data.kind === 'draft') {
    for (const s of expect.mustCite) {
      out.push({ ok: data.citationsBlock?.includes(s), msg: `cites ${s}` });
    }
  }
  if (expect.mustNotCite && data.kind === 'draft') {
    for (const s of expect.mustNotCite) {
      out.push({ ok: !data.citationsBlock?.includes(s), msg: `does not cite ${s}` });
    }
  }
  return out;
}
```

### CLI

```bash
# Run all scenarios against the local dev server
npx tsx eval/run-all.ts http://localhost:3000

# Run a single scenario
npx tsx eval/run-one.ts eval/scenarios/001-fin-wolt-ea.json http://localhost:3000

# Compare a fresh run against the checked-in golden (level 2)
npx tsx eval/diff.ts eval/runs/2026-05-13T14-22-00 eval/golden
```

Exit code 0 if all assertions pass; non-zero with a summary if any fail.

### Three levels of diff

| Level | What's compared | Cost | When to invest |
|---|---|---|---|
| **1. Smoke** | Status codes + `kind` + intent classification | ~10s for 20 scenarios | Always (when you have scenarios) |
| **2. Structural** | Selected clauses + cited statutes + filled-vs-missing fields | ~30s for 20 scenarios | When you start refactoring the compose pipeline |
| **3. Semantic** | Opus rubric-scores both outputs ("does the addendum draft accurately describe the requested change?") | ~$0.50 per run | Only when you have an approved clause baseline AND care about prose regressions |

Level 3 is the killer one — and the most expensive. Build only when the clause
library is counsel-verified.

## What you'd write to bootstrap C from today's state

1. **Seed scenarios from `docs/test-scenarios.md`.** S1–S18 mostly translate one-for-one. Cull subjective edge cases (S18 "make me a sandwich" is hard to assert on).
2. **Run them once, save outputs to `eval/runs/<timestamp>/`.** Manual review. Pick the ones whose clause selection + citations look right; copy those into `eval/golden/`.
3. **Add level-1 assertions** to each scenario file. This catches 80% of regressions for ~10s of runtime.
4. **Wire to CI** — GitHub Actions step that runs the harness on every PR against `main`. Fail the build on any assertion miss.
5. **Add level 2** when you find yourself wanting to know which clauses were selected, not just whether a draft was produced.

## When to skip C entirely

If after 6 weeks of A+B feedback, the changes you make are:

- Mostly clause text edits (counsel-driven, prose-level)
- Mostly per-country jurisdiction additions (additive, isolated)

…then C is overkill. The cost of building it exceeds the cost of running A+B
sweeps manually before each big change. Don't build infrastructure for problems
you don't have.
