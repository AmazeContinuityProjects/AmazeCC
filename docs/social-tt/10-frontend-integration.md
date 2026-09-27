# Frontend Integration

How the client stores, syncs, and computes — and the specific traps in the existing sync engine.

---

## 1. New modules

```
src/lib/social/
  types.ts        shared shapes (mirrored from ../AmazeCC-API/src/lib/socialTypes.ts)
  identity.ts     getActiveRegNumber() with the five-field fallback chain
  schedule.ts     toMinutes, fmt, DAYS, slotMap access, buildBusyMap, computeOverlap
  storage.ts      namespaced localStorage with no global mirror
  client.ts       api() calls for the routes in 07-api-contract.md
  useSocialData.ts  shared atom-backed state + the debounced push
src/store/socialAtoms.ts
  socialIdentityAtom, socialPeersAtom, socialGrantsAtom,
  socialOwnBusyMapAtom, socialOwnCoursesAtom, socialSyncStateAtom
```

Note the path: the hook lives in `src/lib/social/`, not `src/hooks/`. This repo
has no `src/hooks/` directory, and a hook inside a `lib/` folder is the existing
convention — `useSync.ts` sits in `src/lib/sync-engine/`. The one place hooks do
live is `src/components/custom/**/hooks/`, which is scoped to a single feature's
components and so does not fit a cross-tab store.

`computeOverlap` and `buildBusyMap` live here so the Social tab, the home page and `CommonFreeSlotsGrid` all use one implementation. There are currently **three** time parsers in the app (`CommonFreeSlotsGrid.tsx:17`, `TimetableGrid.tsx:64`, `attendanceTimetable.ts:8`) that agree only by coincidence — they are collapsed onto this one.

## 2. Sync engine integration

### Register the op

```ts
// src/lib/sync-engine/operations.ts
registerOp({
  name: "social",
  auth: "vtop",
  async run(ctx) {
    // Demo mode: loginToVTOP returns DEMO123 and there is no real session.
    if (ctx.ids.VtopUsername === "demo") return null;

    try {
      const res = await ctx.request("social/identity/sync", {
        proposedSemesterId: settings.currSemesterID,
      }, { auth: "vtop", retry: { max: 1 } });

      persistSocialIdentity(res.identity);
      persistGrants(res.grantSecrets);
      cacheTimetable(res.identity.ownerKey, res.semesterId, res);

      ctx.bridge.setAtom(socialIdentityAtom, res.identity);
      ctx.bridge.setAtom(socialPeersAtom, res.peers);
      return res;
    } catch {
      return null;   // keep the cache; never clear a good record on failure
    }
  },
});
```

Bailing to `null` rather than throwing is the `officialOd` pattern (`operations.ts:134-153`). A social failure must not put a red line in the sync sheet for a feature the user did not ask about — but it also must not abort the chain it is sitting in.

### Add the label

```ts
// src/lib/sync-engine/sync-session.ts, in OP_LABELS
social: { label: "Friends & groups", delta: 5 },
```

Without this the sheet prints the raw op name.

### Add it to **both** hardcoded chains

This is the step that is easy to get wrong, because the obvious place to add an op does nothing:

- `Main.tsx:519-541` — the fresh-login background chain
- `Main.tsx:796-870` — the reload background IIFE, next to the `officialOd` precedent at `:831-835`

`BACKGROUND_OPS` in `index.ts:18` feeds `syncEngine.syncAll()`, and `syncAll` plus the `useSync` hook are **dead code** — nothing in `src/` imports `useSync`. Updating `BACKGROUND_OPS` alone would make the global Sync button silently never sync social.
### Debounced auto-push

Mutations write local state immediately, mark dirty, and schedule a push:

```ts
const schedulePublish = debounce(() => { void syncEngine.sync("social"); }, 5000);
```

This replaces the current behaviour where every single add/remove/toggle fired a
**full cloud round trip** — `SocialTab.tsx:190` uploaded the entire friends array to
flip one boolean.

The shipped version (`useSocialData.ts`) is a module-level timer rather than a
per-component one, for two reasons: the timer has to survive the component that
scheduled it unmounting, and if a push is already running when the timer fires the
next one is **chained behind it** rather than dropped — otherwise a change made
during a slow push would never reach the server. A rejected push is swallowed
there, because `schedulePublish` is fire-and-forget and the failure is already
recorded in `socialSyncStateAtom.lastError`.
### The double mount

