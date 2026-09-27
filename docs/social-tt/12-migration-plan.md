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

## Phase 1 — Server derivation

| Work | Where |
|---|---|
| `social_people` / `social_timetables` inline DDL | `AmazeCC-API/src/app/api/social/identity/sync/route.ts` |
| VTOP identity → `owner_key`; semester resolution with the selected-then-validated fallback | same |
| Slot-vocabulary validator over `config.json` | `AmazeCC-API/src/lib/socialVocabulary.ts` |
| Header-name-based timetable parser (not index-based) | `AmazeCC-API/src/lib/socialTtable.ts` |
| `maskUserID` for `owner_key` | reuses `src/lib/mask.ts` |
| `ROUTE_TRACKER.md`, `docs/api/social.md`, overview row | both repos |

**Verify:** the probe output, then a `curl` against a local dev server with real credentials, asserting a stored row with a plausible busy map.

**Gate: satisfied.** R1 and R2 were resolved against live VTOP. The parser must nevertheless be written against the *verified* format — `Slot/ Venue` is `"<slots> - <venue>"`, not `"<slots> / <venue>"`, and the course code and component type are explicit in the `Course` cell rather than synthesised. See [05-server-derivation.md](./05-server-derivation.md) §2.

## Phase 2 — Grants and pairing

`social_grants` DDL, secret minting, the read route, revoke, visibility. The mutual-pairing invariant (`least`/`greatest` + `UNIQUE`) lands here.

**Verify:** pair two accounts, read both directions, revoke, confirm both directions die. Attempt a read with a valid secret for the wrong target — expect `403 not_a_participant`.

## Phase 3 — Client sync op

The `social` op, `OP_LABELS` entry, **both** `Main.tsx` chains, the atoms, `useSocialData`, the debounced push. Client-side storage keys.

**Verify:** the global Sync button shows "Friends & groups" and its line goes green; add a friend on device A and see them on device B after a sync.

## Phase 4 — Comparison

`src/lib/social/schedule.ts` with `buildBusyMap`, `computeOverlap`, and one `toMinutes`. Collapse the three existing time parsers onto it.

**Verify:** unit tests plus a manual pass where a known conflict is confirmed to register as a conflict.

**This is the phase that removes the fabricated "% match".** The old figure is `70 + (seed % 25)` from a character hash — real numbers replace invented ones, and the friend row will visibly change.

## Phase 5 — UI

Token module, then landing + 4 subpages, then the grid, then the 5 modals. [11-ui-redesign.md](./11-ui-redesign.md).

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
| 4 | Revert to local-only comparison |
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
