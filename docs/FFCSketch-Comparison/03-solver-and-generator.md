# 03 — Solver & generator

> Part of the [FFCSketch vs AmazeCC FFCS comparison](./README.md). Scan date 2026-10-30.

This is the heart of both apps: everything else exists to feed or display the result of a constraint search over course offerings.

## 1. Clash detection

|                      | FFCSketch                                                                           | AmazeCC                                                                                                                                               |
| -------------------- | ----------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| Where                | `src/lib/ffcs/timetable.ts` → `findClashes`                                         | interactive: `FFCSTimetableTab.tsx:913` `checkClashes`; generator: `generate.ts:556` `clashes = periodListsClash`; math: `src/lib/slots.ts`           |
| Basis                | exact overlap of expanded meetings (day + start/end minutes)                        | `periodsOverlap` = same day && `max(starts) < min(ends)`; precomputed `SlotPeriod[]` windows per offering                                             |
| Same-course rule     | same `code` + `type` on different sections **is** a clash (prevents double-picking) | course grouping + `ERP_ID` dedupe; law-slot aliases handled                                                                                           |
| Back-to-back         | allowed (no overlap)                                                                | allowed (strict `<`, documented)                                                                                                                      |
| Invalid input        | n/a                                                                                 | `timeToMinutes → null` never `0`, so midnight can't become a period                                                                                   |
| Enforcement style    | validated when adding/swapping; generator re-checks at every node                   | **abort-before-mutation** (`checkClashes` strictly blocks state mutation) + **proactive red `Clash: …` badges** on every candidate offering (`:3202`) |
| Faculty swap safety  | swap re-validates immediately                                                       | **safe by construction** — `sameSlotFacultyAlternatives` requires identical slot token sets                                                           |
| Report-side analysis | —                                                                                   | `src/lib/ffcsClashPairs.ts` (170) + `src/lib/exportClashReport.ts` (356) produce a "Clashes With" column for exports                                  |
| Docs                 | README section                                                                      | `docs/ffcs-workings/clash-detection-and-schema.md` with a responsibility table                                                                        |

## 2. Search algorithms side by side

### FFCSketch — `src/lib/ffcs/timetable.ts` (559 L), invoked from `Generator.tsx` (888 L)

```
generateTimetables (≈ lines 373–553)
├─ order courses fewest-options-first (MRV heuristic)
├─ ETH+ELA with a matched partner → atomic unit
├─ synchronous DFS with backtracking on the MAIN THREAD
│    yield once via setTimeout(30)
│    guards: MAX_NODES = 400_000, default maxResults = 60
├─ phase 2: drop wishlist courses in priority order when stuck (allowDrop = 2)
└─ score = droppedPrioritySum*1000 + gaps*20 − freeDays*5
```

**Inputs:** wishlist with priorities, pinned/locked sections, morning/evening theory filters, `maxResults`, `allowDrop`.
**Outputs:** up to 60 scored, clash-free timetables (also supports a "surprise me" dice and "auto-fit").
**Limitations:** no streaming, no progress, no cancellation, no worker, no error taxonomy — the UI can only show a spinner until the whole search returns.

### AmazeCC — `src/components/custom/exams/FFCS/logic/generate.ts` (1,892 L)

```
FFCSGeneratorSubpage / FFCSGuidedSelector.handleRunAutoGeneration
  → useGenerationRun.run (197 L)
  → logic/generator.ts#startGeneration (253 L)
  → workers/generator.worker.ts (96 L)
  → generateTimetablesStream
      ├─ pre-resolve SlotPeriod[] windows per offering
      ├─ DFS walkCombinations (:911)
      ├─ in-tree monotone pruning (buildWalkRules :767, bitmask/popcount)
      │    separateLabDays · avoidConsecutiveLabs · minHalfDays
      ├─ progress every ~4,096 nodes, batches of 50
      ├─ post-search filters
      ├─ groupVariants → variant grouping
      ├─ faculty dedupe by ERP_ID
      └─ stable sort → GenerateResult
```

**Result contract** (`generate.ts:236`): string-discriminated `ok | cancelled | error` — strings rather than enums because `tsconfig` is `strict: false` (documented in a comment).
**Error taxonomy:** `GeneratorErrorCode` with 8 codes — `no_conflict_free`, `no_valid_slots`, `below_min_half_days`, `no_separate_labs`, `no_consecutive_labs`, `error`, …
**Ceilings:** `DEFAULT_RESULT_LIMIT = 50`, `HARD_RESULT_LIMIT = 30_000`, `capped` flag on `ok`.

### `GenerateParams` — the full input surface (`generate.ts:100-225`)

