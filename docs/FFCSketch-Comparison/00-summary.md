# 00 — Summary & verdict

> Part of the [FFCSketch vs AmazeCC FFCS comparison](./README.md). Scan date 2026-10-30.

## What each thing is

### FFCSketch (`../FFCSketch`, v0.2.1)

A purpose-built, single-purpose Next.js app whose entire reason to exist is the VIT Chennai FFCS planner. Its `README.md` (17.9 KB) describes it as _"a fast timetable planner and schedule generator built exclusively for VIT Chennai, with simple and playful UI options… 100% client-side, zero backend required."_

- 19 commits, from `5712459 feat: scaffold Next.js app with PaperCSS theme and PWA shell` through `0cc0eca Update Course List according to Winter Semester 26-27`.
- One page (`src/app/page.tsx`, 749 lines) composes everything; four tabs (Plan / Generate / Compare / Slots).
- Feature commits follow a clean layering: dataset+engine → store → grid/picker/cart → generator/compare/slots/import → share/help/hardening → nerd theme.

### AmazeCC FFCS (`AmazeCC`, v3.1.0)

The FFCS planner feature _inside_ AmazeCC, a multi-tool VIT campus app (attendance, free classrooms, marks predictor, tools hub, sync engine…). FFCS is one of its largest features and gets a **standalone route** (`/ffcs/`) with its own metadata and PWA manifest, plus a receive-only share route (`/share/ffcs/`).

