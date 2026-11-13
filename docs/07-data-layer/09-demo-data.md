---
title: "Demo Data (the fixture that powers the whole demo)"
description: "src/data/demoData.json — 151 KB of fictional VIT-life — is the only reason anyone can run this app cold. Byte-identical copy lives in public/."
---

# Demo Data (the fixture that powers the whole demo)

> **In one line:** `src/data/demoData.json` — 151 KB of fictional VIT-life — is the only reason
> anyone can run this app cold. Byte-identical copy lives in `public/`.

## What's inside

- `username: "demo"`, `password: "demo@…"` (public)
- `attendance`: current semester of 20-ish courses with plausible percentages
- `marks`: assessments for the same courses
- `grades` / `allGrades`: two full semesters of invented GPA (Reg `22BCE1234`)
- `hostel`, `calender` (misspelled on purpose — VTOP field)
- `registeredEvents` (2 events), `profile` (Demo Student)
- `schedule` (empty semester table), `marksStats` fixtures

## Sha provenance

```
sha256(src/data/demoData.json) == sha256(public/data/demoData.json)
```

Both are committed; CI asserts nothing, but the handoff checklist does. Regenerating means
updating both and validating in demo mode before release.

## How demo mode consumes it

`handleDemoClick()` → `fetch("/data/demoData.json")` → atoms seeded → network never touched.
No engine involvement at all for the _seed_ — the engine still serves on-tab refresh actions
by doing nothing (VTOP guards).

## Rules

- Never regenerate by scrambling a real student's payload.
- Keep new fields additive; demo rots silently when screens add unrecognized fields.
- Demo mode is the screenshot tool — blur nothing; it's all fiction.
