# Attendance — Architecture (full model)

> **In one line:** VTOP payload → unweighted sum → predictor arithmetic — the pipeline is short
> because attendance math is easy and impossible to game.

## 1. The data path, hop by hop

```
VTOP doStudentAttendance
  → AmazeCC-API scrapes → { attRes: { success, attendance: [{courseCode, courseTitle, attendedClasses, totalClasses, category, …}] }, marksRes? }
  → ops["attendanceMarks"] → assertApiSuccess → setAttendanceAndOD()
       → atoms: attendanceDataAtom, attendancePercentageAtom (computed)
       → storage: storage.attendance.set(payload) + frozen_marks receipts merge
  → every subscription re-renders — attendance screens are pure projections of this payload
```

## 2. The one true formula (`lib/attendanceSummary.ts`)

```ts
totalAttended = Σ attendedClasses(c) for all c
totalHeld     = Σ totalClasses(c)
percentage    = round(totalAttended / totalHeld × 100)
```

No weighting by credits. No lab-theory split. OD earned classes count the same as attended ones.
The formula is deliberately _dumb_ — dumb is auditable.

## 3. Predictor math (`lib/attendancePredictor.ts`)

`predict()` = given `remaining`, `attended`, `plannedSkip`, `targetPct`:

```
projectedPct(skip) = (attended) / (attended + remaining − skip) × 100
you may skip exactly the floor of the integer solution while projectedPct ≥ targetPct
```

The module also derives `milestoneDates` — see `milestoneDates.ts` — the four exam-week
projection dates used by calendar legend (CAT1/CAT2/DATE FAT labeling).

## 4. The calendar as the spine (`lib/calendarDay.ts`, ~1,581 lines)

`calendarDay.ts` is the most load-bearing non-FFCS module in the repo. It:

- parses VTOP scrape arrays into `CalendarEvent[]` typed `holiday | instructional | cat | fat | important`
- produces `TEACHING_DAYS` schedule skeletons for timetable skeletons (Mon–Sat periods)
- `dateKey(date)` — the one true serialization of a calendar day
- `milestoneExtraction()` — finds CAT/FAT boundaries for the predictor legend
- task due-joins for future features

Tests: `calendarDay.test.ts` (~1,700 lines) is the largest behavioral suite in the repo;
treating it casually is career-limiting here.

## 5. The OD ledger (two populations)

| Source            | Meaning                                                      |
| ----------------- | ------------------------------------------------------------ |
| `officialOdAtom`  | officially approved OD hours (API) — wins ties               |
| `odHoursDataAtom` | client-inferred/“wasted” OD deltas from tapped calendar days |

Official truth beats local inference _always_; the UI badges them separately; the drift log
mentions mismatches rather than silently reconciling.

## 6. Failure modes worth knowing (from the code and the data)

- **Missing attendance for a course row** — VTOP emits no `courseCode` for courses not yet in the
  timetable — those are silently skipped in UI (tests rely on this).
- **Lab double-count** — `labFatWeek.ts` separates LO-week vs TH-week FAT boundaries; the OD
  ledger uses the same split.
- **Percentage motion** — one attendance tap moves two atoms; both trigger via `setAttendanceAndOD`.

## 7. Where to read first

`attendanceSummary.ts` → `attendancePredictor.ts` → `calendarDay.ts` → `analyzeCalendar.ts` — the
order of code dependency and of cognitive dependency.
