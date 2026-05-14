# Nielsen Norman Group — 10 usability heuristics review

> Lumina v2 measured against [NN/g's 10 Usability Heuristics for User Interface
> Design](https://www.nngroup.com/articles/ten-usability-heuristics/). Each
> heuristic is scored with concrete evidence from the current build, then
> evaluated for fix-priority.
>
> Scoring scale:
> - ✅ Strong — the system honors the heuristic well
> - 🟡 Partial — works in common cases, breaks at edges
> - ❌ Violation — the system actively works against the heuristic

---

## H1 — Visibility of system status

> *"The design should always keep users informed about what is going on, through appropriate feedback within reasonable time."*

**Evidence:**
- ✅ Status pill while busy: *"Understanding what you need…"*, *"Drafted ✓"*
- ✅ Thinking dots animation on assistant bubble while waiting
- ✅ Live preview panel updates as slots fill in (collecting state)
- ✅ Brand color stripe across header + preview signals which jurisdiction context is live
- 🟡 Status messaging is coarse — *"Drafting…"* covers a chain of Haiku + Opus calls. For long operations (8+ seconds on the addendum flow with lookup), a more granular state would reassure: *"Looking up Aino in Workday…"* → *"Extracting the changes you want…"* → *"Drafting clauses…"*

**Score: 🟡 Partial**

Fix priority: low. Coarse status is acceptable for PoC; granular pipeline narration is a polish lift.

---

## H2 — Match between system and the real world

> *"The design should speak the users' language, with words, phrases, and concepts familiar to the user, rather than internal jargon."*

**Evidence:**
- ✅ Status pill now reads *"New hire · Wolt · Finland"* (was: *"Wolt · FIN · Employment agreement"*)
- ✅ Gap card reads *"I don't have approved language for [doc] in [country] yet"* (was: *"No processed template"*)
- ✅ Clarify asks *"Where is the person based?"* (was: *"For an employment agreement like this, which country and brand are we working with?"*)
- ✅ Empty-state prompts speak intent, not template: *"Create an employment agreement"* / *"Modify an existing employee's contract"*
- 🟡 Watermark stripe shows *"LUMINA V2 PROTOTYPE — NOT FOR EXECUTION"* — clear, but the trailing `WKR_005` is jargon
- 🟡 Provenance JSON expander uses raw field paths (`schedule.averageWeeklyHours`) — fine for power users, opaque for everyone else

**Score: 🟡 Partial — strong recent improvements; the technical leakage that remains is in places users opt into**

Fix priority: low. The remaining jargon is tucked into "Provenance record" details — gated behind disclosure.

---

## H3 — User control and freedom

> *"Users often perform actions by mistake. They need a clearly marked 'emergency exit' to leave the unwanted state."*

**Evidence:**
- ✅ "Start over" link in chat header (clears messages, history, preview)
- ✅ Gap card "Or start over with a different request" affordance
- ✅ Composer can be edited freely before submit
- ✅ Post-draft edits ("Actually the start date is July 15") now work as edit-deltas, not fresh requests
- ❌ **No undo on the previous turn.** "Start over" is all-or-nothing. If you submit one message you regret, you can't pop it off and try again — you have to wipe everything.
- ❌ **No edit on feedback submission.** Once you click 👍 + a note, you can't change it. Logged forever in JSONL.
- ❌ **No confirmation on Start Over.** One click and a long brain dump is gone.

**Score: 🟡 Partial → leans ❌**

Fix priority: **medium-high.** "Undo last turn" is the single biggest control gap. A small "↶ Undo last message" affordance on the most recent user bubble (or as a chat-level button after the last assistant message) would close it.

---

## H4 — Consistency and standards

> *"Users should not have to wonder whether different words, situations, or actions mean the same thing."*

**Evidence:**
- ✅ Consistent bubble styles (user dark / assistant light / status pill)
- ✅ Consistent brand color treatment (red/blue/teal stripe across header + preview + status)
- ✅ Same chip pattern for clarify quick-replies and gap-card actions
- ✅ Citation block at the end of every draft has the same shape
- 🟡 "Done — your draft is ready in the preview panel" vs. terser status pills like "Drafted ✓" — two voices in one flow
- 🟡 Status pills use country **ISO codes** ("FIN") in some places, friendly country names ("Finland") in others post-scrub. Need a sweep.

**Score: 🟡 Partial**

Fix priority: low. Minor copy inconsistencies; not actually confusing.

---

## H5 — Error prevention

> *"Good error messages are important, but the best designs carefully prevent problems from occurring in the first place."*

**Evidence:**
- ✅ `LUMINA_POC_MODE=true` tripwire — generation is blocked at the route level without explicit opt-in
- ✅ Jurisdiction validators catch real-world errors (max trial period in Finland is 6 months; currency must be EUR for FIN; fixed-term contracts must have an end date)
- ✅ Conservative `looksLikeEdit()` heuristic — only triggers on edit-shaped messages with a prior draft, won't silently mutate on a fresh request
- ✅ "Don't invent values" instruction in extraction prompt — Haiku is biased toward omitting over hallucinating
- 🟡 No confirmation step before the system applies a post-draft edit. Mostly fine because it's reversible, but a quick visual diff would prevent surprise.
- ❌ Start Over is one click with no confirm. After a long session, that's destructive.

**Score: 🟡 Partial**

Fix priority: medium. The validators are the real win here. The remaining gaps are click-throughs that could destroy work.

---

## H6 — Recognition rather than recall

> *"Minimize the user's memory load by making elements, actions, and options visible."*

**Evidence:**
- ✅ Four starter prompts on the empty state — user sees doc types, doesn't have to remember syntax
- ✅ Clarify quick-reply chips show options ("Finland", "United States", "Germany", "United Kingdom")
- ✅ Gap card surfaces the two best alternatives as buttons, not as "type your choice"
- ✅ Extracted card shows captured fields — user can see what the system understood
- ✅ Live preview shows the document taking shape — recognition of correctness as it happens
- ❌ **No autocomplete on employee names/emails.** Power users have to remember `aino.makinen@wolt.com` exactly. A simple suggestion list as you type would close this.
- ❌ **No history of past drafts.** Yesterday's session is gone. If the user wants to revisit, they're starting over.

**Score: 🟡 Partial — strong on the intake; weak on retrieval**

Fix priority: medium. Autocomplete is the highest-impact missing recognition aid.

---

## H7 — Flexibility and efficiency of use

> *"Shortcuts — hidden from novice users — may speed up the interaction for the expert user, such that the design can cater to both inexperienced and experienced users."*

**Evidence:**
- ✅ Brain-dump intake supports both novices and experts — same textbox
- ✅ **Expert shorthand works.** Verified just now:
  - *"FIN/Wolt EA, indefinite, Aino Tester DOB 1990-03-14, GA, 3400 EUR/mo, 37.5h, start 2026-08-01..."* → directly to `needs_input` with only duties missing
  - *"addendum for wkr_005 to reduce hours to 30 effective 2026-06-01"* → directly to `draft`
- ✅ Quick-reply chips can be ignored — typing always works
- ✅ Worker IDs (`wkr_005`), emails (`aino.makinen@wolt.com`), and bare names all route to lookup
- ❌ **No keyboard shortcuts** for common actions (Cmd+Enter to send, Cmd+Z to undo, Esc to dismiss chips)
- ❌ **No saved templates or bookmarks** — a power user who runs 5 USA terminations a day still types each one from scratch

**Score: ✅ Strong on the intake; 🟡 Partial overall**

Fix priority: low for keyboard shortcuts (PoC is mouse-first), medium for "save this configuration" if real usage emerges.

**This is the heuristic you specifically flagged. Confirming: experts CAN summon templates by name. Tested in API and it routes through Haiku correctly. The change I made earlier was scrubbing template language from the system's OUTPUT, not from accepting it as INPUT. Both expert and novice intake paths work.**

---

## H8 — Aesthetic and minimalist design

> *"Interfaces should not contain information that is irrelevant or rarely needed. Every extra unit of information competes with the relevant units."*

**Evidence:**
- ✅ Split layout only appears when there's something to preview — empty state is full-width chat
- ✅ Gap card collapsed from a multi-paragraph wall to a 1-line + 2 chips + 1 sentence
- ✅ Provenance JSON tucked behind a `<details>` disclosure
- ✅ Status pills are compact, never block content
- ✅ Brand stripe is 2-pixel hairline — present, not intrusive
- 🟡 The PoC PREVIEW banner is yellow-on-yellow soft — easy to read past; could be slightly more prominent on the FIRST draft of a session

**Score: ✅ Strong**

Fix priority: very low. This is one of the heuristics Lumina honors best.

---

## H9 — Help users recognize, diagnose, and recover from errors

> *"Error messages should be expressed in plain language (no error codes), precisely indicate the problem, and constructively suggest a solution."*

**Evidence:**
- ✅ Missing fields are listed with friendly ask prompts: *"What's the employee's date of birth?"*, *"Which legal entity is the employer?"*
- ✅ Recent JSON-parse tolerance fix — Haiku occasionally appends prose, parser now extracts the first balanced `{}` block instead of failing
- ✅ Gap card explains WHY there's no template + offers two concrete next steps
- ❌ **`[MISSING: ...]` placeholders in rendered drafts have no inline action.** The watermark stripe says "draft not for execution" but a missing field appears inline in the prose with no way to address it from the document itself.
- ❌ **"Hit a wall" generic error message** when the API returns `kind: 'error'` — user sees a raw error string with no recovery suggestion.
- ❌ **No diff after edit.** When a post-draft edit applies, the new draft just replaces the old one — there's no "here's what changed" visualization.

**Score: 🟡 Partial → leans ❌**

Fix priority: **medium-high.** The MISSING-placeholder problem is the most actionable: each placeholder in the draft should be a clickable element that focuses the composer with a relevant prompt.

---

## H10 — Help and documentation

> *"It's best if the system doesn't need any additional explanation. However, it may be necessary to provide documentation to help users understand how to complete their tasks."*

**Evidence:**
- ✅ Landing page (`/`) explains what Lumina is, what's wired, and the PoC disclaimer
- ✅ Empty state on `/draft` has 4 example prompts (recognition-not-recall aids)
- ✅ Inline microcopy is generally clear (composer placeholder, watermark, citations heading)
- ❌ **No in-app help once you're in `/draft`.** No "?" tooltip, no help panel, no inline guidance on what to do next when stuck.
- ❌ **No documentation of what the system can DO** beyond starter prompts. A new user doesn't know if they can edit drafts, lookup by email, ask follow-up questions, etc.
- ❌ **No example flows visible from the chat surface.** Tutorial-style "watch this happen" would help.

**Score: ❌ Violation**

Fix priority: medium. A minimal "/help" command (or "?" button) that lists capabilities ("you can paste an email", "you can edit any draft by saying 'actually...'", "you can ask for any of: hire / change / termination / certificate / NDA / travel letter") would close the biggest gap.

---

## Summary scoreboard

| # | Heuristic | Score | Fix priority |
|---|---|---|---|
| H1 | Visibility of system status | 🟡 | Low |
| H2 | Match system + real world | 🟡 | Low |
| H3 | User control and freedom | 🟡→❌ | **Medium-high** |
| H4 | Consistency and standards | 🟡 | Low |
| H5 | Error prevention | 🟡 | Medium |
| H6 | Recognition rather than recall | 🟡 | Medium |
| H7 | Flexibility and efficiency | ✅→🟡 | Low |
| H8 | Aesthetic and minimalist design | ✅ | Very low |
| H9 | Help recover from errors | 🟡→❌ | **Medium-high** |
| H10 | Help and documentation | ❌ | Medium |

## Top 3 fixes (highest leverage)

1. **Undo last turn (H3).** A small "↶ Undo last message" affordance after the most recent user/assistant pair. Pops the last turn off the history, restores the composer if it was the user's. Closes the biggest hole in user control.

2. **Clickable `[MISSING: ...]` placeholders (H9).** When a draft renders with an inline `[MISSING: employee.dateOfBirth]`, that span should be a button. Clicking it focuses the composer with a pre-filled prompt: *"The employee's date of birth is "* and waits for the user to type. Eliminates the "I see what's missing but how do I fix it" dead-end.

3. **`/help` slash command or "?" button (H10).** Compact panel listing what Lumina can do, with one-click example chips. Discoverable without leaving the chat surface.

These three together would lift four heuristic scores and would take maybe 90 minutes to build.

## What's already strong

- **H7 Flexibility** — the brain-dump-or-shorthand intake honors both audiences without forcing one mode.
- **H8 Minimalism** — the recent compact gap card + tucked-away provenance is genuinely good.
- **H2 Match real world** — the recent taxonomy scrub closed most of this gap.
- **H6 Recognition** — chips, starter prompts, extracted card, live preview all do real work here.

The architecture (universal record + jurisdiction layer + clause library) is shaped right for the heuristics. The remaining gaps are mostly affordances on the chat surface, not foundational rework.