schema · masterCourses · courseLocks · blockedSlots · friends · `preference` (`none|morning|evening|compact|spread`) · `strictTheoryPreference` · `syncFriendClasses` · `maximizeFreeTimeFriends[]` · `minStartTime` / `maxStartTime` / `maxEndTimeByDay` · `uniqueFaculties` · `noLimit` · `resultCap` · `removeHardResultLimit` · `minHalfDays` · `sortBy` · `rankingMode` · `facultyRatings` · `facultyMetricWeights` · `facultyScoreFilters` · `rankingPriorityOrder` · `rankingFactors{order,disabled}` · lab rules · `facultyPriority` · `blockedSlots` (incl. `blockExtramuralSlots` for TBB1/L17/L18).

All values are structured-clone-safe (arrays only, never `Set`).

### Drop ladder — retry policy (`logic/dropPolicy.ts`, 97 L)

Pure, separately-tested policy module:

- `droppableTail`, `nextDrop`, `DEFAULT_MAX_DROPS = 3`,
- `isRetryableFailure` — `no_valid_slots` triggers a named-course jump; `error` and `no_courses_selected` are **never** retried,
- **`CourseLock` targets are never dropped**,
- orchestration in `useGenerationRun.run`: never retries a run that already streamed partial results.

FFCSketch has the crude equivalent (`allowDrop = 2` + phase-2 priority-ordered dropping) but no policy module and no tests.

## 3. Ranking & scoring

|                      | FFCSketch                                        | AmazeCC                                                                                                                                                                                                                               |
| -------------------- | ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Core score           | `droppedPrioritySum*1000 + gaps*20 − freeDays*5` | `src/lib/ffcsRanking.ts` (418 L): `RANKING_MODES` = Best Faculty · Balanced · Half Days · Minimize Gaps · Early Finish · Late Start; `PROFILES` weights; `rankingInputs`/`scoreRanking` → verdict/100 + breakdown                     |
| Factor system        | —                                                | **8 composable `RANKING_FACTORS`**: gaps · halfDays · balancedLoad · faculty · social · earlyFinish · lateStart · time — each reorderable and switchable; position among enabled = weight; disabled redistributes rather than zeroing |
| Priority order       | user wishlist priority only                      | `rankingPriorityOrder` across 4 dimensions (profile / faculty / sort / time)                                                                                                                                                          |
| Faculty scoring      | section chosen by user, no ratings               | `src/lib/ffcsFacultyRanking.ts` (204 L) over **Vitfac** metrics `wPct`/lecture/DA/vibe with weights + **score filters** ("Minimum faculty review scores")                                                                             |
| Manual faculty order | pinned sections                                  | `src/lib/ffcsFacultyPriority.ts` (150 L): `Record<code, string[]>`, own storage key, ordering-only effect (search order + settled order), UI in `FacultyPriorityModal.tsx` (232)                                                      |
| Persisted on results | score per result                                 | `rankingScore`, `rankingBreakdown`, `rankingComponents{profile,faculty,sort,time}` on every `TimetableState`                                                                                                                          |
| Boundary constraints | implicit                                         | "Search limits" pane: min free half-days, min faculty review scores                                                                                                                                                                   |
| Session prefs        | store fields                                     | `ffcsGeneratorSessionPrefs.ts` (115) + `rankingFactorOrder/Disabled`, `facultyMetricOrder/Disabled` keys                                                                                                                              |

AmazeCC deliberately keeps the **legacy `rankingMode` path byte-identical** to the new factor path so guided-selector flows and pinned tests stay untouched (`d432181` commit message) — factor path wins only when present.

## 4. Constraints & options matrix

