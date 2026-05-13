# Annual Holidays Act (Vuosilomalaki 162/2005)

> **Source:** [Finlex.fi — Annual Holidays Act, English translation](https://finlex.fi/en/legislation/translations/2005/eng/162) (Ministry of Economic Affairs and Employment, Finland)
>
> **Status:** Translation from Finnish. Legally binding only in Finnish and Swedish.
>
> **Full text:** see `aha.txt` (machine-extracted) and `aha.pdf` (Finlex canonical).

This file extracts the sections cited by the Lumina FIN clause library.

---

## Section 5 — Earning annual holiday

> (1) An employee is entitled to two and a half weekdays of holiday for each full holiday credit month. However, the entitlement is two weekdays of holiday for each full holiday credit month if, by the end of the holiday credit year, the duration of the employment relationship has been an uninterrupted period of less than one year. When the number of days holiday is calculated, any fraction of a day is rounded up to constitute one full day of holiday.

## Section 6 — Full holiday credit month

> (1) A calendar month during which an employee has accumulated at least 14 days at work or the equivalent of days at work, as referred to in section 7(1) and (2), is considered to be a full holiday credit month.
>
> (2) If, in accordance with the employee's contract, the employee works on so few days that he or she does not therefore accumulate 14 days at work in any month or accumulates 14 days at work in only some of the calendar months, a full holiday credit month is considered to be a calendar month during which the employee has accumulated at least 35 hours at work or the equivalent of hours at work as referred to in section 7.

## Section 16 — Holiday compensation during an employment relationship

> An employee referred to in section 8(1) above is entitled to receive as holiday compensation 9 per cent, or, if the employment relationship has lasted for at least one year by the end of the holiday credit year preceding the holiday season, 11.5 per cent, of his or her pay, or pay in arrears, for the time at work during the holiday credit year, excluding any sum payable for emergency overtime work and statutory or agreed overtime work.

## Section 17 — Holiday compensation at the end of an employment relationship

> (1) At the end of an employment relationship, the employee is entitled to holiday compensation instead of annual holiday for any holiday entitlement or holiday compensation earned but not yet received. If the employment relationship has lasted at least one year by the time it ends, the employee is entitled to holiday compensation from the start of the current holiday credit year for a period equivalent to the amount of holiday determined in accordance with the first sentence of section 5(1).
>
> (3) Holiday compensation is calculated in compliance with the holiday pay provisions in sections 9–12, as applicable. The employee's pay per holiday day shall be calculated as follows: a divisor of 6 shall be used for those employees with weekly salaries and a divisor of 25 for those earning monthly salaries.

---

## Notes for the Lumina clause library

- `fin.annual_leave` cites this act generally — most of the substantive rules (accrual, entitlement, fragmentation) are routed through it rather than enumerated in the clause.
- `fin.final_pay` cites **§17** for the accrued-leave payout at termination.
- For Wolt operational roles where the employee accrues <14 days/month, the 35-hour-month rule in **§6(2)** is relevant — Lumina's slot schema should capture this when surfacing fields for shiftwork or part-time hires.
