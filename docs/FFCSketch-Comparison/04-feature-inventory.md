# 04 — Feature inventory

> Part of the [FFCSketch vs AmazeCC FFCS comparison](./README.md). Scan date 2026-10-30.
> Legend: ✅ full · ⚠️ partial/limited · ❌ absent · — not applicable

## 1. Manual planning

| Capability                           | FFCSketch                                                                                              | AmazeCC                                                                          |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------- |
| Timetable grid                       | ✅ `TimetableGrid.tsx` (428) — 55-min theory / 50-min lab blocks                                       | ✅ `components/TimetableGrid.tsx` (62, thin wrapper over shared `TimetableView`) |
| Grid orientation                     | ✅ toggle Vertical (days across top) / Horizontal (periods across top)                                 | ✅ view switcher: Auto / Vertical heatmap / Modern horizontal / Classic          |
| Click a block → details              | ✅ `BlockPopover.tsx` (219): title, credits, slot, venue, faculty                                      | ✅ slot detail via shared `SlotDetailSheet` / popovers                           |
| Swap section/faculty inline          | ✅ real-time clash validation on swap                                                                  | ✅ `SlotFacultySwapSheet.tsx` (994) — same-slot-only alternatives                |
| Add courses                          | ✅ `CoursePicker.tsx` (803): 2-stage search → expand → pick faculty/section, category & credit filters | ✅ add-course accordion with **live red clash badges on every candidate**        |
| Cart / selected list                 | ✅ `CourseCart.tsx` (352) with **drag-and-drop** (dnd-kit) ordering                                    | ✅ `SelectedCoursesList.tsx`, `CourseTypeChips.tsx`                              |
| Click blank cell → "what fits here?" | ✅ `SlotFinderPopover.tsx` (115) filters the picker to slots active in that window                     | ⚠️ equivalent achieved by slot map + blocked-slot painting, not a picker filter  |
| Custom course creation               | ✅ `CustomCourseDialog.tsx` (486)                                                                      | ❌ (paste/import instead)                                                        |
| Per-course colors                    | ✅ `ColorPicker.tsx` (100) + `courseColors` state                                                      | ✅ `color` on `AddedCourse` (auto-assigned palette)                              |
| Remove + undo                        | ✅ floating undo, `Ctrl/Cmd+Z`, one-level snapshot                                                     | ❌ no undo stack                                                                 |
| Credits counter                      | ✅ `StatsPanel.tsx` (82)                                                                               | ✅ `X / 27` chip (`FFCSDashboardHeader.tsx:1049-1053`)                           |
| Blocked slots                        | ❌                                                                                                     | ✅ click cells to block; red paint; Reset                                        |
| Proactive clash explanation          | ✅ `ClashDoctor.tsx` (329) explains conflicts                                                          | ✅ `Clash: …` badges + `exportClashReport` column                                |
| Multiple saved timetables            | ✅ **drafts/tables** — add/rename/delete/duplicate/switch                                              | ✅ `ffcs_timetables` array with active id                                        |
| Keyboard shortcuts                   | ✅ `1`–`4` tabs, `Ctrl/Cmd+Z`                                                                          | ✅ `f` generator, Escape closes (`FFCSTimetableTab.tsx:1670-1757`)               |

## 2. Views & explorers

| Capability             | FFCSketch                                                             | AmazeCC                                                                                            |
| ---------------------- | --------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| Slot occupancy browser | ✅ `SlotView.tsx` (680) — which sections occupy each slot             | ❌ explicitly deferred in `docs/ffcs-ccv/03-implementation-plan.md:190`                            |
| Compare saved plans    | ✅ `CompareView.tsx` (779): rank results, **stats deltas**, deep diff | ✅ side-by-side compare ×3 in generator results + `FFCSResultsFilterBar` (130)                     |
| Compare with friends   | ✅ friend sync in Compare view                                        | ✅ `FFCSFriendsSubpage` (583) + `FriendTimetableViewModal` (115) + `SocialMatrixModal` (158)       |
| Peek / ghost preview   | ✅ preview generated combos as dashed ghost blocks over the live grid | ⚠️ results staged with `STAGED_RENDER_LIMIT = 60`, but no ghost overlay on the planner             |
| Dashboard widgets      | ❌                                                                    | ✅ `FFCSDashboardHeader.tsx` (1,991): widget system, `ffcs_dashboard_widgets`, mobile widget sheet |
| Layout modes           | ❌ (2 themes instead)                                                 | ✅ guided / modern / classic + `FFCSLayoutModeModal` (166)                                         |
| Generator view modes   | ❌                                                                    | ✅ `FFCSGeneratorViewModeModal` (157)                                                              |

## 3. Generator UX

