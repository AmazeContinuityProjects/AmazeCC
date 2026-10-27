# Startup, storage & data fetching

**Severity: MEDIUM-HIGH** — blocks the main thread on cold start and on every login/reload.

## 1. Synchronous `localStorage` reads + JSON.parse on mount

`Main.tsx:316-376` runs a mount effect that synchronously reads ~17 keys and `JSON.parse`s each via
`storage.*.get()` (`src/lib/storage.ts:66-74`). Several of these payloads are large
(`allGrades`, `calender`, `schedule`, `hostel`). On a slow device this blocks the main thread during
the critical startup window, delaying first paint/interactivity.

`storage.ts` reads/writes are **synchronous** and called from many components during render/effects
(e.g. `Dashboard.tsx:145-348`, `attendance/CalendarView.tsx:65-461`, `exams/CourseDashboard.tsx:363-1083`).
Frequent `JSON.parse`/`JSON.stringify` of big objects inside render paths is a measurable cost.

Recommendations:
- Read storage **once** during a single hydration pass and feed Jotai atoms; avoid per-component
  `localStorage.getItem` in render.
- Debounce writes; avoid writing large objects on every keystroke (e.g. `notesTracker`,
  `customHomework`, `wastedODsTracker` updates in `attendance/*` and `exams/CourseDashboard.tsx:989`).

## 2. `localStorage.clear()` on logout

`Main.tsx:805-837` calls `localStorage.clear()` then re-writes a handful of keys. With the number of
cached keys the app stores (see `KEYS` in `storage.ts:5-63`), this is O(n) over a potentially large
store but is a one-time action — low concern.

## 3. Login / reload fan-out of network requests

`Main.tsx:543-803` (`handleReloadRequest`) fires a large number of sequential and parallel fetches
against `API_BASE` (attendance, marks, events ×2, transport, moodle, ept, acknowledgement, buses,
library, plus 8 "bulk" endpoints in `Promise.allSettled`). Even though some are backgrounded, the
primary path `await Promise.all(tasks)` blocks the reload banner from clearing until everything
settles. Combined with the artificial 2.4 s splash, the **perceived** reload time is long.

Recommendations:
- Prioritize the data needed for the visible tab; defer the rest (already partially done via the
  background IIFE at `Main.tsx:477-494`). Extend that pattern to the bulk endpoints.
- Show progressive UI as each dataset arrives instead of one spinner.

## 4. No caching layer for the API responses beyond `localStorage`

Responses are cached as raw `localStorage` JSON (`cache_<name>`). There is no TTL/invalidation beyond
manual overwrites, and large responses bloat `localStorage` (5–10 MB quota). Consider a bounded
cache and only persisting what the UI needs.

## Recommendations

1. Centralize storage hydration into one effect; stop reading `localStorage` inside component render.
2. Debounce writes for tracker-style state.
3. Reduce blocking fan-out in `handleReloadRequest` by pushing more endpoints to the background queue.
