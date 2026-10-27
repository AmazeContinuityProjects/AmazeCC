# AmazeCC Performance Optimization — Recommended Action Plan

## Executive Summary

The uploaded performance analyses correctly identify AmazeCC's primary performance problem: the application has a large monolithic client-side dependency graph, while startup also performs synchronous storage hydration and a broad network fan-out.

The recommended strategy is **not** to create a separate Jotai store/cache for every route.

Instead:

> **Reduce the initial client dependency graph, remove artificial startup delays, establish a persistent application shell/provider, split the existing feature tabs into route-level boundaries, keep Jotai granular and shared where appropriate, progressively fetch data, and selectively prefetch/cache likely routes for fast repeat navigation and offline use.**

The existing analyses report approximately **1.52 MB raw JavaScript for the home page chunk** and roughly **2.2–2.5 MB raw first-load JavaScript**. They also identify a 2.4-second artificial splash, synchronous localStorage/JSON parsing, a large reload-time request fan-out, and a monolithic `Main.tsx`/`Dashboard.tsx` architecture as important contributors.

This document adds implementation recommendations and sequencing to the supplied analyses.

---

# 1. Recommended Priority Order

Do not begin with the large routing refactor.

Use measurable stages:

1. **P0 — Remove obvious startup penalties**
2. **P1 — Reduce the initial dependency graph**
3. **P1 — Extract a persistent AppProvider / application shell**
4. **P1 — Convert feature tabs into route-level boundaries**
5. **P1 — Move data fetching toward progressive, route-aware loading**
6. **P2 — Optimize Jotai subscription locality**
7. **P2 — Add selective idle/intent prefetching**
8. **P2 — Harden Serwist for offline resources and navigation**
9. **P3 — Image/assets and smaller rendering optimizations**
10. **Measure after every major stage**

This order minimizes refactor risk and lets each stage prove its value independently.

---

# 2. P0: Fix the Startup Experience First

## 2.1 Remove the artificial 2.4-second splash

The current fixed delay should not be replaced with another global readiness barrier.

Prefer:

```text
App starts
    ↓
hydrate critical cached state
    ↓
render application shell immediately
    ↓
show skeleton/loading states only where data is unavailable
    ↓
refresh data in background
```

Avoid:

```text
App starts
    ↓
wait for arbitrary timer
    ↓
wait for all data
    ↓
render everything
```

The goal is not simply to make the splash shorter. The goal is to make the application **progressively usable**.

### Recommendation

The shell should become interactive as soon as its critical state is available:

- authentication state
- basic student identity
- settings/theme
- navigation state

Feature data can arrive afterward.

---

# 3. P0: Remove the Theme Reload

If the theme is already known locally, it should not require a page reload.

The desired flow is:

```text
stored theme
    ↓
initial theme selection
    ↓
render
```

rather than:

```text
render default theme
    ↓
discover stored theme
    ↓
reload
    ↓
render correct theme
```

If possible, initialize the theme before the main application tree paints.

---

# 4. P0: Fix the `cmds` Memoization

The current `useMemo` issue identified in the supplied runtime analysis is important because `Main` subscribes to many atoms.

A missing dependency array means the expensive command construction is effectively recomputed on every render.

A short-term fix is to provide correct dependencies.

However, the preferred long-term architecture is:

```text
Main
  └── CommandPalette
        └── command-specific state
```

rather than having the top-level application component construct a large command graph.

This improves both readability and render locality.

---

# 5. P0/P1: Move Fonts to `next/font`

The current externally linked font stylesheet should be replaced with Next.js font handling.

Benefits to validate experimentally:

- fewer render-blocking external requests
- self-hosted font assets
- more predictable loading
- improved startup consistency

This is a low-risk change and should be included early.

---

# 6. P1: Attack the Initial Bundle

This is the highest-value architectural problem identified by the supplied bundle analysis.

The current home page chunk is reported at approximately:

```text
1.52 MB raw
```

with approximately:

```text
2.2–2.5 MB raw first-load JS
```

The analysis identifies heavy candidates including:

