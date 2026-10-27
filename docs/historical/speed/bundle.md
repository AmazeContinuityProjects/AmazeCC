# Bundle size & code splitting

**Severity: CRITICAL** — this is the #1 cause of "insanely slow" first load.

## Root cause

The app uses `output: 'export'` (`next.config.mjs:31`) with a single route `/`. Everything is a
client component, so the whole app is shipped as one SPA. `Dashboard.tsx` statically imports **~40
tab components**, several of which pull in very large libraries:

- `recharts` → `exams/AcademicsHub.tsx:5`, `exams/MarksHistoryTab.tsx:4`, `exams/CurriculumPage.tsx:4`
- `xlsx` (SheetJS, ~hundreds of KB) → `exams/FreeClassroomsTab.tsx:22`, `exams/FFCSTimetableTab.tsx:5`, `mobile/FreeClassroomsWidget.tsx:5`
- `@uiw/react-heat-map` → `attendance/AttendanceSubpage.tsx:8`, `attendance/OverallTrackerSubpage.tsx:7`, `attendance/ODTrackerSubpage.tsx:6`
- `framer-motion` → used in ~30 files (e.g. `Main.tsx:23`, `Dashboard.tsx` children, `header/NavigationTabs.tsx:60`)
- `swiper` → `ReelScroller.tsx:3`

Because these are **static imports inside the Dashboard graph**, they are all packed into the home
`page` chunk (1,521.7 KB) and its vendor chunks. The user downloads and parses all of it before the
first screen becomes interactive — even though most of it (e.g. Free Classrooms, GPA Predictor,
heat-maps) is only shown on a later tab.

## Evidence

- Home `page-*.js` = **1,521.7 KB** raw (build output, `out/_next/static/chunks`).
- `demoData.json` = **150,973 bytes**, imported directly at `Main.tsx:22`
  (`import demoData from '../../data/demoData.json'`) → inlined into the main bundle, parsed on load
  even for non-demo users.

## What is already good

`next/dynamic` is used in a few places (`Dashboard.tsx:36` `PapersArchiveTab`, `:45` `PureQBankTab`;
`attendance/AttendanceTabs.tsx:20`; `tools/ToolsTab.tsx:27`; `exams/CourseDashboard.tsx:23`). These
are correctly deferred. The pattern just needs to be applied to the heavy/rarely-used tabs.

## Recommendations

1. **Lazy-load heavy tabs with `next/dynamic`** (they are already conditionally rendered via
   `activeTab === "..." && <Tab/>`, so this is low-risk):
   - `AcademicsHub` (recharts), `MarksHistoryTab` (recharts), `CurriculumPage` (recharts)
   - `FreeClassroomsTab` / `FFCSTimetableTab` (xlsx) — **highest impact**
   - `AttendanceSubpage`, `OverallTrackerSubpage`, `ODTrackerSubpage` (heat-map)
   - `ReelScroller` (swiper)
   - `LoginForm` (pulls `framer-motion` scroll/spring hooks) can stay but consider trimming.
2. **Stop inlining `demoData.json`**: load it via `dynamic(() => import('...'))` or `fetch()` only
   when `demoMode` is active. Removes ~150 KB from the non-demo initial path.
3. **Avoid top-level `import * as XLSX from "xlsx"`**; import the specific function or lazy-load the
   module only inside the export handler.
4. **Consider `framer-motion` → `motion` (mini) / `m` + `LazyMotion`** to shrink the animation bundle,
   or migrate hot-path animations to CSS.
5. After changes, re-run `next build` and confirm the home `page` chunk drops well below ~600 KB.
