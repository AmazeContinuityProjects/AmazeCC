# 03 — Target `docs/` Structure (the handoff tree)

This is the tree the revamped `docs/` must land on. Names are part of the spec: call sites,
all `README.md`s and WPs use these paths verbatim. **When in doubt, add files rather than
cram content.** Nothing in this tree is optional except the `archive/` re-export of legacy
material.

Layering logic: an amateur reads top-to-bottom without knowing what anything is; an
experienced dev jumps straight to a reference page. Every directory has a `README.md`
(explained "what is this folder, what do I read first, what are the pages").

```
docs/
├─ README.md                              ← handoff index: audience, reading order in 1 hour
│
├─ 00-web-foundation/                     ← "What you need to know before the code"
│  ├─ README.md                          ← the spoonfeeding promise: read these once
│  ├─ 01-what-a-web-app-is.md            ← client vs server, request/response, browser
│  ├─ 02-html-css-js.md                  ← the three layers, what the browser does with each
│  ├─ 03-the-build-step.md               ← node/pnpm/npm, bundling, why we build at all
│  ├─ 04-typescript-in-10-minutes.md     ← types you'll see; strict off, implicit any tolerated
│  ├─ 05-react-mental-model.md           ← components, props, state, hooks, JSX
│  ├─ 06-next-app-router.md              ← App Router: layouts, pages, route groups; READ
│  │                                      node_modules/next/dist/docs/ before writing
│  ├─ 07-static-export.md                ← output:"export" = plain files on a static host;
│  │                                      what that forbids (middleware/SSR/API routes)
│  ├─ 08-state-vs-server-state.md        ← why jotai for UI state; why localStorage for cache;
│  │                                      why VTOP is the source of truth
│  ├─ 09-cookies-sessions-tokens.md     ← what VTOP cookies are; who holds them (browser);
│  │                                      why we encrypt them at rest
│  ├─ 10-pwa-and-service-workers.md     ← SW lifecycle, precache vs runtime cache, offline
│  ├─ 11-http-and-apis.md                ← methods, headers, JSON, CORS, fetch, timeouts
│  ├─ 12-the-repo-layout.md              ← src/app, components, lib, store, data; where things live
│  └─ 13-common-footguns.md              ← SSR/client boundaries, hydration, dynamic import,
│                                         no-strictNullChecks, CSS-modules-never
│
├─ 01-getting-started/
│  ├─ README.md                          ← "your first hour"
│  ├─ 01-prerequisites.md                ← git, Node 22, pnpm, a browser; nothing else
│  ├─ 02-clone-and-install.md
│  ├─ 03-env-vars.md                     ← names from .env.example; what may be blank locally
│  ├─ 04-run-in-demo-mode.md             ← zero-VTOP development loop
│  ├─ 05-your-first-change.md            ← change a string; see it live; commit conventions
│  ├─ 06-scripts.md                      ← every package.json script, why it exists
│  ├─ 07-running-tests.md
│  ├─ 08-building-for-production.md      ← static export, out/, Serwist, GitHub Pages
│  └─ 09-handoff-checklist.md            ← what you're expected to own (features ↔ owners map)
│
├─ 02-architecture/
│  ├─ README.md                          ← 5-minute system overview + diagram
│  ├─ 01-runtime-topology.md             ← browser ↔ static assets ↔ AmazeCC-API ↔ VTOP/Supabase
│  ├─ 02-the-one-page-app.md             ← Main.tsx shell: entry, atoms, tabs vs routes
│  ├─ 03-data-flow-end-to-end.md         ← a button click → sync engine → atoms → screen
│  ├─ 04-offline-and-the-pwa.md          ← sw.ts precache policy, offline page, cache headers
│  ├─ 05-build-pipeline.md               ← next build --webpack → out/ → prune-sw-precache
│  ├─ 06-error-handling.md               ← error.tsx, global-error.tsx, chunkRecovery, PostHog
│  ├─ 07-state-management-map.md         ← jotai atoms (index by domain), jotai vs localStorage
│  ├─ 08-directory-map.md                ← annotated `find`-style tree with line counts
│  ├─ 09-design-system.md                ← Tailwind v4, zinc dialect, amazeui, uiTokens, theme
│  └─ 10-configuration-catalog.md        ← every config file at repo root, what it does
│
├─ 03-routing/
│  ├─ README.md                          ← the two routing models explained in one page
│  ├─ 01-next-routes.md                  ← /, /ffcs, /friend-finder, /friend-finder/disclaimer,
│  │                                      /privacy, /terms, /share, /share/ffcs, /~offline,
│  │                                      and every layout.tsx/page.tsx in detail
│  ├─ 02-tab-router.md                   ← how Main.tsx mounts screens: atoms, DashboardRoute,
│  │                                      useDashboardNavigator, navigation registry.tsx
│  ├─ 03-navigation-registry.md          ← lib/navigation/registry.tsx deep-dive: surfaces,
│  │                                      sidebar groups, command palette integration
│  ├─ 04-the-share-routes.md             ← share intents: how /share and /share/ffcs decode
│  │                                      lz-string payloads; manifest share_target
│  ├─ 05-static-export-routing.md        ← trailingSlash, __dynamic segments don't exist,
│  │                                      GitHub Pages 404 quirk, why /ffcs/ works
│  ├─ 06-command-palette-and-shortcuts.md← Cmd/Ctrl-K, g-sequences, registry wiring
│  ├─ 07-screen-locking-nav.md           ← overlay stack, back handling, screen history
│  └─ 08-deep-linking.md                 ← ?tab=…, sign-in return paths, query params
│
├─ 04-app-shell/                         ← the "signed-in chrome" module
│  ├─ README.md
│  ├─ 01-main-tsx.md                     ← Main.tsx annotated top-to-bottom
│  ├─ 02-home-entry-controller.md        ← guest vs app gate, has-stored-session class
│  ├─ 03-app-housing.md                  ← AppHousing: hydration, bridge, sync host
│  ├─ 04-authenticated-workspace.md      ← login wall + intro branches; render order
│  ├─ 05-dashboard.md                    ← Dashboard.tsx: chrome, wiring, feature boundaries
│  ├─ 06-navigation-tabs.md              ← sidebar + mobile bottom nav anatomy
│  ├─ 07-sync-session-sheet.md           ← SyncSessionHost→SyncNotification; progress & lines
│  ├─ 08-command-palette-host.md
│  ├─ 09-connection-banner.md            ← offline / VTOP-down banner logic
│  ├─ 10-notifications-and-toasts.md     ← messageAtom, progress bar, polite etiquette
│  └─ 11-icon-updater.md                 ← per-route favicon/manifest swapping
│
├─ 05-<feature-area>/ …                  ← ONE FOLDER PER FEATURE (see below for full list)
│
├─ 06-sync-engine/
│  ├─ README.md
│  ├─ 01-overview.md                     ← what the engine is; why not raw fetch everywhere
│  ├─ 02-request-layer.md                ← apiRequest/request-layer.ts: auth, dedupe, retry
│  ├─ 03-credential-manager.md           ← VTOP session lifecycle; 10-min expiry; captcha;
│  │                                      single-flight; backoff; demo stub
│  ├─ 04-operations-catalog.md           ← EVERY registered op: name, cost, auth, args, writes
│  ├─ 05-sync-modes.md                   ← quick/balanced/full/academics/campus + custom
│  ├─ 06-sync-modes-editor.md            ← UI for building custom modes
│  ├─ 07-state-bridge.md                 ← how results become atoms + storage caches
│  ├─ 08-progress-bus-and-useSync.md     ← events, useSyncExternalStore, the hook
│  ├─ 09-error-taxonomy.md               ← AuthError vs TransientError; assertApiSuccess;
│  │                                      classifying failures; what the user sees
│  ├─ 10-demo-mode.md                    ← no-network path end-to-end; demoData.json provenance
│  ├─ 11-marks-sync-privacy.md           ← SHA-256 assessment keys, frozen receipts, consent model
│  ├─ 12-unicc-fallback.md               ← allowlist, third-party credentials warning, off switch
│  ├─ 13-failover-and-backup-api.md      ← PRIMARY→BACKUP global swap (UniCC refused); errors
│  ├─ 14-api-route-contracts.md          ← for frontend devs: exact shapes the app expects back
│  │                                      (ffcs payload, grades, attendance, social/…)
│  ├─ 15-rate-limit-and-captcha.md       ← why logins are expensive; storm protection
│  └─ 16-adapters.md                     ← unified /grades response adaptation; FFCS extractors
│
├─ 07-data-layer/
│  ├─ README.md
│  ├─ 01-storage-overview.md             ← localStorage vs atoms vs sessionStorage vs IndexedDB
│  ├─ 02-storage.ts-catalog.md           ← every KEYS entry, type, reader/writer, eviction
│  ├─ 03-local-storage-key-catalog.md    ← EVERY raw string key used anywhere (grep-driven)
│  ├─ 04-atoms-catalog.md                ← all 59 atoms: file, type, persisted?, writers
│  ├─ 05-settings-atom.md                ← the ~70-field Settings object; migration shim behavior
│  ├─ 06-credential-vault.md             ← AES-GCM vault: what's encrypted, migration path,
│  │                                      failure modes, CSP reliance, limits (not XSS-proof)
│  ├─ 07-session-snapshot.md             ← pre-paint `has-stored-session` inline script
│  ├─ 08-caches-and-ttl.md               ← registration_schedule, wishlist, feedback, whoami,
│  │                                      curriculum, frozen_marks_*, sums, and how they age
│  ├─ 09-demo-data.md                    ← both copies; rotation policy; how to regenerate
│  ├─ 10-worker-data.md                  ← cache.amazecc.com: what it serves (buses, laundry)
│  └─ 11-cdn.md                          ← cdn.amazecc.com image rewriting (toCdnImageUrl)
│
├─ 08-pwa-platform/
│  ├─ README.md
│  ├─ 01-service-worker.md               ← src/app/sw.ts annotated; precache exclusions;
│  │                                      PAGES/STATIC/REVIEW caches; ~offline fallback
│  ├─ 02-manifests.md                    ← manifest.json vs manifest-fire vs ffcs-manifest vs
│  │                                      favicon/site.webmanifest; share_target flow
│  ├─ 03-offline-strategy.md             ← what works offline and what doesn't, and why
│  ├─ 04-web-push.md                     ← VAPID, subscriptions (server), quiet hours, caps
│  ├─ 05-installing.md                   ← install prompts, iOS quirks, PwaInstallCard
│  ├─ 06-icon-updater.md                 ← per-route icon/manifest swapping logic
│  ├─ 07-csp.md                          ← the meta CSP; every directive decoded; what it blocks
│  ├─ 08-bundle-and-workers.md           ← generator.worker, pdf.worker, dynamic imports map
│  ├─ 09-chunk-recovery.md               ← stale-HTML-after-deploy: detect & self-heal
│  └─ 10-browser-compat.md               ← evergreen fallbacks, Safari quirks, Android viewport
│
├─ 09-testing/
│  ├─ README.md                          ← why we test; red/green workflow
│  ├─ 01-vitest-config.md                ← environment, workers, alias, CSS-stub, inline amazeui
│  ├─ 02-running-suites.md
│  ├─ 03-writing-a-unit-test.md
│  ├─ 04-writing-a-component-test.md     ← render(), no jest-dom assertions, waitFor patterns
│  ├─ 05-mocking-guide.md                ← sync-engine mock, Vitfac mock, localStorage install
│  ├─ 06-localstorage-helper.md          ← helpers/localStorage.ts contract & why not setupFiles
│  ├─ 07-suite-map.md                    ← EVERY test file, one line, grouped by theme
│  ├─ 08-testing-what-matters.md         ← invariants worth pinning (share round-trip, drop ladder)
│  ├─ 09-coverage-and-ci.md              ← what CI enforces; flakes; timeouts
│  └─ 10-visual-and-a11y.md              ← a11y click test, render assertions conventions
│
├─ 10-tooling-and-ci/
│  ├─ README.md
│  ├─ 01-pnpm-and-workspace.md           ← pnpm vs npm; .npmrc specifics (package-manager pin)
│  ├─ 02-scripts.md                      ← every scripts/*.mjs|.js explained incl. caveats
│  ├─ 03-build-info-generation.md        ← generate-build-info.js → buildInfo.json flow
│  ├─ 04-ci-pipeline.md                  ← .github/workflows/ci.yaml walk-through
│  ├─ 05-github-pages-deploy.md          ← nextjs.yml walk-through; permissions; concurrency
│  ├─ 06-lint-format-hooks.md            ← eslint.config.mjs, prettier, husky, lint-staged
│  ├─ 07-typecheck-and-tiers.md          ← tsc --noEmit; strict-off tiers; ignoreBuildErrors
│  ├─ 08-generating-info.md              ← changelog.json maintenance; commit-count build number
│  └─ 09-postinstall-oddities.md         ← sharp, husky, prebuild hooks
│
├─ 11-security/
│  ├─ README.md                          ← threat model in one page (XSS is real; CSP is narrow)
│  ├─ 01-credential-vault-details.md     ← deeper than data-layer: threat cases, limits, tests
│  ├─ 02-never-share-we-respect.md       ← marks-sync & friend-finder privacy posture; plain English
│  ├─ 03-unicc-third-party-data-flow.md  ← exact path of credentials to api-unicc; why allowed
│  ├─ 04-identity-verification.md        ← PostHog HMAC identity-hash: why secret stays server-side
│  ├─ 05-feedback-uploads.md             ← what FeedbackReportPage uploads; canvas replay scope
│  ├─ 06-dependency-hygiene.md           ← scanning notes, pnpm audit, license posture
│  └─ 07-reporting-security-issues.md    ← responsible disclosure for this project
│
├─ 12-operations/
│  ├─ README.md
│  ├─ 01-github-pages-operations.md      ← how to ship to production; rollback; cache purging
│  ├─ 02-changelog-flow.md               ← changelog.json ↔ releases ↔ version banner
│  ├─ 03-posthog-runbook.md              ← where errors land; filters; how to triage
│  ├─ 04-capacity-and-costs.md           ← what scales badly (VTOP scraping), why caching exists
│  ├─ 05-known-limits.md                 ← campus assumption (Chennai GLOBAL), no strict nulls,
│  │                                      no SSR, no server routes, single deliverer
│  └─ 06-release-checklist.md            ← build → qa → tag → release → announce
│
├─ 13-troubleshooting/
│  ├─ README.md
│  ├─ 01-sync-fails.md                   ← wrong password vs VTOP down vs API down (decision tree)
│  ├─ 02-blank-or-stale-app.md           ← SW/chunkRecovery playbook; hard refresh; ~offline
│  ├─ 03-it-half-works.md                ← PostHog vs console; localStorage corruption detection
│  ├─ 04-marks-sync-trouble.md           ← frozen_marks_* meaning; receipt mismatch debugging
│  ├─ 05-ffcs-planner-issues.md          ← CSV mismatch, tour state, timetable corruption
│  ├─ 06-common-console-errors.md        ← decoded messages most often seen
│  └─ 07-faq.md                          ← the questions every new dev asks in week 1
│
├─ 20-design-notes/                      ← original plans kept for provenance, rewritten voice
│  ├─README.md                           ← "why it looks like this"; archive links
│  └─ naming-and-history.md              ← StatCards→SimplifiedMobileHome; amazeui re-export shims;
│                                         tour duplication; TimetableGrid proliferation
│
├─ archive/                              ← see 02-existing-docs-triage.md
│
└─ 99-reference/
   ├─ README.md                          ← index of reference material
   ├─ glossary.md                        ← THE glossary (built from 08-glossary-seed.md)
   ├─ env-var-reference.md               ← every env var, default, effect, where read
   ├─ dependency-catalog.md              ← every runtime dep: why, who uses it, size; top 40 + rest
   ├─ network-calls-catalog.md           ← every outbound call the app makes, by file, auth method
   ├─ storage-key-catalog.md             ← cross-ref of raw keys (ls/session/caches)
   ├─ atom-catalog.md
   ├─ route-and-file-index.md            ← grep-able index: feature → files → tests → docs
   ├─ decisions/                         ← ADRs: static export; client-side VTOP auth; jotai over
   │  ├─ 0001-static-export.md           redux; localStorage-as-cache; amazeui partial re-home;
   │  ├─ 0002-client-vtop-auth.md        SHA-256 marks keys; UniCC scoped fallback; SW exclusions
   │  ├─ 0003-jotai-and-cache.md
   │  ├─ 0004-marks-sync-model.md
   │  ├─ 0005-service-worker-policy.md
   │  └─ 0006-unicc-fallback.md
   ├─ academy/                           ← optional deep dives for ambitious readers
   │  ├─ timetable-slot-algebra.md       ← slots, lanes, clashes, GLOBAL campus model
   │  ├─ marks-grading-mechanics.md      ← boundaries, curves, grade history semantics
   │  └─ vtop-scraping-primer.md         ← reading VTOP HTML like the API does
   └─ further-reading.md
```

