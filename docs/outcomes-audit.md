# Outcomes audit — does v2 actually optimize for the user?

> Five user-experience principles, tested empirically against the current
> v2 build (commit baseline `8186292`). Each principle is scored by running
> a single representative prompt and reading the API response.
>
> Scoring scale:
> - ✅ Optimized — the system behaves as the principle demands
> - 🟡 Partial — works in the common case, breaks in adjacent ones
> - ❌ Not optimized — the system actively requires the user to do the
>   thing the principle says they shouldn't have to

---

## P1 — "I shouldn't have to know template names"

**Test prompt:**
> I need to write up a hire for our new Senior Engineering Manager.

**What happened:**
- Haiku classified the intent as `employment_agreement` (good — no template name in the prompt)
- Response was `kind: clarify` asking for country/brand
- Clarify text: *"For an employment agreement like this..."* — **leaks the doc-type taxonomy back to the user**

**Score: 🟡 Partial**

Initial intake is friendly. But system-side copy still calls things by their internal names:
- Clarify prose: "For an employment agreement like this..."
- Status pills: "Wolt · FIN · Addendum"
- Gap card: "No processed addendum template for GBR yet"

The user can ignore these mostly, but they're a tell that the system is thinking in templates, not in user intent.

---

## P2 — "I shouldn't need to know country variations or regulatory differences"

**Test prompt:**
> New hire for our Helsinki warehouse team

**What happened:**
- Haiku inferred `country: FIN`, `brand: wolt` from "Helsinki" alone
- Skipped clarify entirely
- Went straight to `needs_input` for the still-missing details

**Score: 🟡 Partial — surprisingly good in this case, brittle in others**

The location-to-jurisdiction inference is already working when the user names a city. But:
- *"Senior Engineering Manager"* with no location → clarify asks Wolt/DD/Roo, exposing the brand structure
- Quick-reply chips literally say "Wolt (Finland)" — making the user pick the brand-country pairing the system uses

Real fix: when clarify must fire, the question should focus on what's actually unknown (where is this person working?) instead of presenting the internal brand × country matrix.

---

## P3 — "I shouldn't have to know more than the minimum required details"

**Test prompt:**
> Generate offer letter for aino.makinen@wolt.com

**What happened:**
- Haiku recognized "Aino Mäkinen" from the email and inferred FIN/Wolt
- BUT the system fell into `needs_input` — it didn't look Aino up
- Lookup is currently name-based only AND only fires for addendum/termination paths

**Score: ❌ Not optimized — biggest gap of the five**

The keystone capability here is **identifier-based lookup**. Mock Workday has 6 employees but:
- No email field anywhere
- `findWorkerByName` is the only lookup function
- Lookup only fires on the addendum/termination paths in `route.ts`

For the PoC, the fix is to seed mock Workday with email addresses and add `findWorkerByIdentifier(query)` that resolves name OR email OR worker ID, and to call it for new-EA flows too (so an offer letter for an internal transfer pre-fills from the existing record).

---

## P4 — "Brain dump > forms"

**Test prompt (run as one paragraph):**
> okay so we have this new person Aino, brand new hire, joining the Helsinki team end of the summer, gonna be a Grocery Associate at like 3400 a month, she's 35-ish I think, lives somewhere on Mannerheimintie - 12 I think - signs August 1st, indefinite contract, signed off by Mikko Korhonen who runs People. Duties are the usual GA stuff - take orders, pack groceries, hand off to couriers, manage inventory, keep the place clean.

**What happened:**
- All fields extracted correctly except `employer.legal_name`
- Single field missing → `needs_input` with one slot-fill question

**Score: 🟡 Partial — initial intake is great; slot-fill recovery is form-like**

Initial brain dump works. But when there's a missing field, the recovery experience is a one-at-a-time form question ("Which legal entity is the employer?"). The user can't do another brain dump with the missing info — they have to answer that one question. That's a 90s form.

Fix direction: in needs_input mode, the placeholder should still invite a brain dump: *"Tell me more about [missing thing] — paste anything, even an email or doc snippet."* And the extraction should re-run against the full new message + everything captured so far.

---

## P5 — "What's not captured should be clear; I can correct"

**Test prompt sequence:**
1. Generate a draft (any happy-path EA)
2. Then type: *"Actually the start date is July 15, not Aug 1."*

**What happened:**
- The follow-up message went through fresh classification
- Haiku saw an isolated edit instruction with no document context
- Response: `kind: gap` with `docType: null` — the system can't tell what you're editing

**Score: ❌ Not optimized**

Post-draft edits are entirely missing. Once a draft exists, the system has no concept of "the user is editing the thing I just generated." Each turn is a fresh classification.

Fix direction: track the most recent draft on the server (or pass it back via session state). When the user follows up with an edit-shaped message after a draft was generated, recognize that and re-run compose with the prior record as the base plus the new delta.

---

## Verdict summary

| Principle | Score |
|---|---|
| P1 — No template names | 🟡 Partial (leaked taxonomy) |
| P2 — No country/regulatory knowledge | 🟡 Partial (clarify exposes brand structure) |
| P3 — Minimum details | ❌ Identifier lookup not wired |
| P4 — Brain dump > forms | 🟡 Partial (intake good; recovery form-like) |
| P5 — Clear missing + correct | ❌ Post-draft edits go to fresh classification |

## What's worth fixing — in priority order

1. **P3 identifier-based lookup (HIGH).** Seed mock Workday with emails, add `findWorkerByIdentifier`, fire the lookup for any doc type when a known identifier appears. This is the single biggest wow-moment: paste an email, get a full draft.
2. **P5 post-draft edit mode (HIGH).** Server tracks the latest draft per session (in-memory keyed by specialistId for PoC). When the next message looks like an edit AND a draft exists, treat as a delta against the existing record.
3. **P1 scrub leaked taxonomy (MEDIUM).** Replace "employment agreement template" / "addendum template" in user-facing strings with friendlier phrasing ("a document like this", "this change").
4. **P4 brain-dump-in-slot-fill (MEDIUM).** Composer placeholder + extraction logic in needs_input mode so the user can paste a chunk instead of answering one question at a time.
5. **P2 gentler clarify when context is thin (LOW).** Instead of presenting "Wolt (Finland) / DoorDash (USA) / Deliveroo (UK)" as chips, ask "Where is this person based?" and let extraction infer the brand from the city.

The first two move the system from "interesting prototype" to "actually feels like an AI assistant." The rest are polish.
