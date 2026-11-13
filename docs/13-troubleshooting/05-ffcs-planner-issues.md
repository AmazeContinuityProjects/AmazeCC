---
title: "FFCS Planner Issues"
description: "slots vocabulary, stale CSVs, and tour state — the three usual suspects."
---

# FFCS Planner Issues

> **In one line:** slots vocabulary, stale CSVs, and tour state — the three usual suspects.

- **Course not appearing in search** → wrong semester prefix (fall CSV loaded for winter); check the file badge in the planner header
- **Clashes with itself** → slot collision bug → check `slots.ts` known mappings; duplicate CRNs sometimes arrive with VTOP typos
- **Tour won't stop / never shows** → `localStorage.ffcs_tour_seen` — clear it (`TOUR_VERSION` bump changes the key's expectation)
- **Export produces nothing** → popup blockers; also the PDF worker silently fails if the tab is closed mid-build — retry from the Export sheet
- **Locked course disappears after semester switch** → targets are semester-agnostic by mistake; re-add (locks are keyed by course code, which survives)