- `xlsx`
- `recharts`
- `@uiw/react-heat-map`
- `framer-motion`
- `swiper`
- `demoData.json`

## 6.1 First, lazy-load the heaviest libraries

Before doing a large route migration, prove the bundle hypothesis.

Examples:

### Export libraries

Load `xlsx`, `jspdf`, `html2canvas`, or similar libraries only when their functionality is invoked.

Conceptually:

```ts
const handleExport = async () => {
  const module = await import("heavy-export-library");
  // perform export
};
```

### Charts

If Recharts is only needed by a particular feature, make that feature's dependency graph lazy.

### Heat maps

If the heat-map component belongs to Attendance, it should not be part of the initial Dashboard dependency graph.

---

# 7. Remove Demo Data From the Normal Bundle

The supplied analysis identifies `demoData.json` as a significant static payload.

If demo mode is not part of the normal application path:

```text
normal user
    ↓
do not load demoData

demo user
    ↓
load demoData on demand
```

This is an easy, low-risk reduction.

---

# 8. P1: Extract the Persistent Application Shell

The current `Main.tsx` is doing too many jobs:

- authentication
- storage hydration
- theme handling
- keyboard shortcuts
- command palette setup
- network/reload handling
- logout
- navigation
- modal handling
- feature rendering

Extract the persistent concerns into an application-level provider/shell.

Recommended conceptual structure:

```text
app/
├── layout.tsx
└── (app)/
    ├── layout.tsx
    │
    └── AppProvider
```

The provider should own genuinely global concerns.

Examples:

```text
Global Jotai state
├── authentication
├── student identity
├── settings
├── theme
└── global UI/navigation state
```

The shell can remain mounted while feature routes change.

---

# 9. P1: Convert Feature Tabs Into Real Routes

The current conditional-tab model is the fundamental structural limitation for code splitting.

Conceptually:

```text
activeTab === "attendance"
```

should become something like:

```text
/attendance
```

The proposed one-to-one route mapping from the supplied routing analysis is a good first migration target.

Do not try to perfect the information architecture during this migration.

Start with the existing feature boundaries:

```text
/
 /attendance
 /academics
 /tools
 /hostel
 /cabshare
 /dayscholar
 /transport
 /payments
 /libraries
 /more
 /profile
 /about
```

These can later be consolidated based on actual usage patterns.

---

# 10. Why Real Routes Help

Real routes provide several benefits simultaneously:

### Code splitting

A feature can become an independently loadable module graph.

### Deep linking

Users can directly open a feature.

### Browser history

Back/forward navigation becomes natural.

### Prefetching

Next.js can prefetch likely destinations.

### Offline caching

Service-worker caching can reason about route resources.

### Ownership

Feature code becomes easier to isolate and maintain.

---

# 11. Important: Do Not Create One Jotai Store Per Route

This is the biggest architectural correction to the original idea.

The goal should **not** be:

```text
/attendance → Store A
/academics  → Store B
/tools      → Store C
```

just because there are multiple routes.

Instead:

```text
                    Jotai Provider
                         │
             ┌───────────┼───────────┐
             ↓           ↓           ↓
          Global     Attendance   Academics
           atoms       atoms        atoms
```

The existing atom-level separation is already a useful foundation.

The key optimization is **subscription locality**, not store count.

---

# 12. Optimize Jotai Subscription Locality

The current architecture has `Main` subscribing to a large number of atoms and passing many values down into `Dashboard`.

Prefer:

```text
AppProvider
    ↓
Route
    ↓
Feature
    ↓
useAtomValue(featureAtom)
```

instead of:

```text
Main
    ↓
many atoms
    ↓
many props
    ↓
Dashboard
    ↓
feature
```

For example:

```text
Attendance route
    ├── attendance data atom
    ├── attendance filter atom
    └── attendance UI atom

Academics route
    ├── marks atom
    ├── grades atom
    └── schedule atom
```

This allows unrelated state changes to affect smaller portions of the tree.

---

# 13. When Route-Scoped Providers Actually Make Sense

A route-specific Provider is useful when you explicitly want:

