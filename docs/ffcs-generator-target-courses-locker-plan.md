# FFCS Auto-Generator: Target Courses Locker Parity Plan

## Goal

Split the inlined target-course selection in `FFCSGeneratorSubpage.tsx` into a
left-hand "locked target courses" list (one item per locked course) plus a
faculty/slot picker that opens as a **bottom sheet on mobile** and a **right
pane on desktop**, matching the manual planner's `TargetCoursesModal` locker UX.

## Current state (baseline)

- `FFCSGeneratorSubpage.tsx` lines ~1920-2180 render every course in the
  master list inline, each expanding to a faculty/slot checkbox matrix when
  selected.
- Selection state lives in `generatorTargets: CourseLock[]` (code, title,
  allowedSlots, allowedFaculty, offerings).
- `lockedOnlyFilter`, `seededFromLocks`, and `generatorDisplayCourses` drive
  filtering.

## Phases

### Phase 1 — Extract offering picker into a reusable component

- Create `FFCS/components/TargetCourseLocker.tsx`.
- Props: `course`, `masterCourses`, `selection` (CourseLock), `onChange`,
  `vitfac` review pill wiring, `onClose`.
- Move the inline faculty/slot matrix (lines ~2001-2160) into this component
  verbatim, preserving `offeringMatches`, `sameSlotFacultyAlternatives`,
  series quick-select, and Vitfac review pills.
- Replace inline expansion with `<TargetCourseLocker>` rendered inside a
  `BottomSheet` (mobile) / right pane (desktop).

### Phase 2 — Left list of locked target courses

- Add a left column (desktop) / top list (mobile) showing one row per
  `generatorTargets` entry: code, title, selected offering count, edit button.
- Clicking a row opens the locker for that course.
- Add "Add target course" entry that opens `TargetCoursesModal` (existing)
  to pick the course, then immediately opens the locker.

### Phase 3 — Responsive container

- Mobile: use `BottomSheet` (existing shared component) with `overlayId`
  `generator-target-locker`, z-index above planner.
- Desktop (lg+): render as a sticky right pane (`lg:col-start-3`) instead of
  a modal, matching the manual planner's right-pane review sheet.
- Use a single `activeLockerCourse: string | null` state to drive both.

### Phase 4 — State & persistence

- Keep `generatorTargets` as the single source of truth; locker edits mutate it
  via `setGeneratorTargets`.
- Preserve `seededFromLocks` and `lockedOnlyFilter` semantics.
- Persist `activeLockerCourse`? No — reset on reload to avoid stale UI.

### Phase 5 — Tests

- Add render tests for:
  - left list renders one item per locked course
  - opening locker shows faculty/slot matrix
  - bottom sheet on mobile viewport, pane on desktop
  - series quick-select and offering checkboxes mutate `generatorTargets`
- Update `ffcsGeneratorSubpage.render.test.tsx` expectations if layout changed.

### Phase 6 — Cleanup

- Remove now-unused inline matrix code from `FFCSGeneratorSubpage.tsx`.
- Verify `VitfacReviewPill` / `FacultyAvatar` still wired.
- Run full FFCS test suite + tsc.

## Risks

- Large diff in a 2800-line file; merge conflicts likely.
- Offering-id matching logic must be preserved exactly to avoid changing
  generation results.
- Responsive pane vs sheet must not break existing `activeGeneratorSection`
  tab navigation in modern view.

## Exit criteria

- All existing generator tests pass.
- Manual smoke: lock 2 courses, edit faculty/slots via locker, generate
  timetable, verify identical results to before refactor.