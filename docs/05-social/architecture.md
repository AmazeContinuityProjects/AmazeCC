# Social — Architecture (deep)

> **In one line:** VTOP stays the source of truth for "who is in my class"; the server derives shared classes on pairing; the client renders from cached busy maps — nothing else.

## 1. The pairing lifecycle (one direction only)

```
A pairs with B:
  A sends handle AMZ-XXXX-YYYY → B's device receives intent
  B accepts → both derive shared classes via server (both calendars submitted)
  → grant rows written on both sides: {handle, classIds[], theirDisclosure}
  → busy maps uploaded (or full timetable, per disclosure choice)
```

No friendship exists until both sides push telemetry; server never pushes silently.

## 2. Disclosure levels (real config, not flags)

- **busy** — day/period bitmap only (what times, not what course)
- **full** — course identity included for your own same sections

Downgrades always possible; upgrades require explicit tap. Revocation wipes grants server-side
in the same round trip.

## 3. The render pipeline

```
useSocialData (atoms) ← socialPeersAtom, socialGrantsAtom, socialOwnCoursesAtom
usePeerTimetables → re-derive busy maps → cache → cache-miss → fetch via apiRequest
CommonFreeGrid → pure combinatorial: intersect members' busy/free bitmaps (no server)
```

## 4. Groups

`useSocialGroups` — named sets of paired peers; group queries are just repeated set intersections
across members with per-group cadence.

## 5. Data that never exists client-side

Peer names beyond displayName disambiguation, raw timetables of peers with coarse grants, anything
before a grant is active. The client never holds more than it needs to render its own screens.

## 6. Failure posture

- Peer revokes → next pull detects grant absence → purge caches + peers row locally, show "left your group"
- Server down → cached data only; the UX says "offline — last seen N min ago"
- Token mismatch → re-pair flow only; no silent refresh gambling
