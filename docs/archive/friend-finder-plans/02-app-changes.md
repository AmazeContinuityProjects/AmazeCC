---
title: "App changes (AmazeCC)"
---

> ⚠️ **ARCHIVED — historical context, not authoritative.**
> This file was moved to `docs/archive/` during the handoff docs rebuild. It may describe
> a previous architecture. If it contradicts the code in `src/` or the live `docs/`, the code wins.
> See `docs/index.md` for current documentation.

# App changes (AmazeCC)

## 1. Client lib — `src/lib/ffcsClassmates.ts`

1. **Requests:** drop the planned variant (`:71`) —
   `publish` becomes `{ op: "publish"; source: "registered"; discoverable?: boolean }`.
2. **Remove planned helpers:** `planClassIds` (`:152-167`) and the
   `attachReportClassIds` import (`:20`) go with it, plus their cases in
   `ffcsClassmates.test.ts`.
3. **Types:** `ClassmateOverlap` (`:45-50`) += `regNo?: string` (optional —
   tolerant of an API that hasn't deployed yet; the sheet falls back to the
   handle until then).
4. **Errors:** `ERROR_MESSAGES` (`:77-96`) +=
   `planned_sharing_disabled: "Only VTOP-verified timetables can be shared."`
5. **Refresh event** (decision D5), mirroring `GLOBAL_SEMESTER_CHANGE_EVENT`
   (`ffcsReports.ts:111`) and its broadcaster (`:200-214` — SSR guard,
   `try/catch`):

   ```ts
   export const FRIEND_FINDER_REFRESH_EVENT = "amaze_friend_finder_refresh";
   export function broadcastFriendFinderRefresh(): void {
     /* window.dispatchEvent(new CustomEvent(...)) */
   }
   ```

## 2. New tab component — `src/components/custom/friendfinder/FriendFinderTab.tsx`

Extracted from `FFCSClassmatesSection.tsx` (which is then deleted — tests
migrated). **Props: none.** The old props `timetables` / `activeTimetableId` /
`reportCourses` existed only for planned publishing; registered-only needs none.
`semesterId` is derived internally: `getSelectedFinalSemesterId()`
(`ffcsReports.ts:163-179`, reads localStorage `settings` itself — MoreTab has
no settings, so prop-drilling is not an option) → `classmatesSemester()`
(`ffcsClassmates.ts:140-144`).

Structure:

- **Header + back**: `friend_finder_source` localStorage key set to `"home"`
  by the entry button, consumed like `FacultyScheduleTab.tsx:150,260-274`
  (`openedFromHome` → back returns to home). Back label: "Back".
