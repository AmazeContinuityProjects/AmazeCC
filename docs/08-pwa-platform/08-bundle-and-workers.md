---
title: "Bundles & Workers (who loads what, when)"
description: "module workers for the two heavy jobs; dynamic imports for screens; precache exclusions keep the install lean."
---

# 08 — Bundles & Workers (who loads what, when)

> **In one line:** module workers for the two heavy jobs; dynamic imports for screens; precache exclusions keep the install lean.

## Dedicated workers

| Worker                | Started by               | Job                               | Lifecycle                                                                       |
| --------------------- | ------------------------ | --------------------------------- | ------------------------------------------------------------------------------- |
| `generator.worker.ts` | `logic/generator.ts`     | timetable search (cartesian walk) | spawned per run; one-shot or `{type:"stream"}` batched; terminated after result |
| `pdf.worker.ts`       | `lib/exportTimetable.ts` | jsPDF dossier assembly            | spawned per export; terminated on completion                                    |

Both are `{ type: "module" }` module workers via `new Worker(new URL(...), import.meta.url)` —
Next's webpack handles the URL resolution; no `worker-loader` needed.

## Dynamic imports (the big ones)

- `Main.tsx` — guest vs signed-in boot split
- `Dashboard.tsx` feature boundaries — attendance/academics/tools/hostel/… load on tab switch
- `courseDashboard_target` — the per-course deep-dive chain
- `xlsx` — only imported for Excel course-sheet uploads
- `html5-qrcode` — only imported when opening scan-handle sheet
- `tesseract.js` — only in the scanner page (plus its worker)
- `framer-motion` heavy leaves — sheets, layout cards (code-split by dynamic import at route level when needed)

## Precache discipline

SW precache holds shell runtime JS but **not** images, JSON, CSVs — install payload stays ~2–4 MB.
Anything new to precache needs an ADR-grade justification (it rides every install forever).
