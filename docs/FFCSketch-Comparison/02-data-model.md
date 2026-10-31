# 02 — Data model & course catalogues

> Part of the [FFCSketch vs AmazeCC FFCS comparison](./README.md). Scan date 2026-10-30.

## 1. Core types

### FFCSketch — `src/lib/ffcs/types.ts` (156 L)

- `CourseSection` — the atom of the catalogue: `id, code, title, type, credits, slot, faculty, classId, erpId, school`, plus **optional `partnerId` / `partnerSlot`** on 1,688 of 3,426 sections (the ETH↔ELA pair links, pre-resolved at build time by the data script).
- `Timetable` — an ordered list of picked `sectionId`s + `pinnedSlots` + `lockedSlots` + label.
- Generator options: priority wishlist entries, morning/evening theory filters, `maxResults`, `allowDrop`.
- Colors are separate state (`courseColors`), keyed by course.

### AmazeCC — `src/components/custom/exams/FFCS/types.ts` (134 L)

- `ParsedCourse` — a **raw report row**: `CODE, TITLE, TYPE, CREDITS, ROOM, SLOT, FACULTY` + optional `ORIGINAL_CODE, LINK_ID, BATCH, CLASS_ID, CLASS_IDS[], ERP_ID, EMPLOYEE_SCHOOL`. Raw rows are cached in `ffcs_raw_courses` after parsing.
- `AddedCourse` — a **placed** course: `id, code, title, slots[], faculty, employeeId?, classId?, classIds?, venue, credits, type, color, batch?`.
- `TimetableState` — `id, name, courses[], metrics?, variants?, rankingScore?, rankingBreakdown?, facultySummary?, rankingComponents{profile,faculty,sort,time}` — richer than FFCSketch's `Timetable` because results carry their own scoring.
- `CourseLock` — `{code, title, allowedSlots[], allowedFaculty[], offerings?[]}` where an offering id is `FACULTY|SLOT|ROOM|ERP_ID` (legacy 3-part form still accepted, `reports.ts:122-136`).
- `Friend` / `FriendGroup` / `ManualLink`.
- `TimetableMetrics` is **re-exported from `lib/timetableMetrics`** with a comment at `:1-13` explaining that a hand-declared twin had drifted — a small but telling example of AmazeCC's defensive posture.

### Structural difference

FFCSketch collapses "raw row" and "picked offering" into one `CourseSection` (the partner fields are already denormalized). AmazeCC keeps **raw report row → parsed master list → placed course → scored timetable** as four distinct stages, because the catalogue arrives at runtime and pairing must be recomputed client-side.

## 2. Slot system & clash primitives

Both model the VIT Chennai timetable: 12 theory periods (A–L, including lunch 13:25/13:25–14:00), lab slots `L1`–`L60`, flex slots, 55-minute theory / 50-minute lab intervals.

|               | FFCSketch                                                                              | AmazeCC                                                                                                                                 |
| ------------- | -------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| Module        | `src/lib/ffcs/slots.ts` (262 L)                                                        | `src/lib/slots.ts` (415 L) + `src/lib/campusSchema.ts` (29) + `src/data/campus/*.json`                                                  |
| Lab map       | `L_SLOT_MAP`, `FLEX_SLOTS`                                                             | `config.json#slotMap` carries all 94 lab slots; campus JSON partitions lab periods                                                      |
| Expansion     | memoized `getSectionMeetings()` — expands `G1+TG1` into concrete day/interval meetings | `periodsForSlot`, `splitSlots`, `periodListsClash`, `findPeriodClash`, `slotsOverlap`                                                   |
| Overlap rule  | exact interval overlap on expanded meetings                                            | `a.day === b.day && Math.max(s1,s2) < Math.min(e1,e2)` — **back-to-back is not a clash**                                                |
| Time parsing  | numeric minutes                                                                        | `timeToMinutes` returns **`null`, never `0`** (deliberate: midnight would otherwise read as a valid period)                             |
| Campus slots  | Chennai hardcoded                                                                      | **law-school aliases first-class**: `A ↔ A1`, `S11 ↔ TEE` (`lawSlotFor`/`schemaSlotFor`, `:122/142`); 99 rows of the report are `TLAW*` |
| Lunch barrier | respected for lab merging (README: 1:20 PM–2:00 PM)                                    | lunch boundary at 840 minutes partitions lab taxonomy (see §4)                                                                          |

