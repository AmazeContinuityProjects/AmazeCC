# 05 — Share, export & import

> Part of the [FFCSketch vs AmazeCC FFCS comparison](./README.md). Scan date 2026-10-30.

Both are backend-free: sharing means encoding a plan into a URL, exporting means rendering off-screen HTML, importing means parsing a file or paste on the client.

## 1. Share links

|                   | FFCSketch                                                  | AmazeCC FFCS                                                                                                                         |
| ----------------- | ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| Module            | `src/lib/ffcs/share.ts` (124) + `ShareDialog.tsx` (391)    | `src/lib/ffcsShare.ts` (583) + `ffcsShareInput.ts` (313)                                                                             |
| Param             | **`?s=`**                                                  | four: **`?d=`** full, **`?x=`** compact, **`?q=`** shape, **`?r=`** numeric-shape                                                    |
| Encoding          | Base64URL of a compressed JSON payload, in the link itself | **lz-string**, `FFCS_SHARE_VERSION = 1`, exact-version check on decode                                                               |
| Route             | none needed — any page with `?s=` works                    | dedicated prerendered **`/share/ffcs`** shell (`page.tsx` 30 + `FFCSShareView.tsx` 307) with `useSearchParams()` inside `<Suspense>` |
| Compression       | (Base64URL of compact state)                               | versioned codec; receiver distinguishes exact-version / cross-version / oversized                                                    |
| Guardrails        | DoS guard on decode size                                   | **8,000-char oversize warning**; oversize/cancel treated as explicit outcomes, not exceptions                                        |
| QR                | ✅ `qrcode` in the dialog                                  | ✅ `qrcode.react`                                                                                                                    |
| Receiver UX       | applies the plan into the store                            | download PNG/JPG **or "Open in planner"** (writes `ffcs_timetables`)                                                                 |
| Formats by intent | 1 (everything)                                             | 4 by intent: full fidelity / minimal (semester + class IDs) / timetable _shape_ only / delta-packed numeric shape                    |
| Tests             | none                                                       | `ffcsShare.test.ts` (10), `ffcsShareInput.test.ts`, `ffcsShareView.render.test.tsx` — 410 lines / 27 cases across the share suites   |
| Docs              | README                                                     | `docs/oct-21-2026/ffcs-fixes/PLAN.md` §"versioned lz-string codec"                                                                   |

**Analysis.** FFCSketch's single `?s=` is simpler and genuinely portable (works without a receiver route, in any context). AmazeCC's four formats solve a real problem — a full plan with 10+ courses can blow past URL limits — so `?x=`/`?q=`/`?r=` let you share a _shape_ cheaply, and the receiver route gives a proper landing page. The version check prevents silent garbage on format evolution; FFCSketch has no versioning in its payload.

## 2. Exports

| Format                         | FFCSketch                                                                                                | AmazeCC FFCS                                                                                                                                                   |
| ------------------------------ | -------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| PNG                            | ✅ `export.ts` (304): **2.5× retina**, grid + full course summary table, scrollbars stripped (`9d8ef37`) | ✅ `lib/exportTimetable.ts` (**2,312 L / ~103 KB**): off-screen builder + `html-to-image` with live-DOM fallback; vertical heatmap vs horizontal grid variants |
| JPG                            | —                                                                                                        | ✅ (menu option in `FFCSTimetableTab`)                                                                                                                         |
| PDF                            | ❌                                                                                                       | ✅ **jsPDF A4-landscape dossier in `workers/pdf.worker.ts`** (OffscreenCanvas slicing), `PdfGenerationBadge.tsx` (127), `ExportDossierWidget.tsx` (203)        |
| Printable dossier              | ❌                                                                                                       | ✅ `FFCSDossierSubpage` (935) in-app preview + print window, light/dark                                                                                        |
| Portrait dossier               | ❌                                                                                                       | ✅ `lib/portraitDossier.ts` (470) — phone-shaped                                                                                                               |
| HTML dossier                   | ❌                                                                                                       | ✅ (export path in `exportTimetable.ts`)                                                                                                                       |
| iCal                           | ❌                                                                                                       | ✅ `lib/exportIcal.ts` (139)                                                                                                                                   |
| Clash report (CSV/PDF)         | ❌                                                                                                       | ✅ `lib/exportClashReport.ts` (356) with **"CLASHES WITH"** column                                                                                             |
| Plain text (WhatsApp/Telegram) | ✅ day-by-day formatted text                                                                             | ⚠️ copy-able dossier text                                                                                                                                      |
| CSV                            | ✅ (in `export.ts`)                                                                                      | ✅ (via report/clash exports)                                                                                                                                  |
| Course-list image              | ❌                                                                                                       | ✅                                                                                                                                                             |
| Faculty sentiment in image     | ❌                                                                                                       | ✅ `% W` pills from Vitfac embedded in exports                                                                                                                 |
| Output engine                  | `html-to-image` main thread                                                                              | `html-to-image` **+ PDF worker**, off-screen DOM with live-DOM fallback                                                                                        |
| Tests                          | none                                                                                                     | `exportTimetable.test.ts`, `portraitDossier.test.ts`, `exportClashReport.test.ts`, `pdfGenerationBadge.render.test.tsx`, `worker-artifact.test.ts`             |

