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

`CommonFreeSlotsGrid.tsx` builds a 7 × 12 grid by deriving the column skeleton from **Monday only**, then projecting each Monday pair onto other days by matching time strings (`projectColumns`):

1. Split Monday's slots into theory and lab by `slotId.startsWith("L")`, sort each by start time.
2. Pair them index-wise into 12 `{ theory, lab }` columns.
3. For each other day, find the slot whose `time` string exactly matches the pair's theory or lab time; fall back to a ±7-minute tolerance on the start minute.

Verified by asserting the algorithm against `config.json`: the exact-match path alone covers **every one of the 164 slots exactly once, with no gaps and no double-counting**, on all seven days. `src/__tests__/social-grid.test.ts` re-checks this, because a `config.json` edit that broke it would silently move every cell in the grid.

### The trap in step 3 that the test caught

A theory slot and its paired lab run at the **same time on the same day**. Monday has both `A1` and `L1` at 08:00–08:50; Tuesday has both `B1` and `L7` there. Six time strings are shared this way on each of MON and TUE.

So the projection index must be keyed by time **and half**, not by time alone. Keying on time alone resolves both halves of a pair to whichever slot was registered first, which produces a duplicate *and* drops the other slot from the grid entirely — 168 cells rendered for 164 slots. The `L` prefix is the only discriminator available, so it is what separates the two indexes.

Two consequences:

- **A `(day, slotId)` set is a complete, lossless representation of a weekly timetable.** There is no information the grid uses that the flat set does not carry. This is what makes server-side derivation viable.
- **The theory/lab pairing is a display concern, not a data concern.** The server stores a flat set; the client re-derives columns from Monday whenever it renders. Nothing is lost, and the server never has to understand the 12-pair structure.

## 4. Time parsing, and a trap

```ts
// CommonFreeSlotsGrid.tsx:17-25
const isPM = h === 12 || (h >= 1 && h <= 7);
if (isPM && h !== 12) h += 12;
```

The heuristic is: **1–7 are PM, 8+ are AM, 12 is PM.** It works on every `config.json` value because 8:00 is the earliest slot and 19:25 the latest. It is not a general time parser, and `attendanceTimetable.ts` used a *different* rule (`if (h < 8) h += 12`) which agreed on this data and would not in general.

The two rules differ at exactly one input, `h = 0`. Verified mechanically over all 164 slots: the hours present are `{1..12}`, and no hour below 8 survives into 24-hour form, so the two rules are indistinguishable on the real vocabulary. That is not a reason to keep both — it is a reason the next vocabulary edit could silently diverge them.

**Shipped:** `src/lib/social/schedule.ts` holds the only `toMinutes`, `minutesToTimeStr` and `fmt`. The two private grid copies and `attendanceTimetable.ts`'s rule are gone; the last one is kept as a *named export* that delegates, because four call sites import it (`ODTrackerSubpage.tsx`, `SimplifiedMobileHome.tsx`, `taskMatch.ts`, and its own range helper) and renaming those is churn for no gain.

`toMinutesInvariant()` re-derives the assumption from the vocabulary — distinct hours, earliest start, latest end, and that every span is positive — so the "1-7 are PM" rule is checked rather than trusted, and the test suite asserts `earliest === 480` and `latest === 1165`.

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

