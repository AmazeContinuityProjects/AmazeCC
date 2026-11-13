---
title: "FFCS Planner — Deep Dive: The Guided Selector"
description: "~5,126 lines of stateful wizard UI built directly over the same engine the modern grid uses — two experiences, one truth source."
---

# FFCS Planner — Deep Dive: The Guided Selector

> **In one line:** ~5,126 lines of stateful wizard UI built directly over the same engine the
> modern grid uses — two experiences, one truth source.
> **Read first:** `architecture.md`, then open the file.

## 1. What the file _is_

`FFCSGuidedSelector.tsx` — the step-by-step planner. Not a page, not a tab: a world. It owns:

- The **preflight/hero** intro (`MobilePreflightCard`)
- **Course selection** (search + paste + import via `availableSlots` cut at line 1683)
- **Course locks** (`internalCourseLocks`), **blocked slots** (`internalBlockedSlots`, `timeBlockedSlots`)
- **Auto preferences** (compact/spread/morning/evening + strict theory + separate lab days + lunch separation)
- **Ranking preference** (balanced/early-finish/late-start + custom factor ordering + metric weights)
- **Generation** (into staged timetables + variant browser)
- **Faculty priority** (ranking interviews — imported only for advanced sort)
- **Swap UX** (`SlotFacultySwapSheet` — swap without regenerating)
- **Tour** (`FEATURES/TOUR_VERSION`-gated, see `features/tour/`)
- **PDF** — build dossier from within guided flow (`PdfGenerationBadge` state machine)

## 2. State families (useState groups, from the real line numbers)

| Family                  | Example keys                                                                                                                                                                             | Lines    |
| ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| Wizard phase            | `guidedPhase`, `currentStep`                                                                                                                                                             | 256, 593 |
| Plan mode               | `planMode` (custom vs auto)                                                                                                                                                              | 257      |
| Timetable browser       | `browsingTimetableIndex`, `selectedVariantIndex`                                                                                                                                         | 278, 383 |
| Course locks            | `internalCourseLocks`, `locksSearchQuery`, `locksMode`                                                                                                                                   | 263      |
| Auto prefs              | `autoPreference`, `autoStrictTheoryPreference`, `autoSeparateLabDays`, `autoAvoidConsecutiveLabs`, `autoLunchBreakSeparatesLabs`, `autoRankingMode`, `autoMinHalfDays`, auto time bounds | 358–369  |
| Ranking                 | `autoSortBy`, `autoRankingPriorityOrder`, metric weights/filters                                                                                                                         | 369–376  |
| Results                 | `stagedTimetables`, `autoResultFilters`, cap/limit                                                                                                                                       | 382–433  |
| Generation error/notice | `generationError`, `generationNotice`                                                                                                                                                    | 422–424  |
| Block slots             | `internalBlockedSlots`, `timeBlockedSlots`, `blockingActiveDay`                                                                                                                          | 428–431  |
| Faculty priority        | `facultyPriority`, `priorityCourse`                                                                                                                                                      | 406–407  |
| Search                  | `searchQuery`, `typeFilter`, lock-only filter                                                                                                                                            | 593–602  |

## 3. The 14 phases (as the union `GuidedPhase` implies)

```
setup_mode → course_pick → block_slots → timings → auto_generation → results
→ faculty_priority → swap → share → pdf → shortcuts → done(tour) → error(error)
```

(Exact union members drift — verify at line ~110 when editing.)

## 4. Why it's a monolith that's _still_ maintainable

Every phase renders off the same state objects; splitting into 14 files would mean 14 props
drills of the same locks/blocked-slots/preferences. The split that survived: `components/guided/*`
holds the phase-card _presentational_ shells — this file stays the _orchestrator_.

## 5. Editing safely (the checklist)

1. All `useState` additions go in the nearest family — don't invent new top-level groups above line 256.
2. The phase footer owns `prev/next`; new phases must register in both union and the footer switch — search `currentStep ===` for existing cases.
3. `settings` persistence — guided prefs that must survive refresh write to `ffcs_settings` at the settings callsite, not at read time.
4. Generation success is the only place `stagedTimetables` is written — anywhere else is a bug.
