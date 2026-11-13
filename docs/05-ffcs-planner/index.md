---
title: "The FFCS Planner"
description: "the reason the app exists — build, compare, share and export a clash-free VIT Flexible Curriculum timetable, entirely client-side."
---

# 05 — The FFCS Planner

> **In one line:** the reason the app exists — build, compare, share and export a clash-free
> VIT Flexible Curriculum timetable, entirely client-side.
> **Entry points:** Tools → FFCS Planner · More → FFCS · `/ffcs` (standalone) · More → FFCS.

## Core screens

| Surface        | Where              | What it does                                              |
| -------------- | ------------------ | --------------------------------------------------------- |
| Planner (full) | Tools → FFCS       | `FFCSTimetableTab.tsx` — modes: guided / modern / classic |
| Standalone     | `/ffcs/`           | same module, own PWA identity                             |
| Embedded       | More → FFCS        | compact embed inside the signed-in shell                  |
| Shared plan    | `/share/ffcs/?d=…` | read-only received plan                                   |

## What this folder documents

- [overview.md](overview.md) — the 10-minute tour of the planner as a student sees it
- [architecture.md](architecture.md) — guided vs modern/classic, generation pipeline, the worker
- [data-model.md](data-model.md) — `ParsedCourse` → `AddedCourse` → `TimetablePeriod`; share payloads
- [ui-map.md](ui-map.md) — 25 components + 6 guided cards + 10 modals, by line count
- [storage-and-state.md](storage-and-state.md) — every `ffcs_*` key, tour/versioning, caches
- [testing.md](testing.md) — the 37 `ffcs*` suites and what they pin
- [known-issues.md](known-issues.md) — tour bugs, drop-ladder, CSV provenance, SW precache exclusions
- [history.md](history.md) — FFCS-inator heritage, permanent CSV choice, codechef-vit catalogue

## Feature sub-systems (docs live in this folder)

Course catalog & filters · target locker · generator (worker-backed ASP-style search) ·
timetable renderers · exports (image/PDF/iCal/dossier/HTML/portable) · share links · tour system ·
frieplaces. The guided mode gets its own sub-doc inside architecture.md.

## Provenance

The planner descends from CodeChef-VIT's FFCS-inator (MIT, attribution in
`public/ffcs/codechef-vit-catalogue.SOURCE.md`); AmazeCC rewrote it for VTOP slot syntax,
campus schema (`GLOBAL`), and half-day optimization. The `codechef-vit` CSV is the catalog of
record; `ffcsReport.csv` is a byte-identical copy of the current fall report.