## The `docs/05-<feature>` detail (one pass per feature; same skeleton each)

Each feature folder follows this skeleton (fill adapted to size; every file mandatory):

```
docs/05-<feature>/
├─ README.md                     ← what it is, who uses it, links to screens
├─ overview.md                   ← user-visible behaviour tour (screens in order)
├─ data-model.md                 ← shapes/types (path+name of real types from src)
├─ architecture.md               ← data flow, state homes, API contracts, caches
├─ ui-map.md                     ← component tree annotated (files, props, sizes in lines)
├─ storage-and-state.md          ← atoms/keys this feature alone writes or reads
├─ testing.md                    ← list of its suites; what to run while changing it
├─ known-issues.md               ← documented traps from code comments + issues
└─ history.md                    ← why it is the way it is (FEATURES.md + archive links)
```

Feature folders to create (complete list — from `src/components/custom`):

1. `attendance/` — calendar, OD tracker, predictor, per-course detail, timetable sheet, ICS export
2. `academics/` — marks history, curriculum browser, CGPA, exam schedule, course dashboard,
   attendance overlap, SimplifiedAcademicsPage, past-semester sync
3. `marks-predictor/` — what-if engine + editor UI + tour (link tour system under ffcs-planner)
4. `ffcs-planner/` — the beast: FFCSTimetableTab, generator, guided selector, VIEWS, workers,
   share links, settings, tour, catalog filters, import pipeline (4,400+ lines of entry point;
   ~80 component files; treat as a sub-tree with its own sub-README)