**Shipped:** `busyMapFromClassSlots` in `src/lib/social/schedule.ts` respects `slot.day` and only falls back to fan-out when the day is missing or unrecognised, because then there is genuinely nothing to go on. `CommonFreeSlotsGrid.tsx` uses it. Storing `(day, slotId)` explicitly removes the ambiguity for new data, and this fixes the read path for old data.

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
  commonFreeSlots: number;   // slots where NEITHER is busy
  commonFreeHours: number;   // the same, in hours
  matchPct: number;          // of MY class hours, the % the peer is also free
  sharedClassHours: number;  // hours where both are busy
  myClassHours: number;      // hours where I am busy
  firstCommonFreeSlot: string | null;
  freeNow: boolean;          // peer is free in the slot covering the current time
  currentSlot: string | null;
}
```

`matchPct` is deliberately defined against **the viewer's own class hours**, not against an absolute slot count. The old code used `totalPossibleSlots = 35` hardcoded against a 164-slot vocabulary (`SocialTab.tsx:237`), and before that it was not computed at all — `getOverlapMetrics` produced `70 + (seed % 25)` from a character hash of the reg number (`:242`), so every "% match" ever displayed was fabricated.

### Two corrections to the draft version of this function

The first draft of this section had two bugs, both found by implementing it:

1. **It iterated the union of the two busy maps.** Every key in that union is busy
   for *someone*, so the `if (!mine[key] && !theirs[key])` branch was unreachable
   and `commonFreeSlots` was permanently `0`. "Common free" is by definition a
   slot neither person occupies, so the function has to walk the **whole
   164-slot vocabulary**.
2. **`matchPct` divided a free-slot count by a busy-slot count**
   (`free / mineCount`). That is not a percentage of anything — with 100 free
   slots and 30 busy ones it yields 333%.

The shipped definition, in `src/lib/social/schedule.ts`:

```ts
export function computeOverlap(
  mine: BusyMap,
  theirs: BusyMap,
  map: SlotMap = slotMap,
  now: Date = new Date(),
): OverlapMetrics {
  const myKeys = new Set(Object.keys(mine ?? {}));
  let shared = 0, sharedMins = 0, free = 0, freeMins = 0;
  let myMins = 0, clashFreeMins = 0, first: string | null = null;

  for (const daySlots of orderedDays(map)) {        // week order, then start time
    for (const { day, slotId } of daySlots) {
      const key = slotKey(day, slotId);
      const span = slotSpanMinutes(map[day][slotId].time);
      const iAmBusy = myKeys.has(key);
      const theyAreBusy = Boolean(theirs?.[key]);

      if (iAmBusy) {
        myMins += span;
        if (!theyAreBusy) clashFreeMins += span;    // <- the honest "match"
      }
      if (iAmBusy && theyAreBusy) { shared++; sharedMins += span; continue; }
      if (!iAmBusy && !theyAreBusy) {
        free++; freeMins += span;
        if (!first) first = key;
      }
    }
  }

  return {
    commonFreeSlots: free,
    commonFreeHours: Math.round((freeMins / 60) * 10) / 10,
    matchPct: myMins > 0 ? Math.round((clashFreeMins / myMins) * 100) : 0,
    sharedClassHours: Math.round((sharedMins / 60) * 10) / 10,
    myClassHours: Math.round((myMins / 60) * 10) / 10,
    firstCommonFreeSlot: first,
    freeNow: currentSlot ? !theirs?.[currentSlot] : true,
    currentSlot,
  };
}
```

`matchPct` is a share of a subset, so it is bounded to 0–100 by construction: 100 means "we are never in class at the same time", 0 means "we clash in every class hour I have". It is deliberately **not** symmetric — it answers "how much of *my* week is compatible with *them*", so the same pair scored from the other side gives a different number, and that is correct.

`commonFreeSlots` is large by construction (~110 of 164 for a typical pair), because most of a week is free to everyone. The discriminating figures are `sharedClassHours` and `matchPct`.

An unknown key is **skipped, not guessed**. If a `slotMap` edit ever leaves a stored key unresolvable, the honest outcome is that the slot is not counted — the alternative is an invented time.

### A trap the metrics invite

A peer with **no** shared timetable makes every one of my slots clash-free, which this formula reports as a 100% match. That is arithmetically correct and completely misleading, so `SocialTab` checks `classSlots.length === 0` first and renders "no timetable shared yet" rather than a flattering number. The underlying number is still 100; the guard is in the presentation layer, deliberately, and there is a test pinning both halves.

`freeNow` is a single dictionary lookup, so "Free Right Now" needs no precomputation. `slotCoveringNow` converts the current local time to a slot via the same `toMinutes` used everywhere else, and returns `null` at the weekend or outside 08:00–19:25 — which is why `freeNow` is then trivially `true`.

## 8. Lunch

Lunch is a **visual spacer, not a slot.** `LUNCH_START_MIN` is `toMinutes("1:20")` = 800, and the split lands at the first Monday pair whose earlier of {theory, lab} starts at or after 800 — index 6, giving 6 before and 6 after.

Note the resulting edge case: `MON.S11` runs 12:35–1:25 and is classified *before* lunch by a 25-minute margin. The display layer keeps this behaviour so the grid looks the same; the data layer does not care, because lunch has no representation in the busy map at all.

---

## 9. Groups

`computeGroupOverlap(mine, memberMaps, ...)` compares the viewer against a whole
group. It is **not** a loop over `computeOverlap`, because the per-slot rule has to
change with group size.

**A common-free slot is free for the viewer AND every member.** The natural
translation of "busy" into AND is `allBusy`, and the free test is then
`!allBusy` — which is wrong, and was wrong in the first implementation of this
function. It asks "is the viewer free and is *someone* free", so a group
containing one person with no classes at all satisfied it for 164 slots and the
rest of the group was silently ignored. The test asserts the 163/162 pair
specifically because that is where the two rules diverge; reintroducing `!allBusy`
makes it fail with `expected 163 to be 162`.

OR would also be wrong in a different way: every additional member can only veto a
slot, so a large group would read as more constrained than a small one purely
because it has more people.

**`groupMatchPct` is a mean, not a gate.** Requiring *all* members to be free
during the viewer's class hours makes any group of three or more score near zero
and stop discriminating between groups at all. So the figure is the mean share of
members free across the viewer's class hours — 100 means every member is
compatible, 0 means every member clashes everywhere. Class lengths are used as
weights, so a 3-hour lab counts as three 1-hour lectures.

**Unknown is not free.** `useSocialGroups` passes only *loaded* timetables to the
function and reports the rest as `pending`. A peer with no data has not been shown
to be free, and counting them would inflate every figure.

**An empty group reports zeros.** With no members, "free for all" is vacuously
true for all 164 slots, so a group of nobody would render as a completely open
week. `computeGroupOverlap(mine, [])` returns zeros instead.

Groups are **client-side only** (`social_groups_v1_<reg>`). A group introduces no
new relationship: every member is someone the user already holds a grant for, so
their timetable is already readable. There is nothing to consent to and nothing to
sync, and no API change.

`handles` is treated as a set of *candidates*, never as truth. A pairing can be
revoked, so `pruneHandles` drops handles that are no longer known peers, and a
group that loses all of them is reported `empty` rather than deleted — hiding it
would make a revoke look like a deletion.
