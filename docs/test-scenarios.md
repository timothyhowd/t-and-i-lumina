# Lumina v2 — manual test scenarios

> Run these at http://localhost:3000/draft. Each one has a short note on what
> "good" looks like. The Notes line is for whatever you observed — paste it
> back into chat or commit the file when you're done.
>
> Also: every draft has a 👍 / 👎 / note widget at the bottom. That captures
> per-draft reactions to `corpus/feedback/runs.jsonl`. Use the widget for
> artifact-level feedback ("this clause is wrong"); use the Notes lines here
> for journey feedback ("the clarify question felt off").

---

## 🟢 Happy paths — should produce a draft

### S1. FIN/Wolt employment agreement, indefinite, operational

**Prompt:**
> New Wolt Finland hire — Aino Mäkinen (DOB 1990-03-14), Mannerheimintie 12, 00100 Helsinki, Grocery Associate at Wolt Services Oy (Business ID 3126563-4, Pohjoinen Rautatiekatu 21, 00100 Helsinki), signed by Mikko Korhonen, Head of People. Indefinite, starts Aug 1 2026, 3400 EUR/month, 37.5 hours/week. Duties: orders, packing, courier handoffs, inventory, cleanliness.

**Look for:**
- Right panel renders a Wolt-stripe (#009DE0) draft
- Section 2 reads "valid until further notice and commences on 2026-08-01"
- Section 4 has the five duty bullets, not invented extras
- Section 5: 3400 EUR, paid monthly (not "bi_weekly" or "monthly_fixed")
- Citations block: Employment Contracts Act, Working Hours Act, Annual Holidays Act
- PoC PREVIEW banner at top, watermark stripe at top of preview

**Notes:**


---

### S2. FIN/Wolt fixed-term

**Prompt:**
> Fixed-term hire for Wolt Finland — Test Tester, Helsinki, joining Sept 1 2026, contract ends Dec 31 2026 to cover a maternity leave, 3200 EUR/month, 37.5 hours/week, Grocery Associate at Wolt Services Oy. Signatory Mikko Korhonen, Head of People. Aino's home address: Mannerheimintie 12, 00100 Helsinki, DOB 1985-04-22. Duties: orders, packing, inventory.

**Look for:**
- Section 2 reads "fixed-term contract commencing on 2026-09-01 and ending on 2026-12-31"
- The fixed-term reason ("maternity leave cover") appears in the validity clause
- All other clauses still render

**Notes:**


---

### S3. USA/DoorDash at-will offer letter

**Prompt:**
> New DoorDash USA hire — Jamie Park, 1234 Oak Street, Austin, Texas 78701. Senior Software Engineer, starts July 1 2026, base 180000 USD per year, reports to Engineering Director. Right-to-work verified via I-9. Employer: DoorDash Technologies Inc., EIN 46-2852392, 303 2nd Street, San Francisco, CA 94107. Signed by Chris Martin, Head of People US. Duties: design and ship distributed systems, mentor mid-level engineers, lead design reviews.

**Look for:**
- Right panel renders DoorDash-stripe (#EB1700)
- "EMPLOYMENT IS AT WILL" section appears
- No European-style sections (no notice period clause, no CBA)
- Compensation: "180000 USD annual"
- Citations: FLSA + COBRA + ERISA at the bottom

**Notes:**


---

### S4. DEU/Wolt bilingual employment agreement

**Prompt:**
> New Wolt Germany hire — Maximilian Schmidt (DOB 1992-06-21), Hauptstraße 45, 10115 Berlin. Operations Manager at Wolt Deutschland GmbH (HRB 178923), Friedrichstraße 68, 10117 Berlin. Anna Becker, People Director, signs. Indefinite, starts Sept 1 2026, 5500 EUR/month, 40 hours/week, 6-month probation. Duties: oversee city operations, manage courier supply, partner with merchants.

**Look for:**
- Every section appears in **both German and English**
- § 2 Probezeit appears (6 months)
- § 9 notice cites § 622 BGB
- § 10 IP cites § 69b UrhG + Arbeitnehmererfindungsgesetz
- § 14 Sprachfassung: "German version prevails"

**Notes:**


---

### S5. FIN addendum — hours change (lookup flow)

**Prompt:**
> Reduce Aino Mäkinen's hours from 37.5 to 30 starting June 1 2026.

**Look for:**
- No clarify question — system identifies Aino from mock Workday
- Status pill reads "Wolt · FIN · Addendum"
- Right panel: addendum with effective date 2026-06-01
- The change clause cites the Working Hours Act (Työaikalaki 872/2019)
- Aino's existing employer (Wolt Services Oy) appears in the recital

**Notes:**


---

### S6. FIN addendum — salary change (same employee)

**Prompt:**
> Increase Aino Mäkinen's monthly salary from 3400 to 3800 effective July 1 2026.

**Look for:**
- Same lookup-skip-clarify behaviour as S5
- Change clause names the previous and new salary, with effective date
- No spurious additional changes

**Notes:**


---

## 🟡 Clarify paths — should ask, not guess

### S7. Doc type known, country/brand missing

**Prompt:**
> Create an employment agreement

**Look for:**
- Bot asks "For an employment agreement like this — which country and brand are we working with?"
- Three quick-reply chips: Wolt (Finland), DoorDash (USA), Deliveroo (UK)
- Clicking a chip sends it as a message; the others grey out

**Notes:**


---

### S8. Doc type ambiguous, just an action verb

**Prompt:**
> Modify someone's contract

**Look for:**
- Bot identifies docType as addendum, asks for the employee name
- Plain-text question, no chips (no fixed set of names)

**Notes:**


---

### S9. Employee not in Workday

**Prompt:**
> Reduce Jordan Smith's hours from 40 to 30

**Look for:**
- Bot identifies docType as addendum, recognizes "Jordan Smith" as the subject
- Doesn't find them in mock Workday → asks for full name as it appears in Workday

**Notes:**


---

## 🟠 Gap paths — v2 has no rule, should surface alternatives

### S10. Poland EA (no Poland rule)

**Prompt:**
> Poland Wolt employment agreement

**Look for:**
- Status pill: "Wolt · POL · Employment agreement"
- Gap card: "No processed employment agreement template for POL yet"
- Two action chips: "Adapt closest match" + one other
- Description names Poland's 18 templates in the Drive inventory
- "Or start over with a different request" link

**Notes:**


---

### S11. Action on gap card

After getting the gap card from S10, click "Adapt closest match".

**Look for:**
- Chip greys out (consumed)
- User-style message appears: "Yes — adapt the [country] template structure for POL."
- New round of analysis fires — either lands on a v2 rule we have or hits gap again with the new context
- No JSON parse error

**Notes:**


---

### S12. UK Deliveroo (no UK templates in corpus)

**Prompt:**
> UK Deliveroo employment agreement

**Look for:**
- Status pill: "Deliveroo · GBR · Employment agreement"
- Gap card with closest matches — should mention Australia or Ireland as closest common-law jurisdiction
- Header brand selector flips to Deliveroo teal

**Notes:**


---

## 🔴 Edge cases — push the system

### S13. Diacritic mismatch

**Prompt:**
> Reduce Aino Makinen's hours from 37.5 to 30 starting June 1 2026

(no umlaut on Mäkinen)

**Look for:**
- Lookup still finds Aino Mäkinen — normalization is working
- Output uses the correct umlaut form from Workday

**Notes:**


---

### S14. Multi-field addendum

**Prompt:**
> Reduce Aino Mäkinen's hours from 37.5 to 30 AND increase her salary from 3400 to 3800, both effective June 1 2026.

**Look for:**
- Both deltas captured in the addendum
- The change section enumerates both as numbered items
- Either Working Hours Act citation OR no citation drift — should not invent new statutes

**Notes:**


---

### S15. Missing critical fields — should fall through to slot-asking

**Prompt:**
> New FIN Wolt hire, joining next month

**Look for:**
- Lands in `needs_input` (not draft, not clarify)
- Lists the missing fields (employee name, employer signatory, salary, etc.)
- Doesn't fabricate values

**Notes:**


---

### S16. Free-text slot quality (duties bullet list)

Use S1 but change the duties phrasing:
> ...Duties: takes orders coming in from the merchant app, packs grocery bags, hands them off to couriers and customers, watches inventory levels, keeps the place tidy.

**Look for:**
- Section 4 in the draft normalizes these into clean bullets
- Doesn't invent additional duties (no "leads team meetings" or similar drift)
- Doesn't repeat the same duty twice in different phrasing

**Notes:**


---

### S17. Country/brand swap mid-conversation

After running S1 (FIN/Wolt) and getting a draft, type:
> Same thing but for the Germany office

**Look for:**
- Doesn't reuse the FIN draft verbatim
- Re-routes through DEU/Wolt jurisdiction
- Either produces a fresh German draft or surfaces the missing fields specific to DEU

**Notes:**


---

### S18. Hostile / nonsense input

**Prompt:**
> Make me a sandwich

**Look for:**
- Should not produce a draft
- Either clarifies politely or returns an error message — not a confused mid-stream failure

**Notes:**


---

## How to feed back

1. **Per-draft reactions:** use the 👍/👎/note widget at the bottom of any
   draft. It's appended to `corpus/feedback/runs.jsonl` with timestamp,
   document id, intent, and your note. I can read that file directly when
   you tell me to.
2. **Journey-level reactions:** fill in the **Notes** lines above. When
   you're done, paste the doc back into chat or commit it — I'll pick it up.
3. **Anything else:** just tell me. The widget and the notes are aids, not
   contracts.
