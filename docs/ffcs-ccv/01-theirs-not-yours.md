# What's in FFCS-inator (CodeChef VIT) that is NOT in AmazeCC

Paths under `../ffcs/` are the CodeChef repo; paths under `src/`, `docs/`, `.github/` are this repo (AmazeCC).
Item numbers are the stable reference used by [`03-implementation-plan.md`](./03-implementation-plan.md).

---

## 1. Accounts & cloud-saved timetables — _(not ported — requires a backend)_

- NextAuth v4 Google OAuth restricted to `hd: vitstudent.ac.in` with a `@vitstudent.ac.in` `signIn` callback —
  `../ffcs/src/app/api/auth/[...nextauth]/authOptions.ts`
- Timetables stored server-side per owner email: `../ffcs/src/models/timetable.ts` (title, `isPublic`, unique sparse
  `shareId`, `slots[]`, timestamps), CRUD at `../ffcs/src/app/api/timetables/route.ts`,
  `timetables/[id]/route.ts`, `save-timetable/route.ts`
- **Saved page** with view / rename / delete / public-private toggle — `../ffcs/src/app/saved/saved.tsx`
- **AmazeCC position:** plans are 100% local (`ffcs_timetables`, `src/lib/storage.ts`). We have
  rename/create/duplicate/delete (`hooks/useTimetables.ts`, `FFCSDashboardHeader.tsx`) but no account, no
  cross-device sync, no cloud backup. (AmazeCC is a static export with no API routes, so this needs a backend.)

## 2. Short share links with privacy gating + OG metadata — _(not ported — requires a backend)_

- 6-char `shareId` → `/share/[shareId]` (DB-backed, tiny URL) — `../ffcs/src/lib/shareIDgenerate.ts`
- **Public/private toggle**; private links redirect to a 403 page — `../ffcs/src/app/denied-access/`
- `generateMetadata()` per share for social-preview images — `../ffcs/src/app/share/[shareId]/layout.tsx`
- QR code of the share link in the share popup — `../ffcs/src/components/ui/QRCode.tsx`
- **AmazeCC position:** the **entire plan is lz-string-encoded into the URL** (`src/lib/ffcsShare.ts`,
  `/share/ffcs/?d=…`), no server, no privacy state, no per-share OG (static export). QR exists only in the
  _social handles_ feature (`src/components/custom/social/`), not FFCS sharing.

## 3. Browser extensions — _(not ported — separate deliverable)_

- **`../ffcs/extension/Client/`** — "My VTOP" MV3 extension: logs into VTOP, captures the user's _personal_ course
  catalogue (slots/venues/faculty), validates it (`../ffcs/src/lib/vtopCatalogue.ts`, schemaVersion 1, 64-hex
  catalogueId), stores it in `chrome.storage.local`, and the app reads a validated copy
  (`ffcs:vtop:catalogue:v1`) and injects it as a virtual **"My VTOP" school**
  (`../ffcs/src/hooks/useVtopCatalogue.ts`, `VtopExtensionModal.tsx`). Gives per-user fresh data with **no backend**.
- **`../ffcs/extension/FFCS-Contributors/`** — crowdsourced data tool: exports VTOP categories directly to
  repo-ready `src/data/<SCHOOL>/<BRANCH>/*.ts` files + generated `index.ts`, with a dependency-free ZIP writer
  (`zip.js`, CRC32 + path-traversal guard).
- Packagers: `../ffcs/scripts/package-extension.mjs`, `package-contributors.mjs`. Privacy-hardened origin/queue
  logic in `background.js` (app origins pinned to `ffcs.codechefvit.com`, `localhost`).
- **AmazeCC position:** no extension; the equivalent is the external scraping API (mitigated by the host-failover
  chain in `src/lib/fetch-utils.ts` + `src/lib/unicc-fallback.ts`).

## 4. Zero-backend offline course catalogue — ✅ **PORTED** (see plan)

- Their entire app works with `MONGODB_URI` absent and no API: `../ffcs/src/data/faculty.ts` + 20 school folders
  (`SCOPE`, `SCORE`, `SENSE`, `SELECT`, `SMEC`, `SBST`, `SCHEME`, `SCE`, `SHINE`, `MTech_*`, plus `_F`
  fresher-batch variants) are the source of truth — 146 files, ≈884 KB, 5 502 offering rows, 783 distinct courses.
- Shape per course: `'CODE - Title': [{ slot: 'G2+TG2', venue: 'PRP630', faculty: 'SATHISH KUMAR P' }, …]`
- **AmazeCC position:** fresh course data requires the hosted API; only two semester CSV reports are bundled
  (`public/ffcs/*.csv`). → **Ported:** the school folders are converted into a bundled offline catalogue;
  AmazeCC's FFCS now has an offline data source that never touches `api.amazecc.com`.

## 5. "All Subjects Mode" toggle — ✅ **PORTED** (see plan)