- **Join card**: registered-only picker ("My registered timetable — read from
  VTOP after registration. Others see you as verified."), visibility switch,
  status tiles, Change/Refresh/Invite/Remove — adapted from
  `FFCSClassmatesSection.tsx:585-681`. The planned picker (`:505-549`) is
  dropped (D1).
- **Segmented control: Classes | Friends** (requirement 5). Persist the choice
  in component state only.
  - **Classes** → `sections[]` as cards (reuse/adapt `SectionCard`,
    `:221-235`): faculty, code/title/type, slot/room, "N classmates" badge
    (`people.length`, D4) → click = class subpage.
  - **Friends** → `overlaps[]` rows: name, "N shared classes", identical
    badge, reg no when present → click = **friend bottom sheet**.
- **Friend bottom sheet** (`BottomSheet`, `overlayId="friend-sheet"`): friend
  name, **reg no** (fallback: handle, until API ships `regNo`), "N classes in
  common", then one row per `sharedClassIds` entry → click closes the sheet
  and opens that class's subpage. Every shared class is a caller's own section,
  so it resolves against `sections[]` (D6).
- **Class subpage** (drill-in, `selectedClassId` state, back button):
  - Faculty name + **Faculty reviews** button → `useFacultyReviewSheet`
    (`exams/FFCS/hooks/useFacultyReviewSheet.ts:5-24`, target
    `{name: offering.faculty, courseCode: offering.code}`) +
    `FacultyReviewSheet` (existing BottomSheet).
  - Subject details from `offering`: code, title, type, credits, slot, room.
  - "N classmates here" + the names list (`people`).
- **Gating**: `canUse = isLoggedIn && !isDemo && Boolean(semesterId)`
  (was `:257-260`; `vtopSemester` replaced by derived semesterId). Guest CTA
  → `router.push("/?signin=1&open=friend-finder")` (D7 — **not**
  `prepareSignIn`). Unsupported-semester copy kept.
- **Data**: `callClassmates(semesterId, {op:"get"})` on mount when `canUse`;
  listener for `FRIEND_FINDER_REFRESH_EVENT` →
  `me.joined ? publish(registered) : get`, errors swallowed silently (the next
  manual refresh recovers). Publish/visibility/leave ops as today.

## 3. Tab registration (mirrors `free-class` / `faculty-schedule`)

| File                                       | Change                                                                                                                                                  |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `header/NavigationTabs.tsx`                | icon+label map `:346-348`; tab entry `:559-572` style; secondary map `:741-755`; gating list `:1467-1468` — add `friend-finder` alongside both siblings |
| `dashboard/DashboardUtilityRoutes.tsx`     | `<DashboardRoute route="friend-finder">` at `:123-128` pattern → render `FriendFinderTab` (check `route` prop typing if it's a union)                   |
| `lib/sectionHome.ts`                       | `SINGLE_SCREEN_TABS` (`:34-45`) += `"friend-finder"`                                                                                                    |
| `app/useAppCommands.tsx` _(optional)_      | command-palette entry next to `:669,:679`                                                                                                               |
| `header/AppLibraryPortal.tsx` _(optional)_ | list entry next to `:893-894`                                                                                                                           |

`activeTabAtom` is `atom<string>` (`uiAtoms.ts:3`) — no union change needed.

## 4. Home entry — `mobile/SimplifiedMobileHome.tsx`

Quick-tools grid (`:2201-2238`) gains a **"Find Classmates"** button:

```tsx
className="... sm:col-span-2"   // grid is grid-cols-1 sm:grid-cols-2 (:2202);
                                // bare col-span-2 would add an implicit mobile
                                // column — precedent :2221, :2233
onClick={() => {
  try { localStorage.setItem("friend_finder_source", "home"); } catch {}
  setActiveTab("friend-finder");
}}
```

`setActiveTab` is already a prop — **no prop threading** (the More sub-tab
option's `setActiveMoreSubTab` concern is moot under D2). No changes needed in
`AmazeOnboardingFlow.tsx:495-517`.

## 5. Deep links & sign-in round trip (council blocker 2, resolved per D7)

1. **Consumer in `Main.tsx`**, next to the existing `takeSignInReturn()`
   handling: read `open` from `location.search`; on `open=friend-finder` →
   `setActiveTab("friend-finder")` + strip via `history.replaceState`.
   Covers: `/?signin=1&open=friend-finder` (post-login — `HomeEntryController`
   `:83-91` deletes only `signin`, preserving `open`) and bare
   `/?open=friend-finder` (share links, cold loads).
2. **`signInReturn.ts` untouched** — `prepareSignIn` stays for the standalone
   planner (`FFCSPageView.tsx:72`); `ALLOWED_PREFIXES = ["/ffcs"]` remains
   correct; `signInReturn.test.ts` stays green by design (rationale recorded,
   not skipped).
3. **Legacy `/ffcs/?open=classmates`** — the effect at
   `FFCSTimetableTab.tsx:641-651` stops opening the planner's friends manager
   and instead redirects: strip the param, `router.replace("/?open=friend-finder")`.
4. **`TimetableShareCard.tsx:153-165`** row → `/?open=friend-finder` (was
   `/ffcs/?open=classmates`); update its copy to "See who shares your classes".
5. `CLASSMATES_PATH` (was `FFCSClassmatesSection.tsx:76`) →
   `"/?open=friend-finder"` in the new tab; the copy-link button copies it.

## 6. Planner surgery — `FFCSTimetableTab.tsx` (council blocker 3, split list)

**REMOVE (classmates-only):**

- `?open=classmates` listener `:641-651` → redirect (§5.3);
- header "Find classmates" button `:2324-2342`;
- `friendsStartSection` values of `"classmates"` (`:640`, `:649-653`).

**KEEP (friends manager — out of scope, decision D8):**

- friends/friendGroups state + persistence `:632-640`, `:819-822`, `:1005-1009`;
- friends-manager early return `:2116-2140`;
- `f`-key opening the manager `:2029-2053`;
- toolbar "Friends" button `:2659` and `onOpenFriendsManager` `:3079`;
- social matrix/scoring consumers `:1925-1957`, `:2152-2154`, `:3070-3075`.

**`FFCSFriendsSubpage.tsx` — keep the file, remove only `classmates`:**

- hub row that navigates to classmates (`:81-89` region);
- `SECTION_META.classmates` `:63-66`;
- `"classmates"` from `FriendsSection` (`:60`) and `initialSection`
  (`:134,:151,:154`);
- `FFCSClassmatesSection` dynamic import (`:58`) and render (`:445-452`).
- Keep `hub`/`add`/`friends`/`groups` and `friendsStartSection` as-is.

**`FFCSClassmatesSection.tsx`**: source of the extraction → delete after
`FriendFinderTab` exists and tests are migrated (no dead duplicate).

## 7. Quick-sync refresh (requirement 4, decision D5)

Dispatch `broadcastFriendFinderRefresh()` at every successful sync exit in
`app/useAppDataActions.ts`:

- quick branch success `:441-462` — just before `closeSyncSession()` `:453`;
- generic (focused/custom) modes success `:467-505` — near `:496`;
- balanced/full "primary data ready" path `:639-650` (same helper).

One-line call each, with a comment pointing at D5. No sync op added;
`RETIRED_OPS` (`sync-modes.ts:295`) untouched. Listener lives in
`FriendFinderTab` (§2) — mounted only, one call per event, well inside the
API's 30 req/min/IP limit.

## 8. Tests (named)

| Test                                    | Change                                                                                                                                                                                   |
| --------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ffcsClassmates.render.test.tsx`        | rewrite as `FriendFinderTab` renders: gating (incl. guest CTA → `/?signin=1&open=friend-finder` at `:136`), registered-only publish, both groupings, sheet, class subpage, event refresh |
| `ffcsClassmates.test.ts`                | drop `planClassIds` cases; add `regNo` parsing, `planned_sharing_disabled` message, registered-only request shape                                                                        |
| `timetableShareCard.render.test.tsx:63` | regex `/^\/ffcs\/?\?open=classmates$/` → `/?open=friend-finder`                                                                                                                          |
| `signInReturn.test.ts`                  | **unchanged** (mechanism retained for the planner — D7)                                                                                                                                  |
| `ffcsFriendsSubpage.render.test.tsx`    | update: drop classmates assertions, keep the 8 manager tests                                                                                                                             |
| new: home quick-tool button             | pattern `simplifiedMobileHome.desktop.test.tsx` — button present, sets `friend_finder_source`, `setActiveTab("friend-finder")`                                                           |
| new: tab routing + `open` consumer      | `DashboardUtilityRoutes`/`sectionHome` registration; `Main` consumes `open=friend-finder` and strips it                                                                                  |

## 9. Executor reminders

- Read `node_modules/next/dist/docs/` (per `AGENTS.md`) before writing any
  Next.js code — this repo's Next version may not match training data.
- Static export: no server components doing data fetches, no API routes added
  in this repo.
- Docs to touch in Phase 4: `docs/ffcs-friend-finder/index.md` (`:4` entry
  point, `:48` privacy line, verified-only + sync sections),
  `FEATURES.md` if it lists the finder.
