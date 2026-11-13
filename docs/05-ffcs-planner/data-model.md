---
title: "FFCS Planner — Data Model"
---

# FFCS Planner — Data Model

> Types live in `src/lib/ffcsTypes.ts`; fields below are the exact ones you'll touch.

## `ParsedCourse` (from CSV or paste/import)

```ts
{ code: string; title: string; type: string; faculty: string; credits: number;
  slots: string[];      // normalized via slots.ts — spelling matters
  venue?: string; room?: string; classId?: string;    // joined for registered sync
  category?: string; semester?: string; seats?: number; }
```

## `AddedCourse` (a course the student has committed to)

```ts
{ id: string; code: string; title: string; type; faculty; credits; slot: string;
  period: SlotPeriod; day: Day; startMin/endMin; color: string; classId?: string; }
```

`slot` values are literal VTOP tokens (`A1`, `TA1`, `S11` …) — `TimetablePeriod` collapses to
abstract period bands for the grid.

## `TimetableState` / sharing payload

The share link encodes **only** the AddedCourse list of the current week. lz-string → URI →
`/share/ffcs/?d=…`. `ffcsShare.ts` owns the (versioned) wire format — do not change field
names without `FFCS_SHARE_VERSION` bump **and** a decode-compat window (or a hard break with
changelog entry).

## Candidate-course matching

`CatalogFilters` (slot chips, type chips, curriculum categories via `/api/curriculum`-backfilled
`ffcsCatalogFilters.ts`) classify `ParsedCourse` for search; `GroupSelectedCourses` merges
LO+ETH pairs from one course code.

## Quiz

1. What does `ParsedCourse` carry that no student ever typed manually, and where does it come from?
2. What does the share payload deliberately leave out?