| Constraint                            | FFCSketch                      | AmazeCC                                                                                                                           |
| ------------------------------------- | ------------------------------ | --------------------------------------------------------------------------------------------------------------------------------- |
| Lock/pin a section or faculty         | ✅ `pinnedSlots`/`lockedSlots` | ✅ target-course locker: `allowedSlots[]` + `allowedFaculty[]` (`TargetCourseLocker.tsx` 508 L, `TargetCourseLockCard.tsx` 232 L) |
| Priority wishlist                     | ✅ (priority 1 = highest)      | ✅ target courses widget + guided phases                                                                                          |
| Morning/evening preference            | ✅ theory filters              | ✅ `preference` + `strictTheoryPreference`                                                                                        |
| Time windows (start/end, per-day end) | ❌                             | ✅ `minStartTime`, `maxStartTime`, `maxEndTimeByDay` + slot map painting them red                                                 |
| Manual blocked slots                  | ❌                             | ✅ `blockedSlots` set (click cells to block), `Reset`                                                                             |
| Block extramural (TBB1, L17, L18)     | ❌                             | ✅ `blockExtramuralSlots` toggle with red-painted map                                                                             |
| Separate lab days                     | ❌                             | ✅ `separateLabDays` (in-tree pruned)                                                                                             |
| Avoid consecutive labs                | ❌                             | ✅ `avoidConsecutiveLabs` (in-tree pruned)                                                                                        |
| Minimum half-days                     | ❌                             | ✅ `minHalfDays` (in-tree pruned)                                                                                                 |
| Unique faculties per course           | ❌                             | ✅ `uniqueFaculties`                                                                                                              |
| Free time with friends                | ⚠️ friend compare only         | ✅ `syncFriendClasses`, `maximizeFreeTimeFriends[]`                                                                               |
| Result cap / hard limit removal       | ✅ `maxResults` (60)           | ✅ `resultCap` + `removeHardResultLimit` (30k ceiling)                                                                            |
| Free-half-day target in scoring       | ✅ `−freeDays*5`               | ✅ factor + `minHalfDays` floor                                                                                                   |
| Lab merging respecting lunch          | ✅ (UI-level)                  | ✅ (schema-level)                                                                                                                 |

**Read across that table:** FFCSketch covers rows 1–3 and the basic scoring row; AmazeCC covers every row, and most rows are _pruned inside the search tree_ rather than filtered after it — a performance difference, not just a feature difference.

## 5. Execution model comparison

| Property          | FFCSketch                                              | AmazeCC                                                                                                                                                                                                                                      |
| ----------------- | ------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Thread            | main                                                   | web worker (module) + inline fallback                                                                                                                                                                                                        |
| Blocking          | up to 400k nodes in one synchronous pass → **UI jank** | non-blocking; UI stays interactive                                                                                                                                                                                                           |
| Progress          | none                                                   | `nodes/found/accepted` streamed, UI rate-limited to 100 ms                                                                                                                                                                                   |
| Cancel            | none                                                   | terminate; partial results kept (batched every 50)                                                                                                                                                                                           |
| Determinism tests | none                                                   | `ffcs-generate.test.ts` (1,064 L / 49 cases) incl. **purity** and **in-tree pruning ≡ enumerate-then-filter** equivalence; `ffcs-generate-stream.test.ts` (536/20); `worker-artifact.test.ts` (342) runs the **built** worker in a Node `vm` |
| Failure modes     | silent freeze or silent empty result                   | 8 named error codes surfaced in the UI                                                                                                                                                                                                       |

## 6. Embedded pairing inside the generator

- **FFCSketch:** generator consumes pre-paired `partnerId`/`partnerSlot`; ETH+ELA treated as one atomic decision → smaller search tree, but pairing can't be re-scored per run.
- **AmazeCC:** `processParsedCourses` runs before generation (and before manual picking) so the same 4-tier branch-and-bound pairing applies to **both** planner and generator — `docs/ffcs-workings/embedded-course-pairing.md` §3 calls this the "universality" guarantee.

## 7. Guided / wizard flows (AmazeCC only)

`FFCSGuidedSelector.tsx` (**6,214 lines**) — a 15-phase wizard:

```
setup_mode · setup_timetable · setup_strategy · setup_locks
auto_courses · auto_slots_faculty · auto_timings · auto_blocking
auto_half_days · auto_social · auto_summary · auto_results
auto_timetable_view · manual_timetable_view · builder
```

with plan mode (`auto`/`custom`), strategy (`lock_advance` / `one_by_one`), reorderable ranking-priority list (`:3756`), results carousel, and nested-page predictive back (`:1460`).

FFCSketch has no wizard — its `Generator.tsx` (888 L) is a single form with checklist copy.

## 8. Verdict on the solver axis

| Criterion                 | Winner        | Note                                                                              |
| ------------------------- | ------------- | --------------------------------------------------------------------------------- |
| Readability / hackability | **FFCSketch** | 559-line engine, one file, one algorithm                                          |
| Search sophistication     | **AmazeCC**   | in-tree monotone pruning, drop ladder, 8 error codes, 30k ceiling                 |
| Runtime behaviour         | **AmazeCC**   | worker + streaming + cancel; FFCSketch can lock the tab                           |
| Constraint coverage       | **AmazeCC**   | see §4 table — 12 exclusive rows                                                  |
| Ranking quality           | **AmazeCC**   | profiles + factors + Vitfac faculty scores + filters                              |
| Correctness assurance     | **AmazeCC**   | 49 generator test cases vs 0                                                      |
| Embedded pairing UX       | **FFCSketch** | one-click pairing _repair_ UI; AmazeCC has manual linking but no problem-detector |
