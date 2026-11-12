> ⚠️ **ARCHIVED — historical context, not authoritative.**
> This file was moved to `docs/archive/` during the handoff docs rebuild. It may describe
> a previous architecture. If it contradicts the code in `src/` or the live `docs/`, the code wins.
> See `docs/README.md` for current documentation.

# Documentation archive — read first

Everything in this folder, and the folders listed below ⚠️, is **historical material, not
current documentation**. It is kept for provenance only. If anything here contradicts the code
in `src/` or the live pages in `docs/`, **the code wins**. Never link to a file here as if it
were authoritative.

## Why these files live here

They describe previous eras of the app (a full-stack era with `src/app/api/*`, HMAC tokens, and
a hosted database in this repo) or planning artefacts for completed migrations. They were moved
out of the live tree during the 2026 handoff docs rebuild (`git mv`, history preserved).

## ⚠️ Could not be moved — treat these as archived too

Four folders are read-only to the build sandbox (`CodexSandboxUsers`, RX, inherited), so they
could not be relocated. They remain at their original paths — **do not read them as current
documentation either**:

- `docs/oct-21-2026/` — FFCS fixes plan (historical)
- `docs/sep-29-2026/` — timetable-shapes & UI-upgrade plans (historical; superseded by code)
- `docs/todo/` — typing-issues backlog (historical)
- `docs/historical/` — performance audit era docs (historical)

The intended destinations are `docs/archive/oct-21-2026/`, `docs/archive/sep-29-2026/`,
`docs/archive/todo/`, `docs/archive/historical/`. A maintainer with write access should move
them with `git mv`; the rest of the archive can be rebuilt from this list.

## Contents (moved)

| Folder                                         | What it was                                                                                                                                  |
| ---------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `api/`                                         | VTOP endpoint scraping tables from the full-stack era — see AmazeCC-API (separate repo) for the server, and `docs/archive/README.md` banners |
| `FFCSketch-Comparison/`                        | Architecture comparison against FFCSketch (9 docs)                                                                                           |
| `ffcs-ccv/`                                    | FFCS "collision/conflict-validation" implementation plan & log                                                                               |
| `ffcs-generator-target-courses-locker-plan.md` | Feature plan for the generator target locker                                                                                                 |
| `friend-finder-plans/`                         | Friend Finder build plan (phases)                                                                                                            |
| `historical/`                                  | Performance audit & speed docs (moved; see above)                                                                                            |
| `mobile-friendliness-plan.md`                  | Mobile redesign plan                                                                                                                         |
| `plan-1/`                                      | Attendance plan                                                                                                                              |
| `prf-encryption-plan.md`                       | Crypto experiment plan                                                                                                                       |
| `reports/`                                     | PostHog analytics reports                                                                                                                    |
| `social-tt/`                                   | Social timetable design notes (full grant/pairing model)                                                                                     |
| `tasks-feature/`                               | Tasks feature build plan                                                                                                                     |