- isolated state
- automatic reset when leaving a route
- independent store lifetime
- separate hydration behavior

It should not be introduced merely because a feature is a route.

For most AmazeCC state:

> **One stable application-level Jotai store + granular atoms is the simpler default.**

Use route/subtree Providers only where their lifetime semantics are genuinely useful.

---

# 14. P1: Centralize Storage Hydration

The supplied startup analysis identifies synchronous `localStorage` reads and `JSON.parse` operations across startup and component render/effect paths.

This should be changed from:

```text
Attendance → localStorage
Calendar → localStorage
Dashboard → localStorage
CourseDashboard → localStorage
...
```

to:

```text
AppProvider
    ↓
single hydration pass
    ↓
Jotai atoms
    ↓
components consume atoms
```

The storage layer should become a persistence mechanism, not a state-access API that components repeatedly invoke.

---

# 15. Do Not Make Centralized Hydration Another Startup Bottleneck

Centralization should not mean:

```text
parse every dataset
    ↓
wait
    ↓
render app
```

Instead use priority levels.

### Priority 0

Immediately available:

- authentication
- student identity
- settings
- essential UI state

### Priority 1

Needed for the visible route:

- dashboard/feature data currently visible

### Priority 2

Likely next destinations:

- attendance
- academics
- schedule

### Priority 3

Rarely used features:

- hostel
- library
- transport
- other secondary data

This gives the user a usable UI much sooner.

---

# 16. P1: Fix the Reload/Login Network Fan-Out

The supplied startup analysis identifies a large number of API requests during reload/login, with the primary path waiting for too much work.

The desired model is:

```text
login/reload
      │
      ├── critical visible-route requests
      │          ↓
      │       render UI
      │
      └── background requests
                 ↓
             populate cache
```

Do not make the user wait for unrelated data.

For example, if the user is entering `/attendance`, attendance data should be prioritized.

Everything else can be refreshed in the background.

---

# 17. Progressive Data Rendering

Avoid:

```text
all data loaded
    ↓
remove spinner
    ↓
show page
```

Prefer:

```text
shell ready
    ↓
cards render
    ↓
primary dataset arrives
    ↓
feature renders
    ↓
secondary datasets arrive
    ↓
enhanced UI appears
```

This improves perceived performance even when absolute network time does not change.

---

# 18. P2: Prefetching Strategy

The idle-prefetch idea is good, but do not immediately download all routes after first paint.

A naive strategy:

```text
first paint
    ↓
idle
    ↓
download all 13 routes
```

can consume bandwidth and CPU for features the user may never open.

Use tiers.

### Tier 1 — likely routes

Immediately after a suitable idle period:

```text
/attendance
/academics
/tools
```

### Tier 2 — secondary routes

Warm them later when the connection/device allows it.

### Tier 3 — intent based

Prefetch when the user:

- hovers over a navigation item
- focuses it
- opens a related menu
- demonstrates clear navigation intent

---

# 19. Make Prefetch Connection-Aware

Aggressive prefetching is excellent on fast Wi-Fi but potentially harmful on constrained networks.

Where practical, take connection information into account.

Conceptually:

```text
fast connection
    → more aggressive warming

slow connection / save-data
    → minimal prefetch
```

The principle is:

> Never trade the current page's performance for speculative future navigation.

---

# 20. P2: Serwist Strategy

Serwist is useful, but it should have a clear responsibility:

```text
Serwist
    ↓
cache application resources/routes/assets
```

while:

```text
Jotai
    ↓
reactive application state

storage/API cache
    ↓
persisted application data
```

These should not be treated as the same cache.

---

# 21. Be Conservative With Navigation Precaching

Do not enable aggressive navigation precaching simply because it sounds like the fastest offline experience.

Start with:

```text
route prefetch
+
runtime caching
+
offline navigation fallback
```

Then measure.

Only add broader navigation precaching if the measured offline/deep-link experience requires it.

The service worker should not turn installation into:

```text
download the entire application
```

---

# 22. Define Offline Correctly

“Offline” requires more than cached JavaScript.

A route needs:

