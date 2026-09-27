# Migration Plan

Seven phases. Each is independently shippable and verifiable; none leaves the app in a state where the feature is broken.

---

## Phase 0 — Close the audit gaps (no behaviour change)

| Work | Where |
|---|---|
| Delete the unreferenced 206-line dead copy | `AmazeCC-API/src/lib/socialUtils.ts` |
| Fix `getActiveRegNumber()` — the five-field reg chain and two name spellings | new `src/lib/social/identity.ts` |
| Fix the two other wrong readers | `Main.tsx:2158`, `SocialTab.tsx:56-57` |
| Fix the undefined env var and absolute-URL calls | `socialUtils.ts:514,535` |
| One-time copy-forward from the global `friends_schedules` key, then drop the global mirror | `src/lib/social/storage.ts` |
| Add `SOCIAL_GRANT_SECRET_KEY` to the deployment env; assert it at boot | `AmazeCC-API` |
| Split `ADMIN_SECRET` and `ID_SALT`; rotate both | `AmazeCC-API/.env` |
| ~~Resolve R1 and R2 with the probe~~ **done — see [13-open-questions.md](./13-open-questions.md) §1** | `scripts/vtop-probe.ts` |

**Verify:** `npx tsc --noEmit`, `npx vitest run`, `npx next build --webpack`; API `pnpm lint && pnpm build`. The reg-reader fix alone will start firing the existing POST — which 404s until Phase 1, so either ship Phase 0 and 1 together or hold the reg fix. **They must not be split.**

## Phase 1 — Server derivation — **DONE**

| Work | Where |
|---|---|
| `social_people` / `social_timetables` inline DDL | `AmazeCC-API/src/lib/socialDb.ts` |
| VTOP identity → `owner_key`; semester validated against the scraped list | `AmazeCC-API/src/app/api/social/identity/sync/route.ts` |
| Slot-vocabulary loader, validator and `SLOTMAP_VERSION` | `AmazeCC-API/src/lib/socialVocabulary.ts` |
| Header-name-based timetable parser (the `" - "` split) | `AmazeCC-API/src/lib/socialTimetable.ts` |
| Semester list scrape + resolution | `AmazeCC-API/src/lib/socialSemester.ts` |
| `maskUserID` for `owner_key` | reuses `src/lib/mask.ts` |
| Synced the stale `config.json` | `AmazeCC-API/config.json` |

**Verified** with 25 pure-logic checks and 28 end-to-end checks against a live VTOP session and the real database: `400` on missing credentials, `422` on an un-offered semester, `200` on the happy path, 32 valid `(day, slotId)` keys, 13 course components across 9 codes, real course codes, disjoint `category`/`componentType` vocabularies, `classId` prefix self-check, no reg-number echo, and `version` incrementing on republish with a stable handle.

**Two bugs this phase caught:**
- The `Category` column is a course taxonomy, not a component type. Fixed by splitting `category` from `componentType`.
- The server's `config.json` had silently drifted from the frontend's. Synced, and now read through one module with a version hash.

**Verify:** the probe output, then a `curl` against a local dev server with real credentials, asserting a stored row with a plausible busy map.

**Gate: satisfied.** R1 and R2 were resolved against live VTOP. The parser must nevertheless be written against the *verified* format — `Slot/ Venue` is `"<slots> - <venue>"`, not `"<slots> / <venue>"`, and the course code and component type are explicit in the `Course` cell rather than synthesised. See [05-server-derivation.md](./05-server-derivation.md) §2.

## Phase 2 — Grants and pairing

`social_grants` DDL, secret minting, the read route, revoke, visibility. The mutual-pairing invariant (`least`/`greatest` + `UNIQUE`) lands here.

**Verify:** pair two accounts, read both directions, revoke, confirm both directions die. Attempt a read with a valid secret for the wrong target — expect `403 not_a_participant`. **Done**, using a synthetic second student rather than a real account, since a live pairing needs two real students. All synthetic rows were removed afterwards.

