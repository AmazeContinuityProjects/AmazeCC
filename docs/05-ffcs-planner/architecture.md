---
title: "FFCS Planner — Architecture (the full pipeline)"
description: "a deterministic cartesian walk over a cartesian product, pruned by slot algebra, greedy-clash-checks, an optional SAT-like faculty-priority ordering — running in a Web Worker, streamed to the UI in…"
---

# FFCS Planner — Architecture (the full pipeline)

> **In one line:** a deterministic cartesian walk over a cartesian product, pruned by slot
> algebra, greedy-clash-checks, an optional SAT-like faculty-priority ordering — running in a
> Web Worker, streamed to the UI in batches.

## 0. The moving parts, in order

```
User intent (guided wizard OR grid clicks)
  → AddedCourse[] (+ locks, blacklists, blocked slots, priority rankings)
  → generateTimetables(params)                       lib/ffcsGenerate.ts (~1,280 lines)
      → apply eight offering filters (morning/evening/slot/faculty/campus/day-start/limit/distinct)
      → buildWalkRules()                             lib/ffcsWalk.ts (~470 lines)
      → walkCombinations()                           lib/ffcsWalk.ts (cartesian, clash-checked)
      → score + dedupe + faculty ranking             lib/ffcsGenerate.ts (HARD_RESULT_LIMIT cap)
  → postMessage({type:"batch", results})             worker boundary
  → GeneratorStatParts (React) paints staged cards
```

Determinism matters: same inputs ⇒ same order ⇒ reproducible tests, share links, and bug reports.
The only intentional nondeterminism is `Math.random()` in nowhere — none — and in dev logging.

## 1. `ffcsGenerate.ts` — the producer contract

```ts
export function generateTimetables(params: GenerateParams): GenerateResult[];
type GenerateResult = TimetableState & { metrics?; warnings? };
```

Stages, in order:

1. **Prepare** — validate course list non-empty; parse slots via `slots.ts#hasSlot`; normalize.
2. **Offering filters** — eight sequential prunes (in application order):
   `slotFilter → eveningOnly? (morning slots banned) → earlyStart? → campus → limit-30k? → distinctLayouts?`