## 3. Imports

| Path                    | FFCSketch                                                                                                             | AmazeCC FFCS                                                                                                                 |
| ----------------------- | --------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| XLSX                    | ✅ `lib/ffcs/xlsxImport.ts` (202) + `XlsxImportDialog.tsx` (407): fuzzy matching, **5 MB / 20,000-row caps**, SheetJS | ✅ dynamic SheetJS (`xlsx@0.20.3` CDN tarball) via `features/import/importFile.ts` (159)                                     |
| CSV/TSV                 | ✅ (same dialog)                                                                                                      | ✅ + `normalizeColumns.ts` (234) header normalization                                                                        |
| Paste text              | ❌                                                                                                                    | ✅ **`parsePastedText.ts` (1,078 L)** — line parser with **per-line confidence**, UI `PasteRegisteredCoursesModal.tsx` (176) |
| VTOP registration sheet | ❌                                                                                                                    | ✅ class-ID decoding (`CLASS_ID`, `CLASS_IDS[]`, `LINK_ID`)                                                                  |
| Backup JSON             | ✅ `lib/ffcs/backup.ts` (176) — full state incl. theme prefs                                                          | ✅ backup JSON import (also the **friend-intake** path, `FFCSGuideModal.tsx:102`)                                            |
| Catalogue swap          | ✅ `scripts/update-courses.mjs` at build time                                                                         | ✅ runtime picker across 3 bundled semesters (`ffcs_semester`)                                                               |
| Custom course           | ✅ `CustomCourseDialog.tsx` (486)                                                                                     | ❌ (manual links / custom rows come through import)                                                                          |
| Guardrails              | 5 MB / 20k rows                                                                                                       | per-line confidence, `sanitizeFFCSSettings` per-field fallback, `ffcs_raw_courses` cache                                     |
| Tests                   | none                                                                                                                  | `importFile.test.ts`, `parsePastedText.test.ts`, `pasteRegisteredCoursesModal.test.tsx`                                      |

## 4. Backups & persistence

|              | FFCSketch                                             | AmazeCC FFCS                                                                                |
| ------------ | ----------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| Storage key  | `ffcs-planner-v1` (single key, everything)            | ~26 `ffcs_*` keys (see [01](./01-architecture.md) §3)                                       |
| Versioning   | `v1` in the key + migration dropping non-Chennai data | per-key accessors in `storage.ts` + `sanitizeFFCSSettings` fallbacks + `FFCS_SHARE_VERSION` |
| Backup file  | ✅ JSON export/import incl. UI prefs                  | ✅ JSON (import doubles as friend intake)                                                   |
| Undo         | ✅ one-level snapshot                                 | ❌                                                                                          |
| Cross-device | share URL only                                        | share URL only (cloud explicitly out of scope)                                              |

## 5. Analysis

**FFCSketch's export/import story is _sufficient_:** PNG for humans, text for chat, CSV for spreadsheets, JSON for backup, `?s=` for sharing, XLSX for catalogue intake. Zero backend, zero versioning risk beyond `v1`.

**AmazeCC's is a _suite_:** it treats output as a product surface — 4 share encodings with a versioned codec and a receiver route, PDF/iCal/clash-report/portrait formats, off-screen rendering with a live-DOM fallback, and a worker so PDF generation never blocks the tab. It also treats input as a product surface: paste with confidence scoring, VTOP class-ID decoding, and three catalogues.

**The real difference is fragility vs. machinery:**

- FFCSketch's single Base64URL payload has **no format version** — any state-shape change silently breaks old links, and long plans can exceed practical URL lengths with no warning.
- AmazeCC's codec has an explicit version, an oversize warning, and four granularity levels — but requires a receiver route and 900 lines of codec/input parsing code to maintain.

**Notable omission on both sides:** neither offers a short link (no backend), per-share privacy controls, or OG metadata for shared links. AmazeCC documents this as deliberate (`docs/ffcs-ccv/03-implementation-plan.md:188`).