**Status: implemented and verified.** Routes: `pair/claim`, `timetable`, `grant/revoke`, `grant/visibility`, `people`, `semester`. Libraries: `socialGrantSecret`, `socialGrantLogic`, `socialGrants`, `socialCaller`.

Two design corrections were made during implementation, both recorded in [06-grants-and-pairing.md](./06-grants-and-pairing.md) §1a:

- The secret is stored as `secret_hash` **and** `secret_enc` (AES-256-GCM), not hash-only. Hash-only made mutual pairing impossible, because the non-claiming partner could never be given the secret.
- Re-pairing after a revoke reactivates the single row for the pair instead of inserting a second one, so `UNIQUE (owner_a, owner_b)` stays honest and the old secret is overwritten rather than merely shadowed. This one was caught by the E2E, not by review.

## Phase 3 — Client sync op ✅

The `social` op, `OP_LABELS` entry, **both** `Main.tsx` chains, the atoms, `useSocialData`, the debounced push. Client-side storage keys.

**Status: implemented and verified.** `registerOp({ name: "social" })` in
`operations.ts`, `OP_LABELS.social = "Friends & groups"`, chain 1 (`Main.tsx:531`)
and chain 2 (`Main.tsx:824`), `src/store/socialAtoms.ts`,
`src/lib/social/useSocialData.ts`, and the grant/identity/timetable-cache keys in
`src/lib/social/storage.ts`.

Three things worth recording, because each is a trap rather than a task:

- **The op must never throw.** Both chains `await` ops sequentially inside one
  `try`, so a throw would skip `buses` and `bulk` in chain 1. It returns `null` on
  every failure path and records the reason in `socialSyncStateAtom.lastError`
  instead, so a failed push never reads as "you have no friends". Asserted in
  `social-sync-op.test.ts`, not left to review.
- **The demo guard needs `demoMode` in `args`, not just the username check.**
  `credential-manager.ts:71-73` hands back `authorizedID: "DEMO123"` for *any*
  username when `demoMode` is set, so checking `ids.VtopUsername === "demo"` alone
  lets a real-username demo run 401 and put a bogus failure in the sheet.
- **The two chains disagree on the semester variable's name** (`currSemesterID` vs
  `activeSem`), so the op accepts `proposedSemesterId`, `semesterId` and `activeSem`
  rather than silently reading the wrong one.

`vitest.config.ts` gained the `@/` alias, which it never had — without it no module
importing through the alias could be tested at all, so the new code was untestable
by construction.

**Verify:** the global Sync button shows "Friends & groups" and its line goes
green — covered by a unit test on the label. The cross-repo contract is verified
against the live API by `scripts/verify-client-contract.mts`, which asserts the real
`identity/sync` response has exactly the keys `SocialSyncPayload` declares and no
others. The device-A/device-B round trip still needs two real accounts and is the
one item here that is not yet done.

## Phase 4 — Comparison ✅

`src/lib/social/schedule.ts` with `buildBusyMap`, `computeOverlap`, and one `toMinutes`. Collapse the three existing time parsers onto it.

**Status: implemented and verified.** 64 new tests. The fabricated figure is gone:
`SocialTab` no longer computes `70 + (seed % 25)` from a character hash.

What the collapse found, which is the actual value of doing it:

- The three parsers (`CommonFreeSlotsGrid`, `attendance/TimetableGrid`,
  `attendanceTimetable`) differed at exactly one input, `h === 0`, and
  `config.json` has no hour below 1 — so they agreed **by coincidence**, not by
  design. Verified mechanically across all 164 slots; the equivalence is now a
  test, so a vocabulary edit that breaks it fails loudly.