3. **Build walk rules** — lab-day restrictions (theory can't land on lab days of the embedded pair),
   half-day adjacency heuristics, doctor of `double-lab-clash` prevention.
4. **Walk** — `walkCombinations()`; each partial assignment clash-checked via `periodListsClash()`
   in O(slots × days); abort-lab-aware pruning at depth 2.
5. **Score** — gap penalties, half-day count bonus vs `freeHalfDays` floor, early-finish / late-start
   bonuses vs `RankingMode`; virtual drops via the drop ladder if user permits.
6. **Dedupe** — variant dedupe (same layout different faculty); `HARD_RESULT_LIMIT` reached →
   return with `truncated: true` — UI shows the truth.
7. **Faculty ranking** — only when `facultyRanking` enabled: sort per-course offerings before
   walking (never reorder after generation).

## 2. `ffcsWalk.ts` — the search core (the only part the generator may not skip)

`buildWalkRules()` returns:

- `labDayRules` — for embedded pair (TH+ELA/LO), mark the lab's day unavailable for the theory
- `maxConsecutiveHours` — default 3
- `minFreeHalfDays` — from settings (`freeHalfDays`)
- `facultyDayMap`? no — faculty spread is a scoring term, not a constraint

`walkCombinations()` does depth-first with early abort:

```
schedule = {}
for (i in courses):
  for (offering in offerings(i, filtered)):
    if clash(schedule, offering): continue
    schedule.add(offering)
    if fully filled: emit
    else recurse
```

It is not SAT — it's a bounded DFS with the capped order; the cap is the _cap_.

## 3. The worker protocol (`src/components/custom/exams/FFCS/workers/generator.worker.ts`)

```ts
// IN
type WorkerRequest =
  { type: "run"; params: GenerateParams } | { type: "stream"; params: GenerateParams; batchSize?: number };
// OUT
type WorkerReply =
  | { type: "batch"; results: GenerateResult[]; done?: boolean; truncated?: boolean }
  | { type: "error"; code: string; message: string };
```

Started by `logic/generator.ts` via `new Worker(new URL("../workers/generator.worker.ts", import.meta.url), { type: "module" })`.
The UI re-arms the worker per run (fresh state). No reuse across runs; memory pressure dictates it.

## 4. `FFCSGuidedSelector.tsx` (~5,126 lines) — the wizard monolith

**Structure (by line range):**

| Lines   | Region                                                                                                                                                   |
| ------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 115–180 | AUTO_SORT/RANKING label tables; module-level constants                                                                                                   |
| 180–256 | imports, dynamic sheet imports, type imports, `GuidedPhase` union                                                                                        |
| 256–594 | **state explosion** — ~90 `useState`s: planMode, locks, auto* prefs, generation error/notice, etc.                                                       |
| 593–672 | guided step (`currentStep` 1..N), search query state, block slots, viewport sizing                                                                       |
| 672–…   | `addCourse`, `handleAddGuidedCourse`, swap `saveSwap`, generation kickoff                                                                                |
| …–4,200 | phase rendering: `MobilePreflightCard → SetupModeCard → SetupStrategyCard → AutoBlockingCard → AutoTimingsCard → AutoSocialCard → AutoTimetableViewCard` |
| …–5,126 | footer (prev/next), `PdfGenerationBadge`, shared modals mounted inline                                                                                   |

**Invariants that matter when editing:**

1. Course locks survive mode flips — `internalCourseLocks` is the cut point; read/write it, never the parent set.
2. Blocked slots are a `Set<string>` mutated by _creating a new Set_ — identity change is the re-render signal.
3. Generation errors arrive via `generationError` + `generationNotice` as strings — the UI joins them into one banner with a "why?" link to `Architecture §6` (failure taxonomy).
4. The `HARD_RESULT_LIMIT` is _never_ removed for guided mode — the wizard cannot show 30k.
5. Tour (`TOUR_VERSION`) re-fires per major surface — don't touch `ffcs_tour_seen` to "reset" a student's tour.

## 5. `FFCSTimetableTab.tsx` (~4,436 lines) — the tab

Same event storm, but for the "modern/classic" grid. Anchor points (by line, approximate — verify):

| Lines      | Region                                                                                                                                            |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| 158–202    | dynamic imports of every sheet/modal it mounts; `FFCS_FINAL_LIST_NOTICE_SEEN_KEY`                                                                 |
| 203–320    | `masterCourses`, `rawParsedCourses`, `semesterReportCourses` (+ load aliases via `loadSemesterReport` at ~672 and `handleSemesterChange` at ~731) |
| 340–362    | tour wiring, vitfac hydration ref                                                                                                                 |
| 392–475    | share/demo memos, semester-tab restore effects                                                                                                    |
| 604–632    | social target state, social matrix toggle                                                                                                         |
| 672–958    | semester-report loader + semester change broadcast + `reportCatalogChangedRef`                                                                    |
| 1020–1190  | `catalogSlotIndex`, curriculum-only switch, search filter memo                                                                                    |
| 1289–1640  | export: `downloadImage`, `handleSharePlan`, `downloadDossierHtml`, `downloadClashReport`, `downloadPrintDossier` — every export path              |
| 1683–1833  | slot search, `handleAddGuidedCourse`, `closeGenerator`                                                                                            |
| 1831–1960  | guided-mode mount, generator preview holders                                                                                                      |
| 4090–4,436 | paste-courses textarea ingest (`code,type,slot,room,faculty`) — the power-user path                                                               |

## 6. The generation "failure taxonomy" — what students can see

| Failure                          | Where it's generated                   | Pretty message                                           |
| -------------------------------- | -------------------------------------- | -------------------------------------------------------- |
| `no_valid_slots`                 | walk found zero full schedules         | "Couldn't build a timetable — try removing a lock."      |
| `truncated_hard`                 | HARD_RESULT_LIMIT hit                  | "We hit our thinking limit — shown best-effort."         |
| `missing_lab_days`               | walk rules unsatisfiable               | "Couldn't pair a lab with its parent subject this week." |
| `faculty_priority_unsatisfiable` | user over-ranked faculty               | "Your faculty ranking can't be satisfied — relax it?"    |
| `ok_with_warnings`               | labs spread across days but suboptimal | "Built, with a note: heavy Wednesday."                   |

## 7. The export ladder (evaluation order)

`image → PDF (portrait dossier) → iCal → HTML snapshot → clash report → JSON` — cheapest first,
worker-backed where possible (jsPDF via pdf.worker.ts). See `lib/exportTimetable.ts`.
