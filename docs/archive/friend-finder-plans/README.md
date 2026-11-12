> ⚠️ **ARCHIVED — historical context, not authoritative.**
> This file was moved to `docs/archive/` during the handoff docs rebuild. It may describe
> a previous architecture. If it contradicts the code in `src/` or the live `docs/`, the code wins.
> See `docs/README.md` for current documentation.

# Friend finder plans

Plan for moving the FFCS friend finder ("Find classmates") out of the FFCS
planner and onto the Simplified Mobile Home, restricting sharing to
VTOP-verified timetables, refreshing the list on every quick sync, and adding
the two groupings (by class / by friend).

- **Status:** implemented
- **Date:** 2026-11-09
- **Repos involved:** AmazeCC (this repo, static-export frontend) and the
  sibling checkout `../AmazeCC-API` (backend; no `docs/` folder there)
- **Upstream docs:** [../ffcs-friend-finder/README.md](../ffcs-friend-finder/README.md)
  (current design of the feature being moved — must be repointed in Phase 4)

## Files

| File                                       | Contents                                                           |
| ------------------------------------------ | ------------------------------------------------------------------ |
| [00-overview.md](./00-overview.md)         | Vision, requirement → design mapping, decisions (incl. privacy)    |
| [01-api-changes.md](./01-api-changes.md)   | Every change in AmazeCC-API: schema, route, matching, tests        |
| [02-app-changes.md](./02-app-changes.md)   | Every change in AmazeCC: new tab, component, sync, removals, tests |
| [03-build-phases.md](./03-build-phases.md) | Phased build order, deploy order, verification per phase           |

## Non-negotiables carried through every file

- **Deploy order: app before API.** Old clients must stop sending
  `source: "planned"` before the API starts rejecting it.
- **The planner's friends manager stays.** Only the `classmates` section
  moves; `friends` / `friendGroups` feed the generator's social scoring.
- **No new sync op.** The retired `"social"` op stays retired; refresh rides
  a custom event.
- **Reg no rides `overlaps` only** — never section rosters.