`SocialTab` is mounted by both `MoreTab.tsx:33` and `ToolsTab.tsx:134`, so there are two independent copies of the state and the sub-tab resets when switching between them. `useSocialData()` gives both mounts the same atom-backed state.

**Scope note.** `useSocialData` currently backs the *server-derived* state — the
handle, the peer list, the grant secrets, the user's own busy map. The legacy
`Friend[]`/`FriendGroup[]` lists still live in `SocialTab`'s local `useState`,
because they are local-only records with no server equivalent until Phase 6
retires them. Migrating them to atoms without changing their semantics would be
churn; the redesigned People subpage in Phase 5 replaces them outright.

## 3. `ctx.request` vs `api`

**Correction from the original draft of this document:** it said the timetable read
"needs a query string, so it goes through `apiRequest`". That is no longer true. The
read was changed to `POST` with the grant secret in the **body** (see
[07-api-contract.md](./07-api-contract.md)) precisely because a bearer credential in
a query string ends up in access logs, browser history and `Referer` headers. With
no query string, `ctx.request` is usable everywhere.

So the split is:

| Call | Transport | Why |
|---|---|---|
| `identity/sync` (the push) | `ctx.request` | gets retry + in-flight dedupe |
| `timetable`, `pair/claim`, `people`, `grant/*` | `api` | one-shot user actions; no retry wanted |
| `semester` | `api` | `GET`, no credentials |

`client.ts` uses `api` throughout because it is also called from the debounced
auto-push, outside the sync engine. The op itself uses `ctx.request` directly.

Two real traps in this area, both hit during implementation:

- **`strictNullChecks` is off in this repo.** `atom<T | null>(null)` resolves to
  jotai's *read-function* overload and yields a **read-only** atom. `socialAtoms.ts`
  uses the `null as unknown as T` cast for the same reason `dataAtoms.ts:16-21` does.
- **`stateBridge.setAtom` takes `unknown`.** A mismatched atom/value pair is
  neither a compile error nor a runtime error — it is a silent no-op. The op writes
  each atom explicitly rather than in a loop so a rename fails loudly in review.
- **`vitest.config.ts` had no `@/` alias**, so no module importing through the
  alias could be tested at all. It now mirrors `tsconfig.json`.

## 4. Storage

`socialUtils.ts` bypasses `src/lib/storage.ts` entirely, writes `localStorage` raw, and duplicates every write to a **global mirror key**:

```ts
// socialUtils.ts:595-597
const key = reg ? `friends_schedules_${reg}` : "friends_schedules";
localStorage.setItem(key, JSON.stringify(friends));
localStorage.setItem("friends_schedules", JSON.stringify(friends));   // ← leak
```

That mirror hands the last-touched student's friends to any other account on the same browser, and `getFriends()` with no active reg returns it. `src/lib/storage.ts:43-44` declares `FRIENDS_SCHEDULES`/`FRIENDS_GROUPS` with typed accessors at `:296-305` that `socialUtils` never uses — two sources of truth, and no accessor for the `_${reg}` variants at all.

New keys, going through `storage.ts` with a per-user namespace and **no global mirror**:

| Key | Contents | Cache? |
|---|---|---|
| `social_identity_v1` | `SocialIdentity` | yes |
| `social_grants_v1` | `SocialGrant[]` **including secrets** | **no — the only copy** |
| `social_timetables_v1` | `Record<"ownerKey:semesterId", SocialTimetable>` | yes |
| `social_peers_v1` | `SocialPeer[]` | yes |
| `social_legacy_v1` | old `Friend[]`, read-only during deprecation | no |

`social_grants_v1` is the one piece of genuinely non-recoverable client state: the server keeps only hashes, so losing this file means re-pairing with everyone. It is written through `storage.ts` (so `clearAllData` treats it deliberately) and excluded from any "wipe cache" action.

Also fixed while here: `saveFriend` and friends have **no SSR guard**, unlike the getters, so they would throw in a server component. All new storage helpers guard.

## 5. The identity bug, and the copy-forward migration

