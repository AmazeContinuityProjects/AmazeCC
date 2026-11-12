# Marks & Cohort — Architecture

Outflow: `marksSync.ts` → `/api/marks/stats` → server pools keyed by `assessmentKey`.
Inflow: op `marksStats` → `marksStatsAtom` merged ~-over (local wins ties).
Frozen: `marksFrozenV1` receipt set pins accepted writes; drift logged loudly.