```text
offline route
├── navigation/document response
├── JS/CSS/assets
└── usable data
```

Therefore test all three layers.

A real acceptance test should be:

```text
1. Visit /attendance online
2. Allow route/data to become cached
3. Close the browser
4. Enable airplane mode
5. Directly open /attendance
6. Refresh /attendance
7. Verify cached data is useful
```

Also test:

```text
/dashboard
/academics
/tools
```

independently.

---

# 23. Offline Data Needs Its Own Strategy

Caching a route's JS does not mean the student's data is offline.

The existing localStorage-backed data can provide a useful foundation, but it should be bounded and deliberate.

The desired model is:

```text
cached data
    ↓
render immediately
    ↓
network available?
    │
    ├── yes → background refresh
    │
    └── no  → remain on cached data
```

Avoid blindly persisting every response forever.

The supplied analysis correctly notes the risks of large raw JSON payloads, quota pressure, and lack of TTL/invalidation.

---

# 24. Debounce Large Storage Writes

The supplied analysis identifies tracker-style data as a potential source of repeated `JSON.stringify`/`localStorage` writes.

For data such as:

```text
notesTracker
customHomework
wastedODsTracker
```

prefer:

```text
user changes state
    ↓
update Jotai
    ↓
debounced persistence
```

rather than:

```text
every keystroke
    ↓
JSON.stringify
    ↓
localStorage.setItem
```

This reduces synchronous main-thread work.

---

# 25. `localStorage.clear()` on Logout

This is not a major performance concern because it happens only once per logout.

However, as the cache grows, a namespaced deletion strategy is architecturally cleaner than:

```ts
localStorage.clear()
```

Consider removing only AmazeCC-owned keys.

This avoids accidentally destroying unrelated application data stored by the same origin.

---

# 26. What NOT to Optimize Yet

Do not spend significant engineering time on low-impact micro-optimizations while the following remain:

- 2.4-second artificial startup delay
- ~1.52 MB page chunk
- monolithic `Main.tsx`
- broad startup request fan-out
- synchronous large-cache hydration
- heavy libraries statically reachable from the initial route

Image optimization, tiny atom rewrites, and minor animation changes should come later unless profiling identifies a specific hotspot.

---

# 27. Recommended Migration Sequence

## Phase 0 — Baseline

Record:

```text
Initial JS transferred
Initial JS parsed/evaluated
FCP
LCP
INP/TBT
main-thread time
cold navigation time
warm navigation time
offline navigation
```

Build the production app before measuring.

---

## Phase 1 — P0

Implement:

```text
✓ remove 2.4s timer
✓ remove theme reload
✓ fix cmds memoization
✓ move fonts to next/font
```

Measure again.

---

## Phase 2 — Bundle Proof

Implement:

```text
✓ lazy xlsx
✓ lazy charting
✓ lazy heat-map
✓ lazy export tooling
✓ lazy demo data
✓ inspect remaining heavy modules
```

Measure the home chunk again.

This phase validates the code-splitting hypothesis before the large routing migration.

---

## Phase 3 — App Shell

Extract:

```text
AppProvider
AppShell
Navigation
CommandPalette
global UI
```

Keep global Jotai state here.

---

## Phase 4 — Routes

Convert the existing feature tabs into real routes.

Start with the one-to-one mapping from the current navigation model.

Do not attempt to redesign the entire information architecture simultaneously.

---

## Phase 5 — State Locality

Move feature-specific atom consumption downward.

Target:

```text
route → feature → atom
```

rather than:

```text
Main → 50 props → Dashboard → feature
```

---

## Phase 6 — Progressive Data

Change reload/login from:

```text
fetch everything → wait → render
```

to:

```text
critical fetch → render
background fetch → populate cache
```

---

## Phase 7 — Prefetch

Implement:

```text
likely route prefetch
+
hover/intent prefetch
+
connection-aware throttling
```

Avoid downloading every route immediately.

---

## Phase 8 — Serwist

Implement:

```text
immutable asset caching
runtime route caching
offline navigation fallback
```

Then validate deep-link offline behavior.

---

# 28. Target Architecture