**Extra rule in FFCSketch:** `findClashes` also flags same `code` + same `type` across _different_ sections as a clash — this prevents accidentally double-counting a course you already picked. AmazeCC handles the equivalent concern at the generator level by grouping courses and deduplicating offerings by `ERP_ID`.

## 3. Campus schemas

|           | FFCSketch                                                                          | AmazeCC                                                                                                                             |
| --------- | ---------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| Files     | implicit — hardcoded in `slots.ts` + a store migration that drops non-Chennai data | `src/data/campus/{chennai,ap,bhopal}.json` (562 lines total), each with `theory[]`/`lab[]` periods and `start/end/days` maps        |
| Selection | none — Chennai only                                                                | **none either** — `GLOBAL_CAMPUS = "chennai"` in `campusSchema.ts`                                                                  |
| Rationale | product scope ("built exclusively for VIT Chennai")                                | explicit design comment: _"a picker that swapped the schema under a report that no longer matches it would be a setting that lies"_ |
| Leaks     | none                                                                               | `constants.ts` and `FreeClassroomsWidget.tsx:32` hardcode Chennai independently of `GLOBAL_CAMPUS`                                  |

Both are Chennai-only in practice; AmazeCC at least ships the other schemas, but they are unreachable and the duplicated hardcoded constants would drift if a picker were added.

## 4. Embedded (ETH/ELA) pairing data rules

VIT reports Embedded Theory (`ETH`) and Embedded Lab (`ELA`) as separate rows; students must take both **under the same faculty**. The two codebases solve this at different stages.

### FFCSketch — pairing baked into the dataset

`scripts/update-courses.mjs` (301 L) runs at build time against `public/Winter_Semester_2026-2027_Course_Offered_List.csv`:

- heuristic slot/type inference,
- **brute-force ETH↔ELA same-faculty pairing**, writing `partnerId` / `partnerSlot` onto 1,688 sections.

Runtime cost is then trivial: `src/lib/ffcs/embedded.ts` (217 L) provides

- `pairScore` — ranks candidate partners for a chosen theory,
- `embeddedPairProblems` — detects missing/mismatched pairs and offers **one-click fixes**,
- the generator treats a matched ETH+ELA as an **atomic unit**.

Trade-off: pairing quality is decided offline and shipped; a bad pairing can't be reconsidered without regenerating the JSON.

### AmazeCC — pairing solved at runtime, 4-tier scored branch-and-bound

`src/lib/ffcsCourseGrouping.ts` (**445 L**, `processParsedCourses` at `:122`) — re-exported from `FFCSTimetableTab.tsx:30`.

> Doc drift: `docs/ffcs-workings/embedded-course-pairing.md` still says this lives inside `FFCSTimetableTab`.

- **Scoring tiers** (`computePairScore`, `:57`):
  | Tier                          | Score |
  | ----------------------------- | ----: |
  | shift-complementary core pair | +2000 |
  | permitted same-half late slot | +1000 |
  | general cross-shift           |  +500 |
  | penalised same-half           | −1000 |
  | same-day tie-break            |   −30 |
  | class-id proximity tie-break  |   +20 |
- **Search:** backtracking at `:293-330` with a bounding/pruning guard and a hard **`steps > 20000` cap** (`:310`).
- **Slot taxonomies** hardcoded (`:19-38`): `CORE_MORNING_LABS`, `CORE_EVENING_LABS`, `LATE_MORNING_LABS`, `LATE_EVENING_LABS` = `L1`–`L60` partitioned around the 840-minute lunch boundary.
- **Escape hatches:** `isGroupingEnabled` toggle, plus **manual linking** (`ManualLink` + `isManualLinkerOpen` + `manualLinkCsvText`, `FFCSTimetableTab.tsx:614-616`).
- Course-type map lives in `FFCS/constants.ts`: `ETH, ELA, EPJ, TH, LO, PJT, OC, "ETH+ELA", "TH+LO", SS…`.

