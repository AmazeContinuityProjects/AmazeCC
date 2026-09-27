# Schedule Math

The slot vocabulary, why `(day, slotId)` is the only correct key, and how overlap is computed. Everything here was verified against `config.json` and the current grid implementation.

---

## 1. The vocabulary

`config.json` has exactly two top-level keys: `semesterIDs` and `slotMap`. Every `slotMap` entry is `{ time: "H:MM-H:MM" }` and nothing else — no label, no kind, no day.

| Day | Slots |
|---|---|
| MON | 24 |
| TUE | 23 |
| WED | 23 |
| THU | 23 |
| FRI | 23 |
| SAT | 24 |
| SUN | 24 |
| **Total** | **164** |

Slot id families: `A`–`G` theory blocks, `T`-prefixed tutorials (`TB1`, `TC1`, `TAA1`, …), `S*` seminar slots, `L*` labs. `L` prefix is the only lab discriminator anywhere in the codebase (`CommonFreeSlotsGrid.tsx:91`, `TimetableGrid.tsx:135,261`).

## 2. Slot ids are day-scoped — this is the whole reason for `(day, slotId)`

**24 of the ids exist on more than one day**, at different times:

| Id | Days | MON time | WED time |
|---|---|---|---|
| `A1` | MON, WED | 8:00-8:50 | 8:55-9:45 |
| `A2` | MON, WED | 2:00-2:50 | 2:55-3:45 |
| `D1` | MON, THU | 9:50-10:40 | 8:00-8:50 |
| `B1` | TUE, THU | 8:00-8:50 | 8:55-9:45 |
| `E1` | TUE, FRI | 8:00-8:50 | 8:55-9:45 |
| `C1` | WED, FRI | 8:00-8:50 | 8:55-9:45 |
| `F1` | MON, WED | 8:55-9:45 | 9:50-10:40 |
| `G1` | TUE, THU | 8:55-9:45 | 9:50-10:40 |

Plus `B2`, `C2`, `D2`, `E2`, `F2`, `G2` on the same pairs, and `W21`, `W22`, `X11`, `X12`, `X21`, `Y11`, `Y12`, `Y21`, `Z21`, `Z22` on both SAT and SUN.

So `A1` is a valid key on two days at two different times. **A bare `slotId` is ambiguous and cannot be a storage key, a cache key, or a comparison key.** Everything downstream is keyed `"DAY:SLOTID"`.

## 3. The grid's projection is complete — proven, not assumed

`CommonFreeSlotsGrid.tsx` builds a 7 × 12 grid by deriving the column skeleton from **Monday only**, then projecting each Monday pair onto other days by matching time strings (`slotsMatchingTimes`, `:115-142`):

1. Split Monday's slots into theory and lab by `slotId.startsWith("L")`, sort each by start time.
2. Pair them index-wise into 12 `{ theory, lab }` columns.
3. For each other day, find slots whose `time` string exactly matches the pair's theory or lab time; fall back to a ±7-minute tolerance on the start minute.

Verified by simulating the algorithm against `config.json`: the exact-match path alone covers **every one of the 164 slots exactly once, with no gaps and no double-counting**, on all seven days.

Two consequences:

- **A `(day, slotId)` set is a complete, lossless representation of a weekly timetable.** There is no information the grid uses that the flat set does not carry. This is what makes server-side derivation viable.
- **The theory/lab pairing is a display concern, not a data concern.** The server stores a flat set; the client re-derives columns from Monday whenever it renders. Nothing is lost, and the server never has to understand the 12-pair structure.

## 4. Time parsing, and a trap

```ts
// CommonFreeSlotsGrid.tsx:17-25
const isPM = h === 12 || (h >= 1 && h <= 7);
if (isPM && h !== 12) h += 12;
```

The heuristic is: **1–7 are PM, 8+ are AM, 12 is PM.** It works on every `config.json` value because 8:00 is the earliest slot and 7:25 the latest. It is not a general time parser, and `attendanceTimetable.ts:8-12` uses a *different* rule (`if (h < 8) h += 12`) which happens to agree on this data and would not in general.

The new code parses times in exactly one place — `src/lib/social/schedule.ts` — and the two existing copies should be pointed at it. There is no need to keep three implementations that agree by coincidence.

## 5. Two defects this design eliminates

### The day-blind friend grid

`CommonFreeSlotsGrid.tsx:68-80` builds a friend's busy grid by ignoring `slot.day` and re-fanning-out `slot.slotId` across all seven days:

```ts
friend.classSlots.forEach((slot) => {
  days.forEach((day) => {
    if (slotMap[day]?.[slot.slotId]) {
      friendsGrid[friend.id][day][slot.slotId] = slot.courseTitle || true;
    }
  });
});
```

For v5/v6 friends this is harmless, because those importers already emit one entry per `(day, slotId)` so the fan-out is idempotent. For v1/v2/v3/`amz-profile-` friends, where `day` is meaningful, it marks the friend busy on days they are not in class — and because every theory block exists on two days, this fires for all of them. A v2 friend with `slotId: "A1"`, `day: "MON"` is marked busy on Monday *and* Wednesday.

