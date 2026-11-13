---
title: "Build phases, deploy order, verification"
---

> ⚠️ **ARCHIVED — historical context, not authoritative.**
> This file was moved to `docs/archive/` during the handoff docs rebuild. It may describe
> a previous architecture. If it contradicts the code in `src/` or the live `docs/`, the code wins.
> See `docs/index.md` for current documentation.

# 03 — Build phases, deploy order, verification

- **Date:** 2026-11-09
- **Status:** planned
- Convention follows `docs/tasks-feature/08-build-plan.md` (Phase N +
  Verification) and `docs/oct-21-2026/ffcs-fixes/PLAN.md` (progress log).

## Ground rules

1. **Deploy order: app before API.** The API's only breaking step (rejecting
   `source: "planned"`) ships last, after clients have stopped sending it.
2. No new sync ops; `RETIRED_OPS = {"social"}` untouched.
3. No new env vars, no API routes added in AmazeCC (static export).
4. The planner's friends/groups manager and generator social scoring stay
   untouched (decision D8).
5. Every phase ends with its repo's `pnpm lint` / `pnpm test` / `pnpm tsc`
   (or `typecheck` script as present) and a passing build.

## Phase 1 — App: client lib + new tab + wiring (deployable alone)

Files: `src/lib/ffcsClassmates.ts`, NEW
`src/components/custom/friendfinder/FriendFinderTab.tsx`,
`NavigationTabs.tsx`, `DashboardUtilityRoutes.tsx`, `sectionHome.ts`,
`SimplifiedMobileHome.tsx`, `Main.tsx`, `FFCSTimetableTab.tsx`,
`FFCSFriendsSubpage.tsx`, delete `FFCSClassmatesSection.tsx`,
`TimetableShareCard.tsx` (02 §1–§6).

Covers: verified-only client (drops planned), reg-no-tolerant types, event
helper, tab registration, home button, deep links (`open=friend-finder`
consumer + legacy redirect), planner split removals, share-card repoint.

**Verify:**

- `pnpm lint && pnpm test && pnpm build` (static export still builds).
- Render tests from 02 §8 (new ones written in this phase).
- Manual: home button → finder tab; back → home; guest CTA → login →
  finder opens; `/ffcs/?open=classmates` redirects; **planner friends manager
  intact** (f-key, toolbar Friends, generator social scoring, its 8 tests).

## Phase 2 — App: quick-sync refresh (02 §7)

One-line dispatches in `useAppDataActions.ts` (three success exits) + the
`FriendFinderTab` listener (already typed in Phase 1).

**Verify:**

- Unit test: `broadcastFriendFinderRefresh()` dispatches; listener runs
  `publish` when joined / `get` when not.
- Manual two-account: A publishes verified → B opens finder (sees A) → A adds
  a class → B hits Quick Sync **with finder open** → B's list grows and stays
  accurate; repeat with finder **closed** → B's next open shows A's update.
- Rate sanity: one event per sync, no burst.

## Phase 3 — API (deploy only after Phase 1 is live)

Files: `socialCaller.ts`, `ffcsMatchDb.ts`, `ffcsMatch.ts`,
`ffcs-match/route.ts` (01 §1–§4) + privacy-comment updates (01 §6) + backend
tests (01 §5).

**Verify:**

- `pnpm lint && pnpm test` in AmazeCC-API — `ffcsMatch.test.ts` and
  `ffcsMatchDb.test.ts` green, including the 11 updated `publishEntry` call
  sites and the new reg-no/backfill/cleanup cases.
- Manual: `publish source:"planned"` → `400 planned_sharing_disabled`;
  existing `planned` rows gone after first request; pre-existing registered
  rows get `register_no` filled on next `get`; friend sheet shows reg no
  (app from Phase 1 picks it up with no further deploy); section rosters show
  **no** reg no; OpenAPI description matches behavior.

## Phase 4 — Docs

- `docs/ffcs-friend-finder/index.md`: `:4` "lives in the planner" → new home
  tab; `:48` privacy line (reg no in overlaps); verified-only publish;
  quick-sync refresh; keep the deploy/semester sections accurate.
- `FEATURES.md`: update the finder entry if listed.
- This folder: `README.md` status → **implemented**, with links to the commit
  that landed each phase (progress log per oct-21 convention).

**Verify:** links resolve; cross-references (`docs/ffcs-friend-finder`,
`docs/social-tt`) consistent; `pnpm build` still green.

## Risk register (from the council review — all addressed)

| Risk                                                            | Where handled                                        |
| --------------------------------------------------------------- | ---------------------------------------------------- |
| Deleting `FFCSFriendsSubpage` would kill friends/groups scoring | D8 + 02 §6 (file kept, classmates extracted only)    |
| Sign-in return dropped the new deep link                        | D7 + 02 §5 (URL param, `signInReturn` untouched)     |
| Planner removal list incomplete/over-broad                      | 02 §6 explicit REMOVE/KEEP split with line numbers   |
| Reg no inverts documented privacy invariants                    | D3 + 01 §6 (four comment/doc updates in-change)      |
| `CREATE TABLE` never adds a column to existing tables           | 01 §2 `ALTER TABLE … ADD COLUMN IF NOT EXISTS`       |
| Pre-migration rows would show blank reg no                      | 01 §2/§3 backfill on every op, cap-safe              |
| Refetch alone doesn't refresh my published snapshot             | D5 (publish-if-joined on sync event, free when same) |
| Planned-share removal ripples + deploy ordering                 | Ground rule 1 + 01 §7 (app before API)               |
| Button `col-span-2` breaking mobile grid                        | 02 §4 `sm:col-span-2`                                |
| Placement ambiguity                                             | D2 — user-confirmed top-level tab, 2026-11-09        |