5. `ffcs-friends/` — classmate matching + Friends subpage
6. `timetable-ui/` — timetable/TimetableView, grids, vertical/horizontal modes, densities
7. `tasks-and-pomodoro/`
8. `social/` — pairing, grants, groups, common-free grid, busy maps (see `social-tt` archive)
9. `friend-finder/` — public route, login modal, VTOP verification, FFCS match
10. `hostel/` — mess, laundry, leave, counselling, cab-share (own sub-folder)
11. `libraries/` — catalog, dues, holdings
12. `payments/` — fees, dues, receipts, wallet
13. `events-and-clubs/` — EventHub + clubs + feed
14. `qbank/`
15. `paper-scanner/` — camera → crop → OCR (tesseract.js), NN classifier, IndexedDB store
16. `student-report/` — export pipeline PDF/JSON/zip, math provenance (fold docs/student-report)
17. `settings-and-profile/` — ProfilePage, assistant, sync modes, API host picker, about
18. `notifications-and-push/`
19. `guest-landing/` — GuestExperience, landing sections, PWA install marketing
20. `onboarding/` — intro hero, sign-in, sync screen, first-run onboarding
21. `feedback-and-support/` — FeedbackModal, FeedbackReportPage, bug recording, PostHog tickets
22. `changelog-and-about/` — changelog modal, hall of fame, team, buildInfo badge
23. `marks-and-cohort/` — cohort marks stats, frozen receipts, drift logging (ties to 11-sync)
24. `free-classrooms/` — client scan vs server answer vs merge
25. `cab-share/` — ride sharing (sub of hostel or standalone — keep standalone)
26. `about-and-licensing/` — licenses, fonts, third-party attribution

## Count sanity

Sections 00–04 ≈ 50 files; 05 (features) ≈ 26 folders × 8–12 files ≈ 280; 06 ≈ 16;
07 ≈ 11; 08 ≈ 10; 09 ≈ 10; 10 ≈ 9; 11 ≈ 7; 12 ≈ 6; 13 ≈ 7; 20 ≈ 2; 99 ≈ 20 + 6 ADRs.
Total ≈ **430–480 new files**, plus relocated archives. Well under the "1000 files is fine"
budget; do not pad or split atomically. Completeness beats page count.