| Capability         | FFCSketch                                             | AmazeCC                                                                                                                 |
| ------------------ | ----------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| Generator surface  | ✅ `Generator.tsx` (888): single form, checklist copy | ✅ `FFCSGeneratorSubpage.tsx` (3,809): 5 panes — target courses / ranking & reviews / schedule / search limits / social |
| Wizard/guided mode | ❌                                                    | ✅ `FFCSGuidedSelector.tsx` (6,214), 15 phases                                                                          |
| Progress display   | ❌ spinner only                                       | ✅ nodes/found/accepted, run-summary modal (223), `PdfGenerationBadge` (127)                                            |
| Cancel             | ❌                                                    | ✅ cancel keeps partial results                                                                                         |
| Playful extras     | ✅ "surprise me" dice, auto-fit, peek mode            | —                                                                                                                       |
| Run summary        | ❌                                                    | ✅ `FFCSGeneratorRunSummaryModal.tsx` (shows top factor / tie-break)                                                    |
| Results filter bar | ❌                                                    | ✅ building / session / faculty / slot-group filters (`lib/ffcsResultFilters.ts`, 193)                                  |

## 4. Faculty intelligence

| Capability                     | FFCSketch                         | AmazeCC                                                                                                                         |
| ------------------------------ | --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| Faculty listed per section     | ✅                                | ✅                                                                                                                              |
| Faculty reviews                | ❌                                | ✅ Vitfac: `FacultyReviewSheet.tsx` (389), `FacultyAvatar.tsx` (132), `FacultyScheduleModal.tsx` (441), `useFacultyReviewSheet` |
| Faculty metrics in ranking     | ❌                                | ✅ `wPct`/lecture/DA/vibe weights + score filters                                                                               |
| Faculty priority per course    | ❌                                | ✅ `ffcsFacultyPriority` + `FacultyPriorityModal` (232)                                                                         |
| Faculty schedule view          | ❌                                | ✅ modal + `FacultyScheduleTab` in host                                                                                         |
| Sentiment in exports           | ❌                                | ✅ `% W` sentiment pills embedded in exported images                                                                            |
| Same-slot faculty alternatives | ✅ (swap in popover, revalidated) | ✅ `SlotFacultySwapSheet` (994), safe by construction                                                                           |
| Dedupe faculty across courses  | ❌                                | ✅ `uniqueFaculties` param, ERP_ID dedupe                                                                                       |

## 5. Social / friends

| Capability             | FFCSketch                                    | AmazeCC                                                                                          |
| ---------------------- | -------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| Friend timetables      | ⚠️ compare-with-friend flow in `CompareView` | ✅ `ffcs_friends`, `ffcs_friendGroups`, `FFCSFriendsSubpage` (583)                               |
| Friend groups          | ❌                                           | ✅ `ffcs_friendGroups` + group scoring                                                           |
| Social score of a plan | ❌                                           | ✅ `SocialMatrixModal` (158): `calculatePairwiseSocialScore` over saved weeks × friends' options |
| Generator uses friends | ❌                                           | ✅ `syncFriendClasses`, `maximizeFreeTimeFriends[]`, `auto_social` wizard phase                  |
| Social score method    | ❌                                           | ✅ `ffcs_socialScoreGroupMethod`                                                                 |
| Friend intake          | share link                                   | ✅ **backup JSON import** (`FFCSGuideModal.tsx:102`) + share route                               |

## 6. Onboarding, help, discovery

| Capability            | FFCSketch                          | AmazeCC                                                                                    |
| --------------------- | ---------------------------------- | ------------------------------------------------------------------------------------------ |
| In-app help           | ✅ `HelpSection.tsx` (150)         | ✅ `FFCSGuideModal.tsx` (145)                                                              |
| Product tour          | ❌                                 | ✅ `features/tour/` (499): 6 anchors, spotlight, `TOUR_VERSION=1`                          |
| Contextual tips       | ❌                                 | ✅ `useTips` + dismissible `Tip` components, `ffcs_tips_dismissed`                         |
| First-run experience  | ✅ theme-choice prompt (`706a21f`) | ✅ app-wide `OnboardingIntro` + layout-mode prompt                                         |
| Settings modal        | ⚠️ inline UI prefs in header/store | ✅ `FFCSSettingsModal.tsx` (949) + `lib/ffcsSettings.ts` (248) with per-field sanitization |
| Command palette entry | ❌                                 | ✅ `useAppCommands.tsx:281`                                                                |

## 7. What only one side has

### Only FFCSketch

