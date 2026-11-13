---
title: "Timetable Slot Algebra"
---

# Timetable Slot Algebra

> Slot vocabulary is the load-bearing concept of the timetable engine.

- **Slot token** identifies a (day, period) pair: `A1` = Mon period 1, `A2` = Tue 1, … `TA1` = Tue alternate? No — the alternate numberings come from paired tokens (lab slots `L`/`TP` families).
- **Period grid (Chennai GLOBAL)** — Monday–Saturday, 8 periods per day with a lunch band at 12:35; slot spellings include `S##` variants from newer VTOP school years (`S11`, `S12` …) — never hand-type them; `slots.ts` is the vocabulary.
- **Labs** span two consecutive periods (embedded theory+lab courses are TWO rows in ParsedCourse).
- **Clashes** — two slots collide iff they share (day, period). The walk prunes branches early on lab-day constraints (a lab slot forces theory into complementary blocks).
- **GLOBAL campus** — the only supported schema; Bhopal/AP JSON is present but unused.