- Documented in `docs/ffcs-workings/` (engine architecture), `docs/ffcs-ccv/` (feature-by-feature comparison against CodeChef's FFCS-inator + port plan), `docs/ffcs-generator-target-courses-locker-plan.md`, `docs/oct-21-2026/ffcs-fixes/PLAN.md`.
- Entry points: `src/lib/ffcsNavigation.ts` → `window.location.assign(getAssetPath("/ffcs/"))` called from `NavigationTabs.tsx`, `ToolsHub.tsx`, `MoreSubTabs.tsx`, `useAppCommands.tsx` (command palette).

## Capability scorecard

Legend: ✅ strong · ⚠️ present but limited · ❌ absent

| Capability                | FFCSketch                                | AmazeCC FFCS                                                  |
| ------------------------- | ---------------------------------------- | ------------------------------------------------------------- |
| Manual timetable builder  | ✅ grid + block popover + swap + colors  | ✅ grid + click-to-block + live clash badges                  |
| Auto generator            | ⚠️ main-thread DFS, no cancel/stream     | ✅ worker, streaming, cancel, drop ladder                     |
| Clash detection           | ✅ exact interval overlap                | ✅ canonical `lib/slots.ts` + law-slot aliases                |
| ETH/ELA embedded pairing  | ✅ scored pairing + repair UI            | ✅ 4-tier scored branch-and-bound + manual links              |
| Multi-draft plans / undo  | ✅ tables A/B, duplicate, one-level undo | ⚠️ multiple timetables, no undo snapshot                      |
| Slot occupancy explorer   | ✅ `SlotView.tsx`                        | ❌ deferred in planning docs                                  |
| Comparison / diff         | ✅ `CompareView.tsx` (779 L)             | ✅ side-by-side compare ×3 in generator results               |
| Faculty reviews           | ❌                                       | ✅ Vitfac (reviews, sentiment, schedule modal)                |
| Social / friends planning | ⚠️ friend sync in compare                | ✅ friends, groups, social matrix, generator sync             |
| Guided / wizard flow      | ❌                                       | ✅ 15-phase `FFCSGuidedSelector`                              |
| Onboarding tour & tips    | ⚠️ help section + theme intro            | ✅ tour (6 anchors, versioned) + tips + guide modal           |
| Ranking & scoring         | ⚠️ priority + composite score            | ✅ 6 profiles, 8 reorderable factors, faculty metrics         |
| Course locks / targets    | ✅ pin/lock sections, priority wishlist  | ✅ target-course locker (allowed slots/faculty)               |
| Share link                | ✅ `?s=` Base64URL + QR                  | ✅ 4 encodings + versioned codec + receiver route             |
| PNG export                | ✅ 2.5× retina                           | ✅ off-screen PNG/JPG with faculty sentiment                  |
| PDF export                | ❌                                       | ✅ jsPDF dossier in `pdf.worker.ts`                           |
| iCal / clash report       | ❌ / ❌                                  | ✅ `exportIcal.ts`, `exportClashReport.ts`                    |
| Text (WhatsApp) export    | ✅                                       | ⚠️ via dossier copy                                           |
| JSON backup/restore       | ✅ `backup.ts`                           | ✅ backup JSON import (also the friend-intake path)           |
| Paste / CSV / XLSX import | ✅ XLSX+CSV dialog                       | ✅ paste parser (1,078 L), CSV/TSV/XLSX, VTOP class-ID decode |
| Theming                   | ✅ PaperCSS fun / nerd, day-night        | ⚠️ host theme only, 3 layout modes                            |
| PWA / offline             | ⚠️ network-first SW + offline page       | ✅ Serwist, CSV NetworkFirst, layout preload                  |
| Multi-campus              | ❌ Chennai only                          | ⚠️ schemas shipped, hard-locked to Chennai                    |
| Tests                     | ❌ 0                                     | ✅ 582 FFCS assertions in CI                                  |
| Docs                      | ⚠️ one README                            | ✅ 11 FFCS docs (~1.3k lines)                                 |

## Where each is genuinely better

**FFCSketch is better when you want…**

1. A small, understandable codebase — engine is ~2,223 lines across 9 files; you can read the whole scheduler in one sitting.
2. Instant, portable plan sharing — the whole plan is the URL (`?s=`), no route, no receiver page, works in a WhatsApp message.
3. Personality — PaperCSS hand-drawn theme, Neucha font, day/night, first-visit theme prompt, all applied by a pre-hydration `<head>` script (no flash).
4. Draft ergonomics — multiple named tables you can duplicate/rename/switch, one-level undo with `Ctrl+Z`, per-course pastel colors.
5. A slot occupancy browser (`SlotView`) — "which courses use `E2`?" answered directly.
6. Low dependency weight — no backend SDKs, no PDF stack, no chart libraries actually needed.

**AmazeCC FFCS is better when you want…**

1. A solver that doesn't freeze the tab — worker + streaming progress + cancel-keeps-partial-results + inline fallback for old browsers.
2. Real ranking power — 6 profiles, 8 composable factors you can reorder and disable, faculty scores from Vitfac (`wPct`/lecture/DA/vibe), score filters, per-course faculty priority.
3. Faculty intelligence — reviews, avatars, sentiment pills in exports, same-slot faculty swap sheet, faculty schedule modal.
4. Social planning — friend groups, friends' timetables, a social matrix scoring your saved weeks against friends' options, generator options to sync/maximize free time with friends.
5. Breadth of output — PNG/JPG, PDF dossier with a "CLASHES WITH" column, iCal, clash report, portrait dossier, 4 share formats with a receiver page.
6. Verified correctness — 1,873-test suite gated in CI, including a test that executes the _built_ worker artifact in a Node `vm`, and a test proving in-tree pruning is equivalent to enumerate-then-filter.

## The trade in one line

> **Craft vs. scale.** FFCSketch is a hand-tooled instrument with no safety net; AmazeCC FFCS is a platform with real mass and the maintenance burden that comes with it.

Risks on each side (expanded in [07](./07-strengths-gaps-porting.md)):

- **FFCSketch:** no tests, lint effectively disabled (~30 rules off incl. `no-explicit-any` and `react-hooks/exhaustive-deps`), up to 400k DFS nodes on the main thread, 964 KB dataset inlined in the bundle, PWA that is not really offline-capable, unused dependency tail (`next-auth`, `next-intl`, `@mdxeditor/editor`, `z-ai-web-dev-sdk`, TanStack…).
- **AmazeCC FFCS:** `FFCSGuidedSelector.tsx` 6,214 L / `FFCSTimetableTab.tsx` 4,047 L / `FFCSGeneratorSubpage.tsx` 3,809 L (~14k lines in three files), state duplicated between tab-local `useState`, hooks, and raw `localStorage`, doc drift (`embedded-course-pairing.md` points at a function that moved), campus locked to Chennai despite shipping other schemas, `tsconfig` `strict: false`.