| Feature                                                        | Where                                                     | Why it matters                                            |
| -------------------------------------------------------------- | --------------------------------------------------------- | --------------------------------------------------------- |
| **Dual theme system** (PaperCSS fun / plain nerd, day × night) | `fun.css` 1,731 L, `nerd.css` 234 L, pre-hydration script | Gives the tool a personality; zero hydration flash        |
| **Slot occupancy explorer**                                    | `SlotView.tsx` (680)                                      | Fastest way to answer "what else uses this slot?"         |
| **Multi-draft tables + one-level undo**                        | `store/ffcs.ts`                                           | Plan A/B/C side by side; mistakes recoverable             |
| **Peek mode (ghost preview)**                                  | `page.tsx` + grid                                         | Evaluate a generated combo without committing             |
| **Slot finder from a blank cell**                              | `SlotFinderPopover.tsx`                                   | "What fits here?" is a first-class interaction            |
| **Custom course creation**                                     | `CustomCourseDialog.tsx` (486)                            | Fill catalogue gaps by hand                               |
| **Pairing problem detector + one-click repair**                | `embedded.ts` `embeddedPairProblems`                      | Surfaces broken ETH/ELA pairs instead of silently failing |
| **WhatsApp/Telegram text export**                              | `export.ts` (304)                                         | Trivially shareable day-by-day schedule                   |
| **QR code in share dialog**                                    | `ShareDialog.tsx` (391) + `qrcode`                        | Desktop→phone transfer without a link                     |
| **JSON backup/restore with UI prefs**                          | `backup.ts` (176)                                         | Includes theme prefs in the backup                        |
| **Playful generator extras**                                   | dice / auto-fit / checklist                               | Lowers intimidation for first-timers                      |
| **Static inlined catalogue**                                   | `courses.json`                                            | Guaranteed offline data with zero fetch                   |

### Only AmazeCC

| Feature                                                     | Where                                               | Why it matters                                    |
| ----------------------------------------------------------- | --------------------------------------------------- | ------------------------------------------------- |
| **Web-worker generator w/ stream + cancel**                 | `workers/generator.worker.ts`, `logic/generator.ts` | Tab never freezes; partial results survive cancel |
| **PDF worker export**                                       | `workers/pdf.worker.ts` (125)                       | A4 dossier off the main thread                    |
| **15-phase guided wizard**                                  | `FFCSGuidedSelector` (6,214)                        | Walks a first-timer from setup to results         |
| **Product tour + tips**                                     | `features/tour/` (499)                              | Discoverability                                   |
| **Vitfac faculty reviews**                                  | `lib/vitfacService.ts` (392) + 3 components         | Real quality signals feed ranking and exports     |
| **Social matrix / friend groups**                           | `useSocialState`, `SocialMatrixModal`               | "Which plan maximizes time with my friends?"      |
| **Target-course locker**                                    | `TargetCourseLocker` (508) + cards                  | Per-course allowed slots/faculty constraints      |
| **Drop ladder policy**                                      | `logic/dropPolicy.ts`                               | Automatic retry semantics with protected locks    |
| **Time windows / per-day ends / extramural blocks**         | generator schedule pane                             | Real scheduling constraints                       |
| **Separate lab days / no consecutive labs / min half-days** | in-tree pruned                                      | Rules that shape the week, pruned during search   |
| **4 share encodings + receiver route**                      | `lib/ffcsShare.ts` (583), `/share/ffcs`             | Full / compact / shape / numeric-shape            |
| **iCal export**                                             | `lib/exportIcal.ts` (139)                           | Put the plan in a calendar app                    |
| **Clash report export**                                     | `exportClashReport.ts` (356)                        | "Clashes With" column in PDF/CSV                  |
| **Portrait dossier**                                        | `lib/portraitDossier.ts` (470)                      | Phone-shaped printable dossier                    |
| **Paste-text import with confidence**                       | `features/import/parsePastedText.ts` (1,078)        | Paste straight from VTOP                          |
| **VTOP class-ID decoding**                                  | `normalizeColumns.ts`                               | Handles real registration sheets                  |
| **3 catalogues incl. competitor-derived**                   | `public/ffcs/*.csv`                                 | Semester history + codechef-vit                   |
| **Free classrooms cross-feature**                           | `lib/freeClassrooms.ts` (620)                       | FFCS parse feeds another tool                     |
| **Result filters (building/session/faculty/slot)**          | `lib/ffcsResultFilters.ts` (193)                    | Narrow large result sets                          |
| **Analytics w/ consent queue**                              | `ffcs_analytics_*` keys                             | Usage insight (opt-in)                            |
| **Law-school slot aliases**                                 | `lib/slots.ts:122/142`                              | `TLAW*` rows schedule correctly                   |
| **Tests + CI + docs**                                       | see [06](./06-quality-and-testing.md)               | Regression safety                                 |

## 8. Feature-density observation

Counting only the ✅ rows across §1–§6: **FFCSketch ≈ 22/45**, **AmazeCC ≈ 38/45**. But raw counts mislead:

- FFCSketch's ✅s are concentrated in the _core planning loop_ (grid, picker, drafts, compare, slots) where it is often **equal or better**.
- AmazeCC's extra ✅s are mostly in _adjacent value_ (faculty, social, exports, onboarding) plus the execution-model rows (worker, progress, cancel) that are really **quality-of-implementation** features.
- FFCSketch has **6 first-class features AmazeCC lacks entirely** (slot view, drafts+undo, peek, slot finder from a cell, custom courses, pairing repair) — see §7.

Neither is a subset of the other.