- **The doc's own `computeOverlap` pseudocode was broken twice.** It iterated the
  union of the two busy maps, so the "neither is busy" branch was unreachable
  and `commonFreeSlots` was permanently 0; and it divided a free-slot count by a
  busy-slot count, which can exceed 100%. Both corrected in §7 of
  [09-schedule-math.md](./09-schedule-math.md), which now carries the shipped
  implementation.
- **Collapsing `getTodayAttendanceDay` introduced a real off-by-one**, caught by
  the existing `attendanceTimetable.test.ts`: `DAYS` is MON-first (it mirrors
  `config.slotMap`'s key order) while `Date.getDay()` is 0=Sunday, so indexing
  one with the other shifted every day. `dayKeyForDate` owns that mapping now.
- **The day-blind friend grid is fixed.** `CommonFreeSlotsGrid` ignored
  `slot.day` and re-fanned each `slotId` across all seven days, so a legacy
  friend with `{ day: "MON", slotId: "A1" }` showed busy on Monday *and* Wednesday
  — which is every theory block. `busyMapFromClassSlots` respects the day.

**Verify:** unit tests plus a manual pass where a known conflict is confirmed to
register as a conflict. The manual pass is now a test
("a known conflict registers as a conflict"): two VTOP-shaped timetables with a
conflict planted in a known slot, asserting an identical week scores 0% and full
shared hours, a one-slot overlap scores 83%, and a peer in a different block
scores 100%.

**One presentation trap is guarded explicitly.** A peer with no shared timetable
makes every one of my slots clash-free, which the formula reports as a 100% match
— arithmetically correct and completely misleading. `SocialTab` checks
`classSlots.length === 0` first and renders "no timetable shared yet". Both halves
are pinned by tests, so the guard cannot be quietly dropped.

## Phase 5 — UI ✅

Token module, then landing + 4 subpages, then the grid, then the modals. [11-ui-redesign.md](./11-ui-redesign.md).

**Status: implemented.** `SocialTab.tsx` 832 → 417 lines, with 10 new extracted
components: `rows.tsx`, `PeopleSubpage`, `PairsSubpage`, `FreeNowSubpage`,
`CommonFreeGridSubpage`, `ShareHandleSheet`, `AddPeerSheet`, `PeerTimetableSheet`,
plus the rewritten `CommonFreeSlotsGrid`. 762 lines of superseded modals deleted
(`AddFriendModal`, `AddGroupModal`, `FriendTimetableModal`, `ShareScheduleModal`),
all confirmed unreferenced first.

The token promotion in §2 of the UI doc had **already happened** — `uiTokens.ts`
exists and `libraries/ui.ts` is already a re-export shim. Only the two new tokens
were missing: `TILE_INTERACTIVE` and `SEARCH_FIELD`, both added.

### Deviations from the plan, and why

- **No `PairPeerSheet`; groups are gone.** The plan assumed groups survive as a
  client-side view over the grant list. Now that pairings live on the server, a
  second client-side grouping would be a second source of truth that can disagree
  with the first, so `PairsSubpage` lists grants directly. If grouping is wanted
  it should be *derived* from that list, not stored beside it.
- **`CommonFreeGridSubpage` instead of `CommonFreeSlotsSheet`.** The UI doc §5
  lists Common Free Grid as a *subpage* and only mentions de-nesting the sheet, so
  the subpage won.
- **`CommonFreeSlotsModal` is kept, not deleted.** `AttendanceTabs.tsx` uses it
  for the Dashboard's own friends list, which is still on the legacy model. Rather
  than keep the old grid alive, the modal now adapts `Friend[]` → the new
  `GridPeer[]` and the Dashboard picks up the day-aware fix for free.

### The bug the grid tests caught

The 7 × 12 projection initially indexed each day's slots by **time string alone**.
But a theory slot and its paired lab run at the same time on the same day — Monday
has both `A1` and `L1` at 08:00–08:50 — so both halves of a pair resolved to the
same slot. The grid rendered **168 cells for 164 slots**, duplicating six pairs and
dropping six slots entirely. Fixed by keying the index on time *and* half, using the
`L` prefix. `src/__tests__/social-grid.test.ts` now pins the 164-slot coverage.

**Verify:** tsc clean, lint clean, production build compiles, 278 tests pass
(12 new for the projection and row helpers).

## Phase 6 — Legacy retirement

**Do not start before one full semester has passed.** See below.

---

## Legacy data

The existing `Friend[]` in `localStorage` cannot become a server record:

- its `classSlots[]` carries **no `semesterId`**, so it cannot be attributed to a term
- it was uploaded by the *other* person's device, so the server has never verified it
- the old `id` is a raw registration number, which is exactly what the new model refuses to accept from a client

So it is **migrated to `social_legacy_v1`, rendered read-only, with a re-share prompt**, and never silently guessed at. Assuming the viewer's current semester was rejected: it would produce rows that look authoritative and may be two terms wrong, which is worse than an honest "re-share needed".

The old list is never deleted during the window. A student who re-paired sees their server peers first and the legacy entries below, labelled.

## v5/v6 codec deprecation

Server derivation makes the codec obsolete for timetable transfer — the handle replaces it. The timeline:

| When | Action |
|---|---|
| Phase 3 | Stop **emitting** v5/v6. The share sheet now offers only the handle |
| Phase 3+ | Keep **importing** `v6\|` so codes already in the wild still resolve. The v6 branch is ~55 lines and imports cleanly, so keeping it is cheap |
| Phase 6, one semester later | Delete `exportScheduleCode`, `compressScheduleCode`, `decompressScheduleCode`, `exportShareableLink` and the v1/v2/v3/`amz-profile-` branches — about 316 lines |

Codes in the wild are expiring anyway: `v6` carries an absolute expiry and the "permanent" option emits a `v5` code (`ShareScheduleModal.tsx:180` → `expiryMinutes: 0` falls through to the v5 branch), which is a separate pre-existing bug worth fixing before it is deleted along with everything else.

## Ordering constraints

1. **Phase 0 and 1 ship together.** Fixing the reg reader starts the POST; without the route that is 404 noise on every mutation.
2. **Phases 1 and 2 are independent** and can be developed in parallel, but the UI cannot ship until both are done.
3. **Phase 4 must precede Phase 5's People subpage**, or the redesigned rows would display the fabricated metrics in new typography.
4. **Phase 6 is gated on a semester boundary**, not a date. Deleting the codec while a v5 code is still in someone's chat history means a support issue with no fix.

## Rollback

| Phase | Rollback |
|---|---|
| 0 | Revert the reg fix. Nothing user-visible depends on it yet |
| 1 | Route deleted; the app falls back to local-only, which is today's behaviour |
| 2 | Route deleted; unused tables remain harmless |
| 3 | Op removed from both chains; local-only |
| 4 | Revert to local-only comparison. **Note:** the old figures were fabricated, so a rollback restores a visible lie rather than a correct one |
| 5 | Old UI restored from git |
| 6 | Irreversible — the legacy key is kept until the end of Phase 6 |

Every phase through 5 degrades to "local-only sharing", which is exactly today's behaviour. That is the safety property worth protecting: no phase can leave a student worse off than they were.

## What can go wrong

| Risk | Likelihood | Mitigation |
|---|---|---|
| A `config.json` slot edit orphans stored keys | Low | `slotmap_version` + the vocabulary assertions in the test suite + a migration script |
| VTOP changes the timetable page layout | Medium | Parse by header name and record which header matched, so a change surfaces as a mismatch rather than silent garbage |
| The campus-wide semester model is wrong | Low | Table is keyed `(owner_key, semester_id)`; no migration needed if it turns out per-cohort |
| A peer stops opening the app | **Certain** | Inherent. Staleness badge plus a nudge; the only real fix is storing sessions, which was rejected |
| `ID_SALT` is rotated and orphans every row | Low | Documented as irreversible; take a DB snapshot before any rotation |
