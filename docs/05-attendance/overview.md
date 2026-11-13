---
title: "Attendance — Overview (walkthrough)"
description: "open Attendance, see exactly how many classes you can skip this week without breaching 75% — or whatever threshold you set."
---

# Attendance — Overview (walkthrough)

> **In one line:** open **Attendance**, see exactly how many classes you can skip this week
> without breaching 75% — or whatever threshold you set.
> **Screen order:** tab → month → course → sheet.

## The path a student takes

1. **Attendance tab opens** — month view. Colors are `TEACHING_DAYS` classes: instructional = solid dot,
   CAT/FAT = exam-colored chip, holiday = red dashed. Past = green/red eco-dot depending on whether all
   held classes that day were attended (inferred).
2. **Click a day** → `DayDetailSheet` slides up: classes held, marks earned, exams nearby, ICS export button.
3. **Click a course** → `DesktopCourseDetail` — every number VTOP exposes + local notes —
   with the **Skip simulator** at the bottom showing
   _"You can skip N more this semester and stay ≥ 75%"_ — recomputed live.
4. **Overdue?** → OD tracker lists official vs inferred OD — green/red split by whether VIT has approved them.
5. **Predictor** card lets you ask "what if I miss two Lab sessions and one TH?" — answers with numbers.

## The math students actually learn

`(attended so far) ÷ (held so far + remaining after skips) ≥ 0.75` — solved per course, shown bold.
OD sits on the plus side just like attended classes — every OD is a class attended, academically.

## The one rule of this screen

**Never show a stale number without a "last synced" stamp.**
The badge at the top is fed by sync session state; tapping it re-runs the `attendanceMarks` op.