Storing `(day, slotId)` explicitly removes the ambiguity, because there is nothing left to re-derive.

### The unversioned wire format

`exportScheduleCode` (`socialUtils.ts:50-118`) builds a 164-entry slot list by iterating days in order and sorting slot ids **lexicographically** within each day, then encodes a 2-char base36 index per occupancy. Any rename, addition or removal shifts every subsequent index, so **a single `config.json` edit silently re-maps every code ever shared**. There is no version field and no validation, so nothing detects it.

The new model stores literal `"DAY:SLOTID"` keys validated against a known vocabulary at write time, plus an explicit `slotmap_version`. Indices do not exist, so the failure mode is gone.

The format also has a second bug: `courseIdx.toString(36).substring(0, 1)` (`:101`) truncates, so a student with 37+ courses gets two courses mapped to the same index on import.

## 6. Deriving a busy map

VTOP gives slot ids and a venue in one cell, separated by `" - "`: `L31+L32+L37+L38 - AB1-607B`. Verified live — the separator is *not* `"/"`.

```ts
export function buildBusyMap(
  courses: { slotVenue: string }[],
  slotMap: SlotMap,
): BusyMap {
  const out: BusyMap = {};

  for (const course of courses) {
    // " - " is space-delimited. A bare split("-") would break on slot ids like
    // S8B and on venue names like AB1-607B.
    const [slotPart, venue] = String(course.slotVenue ?? "").split(/\s+-\s+/);
    const slotIds = (slotPart ?? "").split("+").map(s => s.trim()).filter(Boolean);

    for (const slotId of slotIds) {
      // A bare slot id is ambiguous, so it fans out across the days it exists on.
      for (const day of DAYS) {
        if (!slotMap[day]?.[slotId]) continue;
        out[`${day}:${slotId}`] = { c: course.code, t: course.title, v: venue?.trim() ?? "" };
      }
    }
  }

  return out;   // ≤ 164 keys
}
```

`slotMap` is the shared vocabulary, imported from `config.json` on both sides. The **server** holds its own copy and validates every key against it at ingest; the version string is for diagnostics, not trust.

## 7. Comparison

Two flat sets in, a few derived figures out. Entirely client-side — two small objects, no round trip, works against cache while offline.

```ts
export interface OverlapMetrics {
  commonFreeSlots: number;   // slots where neither is busy
  commonFreeHours: number;   // the same, in hours
  matchPct: number;          // % of the viewer's *class hours* the peer is also free
  sharedClassHours: number;  // hours where both are busy
  firstCommonFreeSlot: string | null;
  freeNow: boolean;          // peer is free in the slot covering the current time
}
```

`matchPct` is deliberately defined against **the viewer's class hours**, not against an absolute slot count. The old code used `totalPossibleSlots = 35` hardcoded against a 164-slot vocabulary (`SocialTab.tsx:233`), and before that it was not computed at all — `getOverlapMetrics` produced `70 + (seed % 25)` from a character hash of the reg number (`:234`), so every "% match" ever displayed was fabricated.

```ts
export function computeOverlap(mine: BusyMap, theirs: BusyMap, slotMap: SlotMap): OverlapMetrics {
  const busy = new Set([...Object.keys(mine), ...Object.keys(theirs)]);
  let shared = 0, free = 0, hours = 0, first: string | null = null;

  for (const key of busy) {
    const [day, slotId] = key.split(":");
    const slot = slotMap[day]?.[slotId];
    if (!slot) continue;                       // vocabulary drift: skip, do not guess
    const span = toMinutes(slot.time.split("-")[1]) - toMinutes(slot.time.split("-")[0]);

    if (mine[key] && theirs[key]) { shared++; continue; }
    if (!mine[key] && !theirs[key]) {
      free++; hours += span / 60;
      if (!first) first = key;
    }
  }

  return {
    commonFreeSlots: free,
    commonFreeHours: Math.round(hours * 10) / 10,
    matchPct: mineCount ? Math.round((free / mineCount) * 100) : 0,
    sharedClassHours: shared,
    firstCommonFreeSlot: first,
    freeNow: theirs[slotCoveringNow(slotMap)] === undefined,
  };
}
```

`freeNow` is a single dictionary lookup, so "Free Right Now" needs no precomputation. `slotCoveringNow` converts the current local time to a slot via the same `toMinutes` used everywhere else.

An unknown key is **skipped, not guessed**. If a `slotMap` edit ever leaves a stored key unresolvable, the honest outcome is that the slot is not counted — the alternative is an invented time.

## 8. Lunch

Lunch is a **visual spacer, not a slot.** `LUNCH_START_MIN` is `toMinutes("1:20")` = 800, and the split lands at the first Monday pair whose earlier of {theory, lab} starts at or after 800 — index 6, giving 6 before and 6 after.

Note the resulting edge case: `MON.S11` runs 12:35–1:25 and is classified *before* lunch by a 25-minute margin. The display layer keeps this behaviour so the grid looks the same; the data layer does not care, because lunch has no representation in the busy map at all.
