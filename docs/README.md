# AmazeCC — Developer Documentation

> **Who this is for:** the next developer (or team) inheriting AmazeCC. Assumes you have _used_
> web apps, not built them. Everything here is spoonfed.
> **Status:** handoff rebuild (2026-11). See `grounding/` at the repo root for the build plan
> and the coverage checklist.

## Read in this order (the 1-hour tour)

1. **[00-web-foundation](00-web-foundation/README.md)** — how the web works; read this even if you know it
2. **[01-getting-started](01-getting-started/README.md)** — clone → install → demo mode → first change
3. **[02-architecture/README](02-architecture/README.md)** — the shape of the system in five minutes
4. **[03-routing/01-next-routes](03-routing/01-next-routes.md)** — every URL, and the tab router inside the app
5. **[04-app-shell/01-main-tsx](04-app-shell/01-main-tsx.md)** — the runtime root, top to bottom
6. **[06-sync-engine](06-sync-engine/README.md)** — how data actually gets here
7. **[07-data-layer](07-data-layer/README.md)** — atoms, storage, caches, the vault
8. **[05-ffcs-planner/README](05-ffcs-planner/README.md)** — the flagship feature, in depth
9. **[09-testing](09-testing/README.md)** — how we know any of this works
10. **[99-reference/glossary](99-reference/glossary.md)** — every acronym, once, in plain words

## The map

| Section               | Covers                                                                                                         |
| --------------------- | -------------------------------------------------------------------------------------------------------------- |
| `00-web-foundation/`  | Web literacy primer (HTML/CSS/JS → static export → PWA)                                                        |
| `01-getting-started/` | Prereqs, install, demo mode, scripts, first change, handoff checklist                                          |
| `02-architecture/`    | Runtime topology, one-page app, data flow, offline, build, errors, state, design system, config catalog        |
| `03-routing/`         | Next routes, tab router, registry, share routes, static-export quirks, palette/shortcuts, overlays, deep links |
| `04-app-shell/`       | Main.tsx, entry gate, housing, workspace, Dashboard, nav tabs, sync sheet, palette, banners, icons             |
| `05-*`                | **26 feature folders** (attendance → guest-landing), each self-contained                                       |
| `06-sync-engine/`     | The VTOP fetch machinery — 16 pages + README                                                                   |
| `07-data-layer/`      | Storage, atom & key catalogs, vault, caches, demo data, worker data, CDN                                       |
| `08-pwa-platform/`    | Service worker, manifests, offline, push, install, CSP, bundle/workers                                         |
| `09-testing/`         | Vitest config, how to write tests, mocking, 204-suite map                                                      |
| `10-tooling-and-ci/`  | pnpm, scripts, CI/CD, hooks, build info                                                                        |
| `11-security/`        | Vault details, privacy model, UniCC data flow, identity HMAC, feedback uploads, deps, disclosure               |
| `12-operations/`      | Deploys, changelog, PostHog runbook, capacity, limits, release checklist                                       |
| `13-troubleshooting/` | Sync fails? Blank app? Getting stuck? — decision trees + FAQ                                                   |
| `20-design-notes/`    | Why the codebase looks this way (naming, eras, shims, duplications)                                            |
| `99-reference/`       | Glossary, env vars, dependencies, network calls, storage keys, atoms, ADRs, academy dives                      |
| `archive/`            | **Historical** — moved as-is with a banner; never authoritative                                                |

## The unbreakable rules of this docs tree

1. Code in `src/` wins over any page here. Contradictions are bugs — file them.
2. `docs/archive/` is a museum; live docs link to it only as labeled "historical".
3. New docs follow `04-writing-standard` in `grounding/` — spoonfeeding, not showing off.
4. Secrets never appear. `.env` is gitignored; this tree documents meaning, not values.
