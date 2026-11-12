# FFCS Planner — Architecture

> **In one line:** a pure deterministic search (`ffcsGenerate.ts` + `ffcsWalk.ts`) driven by a
> Web Worker, rendering into a React grid — nothing network-shaped in the hot path.

## The search pipeline

```
user selection (ParsedCourse[]) + locks (CourseLock[]) + filters
   → buildWalkRules()           (ffcsWalk.ts: lab/theory pairing rules, lab-day pruning)
   → walkCombinations()         (cartesian walk with clash checks + HARD cap)
   → generateTimetables()       (ffcsGenerate.ts: score, dedupe, half-days floor, faculty ranking)
   → results streamed via postMessage (batched) — UI paints progressively
```

Deterministic — the same inputs produce the same outputs in the same order. That property is
load-bearing for the test suite (`ffcsGenerate*`) and for share-link stability.

## The worker protocol (`generator.worker.ts`)

```ts
// to worker:  { type: "run", params } | { type: "stream", params }
// from:       { type: "batch", results, done? }  |  { type: "error", code }
```

Started by `logic/generator.ts` via `new Worker(new URL("../workers/generator.worker.ts", import.meta.url), { type: "module" })`,
with an inline-fallback if Worker spawning fails (rare; logged).

## Guided vs modern/classic

|             | Guided (`FFCSGuidedSelector`, ~5.1k lines)      | Modern/Classic (`FFCSTimetableTab`) |
| ----------- | ----------------------------------------------- | ----------------------------------- |
| Audience    | first-timers, phone-first                       | power users, desktop                |
| Data model  | same — both write `AddedCourse`[]               | same                                |
| Layout      | phase cards + wizard; heavy a11y                | table grid + sheets                 |
| Auto-switch | manual; stored in settings (`ffcs_layout_mode`) | manual                              |

## Export pipeline (`lib/exportTimetable.ts`, ~1.75k lines)

JPG/PNG (html2canvas-free: manual canvas draw) · jsPDF in a worker (`pdf.worker.ts`) for the
portrait dossier · `.ics` · print-friendly HTML (`exportTimetableHtml.ts`) · clash-report PDF ·
QR/Share handoff. All student-side; zero upload.

## Course data provenance

`public/ffcs/*.csv` — winter/fall 2026-27 reports:

- `winter-2026-2027-final-ffcs.csv` (356 KB)
- `fall-2026-2027-final-ffcs.csv` == `ffcsReport.csv` (233 KB, byte-identical)
- `winter-2026-2027-slot-timetable.csv` (mock, 303 KB)
- `codechef-vit-catalogue.csv` (CodeChef-VIT FFCS-inator catalogue, 222 KB; MIT, see `.SOURCE.md`)

`ffcsReports.ts#getFFCSSemester` maps code-prefix (`CH2026…01` vs `…05`) → file. Students
re-paste reports when printed; files are compile-time static but replaceable per release.

## Quiz

1. Why does the generator run in a worker rather than on the main thread?
2. What is the one file that owns the clash-detection rules, and the one that owns scoring?
3. Which search optimizations live in `ffcsWalk.ts` vs `ffcsGenerate.ts`?
