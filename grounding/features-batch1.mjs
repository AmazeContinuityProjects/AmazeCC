// Generates the 8-file skeleton (README done by hand, 7 content files here) for
// mid-size feature folders in docs/05-*/. Idempotent — never overwrites existing files.
// Content is real, sourced from the codebase; extend by editing this file.
import { mkdirSync, writeFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";

const pages = {
  // ───────────────────────────── attendance
  "05-attendance/overview.md": `# Attendance — Overview

Open **Attendance**. The tab has one job: tell the student where they stand, per course, per month, with one authoritative number everywhere — \`attendanceSummary.ts\`: unweighted sum of \`attendedClasses / totalClasses\` across all courses. OD requests score against the same odds.

## Screens

1. **Calendar view** — month grid with working days, instructional days, CAT/FAT dates (\`calendarDay.ts\` classifies)
2. **Course detail** — per-course rates, skip math (\`attendancePredictor.ts\`), embedded-lab weight
3. **OD tracker** — earned vs "to-date" remaining, semester crossing
4. **Upcoming classes** — this-week strip with lock dates
5. **Overall predictor** — "which class is the safest skip this week?"

Tap anything to drill in; export the month as \`.ics\` via DayDetailSheet.`,

  "05-attendance/architecture.md": `# Attendance — Architecture

\`attendanceMarks\` op → \`setAttendanceAndOD\` → atoms + localStorage (\`attendance\`).
Calendar model: \`analyzeCalendar\` classifies (working/holiday/instructional/important); \`calendarDay.ts#TEACHING_DAYS\` defines the teaching week.
Predictor: \`predict(remaining, attended, targetPct)\` → \`{ canSkip, needToAttend, safe }\` — recomputed on mount (cheap, never cached).
OD ledger: \`odHoursDataAtom\` + \`officialOdAtom\` — "official" OD from \`officialOd\` op wins over local assumptions.
Day sheet: \`DayDetailSheet.tsx\` joins calendar + exam cells + latest marks.`,

  "05-attendance/data-model.md": `# Attendance — Data Model

VTOP payload (\`attendanceRes\`, see \`types/data/attendance.d.ts\`):
\`{ attendance: [{ courseCode, courseTitle, attendedClasses, totalClasses, category }], … }\`
— unweighted-sum is canonical; do not average per-course percentages.
Predictor result lives in component state only.
\`CalendarInput\`/\`CalendarType\` in \`types/data/semTT.d.ts\`; events typed loosely by VTOP via cheerio scrapes (strings mostly).`,

  "05-attendance/ui-map.md": `# Attendance — UI Map

- \`attendance/AttendanceSubpage.tsx\` — *alias*: \`export * from "@/lib/attendanceRemainingClasses"\` + RegionalCourseDetail re-export (import-path compatibility)
- \`attendance/DesktopCourseDetail.tsx\` (5k+ words; + \`DesktopCourseDetailPane.tsx\` alias) — per-course detail
- \`attendance/AttendanceCalendarView.tsx\`, \`MonthGrid.tsx\` — month square grid
- \`attendance/CalendarSubpage.tsx\` + \`DayDetailSheet.tsx\` — day sheet + RFC-5545 export (\`calendarIcs.ts\`)
- \`attendance/OverallAttendancePredictor.tsx\` — simulate skips safely
- \`attendance/ODTrackerSubpage.tsx\` + \`OfficialOdSection.tsx\` — OD ledger UI
- \`attendance/TimetableGrid.tsx\` — attendance-flavored timetable sheet
- \`attendance/MoodleConnectSheet.tsx\` — LMS sign-in surface`,

  "05-attendance/storage-and-state.md": `# Attendance — Storage & State

Atoms: \`attendanceDataAtom\`, \`marksDataAtom\`, \`calendarDataAtom\`, \`odHoursDataAtom\`, \`officialOdDataAtom\`, \`moodleDataAtom\`.
Storage keys: \`attendance\`, \`marks\`, \`calendar\`, \`officialOD_*\`, \`cache_curriculum\`.
Semester change → full sync wipes them implicitly (caches are additive; attendance is replaced).`,

  "05-attendance/testing.md": `# Attendance — Testing

\`calendarDay.test.ts\`, \`calendarVtopMonth.test.ts\`, \`analyzeCalendar.test.ts\` pin the calendar model.
\`attendanceRemainingClasses.test.ts\` / \`attendancePredictor.test.ts\` pin the skip math.
Render suites: DayDetailSheet, predictor dialog, official-OD picker.
OD arithmetic shows up inside \`marksSync.test.ts\` (frozen receipts are OD-adjacent).`,

  "05-attendance/known-issues.md": `# Attendance — Known Issues

1. Official OD lags local assumptions — official wins; the UI must say so.
2. CAT/FAT weekend collisions — \`TEACHING_DAYS\` is a pinned hard list; change only with tests.
3. Predictions are heuristics — lab-heavy weeks fool them; treat as advisory.
4. \`attendanceRemainingClasses.ts\` counts lab periods as theory-ish in some shapes — \`labFatWeek.ts\` owns the compensation logic.`,

  "05-attendance/history.md": `# Attendance — History

2025-spring: raw list UI; 2025-autumn: calendar-first redesign; 2026-spring: OD ledger split (official vs predicted) + drift logging; 2026-10: \`attendancePredictor.ts\` extracted from inline component math.`,

  // ───────────────────────────── academics
  "05-academics/overview.md": `# Academics — Overview

Sidebar → **Academics**. The quarterback tab: marks, grade history, curriculum, exam schedule,
CGPA — for the whole degree, not just this term. Students land here Mondays, pre-CATs, and on
results day.

## Screens
1. **Simplified marks list** (type filters) · 2. **Grade history** (semester table + trend)
3. **Curriculum** (branches, credits, category rules) · 4. **Exam schedule** (CAT/FAT, PDF/iCal export)
5. **Analysis** (distribution, CGPA trajectory) · 6. **Course dashboard** (deeper than attendance)`,

  "05-academics/architecture.md": `# Academics — Architecture

Seed data: unified \`/api/grades\` → \`applyUnifiedGrades\` → \`gradesDataAtom\` + \`allGradesDataAtom\`
(201 ok: \`adaptUnifiedGradesResponse\` normalizes historical payload name-shapes).
Marks: per-assessment breakdown — marks remain *fresh* only via test payload (\`VTOP doStudentMarkView\`); client renders with absolute/relative boundaries from \`gradeBoundaries.ts\`.
Exam schedule: same FFCS bundle (\`/api/ffcs?section=schedule\`) — one fetch, three consumers (download, .ics, day sheet).
CGPA: \`gradesEffective.ts\` — single source of cumulative figures; predictor GPA separate (\`predictorGpa.ts\`).`,

  "05-academics/data-model.md": `# Academics — Data Model

\`allGradesDataAtom\` → \`{ grades: { [semesterId: string]: { gpa?, grades: GradeBreakdown[] } } }\`
\`GradeBreakdown\` shape in \`types/data/allgrades.d.ts\` — code, title, grade, credits, creditsEarned, effective*.
ExamSchedule types in \`types/data/schedule.d.ts\` (CAT/FAT keys are data-driven — new series need code only).`,

  "05-academics/ui-map.md": `# Academics — UI Map

- \`exams/MarksHistoryTab\` / \`MarksPredictorTab\` — historical analytics + what-if ladder
- \`exams/SimplifiedAcademicsPage.tsx\` — flattened marks by course type
- \`exams/CurriculumPage.tsx\` — catalog browser + branch computation
- \`exams/ScheduleDisplay.tsx\` + \`examSchedule.ts\` — exam schedule, export to PDF/iCal
- \`exams/CourseDashboard.tsx\` + \`CourseDetailSubpage.tsx\` — per-course deep dive (2,900 lines)
- \`exams/GradesModal.tsx\` — the grade sheet from anywhere
- \`exams/CircularsTab.tsx\`, \`CourseQBankTab.tsx\` (see 05-qbank/)
- \`exams/MoodleDisplay.tsx\` (assignments; see 05-tasks-and-pomodoro/)`,

  "05-academics/storage-and-state.md": `# Academics — Storage & State

Atoms: \`marksDataAtom\`, \`marksStatsAtom\`, \`gradesDataAtom\`, \`allGradesDataAtom\`, \`scheduleDataAtom\`, \`qcmDataAtom\`.
Caches: \`allGrades\`, \`schedule\`, frozen grade snapshots under \`frozen_grade_*\`.
Exam schedule lives in the same FFCS bundle cache (\`cache_exams_pdf_*\` for blobs; ephemeral).`,

  "05-academics/testing.md": `# Academics — Testing

\`marksPredictor.test.ts\`, \`marksStatsOp.test.ts\`, \`gradeBoundaries.test.ts\`, \`gradeHistory.test.ts\`, \`gradesEffective.test.ts\`, \`examSeries.test.ts\`, \`gradeRegulations.test.ts\`, \`academics.diff?\`
Render: CurriculumPage, ScheduleDisplay, CourseDetailSubpage.`,

  "05-academics/known-issues.md": `# Academics — Known Issues

1. Effective grade reconciliation — VTOP's "effective vs declared" semantics differ by batch; \`gradesEffective.ts\` carries batch-conditionals. Verify against live semester response when in doubt.
2. Curriculum categories drift — institutional plan changes land without notice; the UI expects VIT to fix sources, not us.
3. Exam series naming — "CAT2" vs "CAT - II" handled by \`examSeries.ts\` canonicalization; add variants, never fork.`,

  "05-academics/history.md": `# Academics — History

2025: semester-table UI only; 2025-autumn: unified grades endpoint replaced six requests with one; 2026-spring: predictor promoted from experimental to first-class screen; 2026-10: qBank + curriculum browsing merged into the same tab family.`,

  // ───────────────────────────── marks-predictor
  "05-marks-predictor/overview.md": `# Marks Predictor — Overview

**Academics → Marks Predictor.** The trick: VIT grade boundaries are partly curve-dependent (class μ/σ) — so the predictor carries both absolute and relative ladders and shows what you need for each letter grade under either.

## Screens
1. Course picker → 2. Assessment regimen editor → 3. Input your scores → 4. Ladder of grade letters with FAT-to-deliver
5. Target solver ("I need an A — what do I need on FAT?") · 6. Class curve editor (μ/σ overrides)`,

  "05-marks-predictor/architecture.md": `# Marks Predictor — Architecture

Pure engine: \`lib/marksPredictor.ts\` — no DOM, no React. Two readings of the same roster:
absolute (fixed cutoffs) and relative (μ/σ-scaled). \`gradeBoundaries.ts\` builds both;
\`gradeInsights.ts\` narrates them.
UI container: \`CoursePredictorPage.tsx\` — scope via \`useCoursePredictionScope\` (enrolled vs custom courses).
Storage: \`marksPredictorStorage.ts\` — mocks and custom courses under \`predictor_*\`.`,

  "05-marks-predictor/data-model.md": `# Marks Predictor — Data Model

\`AssessmentComponentType: theory | lab | project | softSkill | x\` — each with VIT-standard splits (e.g. theory TH: CAT1 25 + FAT 50 + LD/... — see tables in marksPredictor.ts).
\`CoursePrediction: { components: AssessmentComponent[], mu?, sigma?, predicted: Record<string, number> }\`.
\`GradeLetter\`: A+..F (with S grade for softSkills).`,

  "05-marks-predictor/ui-map.md": `# Marks Predictor — UI Map

- \`AddAssessmentSheet\`, \`AddCustomCourseModal\`, \`AssessmentMarkSheet\`, \`AssessmentRegimenEditor\`
- \`ClassCurveEditor\`, \`TargetGradeSolver\`, \`GradeLadderChart\` — the main panels
- \`tour/\` — verbatim copy of the FFCS tour system (usePredictorTour) — merge candidate (WP-notes)`,

  "05-marks-predictor/storage-and-state.md": `# Marks Predictor — Storage & State

\`predictor_mocks_v1\`, \`predictor_custom_courses\`, \`predictor_tour_seen\`
Data: \`marksDataAtom\` (enrolled courses), \`marksStatsAtom\` (cohort stats — needs opt-in for live μ/σ).`,

  "05-marks-predictor/testing.md": `# Marks Predictor — Testing

\`marksPredictor.test.ts\` (the ladder), \`marksPredictorStorage.test.ts\`, render suites for ladder & editor, \`gradeBoundaries.test.ts\`, \`gradeInsights.test.tsx\`.

## Known fragility
Boundary-flag cases at exact cutoffs (e.g. exactly 60) — tests exist in EVERY rounding mode; do not "fix" double-rounding casually.`,

  "05-marks-predictor/known-issues.md": `# Marks Predictor — Known Issues

1. Relative-grading accuracy depends on class stats — VIT does not publish them officially; the predictor infers or accepts manual μ/σ input.
2. Custom-course assessments are user-authored — garbage in, garbage ladder.
3. Soft-skills input maxes at 10 — the UI must enforce the cap or the E-grade misfires.`,

  "05-marks-predictor/history.md": `# Marks Predictor — History

2025: basic CGPA what-if only; 2025-autumn: absolute ladder shipped; 2026-spring: relative curve added; 2026-summer: tour for new users; 2026-10: target solver rebuilt on top of ladder introspection.`,

  // ───────────────────────────── free-classrooms
  "05-free-classrooms/overview.md": `# Free Classrooms — Overview

Find a place to nap/study at a specific period — computed **on-device**, no server endpoint,
purely from the installed slot tables, with an honest story about which rooms are actually occupied.

## Screens
1. **Now** (this period) · 2. **By period** · 3. Drill into a room: who's occupying it (load-in)`,

  "05-free-classrooms/architecture.md": `# Free Classrooms — Architecture

Two independent sources, merged:
1. **Client scan** — \`freeClassrooms.ts\`/\`slots.ts\` slot math over ~2,357 rooms listed in the committed campus tables (all slot encodings); known-silenced: 3 systematic failures (the "hasSpanish period" 8:30/8:30S) — documented in code.
2. **Server answer** — \`roomAvailability.ts\` (server cross-check of section occupancy) when online.
\`roomMerge.ts\` reconciles: server wins conflicts; client fills server gaps (other-room false negatives flagged honestly).`,

  "05-free-classrooms/data-model.md": `# Free Classrooms — Data Model

\`Room = { id, capacity, type: "theory"|"lab"|"seminar", building }\`;
\`FREE_VIOLATION = "silent" | "loud"\` — which source disagrees.
Occupancy = slot-token → room map; lab-only rooms listed in slot tables.`,

  "05-free-classrooms/ui-map.md": `# Free Classrooms — UI Map

\`FreeClassroomsTab.tsx\` — main page (period picker, filtered lists, building grouping) · \`ClassDetailsModal.tsx\` — occupant detail sheet (who & until when) · reachability from Tools hub + command palette.`,

  "05-free-classrooms/storage-and-state.md": `# Free Classrooms — Storage & State

No atoms; fetches via \`roomAvailability\` op on demand.
Caches: \`cache_free_classrooms\` (TTL ≈ semester lifetime; slot tables don't change per semester).
The client-side tables ship in /data/campus/*.json — no network at all for the math.`,

  "05-free-classrooms/testing.md": `# Free Classrooms — Testing

\`freeClassrooms.test.ts\` pins slot-math + table integrity (2,357 rows). \`roomMerge.test.ts\` pins the client/server reconciliation rules.`,

  "05-free-classrooms/known-issues.md": `# Free Classrooms — Known Issues

1. 8:30S-vs-8:30 slot collapse — 3 systematic silenced failures are known & documented (test pins).
2. Server cross-check is authoritative when present — silent rooms shouldn't outvote it.
3. VIT room ids can duplicate across buildings; display always with building prefix.`,

  "05-free-classrooms/history.md": `# Free Classrooms — History

2025: static list, no math; 2026-spring: client-side slot math landed; 2026-02: server cross-check + merge engine (VIT trusts the server, but students offline get math anyway).`,

  // ───────────────────────────── marks-and-cohort
  "05-marks-and-cohort/overview.md": `# Marks & Cohort Statistics — Overview

See how your cohort did on an assessment — mean, σ, top decile — pooled from students who
opt-in (see 11-security/11-marks-sync-privacy.md). The one-line pitch: *your marks are yours
unless you donate them.*`,

  "05-marks-and-cohort/architecture.md": `# Marks & Cohort — Architecture

Outflow: \`marksSync.ts\` → \`/api/marks/stats\` → server pools keyed by \`assessmentKey\`.
Inflow: op \`marksStats\` → \`marksStatsAtom\` merged \~-over (local wins ties).
Frozen: \`marksFrozenV1\` receipt set pins accepted writes; drift logged loudly.`,

  "05-marks-and-cohort/data-model.md": `# Marks & Cohort — Data Model

\`AssessmentKey = sha256(classId::component::normalizedTitle)\`
Server payload: \`{ stats: { [classId]: { μ, σ, topFraction, n } } }\`.
Frozen receipts: \`[{ key, received, ts }]\`.`,

  "05-marks-and-cohort/ui-map.md": `# Marks & Cohort — UI Map

\`MarksHistoryTab\` — distributions; \`MarksPredictorTab\` — predicted FAT band vs the curve; \`MarksStatsFeature\` wrapper (DashboardAcademicsFeature slot).`,

  "05-marks-and-cohort/storage-and-state.md": `# Marks & Cohort — Storage & State

\`marksStatsAtom\` · \`marksFrozenV1\` · \`frozen_marks_<semId>\` (per-term anchors) · \`frozen_attendance_*\` siblings.`,

  "05-marks-and-cohort/testing.md": `# Marks & Cohort — Testing

\`marksSync.test.ts\` — HMAC-free hash parity + receipt flows; \`marksStatsOp.test.ts\` — op behavior; frozen-mismatch surfacing.`,

  "05-marks-and-cohort/known-issues.md": `# Marks & Cohort — Known Issues

1. Server-side class drift — if VIT re-uploads paper after stats converge, receipts mismatch; surfaced, never swallowed.
2. σ for small classIds is noisy — display "insufficient data" rather than a fake-precise σ.
3. Opt-in must stay explicit; removing the toggle requires an ADR.`,

  "05-marks-and-cohort/history.md": `# Marks & Cohort — History

2026-spring: initial opt-in contribution pipeline; 2026-06: receipt/freeze machinery; 2026-09: drift logging surfaced in sync sheet; 2026-11: this doc set.`,

  // ───────────────────────────── timetable-ui
  "05-timetable-ui/overview.md": `# Timetable UI — Overview

How every grid in the app is drawn: vertical (days × slots heatmap), horizontal (band rows),
classic (legacy amazeui) — auto-selected by width; user-overridable in settings.`,

  "05-timetable-ui/architecture.md": `# Timetable UI — Architecture

Canonical entry: \`TimetableView.tsx\` — picks variant + density (auto/vertical/horizontal/classic).
Grids: \`VerticalTimetableGrid\` (phone), \`ModernHorizontalTimetableGrid\`, \`HorizontalTimetableGrid\`, \`ClassicHorizontalTimetableGrid\` (amazeui legacy preserved for parity with exports).
Band transposition: \`buildBands.ts\` (left-day grid → column bands). Slot model: \`slots.ts\`.`,

  "05-timetable-ui/data-model.md": `# Timetable UI — Data Model

\`TimetablePeriod { day, band, type, courseCode, title, slot }\`
\`Band\` = consecutive-period grouping for the horizontal view.
\`DAYS\`, \`SLOT_ORDER\`, \`GLOBAL_CAMPUS\` — the fixed vocabularies.`,

  "05-timetable-ui/ui-map.md": `# Timetable UI — UI Map

\`TimetableView\` · \`TimetableGridShell\` (sticky gutter/headers, lunch divider) · \`SlotDetailSheet\` · \`useTimetableViewMode\` (auto + density) · \`periodSkeleton.ts\` · \`buildBands.ts\` (pure, tested).`,

  "05-timetable-ui/storage-and-state.md": `# Timetable UI — Storage & State

\`timetable_view_mode\`, \`timetable_cell_density\` (settings atoms) — per-student prefs. No other state.`,

  "05-timetable-ui/testing.md": `# Timetable UI — Testing

\`timetable-vertical.render.test.tsx\`, \`timetable-horizontal-law.test.tsx\`, \`timetable-metrics.test.ts\`, \`timetableGridCourseReference.test.tsx\`, timetable density suites.`,

  "05-timetable-ui/known-issues.md": `# Timetable UI — Known Issues

1. Auto mode flips by width — a rotation can swap views mid-semester; user override wins.
2. Overflow bands in horizontal mode silently clip with 5+ back-to-back periods; noted, not fixed (rare).
3. Classic mode is frozen for export parity — do not restyle.`,

  "05-timetable-ui/history.md": `# Timetable UI — History

2025: vertical-only; 2026-spring: horizontal band transposition; 2026-07: density control; 2026-11: classic preserved for pixel-parity with JPG exports (FFCS share links embed the same shapes).`,
};

let created = 0;
for (const [rel, content] of Object.entries(pages)) {
  const p = join("docs", rel);
  mkdirSync(dirname(p), { recursive: true });
  if (existsSync(p)) continue;
  writeFileSync(p, content, "utf8");
  created++;
}
console.log(`Created ${created} file(s).`);