`getActiveUserRegNumber()` returns `""` today, which is why the sync POST never fires. Three separate readers are wrong:

| Location | Reads | Correct field |
|---|---|---|
| `Main.tsx:2158` | `p?.regNo` | `registerNo` |
| `socialUtils.ts:494` | `parsed?.regNumber` | `registerNo` |
| `SocialTab.tsx:56-57` | `attendanceData?.studentInfo?.regNumber` | `registerNo` — and `attendanceRes` has no `studentInfo` at all |

The live shape comes from `/api/student` → `parseStudentProfile` and uses `registerNo` + `name`. The demo shape in `src/data/demoData.json` uses `registerNumber` + `studentName`. `getActiveRegNumber()` tries all five reg spellings and both name spellings.

**One-time migration.** Because the reg always resolved to `"VIT Student"`, everyone's friends were written to the bare `friends_schedules` key. Once a real reg resolves, the namespaced key is empty and the list would appear to vanish. The getters already fall back to the global key (`socialUtils.ts:577`), so nothing is lost — but on first successful derivation the global key is copied forward to the namespaced one, once, and the global mirror is then dropped.

## 6. Comparison replaces fabrication

`SocialTab.tsx:230-240`:

```ts
const totalPossibleSlots = 35;                                    // vocabulary has 164
const seed = (friend.id || friend.name).split("").reduce((a, c) => a + c.charCodeAt(0), 0);
const overlapPct = Math.min(96, Math.max(62, 70 + (seed % 25)));   // 62–96%, from a hash
const commonFreeHours = Math.max(3, Math.min(16, totalPossibleSlots - friendSlotCount - 5));
```

Both figures are derived from a character sum. Replaced by `computeOverlap` over two real busy maps — see [09-schedule-math.md](./09-schedule-math.md) §7. The friend row then shows real common-free slots, and a zero is rendered as `—` rather than a fabricated 70%.

## 7. UI defects fixed in passing

- **Invalid nesting.** `SocialTab.tsx:596-645` puts `<span role="button">` inside a `<button>`. The friend row becomes a `<div>` with an inner `<button>` as the main tap target, matching the pattern already used in `AttendanceSubpage.tsx`.
- **8 `alert()` and 2 `confirm()`** → inline validation and a confirm `BottomSheet`.
- **Four non-existent utility classes.** `shadow-2xs` is not defined in this project (it appears in 20+ files, so it is repo-wide, not Social-specific). `no-scrollbar` and `scrollbar-none` are dead — the working class is `hide-scrollbar`, defined in `amazeui/tailwind.css:163-169`. `animate-slideUp` is a typo for the real `animate-slide-up` (`globals.css:205-207`).
- **Four names for one view.** "Common Free Grid Matrix" (help copy), "Common Free Grid" (button), "Common Free Slots Matrix" (panel), "Common Free Hours Matrix" (grid) → all become **Common Free Grid**.
- **The search counter says "friends" on the Groups tab** (`SocialTab.tsx:546-548` renders `filteredFriends.length` regardless of `activeSubTab`).
- **Demo "Load Demo Data" lies.** `SocialTab.tsx:576-583` writes only to `useState`, so a refresh wipes it while the UI implies friends were added. It is now either persisted or clearly labelled as a preview.
- **Seven near-identical empty states**, none matching the house `EMPTY_STATE` token → one.

## 8. Tests

`src/__tests__/social.test.ts`:

- `computeOverlap` — empty, identical, disjoint, single-slot, unknown-key-skip, `matchPct` denominator
- `buildBusyMap` — fan-out across the 24 ambiguous ids, `+` splitting, empty/missing `slotVenue`, ≤164 keys
- `getActiveRegNumber` — live shape, demo shape, all five spellings, absent
- `toMinutes` — the 1–7 PM heuristic against every `config.json` value
- `normalizeVisibility` — coarse strips `c`/`t`/`v`, full retains them
- vocabulary assertions: 164 keys, 24 ids on more than one day, `A1` at 8:00 on MON and 8:55 on WED

The vocabulary assertions are deliberately not snapshots. A `config.json` change is legitimate; a change that breaks the count or reintroduces a day-scoped-id collision is not, and those three assertions are what make the difference loud.
