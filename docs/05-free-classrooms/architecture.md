# Free Classrooms — Architecture (deep)

> **In one line:** a two-source truth — on-device slot math over VIT's printed section tables
> plus a server cross-check — merged honestly, never silently.

## 1. The on-device scanner (`lib/freeClassrooms.ts`)

- Input: committed tables of all rooms on campus with their slot assignments (converted from
  the official 2026–27 PDFs — committed as `data/campus/chennai.json` + `data/dayscholar_buses.json`-esque fixtures? no — the room table itself is inlined in `freeClassrooms.ts`).
- For every `slot` token, the function returns the set of rooms _not_ listed as booked;
  subtract cross-slot conflicts (`slots.ts#periodListsClash`)
- Silent failures: 3 systematic cases (documented in code; most famously 8:30 vs 8:30S ambiguity)
  — handled by treating the affected slot token as fully occupied with a diagnostic log, never an
  invented empty room

## 2. The server cross-check (`lib/roomAvailability.ts`)

Asks AmazeCC-API: given current period, which rooms are marked occupied on VTOP?
Purpose: catch rooms the PDF tables get wrong (room swaps, faculty changes) during the semester.

## 3. The merge (`lib/roomMerge.ts`)

- server wins on any conflict (it saw VTOP, the PDF doesn't)
- client fills _false negatives_ (server says empty when PDF knows it's occupied) with a warning flag
- result: `RoomOccupancy { rooms[], silentFailures: string[] }` — the UI is expected to badge these

## 4. Failure modes worth knowing

- VIT publishes new section tables mid-semester; the VIT table baked into the bundle is the fallback —
  the cross-check is what saves the day when that happens
- Lab rooms are excluded from "theory" slots and vice-versa — mis-tagging would offer students a
  mechanical workshop as a study spot, not nice
- power users point at periods where VIT hasn't yet published the day schedule — half-empty campus
  math via PDF is better than an empty list, but the server confirms otherwise within 5 min of publish
