# Free Classrooms — Architecture

Two independent sources, merged:

1. **Client scan** — `freeClassrooms.ts`/`slots.ts` slot math over ~2,357 rooms listed in the committed campus tables (all slot encodings); known-silenced: 3 systematic failures (the "hasSpanish period" 8:30/8:30S) — documented in code.
2. **Server answer** — `roomAvailability.ts` (server cross-check of section occupancy) when online.
   `roomMerge.ts` reconciles: server wins conflicts; client fills server gaps (other-room false negatives flagged honestly).