Trade-off: pairing is recomputed against whatever catalogue is loaded (any of 3 semesters), can be disabled or overridden by hand, and is test-covered — but costs CPU on every load.

## 5. Course catalogues

|               | FFCSketch                                                                                  | AmazeCC                                                                                                                                                             |
| ------------- | ------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Location      | `src/data/courses.json`                                                                    | `public/ffcs/*.csv`                                                                                                                                                 |
| Size          | 44,489 lines / **964 KB**                                                                  | 10,963 rows / **856 KB**                                                                                                                                            |
| Loading       | **statically imported → inlined in the client bundle**                                     | `fetch(getAssetPath(...))` → `XLSX.read` → `parseReportRows` (`FFCSTimetableTab.tsx:634-687`), cached in `ffcs_raw_courses`; **preload** via `PreloadReportCsv.tsx` |
| Content       | 3,426 sections · 686 unique codes · 933 faculty                                            | multiple semesters, ~11k rows incl. venue/batch/class-id columns                                                                                                    |
| Type mix      | TH 1,139 · ELA 896 · ETH 849 · LO 285 · SS 192 · PJT 55 · OC 10                            | full type map incl. `TH+LO`, `ETH+ELA`, law rows                                                                                                                    |
| Semesters     | 1 (Winter 2026-27, footer credits "VIT Chennai · Fall 2026-27")                            | **3**: `winter-2026-2027` (default), `previous`, `codechef-vit` (219 KB, converted from CodeChef's FFCS-inator with `codechef-vit-catalogue.SOURCE.md` credit)      |
| Refresh       | `npm run courses:update` → `scripts/update-courses.mjs` from a local CSV/FFCSonTheGo sheet | manual export of VIT's registration list into `public/ffcs/*.csv`; selection validated by `ffcsCodechefCatalogue.test.ts` (asserts the exact `FFCSSemesterId` list) |
| Offline       | guaranteed (bundled)                                                                       | NetworkFirst cache + layout preload; also `ffcs_raw_courses` localStorage cache                                                                                     |
| Bundle impact | **964 KB added to first load, no splitting**                                               | catalogue deferred; `xlsx` dynamically imported (see `docs/historical/speed/bundle.md`)                                                                             |

### Extra data paths in AmazeCC only

`src/features/import/` (**1,521 L**):

| File                  |   LOC | Role                                                                  |
| --------------------- | ----: | --------------------------------------------------------------------- |
| `parsePastedText.ts`  | 1,078 | line parser with **per-line confidence** for pasted registration text |
| `normalizeColumns.ts` |   234 | header/column normalization across source formats                     |
| `importFile.ts`       |   159 | file dispatch (CSV/TSV/XLSX via dynamic SheetJS)                      |
| `sampleCourseList.ts` |    50 | sample data                                                           |

Plus `CourseImportPanel.tsx` (334), `CourseListImportSection.tsx` (241), `modals/PasteRegisteredCoursesModal.tsx` (176), and **VTOP registration-sheet class-ID decoding**.

FFCSketch's equivalent is `src/lib/ffcs/xlsxImport.ts` (202) + `XlsxImportDialog.tsx` (407): fuzzy XLSX/CSV import with a **5 MB / 20,000-row cap** — but no paste parser and no class-ID decoding.

### Adjacent data consumers

- AmazeCC: `ffcs_raw_courses` also feeds `src/lib/freeClassrooms.ts` (620 L) — the FFCS parse powers the Free Classrooms feature (`FFCSTimetableTab.tsx:785-789`).
- FFCSketch: no cross-feature data reuse; the dataset serves only the planner.

## 6. Data-model risks

**FFCSketch**

- A single monolithic 964 KB JSON in the bundle; no version field beyond the `v1` storage key; freshness is a manual CSV drop + script run.
- Pairing decided offline → cannot adapt to a catalogue swap without regenerating.

**AmazeCC**

- Two representation stages mean conversion bugs are possible (`ParsedCourse` → `AddedCourse`), mitigated by `parsePastedText`/`normalizeColumns` tests.
- `ffcs_raw_courses` cache can go stale relative to the selected semester; no invalidation signal beyond version.
- Manual CSV pipeline with no in-repo scraper (the scraping API lives in a separate repo and FFCS does not call it).
