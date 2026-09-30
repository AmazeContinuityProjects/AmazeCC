# Phase 0 — dead code, and the radius doc

Three pieces of work, none of them UI conversion. This phase exists so that Phases 1-5 are not
migrating files that nothing renders, and so the radius question is settled before 61 arbitrary
radii start getting copied around.

## 0.1 Delete the confirmed dead

| File | loc | Evidence | Superseded by |
|---|---|---|---|
| `attendance/PopupCard.tsx` | 535 | 0 importers, 0 render sites | `attendance/DayDetailSheet.tsx` (619, already on-grammar) |
| `exams/AllGradesDisplay.tsx` | 457 | 0 importers, 0 render sites | — |

Evidence is a repo-wide grep over `.tsx`/`.ts` for both an import statement and a JSX render
site. Both files return zero for both.

`PopupCard.tsx` is the safer deletion of the two: its own peer `DayDetailSheet.tsx` is a strict
superset (bottom sheet, `ListShell` rows, `ToneDot`, `AvatarDot`, all primitives) and is rendered
from three places. `AllGradesDisplay.tsx` has no clear replacement — confirm grades are reachable
via `exams/AcademicsHub.tsx` sub-tabs before deleting, and if grades are currently unreachable,
that is a **bug to report, not a migration to schedule**.

**Also verify before deleting** (candidates that are *not* dead, listed so nobody re-audits them):

| File | Why it looks dead | Actually |
|---|---|---|
| `AttendanceCalendarView.tsx` | older calendar, next to `CalendarSubpage` | **live at 3 sites** — `AttendanceSubpage:551`, `OverallTrackerSubpage:230`, `CourseDetailSubpage:1126` |
| `exams/VitolDisplay.tsx` | 1 importer | live (1 importer, 1 render) |
| `exams/MoodleDisplay.tsx` | imported once | live |
| `exams/TestGradesContainer.tsx` | 40 loc shim | live |
| `attendance/TimetableGrid.tsx` | 346 loc | live; delegates to `TimetableView:256` |
| `exams/CourseDashboard.tsx` | 94 loc router | live; `AcademicsHub` renders it |

## 0.2 Update `design/DESIGN_LANGUAGE.md` §5

The doc currently states:

```
Small Radius      12px
Medium Radius     16px
Large Radius      24px
Extra Large Radius 32px

No arbitrary radius values.
```

That is wrong on two counts. The code ships **8** (`rounded-lg`, segmented segments) and **28**
(`BottomSheet.tsx:226,244`, `EMPTY_STATE` at `uiTokens.ts:105`). And several of the "arbitrary"
values are not arbitrary at all — they are the *scale*, written in Tailwind arbitrary syntax
because the named steps do not cover 24 or 28.

`rounded-[24px]` is not a violation of a 24px scale. It is the 24px step, spelled out. The
audit counts these separately only so the doc amendment can be precise.

Amendment to §5:

```markdown
# 5. Radius System

Scale (Tailwind):

| Step  | Class             | Used for                              |
|-------|-------------------|---------------------------------------|
| 8     | `rounded-lg`      | Segmented segments, inner chips        |
| 12    | `rounded-xl`      | Icon buttons, tone icon tiles         |
| 16    | `rounded-2xl`     | List shells, chips, content cards     |
| 24    | `rounded-[24px]`  | Tile surfaces, insight carousels      |
| 28    | `rounded-[28px]`  | Bottom sheets, dashed empty states    |
| 32    | `rounded-[32px]`  | Large empty-panel variant             |

`rounded-[24px]`, `rounded-[28px]` and `rounded-[32px]` are the named steps expressed in
Tailwind's arbitrary-value syntax, because Tailwind's `rounded-3xl` (24px) and
`rounded-[1.75rem]` (28px) do not map one-to-one onto this scale. They are not arbitrary.

No values outside this scale. `rounded-3xl` is not permitted: it is Tailwind's 24px, which
this scale expresses as `rounded-[24px]`, and mixing the two produces visually identical
surfaces that fail to dedupe.
```

That last sentence matters. `rounded-3xl` is 53 hits across 21 files and every one of them is
*visually correct* — they are just on a different spelling of step 24. Normalising them to
`rounded-[24px]` is a no-op on screen and makes the token greppable.

Also worth adding to §5, since the audit surfaced it as a real disagreement: the doc says
"no custom shadows" and the code uses `shadow-xs`, `shadow-2xs` and
`shadow-[0_-15px_...]` (`BottomSheet.tsx:226`). Either amend §6 the same way or accept the
mismatch knowingly. Do not leave it silent.

## 0.3 Normalise `rounded-3xl` → `rounded-[24px]`

61 occurrences, 21 files. Mechanically a `sed`, but it is a Phase 0 item because it must land
**before** the conversions, so that Phases 1-5 produce a tree where `rounded-3xl` means
"unconverted" and nothing else.

Affected: `LoginForm` (7), `SimplifiedAcademicsPage` (6), `AcademicsHub` (5),
`CourseDetailSubpage` (6), `OverallAttendancePredictor` (4),
`CabShare/SearchTrips` (5), `marks-predictor/CoursePredictorHero` (5),
`MarksDisplay` (3), `CabShare/MyTrips` (4), `CabShare/CabShareMatchCard` (3),
`AttendanceCalendarView`, `Attendance/TimetableGrid`, `CabShare/CreateTrip`,
`CabShare/CabShareAuthModal`, `CoursePredictorHero`, `AssessmentRegimenEditor`,
`CourseSelectorStrip`, `TargetGradeSolver`, `WhatIfSimulator`, `ClubHubTab`, `CommunityFeed`,
`CourseQBankTab`, `MarksPredictorTab`, `ProfileStatusCards`, `MessDisplay`, `nav/calendar`, `other`.

Then the genuinely off-scale values, 10 of them, all in `marks-predictor/`:
`rounded-[18px]` ×4 in `CoursePredictorHero` (→ these become `StatTile`, not a radius edit),
`rounded-[22px]` ×5 in `SimplifiedAcademicsPage` (→ `TILE_CARD`), and one each in
`AllCoursesMatrix`, `AssessmentRegimenEditor`, `CourseSelectorStrip`, `TargetGradeSolver`,
`WhatIfSimulator`, `MarksPredictorTab` (×2), `ProfileStatusCards` (×2).

These go to the *nearest* step: 18 → 16, 22 → 24. Do not invent 20 or 26.

## 0.4 A lint guard, if it can be had cheaply

`eslint.config.mjs` already exists. Two rules worth adding, both as `warn` initially:

1. **no-restricted-imports** on `@amazecontinuityprojects/amazeui`, allowing `cn` and `type`.
   This is what makes Phase 4's deletion durable — otherwise the next contributor re-imports
   `Card` and the old dialect is back.
2. **no-restricted-syntax** on `rounded-3xl` in `className`, after 0.3.

If the ESLint version in this repo cannot express rule 1 without config gymnastics, **skip it and
note it**. The prohibition belongs in the doc set either way. Do not spend this phase fighting
lint config.

## Gate

```
pnpm test        # expect 854 passed across 46 files, unchanged
pnpm typecheck
pnpm lint
```

The test count must be **exactly** 854. Deleting `PopupCard.tsx` and `AllGradesDisplay.tsx`
should not move it, since no test imports either — if it drops, something was importing them
that the grep missed, and that is a **stop and report**.

## Net effect

−992 lines deleted, one doc corrected, 61 no-op radius normalisations, and a tree where
`rounded-3xl` and `dark:bg-black` are reliable "not yet converted" markers.
