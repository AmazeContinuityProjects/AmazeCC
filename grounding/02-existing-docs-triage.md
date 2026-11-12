# 02 — Triage of the Existing `docs/` Tree

The current `docs/` (~126 files across 15 topic folders) was written **against a different
architecture** and a different era of the app. A handoff cannot inherit it wholesale. This
file is the disposition list. The rule: **the code wins; the docs bend.**

## Class A — Rewrite in place (topic still valid, facts stale)

| Existing path                                                            | Action                                                                                                                                                                   |
| ------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `docs/README.md`                                                         | Replace with the new handoff index (see `03-target-docs-structure.md`)                                                                                                   |
| `docs/architecture/overview.md`                                          | Rewrite from scratch to describe the static export + external API (it currently describes `src/app/api/*` and HMAC tokens — wrong repo)                                  |
| `docs/architecture/frontend.md`                                          | Rewrite to describe this repo only; drop "backend API routes" claims                                                                                                     |
| `docs/architecture/authentication.md`                                    | Rewrite entirely: client-side VTOP session, vault, no JWT — see `01-inventory.md` §"Architecture facts"                                                                  |
| `docs/architecture/backend.md`                                           | Replace with a "Backend boundary" chapter pointing at AmazeCC-API's own docs; delete pass-through API-route claims                                                       |
| `docs/guides/getting-started.md`                                         | Rewrite for the amateur (prereqs, pnpm, demo mode, env names, 3001, sync caveats)                                                                                        |
| `docs/guides/development-setup.md`                                       | Rewrite; merge into getting-started or keep as deeper setup incl. certificates, tooling versions                                                                         |
| `docs/guides/testing.md`                                                 | Rewrite to actual vitest setup (no jest-dom, helper-not-setup, localStorage install pattern)                                                                             |
| `docs/guides/debugging.md`                                               | Rewrite: PostHog error tracking, devtools, `pnpm dev:http`, chunk-recovery, CSP notes                                                                                    |
| `docs/guides/frontend-development.md`                                    | Rewrite to actual practices (dynamic imports, overlay stack, jotai, amazeui shims)                                                                                       |
| `docs/sync-engine/*` (6 files)                                           | **Retain heavily** as the seed of `docs/06-sync-engine/`; verify every claim against `src/lib/sync-engine/*`; keep perf costs/op list in sync                            |
| `docs/social-tt/*` (13 files)                                            | Keep as design history BUT move under `docs/archive/social-tt/` and write a fresh `docs/05-social/` reference from the code; link archive as "design notes (historical)" |
| `docs/student-report/*` (5 files)                                        | Keep; fold into `docs/05-student-report/` reference, keeping math/provenance detail; verify against `studentReportPdf.ts`                                                |
| `docs/ffcs-workings/*`, `docs/sep-29-2026/timetableShapes/*`             | Keep under `docs/05-ffcs-planner/` sub-notes; verify claims against `generateTimetablesStream`, `slots.ts`, share-link code                                              |
| `docs/reference/tech-stack.md`, `scripts.md`, `environment-variables.md` | Rewrite tables from actual `package.json`, `.env.example`, source greps; they are substantially outdated                                                                 |

## Class B — Keep but relocate (valuable, wrong home or wrong era)

| Existing path                                                                                                                                                                                                                    | Action                                                                                                                                                                                                                                                                                                                                |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `docs/FFCSketch-Comparison/*` (9 files)                                                                                                                                                                                          | Relocate to `docs/archive/ffcsketc-comparison/` (or `docs/05-ffcs-planner/comparison/` linked as history). It is a third-party architectural comparison — useful, not onboarding material                                                                                                                                             |
| `docs/friend-finder-plans/*`, `docs/tasks-feature/*`, `docs/tasks-feature/*`, `docs/ffcs-ccv/*`, `docs/social-tt/*`, `docs/oct-21/`, `docs/plan-1/*`, `docs/sep-29-2026/*`, `docs/todo/*`, `docs/reports/*`, `docs/historical/*` | Move verbatim to `docs/archive/<same-name>/` with a one-line `README.md` stub ("archived, historical, not authoritative; code is truth"). Do not edit their bodies except to prepend the banner line                                                                                                                                  |
| `docs/mobile-friendliness-plan.md`, `docs/prf-encryption-plan.md`, `docs/ffcs-generator-target-courses-locker-plan.md`                                                                                                           | Same — `docs/archive/`                                                                                                                                                                                                                                                                                                                |
| `docs/guides/backend-development.md`, `docs/api/*` (17 files)                                                                                                                                                                    | **Archive as a set** with a stub: "The API this app calls lives in the AmazeCC-API repo (github.com/AmazeContinuityProjects/AmazeCC-API) with its own docs. The endpoint tables here reflect VTOP scraping, not this repo." Alternatively keep `docs/api/overview.md` only as a short "API boundary" page linking to AmazeCC-API docs |
| `docs/architecture/database.md`, `edge-infrastructure.md`                                                                                                                                                                        | Rewrite as "Infrastructure we don't own" (Supabase/B2/Worker/CDN/cache) with clear boundary: names + purposes + where credentials live (server-only). No schema dumps of tables that don't exist here                                                                                                                                 |
| `docs/contributing/*`                                                                                                                                                                                                            | Keep `code-of-conduct.md`, `pull-request-guide.md`, `style-guide.md` (refresh against `.prettierrc`, eslint.config.mjs, husky/lint-staged); drop `issue-template.md` if it references non-existent templates                                                                                                                          |

## Class C — Delete-and-replace candidates (do not re-create as-is)

- Anything claiming **this repo has API routes**, **this repo holds a Postgres schema**,
  **HMAC-JWT auth between this frontend and a backend**, or **the old `StatsCards` dashboard is
  current** — all three eras are gone. Replace with the corresponding sections in
  `03-target-docs-structure.md`. When in doubt, archive rather than delete.
- `docs/README.md` quick-links pointing to files that don't exist (e.g.
  `main-dashboard-decoupling-plan.md` at repo root — not tracked) → rebuilt index fixes this.

## Archive banner to prepend to every Class B/C file

```
> ⚠️ **ARCHIVED — historical context, not authoritative.**
> This document was moved to `docs/archive/` during the handoff docs rebuild.
> It may describe a previous architecture. If it contradicts the code in `src/`, the code wins.
> See `docs/README.md` for current documentation.
```

## What the archive does NOT excuse

Archived content must NOT be the only source for: env handling, auth flow, sync engine
invariants, marks-sync privacy model, share-link format, or deploy steps. Those have
authoritative sections in the new `docs/` (see `03-target-docs-structure.md`) derived from
code, and every future-AI WP touching those areas must write those sections fresh.

## Order of operations for triage

1. Create `docs/archive/` + stub READMEs (WP-00).
2. Move files with `git mv` (preserve history).
3. Rewrite Class A files in their new homes; link archive where relevant.
4. Rebuild `docs/README.md` last (after new structure exists) — it must never point at
   moved/deleted files.

## Sanity checklist for whoever performs triage

- `git status` shows renames, not deletes+adds (except README rebuilt).
- No inbound links from the live tree to `docs/archive/*` except via labeled "(historical)"
  callouts.
- `grep -ri "src/app/api" docs/ --exclude-dir=archive` returns nothing.
- `grep -ri "HMAC token" docs/ --exclude-dir=archive` returns nothing.