- `../ffcs/src/components/cards/CourseCard.tsx:179,353` — **ON**: only timetables containing _all_ selected
  subjects; **OFF**: subjects are prioritized by their drag order and the **lower-priority subject is excluded**
  when it clashes, so the student still gets timetables.
- **AmazeCC position:** the backtracker (`src/components/custom/exams/FFCS/logic/generate.ts`) places every
  selected course or returns nothing (`no_conflict_free`, line ~1799). A student who picks 6 courses that cannot
  all fit gets zero results. AmazeCC's `rankingPriorityOrder` orders _ranking criteria_, not courses.
  → **Ported:** an "All Subjects Mode" setting with a drop-lowest-priority retry pass.

## 6. Manual per-course faculty priority ordering — ✅ **PORTED** (see plan)

- `../ffcs/src/components/cards/FacultySelector.tsx:277,871` — a **drag-and-drop `priorityList` of faculty per
  course** (plus up/down arrows) that directly drives generation order; `FacultyPriorityModal.tsx` reviews it after
  adding; `CourseCard.tsx` drag-orders **course** priority.
- **AmazeCC position:** automated vitfac ranking (`src/lib/ffcsFacultyRanking.ts`), faculty groups
  (`logic/facultyGroups.ts`), locks (`hooks/useCourseLocks.ts`), the slot-faculty swap sheet
  (`SlotFacultySwapSheet.tsx`), and a reorderable _ranking-priority_ list (`FFCSGuidedSelector.tsx:3756`) — but
  **no hand-dragged "prefer Prof A over Prof B for this course" list**. → **Ported:** per-course faculty priority
  persisted in `ffcs_settings` and consumed by generation + ranking.

## 7. Interactive standalone Slot View with live clash blocking — _(not ported)_

- Route `/slots` — `../ffcs/src/app/slots/slots.tsx` + `slots-mobile.tsx`, backed by
  `../ffcs/src/lib/slots.ts` (`clashMap`, full A1…TG2 + L1–L60 grid geometry). Selecting a slot visually disables
  every conflicting slot _before_ course selection.
- **AmazeCC position:** no `/slots` route. We do accept `blockedSlots` as generator input
  (`generate.ts:475–480`, timetable grid props) but there is no exploratory slot-map page.

## 8. Result-view smart filters — ✅ **PORTED** (see plan)

- `../ffcs/src/components/cards/ViewTimeTable.tsx` (1 025 lines) + `src/lib/{filterUtils,groupTimetables}.ts`:
  - **Group by Slot** — one tab per slot layout, with faculty-variant arrows (`FacultyVariantArrows.tsx`)
  - **Same Building** filter (venue-prefix based, unit-tested in `tests/building-filter.test.cjs`)
  - **Morning / Evening / Mixed** theory pills
  - **Filter-by-faculty** ComboBox
  - Numbered pagination with windowed tabs + first/last buttons
- **AmazeCC position:** 6 ranking profiles, variant grouping, time/session filters in the guided selector, and
  morning/evening lab detection — but **no "Same Building" grouping of results**, no group-by-slot tabs, no
  faculty filter over generated results. → **Ported:** a filter bar over generated results.

## 9. PDF report with an explicit "Clashes With" column — ✅ **PORTED** (see plan)

- `../ffcs/src/lib/exportToPDF.ts` (pdfmake) — per-course faculties, theory/lab slots, and a **"Clashes With"
  clash-report column** in the download (their README: "Download Detailed Reports").
- **AmazeCC position:** PDF export is screenshot-based (`src/lib/exportTimetable.ts` → html-to-image + jsPDF) and
  `src/lib/portraitDossier.ts` renders a **text** course table — but neither reports clashes.
  → **Ported:** a structured text report including a Clashes With column.

## 10. Smaller things they have and we don't

| Thing                                       | Theirs                                                              | Status                                           |
| ------------------------------------------- | ------------------------------------------------------------------- | ------------------------------------------------ |
| Prettier + Husky pre-commit (`lint-staged`) | `.prettierrc`, `.prettierignore`, `.husky/pre-commit`               | ✅ **ported**                                    |
| GitHub issue templates                      | `.github/ISSUE_TEMPLATE/{bug_report,feature_request}.md`            | ✅ **ported**                                    |
| FAQ page component                          | `src/data/faq.ts` + `FAQ.tsx`/`Accordion.tsx`                       | not ported                                       |
| Custom 404 variants (desktop + mobile)      | `src/app/four04/`                                                   | not ported                                       |
| Email capture → Google Sheets               | `src/app/api/collect-email/route.ts`                                | not ported                                       |
| Server OG metadata                          | `share/[shareId]/layout.tsx`                                        | not ported                                       |
| Middleware session guard                    | `middleware.ts` (inert — targets a removed route)                   | not ported                                       |
| Landing A/B by screen size                  | `useScreenSize()` picks desktop/mobile page variants for every page | not ported (AmazeCC uses responsive CSS instead) |
| Excel export                                | declared (`exceljs`) but **unimplemented** — not actually a feature | —                                                |
