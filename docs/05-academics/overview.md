# Academics — Overview (the walking tour)

> **In one line:** everything about your degree performance — past, present and a probabilistic future — in one tab.

1. **Simplified marks list** (default landing) — every course this term with its TH/ELA/LO lanes split out; type filter chips across the top; color ramp red→green; tap any row to drill into the course detail page.
2. **Grade history** — semester table with cumulative CGPA bolded; each row expandable to subjects with effective-vs-declared grade reconciliation.
3. **Marks predictor** — the what-if ladder (see 05-marks-predictor/).
4. **Curriculum** — the VIT catalog browser: every required course of your degree, your progress against it, and your branch averages.
5. **Exam schedule** — CAT/FAT with venue, floor, seat, reporting; PDF/image export and iCal.
6. **Course dashboard** — the per-course deep-dive target most students actually use weekly.

## The honest contract

Every figure on this tab is either:

- server-sent (VTOP), or
- computed from that payload on-device by `lib/*` — always labeled as such when stale

Nothing here is aspirational or invented. If a number seems wrong, assume a stale payload first —
pull refresh before assuming a bug.
