---
title: "FFCS Planner — The 10-Minute Tour (as a student sees it)"
description: "pick courses → get conflict-free timetables, ranked by what you care about."
---

# FFCS Planner — The 10-Minute Tour (as a student sees it)

> **In one line:** pick courses → get conflict-free timetables, ranked by what you care about.

Open **Tools → FFCS Planner** (or `amazecc.com/ffcs/`). If it's your first visit, a short tour
walks three highlights (`TOUR_VERSION` gates it — see `features/tour/tourSteps.ts`).

## The two journeys

**Guided (mobile-first, recommended):** a step-by-step wizard —

1. Pick your courses (search by code/name/faculty or import from your VTOP curriculum)
2. (Optional) lock time slots or faculty you want
3. Choose ranking preferences (half-days? early finish? balanced?)
4. The engine generates ranked options — you tap through variants

**Modern / Classic:** the power-user grid — all courses in one table, live clash highlighting,
filter chips (slot, type, faculty), compare drawer, manual drag mode, export hub.

## The essential verbs

- **Pin** a course → it stays across regenerations
- **Blacklist** a faculty/offering
- **Swap** one course's section to fix a clash
- **Compare** two options side-by-side
- **Share** your plan via link (no server, plan rides in the URL)
- **Express** export: high-res JPG / multi-page PDF / iCal / HTML dossier / clash report

## What the planner knows about you

Nothing, unless you tell it — plans live in your browser's storage. Only explicitly shared
week links carry data, and only the shared week travels.

## How it survives no network

The course report CSVs ship as static assets; generation runs in a Web Worker against your
browser — no API round-trips in the generation loop whatsoever.

## Quiz

1. Which four CSVs can the planner load, and where do they come from?
2. What does the guided mode produce that modern mode doesn't?
3. Why does your plan survive refresh — and why does your _shared link_ work offline for friends?