```text
                         AmazeCC
                            │
                    Root Application
                            │
                  ┌─────────┴─────────┐
                  │                   │
              App Shell          Jotai Provider
                  │                   │
       Header / Navigation       Global atoms
       Command Palette           Feature atoms
       Global UI
                  │
                  └─────────┬─────────┘
                            │
                       Next Routes
                            │
        ┌─────────┬─────────┼─────────┬─────────┐
        ↓         ↓         ↓         ↓         ↓
   Attendance  Academics   Tools    Hostel   Library
        │         │         │         │         │
     feature   feature   feature   feature   feature
       atoms     atoms     atoms     atoms     atoms
        │         │         │
        └─────────┴─────────┘
                  │
             route chunks
                  │
          selective prefetch
                  │
             Serwist cache
                  │
          ┌───────┴────────┐
          ↓                ↓
      JS/CSS/assets     route resources
          │
          └───────────────┐
                          ↓
                    Offline shell
                          +
                    persisted data
```

---

# 29. Performance Model

The resulting performance model should be:

```text
                 SPEED
                   │
       ┌───────────┼────────────┐
       ↓           ↓            ↓
    Startup    Navigation     Runtime
       │           │            │
  small bundle  prefetch      granular atoms
  no timer      route cache   fewer rerenders
  fast hydrate  SW cache      less work
       │           │            │
       └───────────┼────────────┘
                   ↓
             perceived speed
```

Each layer solves a different problem.

### Next.js routes

Solve:

> “Why am I downloading code for features I haven't opened?”

### Jotai

Solves:

> “Why does unrelated state cause this feature to rerender?”

### Storage/data cache

Solves:

> “Why do I have to wait for data I've already seen?”

### Serwist

Solves:

> “Why do I need the network for resources I've already downloaded?”

### Prefetch

Solves:

> “Why am I waiting when I click the next feature?”

---

# 30. Acceptance Criteria

Do not define success solely as “the bundle got smaller.”

The refactor should be considered successful when:

## Cold startup

```text
✓ no artificial 2.4s delay
✓ lower initial JS
✓ lower main-thread work
✓ faster FCP/LCP
✓ shell becomes usable immediately
```

## Navigation

```text
✓ feature routes load independently
✓ likely routes can be prefetched
✓ warm navigation is effectively instant
✓ no unnecessary global remount
```

## Runtime

```text
✓ feature state changes do not rerender unrelated features
✓ command palette work is isolated
✓ large derived computations are localized
```

## Data

```text
✓ cached data can render immediately
✓ visible-route data has priority
✓ background APIs do not block first interaction
✓ storage writes are debounced
```

## Offline

```text
✓ previously visited routes can open offline
✓ direct deep links are tested
✓ cached data remains useful offline
✓ service-worker updates do not break existing sessions
```

---

# 31. Final Recommendation

The core idea is correct, but the architectural principle should be:

> **Split the application by feature ownership, not by state ownership.**

AmazeCC should have:

- **one persistent application shell**
- **one stable global Jotai store/provider by default**
- **granular feature atoms**
- **real route boundaries**
- **lazy heavy dependencies**
- **centralized storage hydration**
- **progressive API fetching**
- **selective route prefetching**
- **Serwist for deliberate resource/offline caching**

Avoid:

- one Jotai store per route by default
- waiting for every API before rendering
- precaching every route immediately
- using localStorage directly from many components
- replacing the 2.4-second timer with another global loading barrier
- optimizing low-impact details before fixing the dependency graph

The highest-confidence first move is therefore:

```text
P0 fixes
   ↓
measure
   ↓
lazy-load the heaviest dependencies
   ↓
measure
   ↓
extract AppProvider/AppShell
   ↓
convert tabs → routes
   ↓
localize Jotai subscriptions
   ↓
progressive data fetching
   ↓
selective prefetch
   ↓
Serwist/offline
   ↓
final benchmark
```

This gives AmazeCC a clear path from a monolithic client application to a **small persistent shell + independently loadable feature application**, while retaining the benefits of Jotai and offline support without conflating state management with caching.
