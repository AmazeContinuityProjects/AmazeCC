# Phases 1-2 — the zinc conversions

The mechanical work. Phases 1-4 are all token swaps and component substitutions; Phase 5 is
not, and is in [07-phase-5-dialects.md](./07-phase-5-dialects.md).

## Phase 1 — prove the grammar

Five files, 1-3 swaps each. The point is not the work, it is the evidence: if these are
genuinely one-liners, Phases 2-4 are worth scheduling at full size. If any is not, stop and
report before starting Phase 2.

### `attendance/ODTrackerSubpage.tsx` (552 loc)

Already imports `TILE`, `PageShell`, `EmptyPanel`, `InsightCarousel`, `SegmentedControl`.
Three violations.

| Line | Violation | Fix |
|---|---|---|
| L393 | inline tile in a file that already imports `TILE` | → `TILE_CARD` |
| L350-359 | hand-rolled section header | → `SectionHeader` |
| L11 | imports `BackButton` from `../shared`, now unused since `PageShell` owns the header | delete the import |

### `attendance/DayDetailSheet.tsx` (619 loc)

Already imports `ListShell`, `ListRowText`, `SectionHeader`, `ToneBadge`, `ToneDot`, `DotPill`,
`AvatarDot`, `EmptyPanel`, `GhostButton`. One violation, three occurrences.

| Line | Violation | Fix |
|---|---|---|
| L392, L405, L609 | three hand-rolled copies of the exact `ICON_BUTTON` string | → `IconButton` |

This file is also the **best reference for a `ListShell`-driven bottom sheet** — worth citing
once Phase 5 replaces `PopupCard`'s role.

### `attendance/CourseCard.tsx` (213 loc)

Imports amazeui `Card`/`CardHeader`/`CardTitle` (L3) and `InfoRow`/`CircularProgress` shims.
No primitives at all.

| Line | Violation | Fix |
|---|---|---|
| L3, 4 uses | amazeui `Card` | → `TILE_CARD` |
| L71-77, L90 | conditional `cardBg`/`cardBorder` maps | → `TILE_CARD`, tone via `TONE_BADGE` |
| L131, L172, L181, L187 | hand-rolled status pills | → `ToneBadge` |

### `attendance/AttendanceSummary.tsx` (141 loc)

The smallest file in the plan.

| Line | Violation | Fix |
|---|---|---|
| L77 | hand-rolled tile | → `TILE` |
| L130 | hand-rolled red pill | → `TONE_BADGE.red` via `ToneBadge` |

### `exams/CurriculumPage.tsx` (1,487 loc)

Already imports 9 primitives. Two violations, but the second is the interesting one.

| Line | Violation | Fix |
|---|---|---|
| L975 | inline `bg-white/80` tile in a file that already imports `TILE` | → `TILE` |
| L118, L197, L1290-1291 | `type Screen = "landing" \| TabView` + `useState<Screen>` + manual back — a hand-rolled stack | → `useSubpageStack` + `SubpageScreen` |

The stack conversion is R6 and worth doing here specifically: it is the only Phase 1 file where
`useSubpageStack` actually replaces something rather than being a no-op.

### `exams/CurriculumPage.tsx` and `attendance/ODTrackerSubpage.tsx` are the acceptance sample

If both land clean with no test changes, the conversion cost estimate in Phase 2 is sound. If
`CurriculumPage`'s stack swap turns out to need `useOverlayBack`-style behaviour that
`useSubpageStack` does not model, **stop and report** — that would mean the primitive is
incomplete, and every other stack conversion inherits the gap.

## Phase 2 — the big zinc offenders

Three items, roughly 3,600 lines. This is the phase where the app starts to look like one app.

### 2.1 `attendance/OverallAttendancePredictor.tsx` (1,134 loc)

The highest-leverage file in the repo. No primitives; imports only the `PageHeader` shim.

| Line(s) | Violation | Fix |
|---|---|---|
| L399-404 | amazeui `PageHeader` | → `PageShell` with `eyebrow="Attendance"` |
| L455, L627 | two hand-rolled back buttons (`ChevronLeft` + pill) | → `PageShell onBack`, delete both |
| L415-435 | hand-rolled segmented control (theory/lab) | → `SegmentedControl` |
| L466, L495, L516, L539, L606, L780 | **6** inlined tiles, and their borders are `border-gray-200/70` — gray dialect, not zinc | → `TILE_CARD` |
| L606, L765, L780, L940 | 4 × `rounded-3xl` | → 0.3 handles these |
| L561-575, L751 | two hand-rolled chip strips | → `ChipTabs` |
| L735 | hand-rolled search field | → `SEARCH_FIELD` |
| L765 | hand-rolled empty state | → `EmptyPanel` |
| L671-678 | hand-rolled day grid | **leave** — bespoke visualisation |

Note the L466-780 tiles carry `border-gray-200/70`. That is a *zinc file with gray borders*, not
a gray-dialect file. The 6 tiles are a `TILE_CARD` swap; the borders resolve with it.

### 2.2 `exams/SimplifiedAcademicsPage.tsx` (1,027 loc)

The course list that precedes the reference implementation. Only `EmptyPanel` imported.

| Line(s) | Violation | Fix |
|---|---|---|
| L742-777, L849-858 | two amazeui `PageHeader` | → `PageShell` |
| L734, L849 | two hand-rolled `max-w-3xl mx-auto space-y-*` shells | → `PageShell` |
| L768-774 | hand-rolled back button (`ChevronLeft` + blue pill) | → `PageShell onBack` |
| L652, L787, L870, L918, L944, L968, L1001 | 6 inlined tiles (`border-zinc-200/80 … bg-white/90 shadow-2xs`) | → `TILE_INTERACTIVE` (5) + `TILE_CARD` (1) |
| L875-897 | hand-rolled All/Theory/Lab/Embedded pill row | → `ChipTabs` |
| L782-788, L865-871 | two hand-rolled search fields | → `SEARCH_FIELD` |
| L801-815 | hand-rolled semester header strip | → `SectionHeader` |
| L652, 918, 944, 968, 1001 | 5 × `rounded-[22px]` | → 0.3, nearest step 24 |

The pill row at L875-897 is the one to be careful with: the order *is* meaningful (All → Theory →
Lab → Embedded), so `ChipTabs` scrolls rather than wrapping. That is the correct component per
R4, and it is also the one where a careless swap would change mobile behaviour. Check the
4-pill case at 320px.

This file also sets `selectedCode` on the `CourseDashboard` router, so it is on the critical path
into the reference implementation. Convert it before Phase 6.

### 2.3 `qbank/PureQBankTab.tsx` (208) + `qbank/PapersArchiveTab.tsx` (333)

Near-duplicates. Write the conversion once, apply twice.

| Line (Pure / Papers) | Violation | Fix |
|---|---|---|
| L12,20 / L14,25-27 | `type ViewState` + `useState` + `handleGoBack` | → `useSubpageStack` + `SubpageScreen` |
| L79-94 / L92-116 | hand-rolled shell + header + `ArrowLeft` back | → `PageShell onBack` |
| L97-116 / L125-144 | hand-rolled chip strip | → `ChipTabs` |
| L118 / L145 | amazeui `SearchInput` | → `SEARCH_FIELD` |
| L128,194 / L150,260 | 2 amazeui `EmptyState` each | → `EmptyPanel` |
| L142 / L280 | `rounded-2xl border-gray-200 bg-white` card | → `TILE_INTERACTIVE` |
| — / L215-236 | hand-rolled Papers/Questions segmented control | → `SegmentedControl` |
| — / L112, L207 | hand-rolled primary buttons | → `GhostButton` + local primary |

Both files use `SubpageLayout` (shim) and `EmptyState` + `SearchInput` (shims) — 3 shim families
each, so this also advances Phase 4.

## Also in Phase 2, if the budget allows

| File | loc | Work | Why here |
|---|---|---|---|
| `attendance/AttendanceSubpage.tsx` | 673 | 5 shims, 1 segmented control, 2 tiles, 2 duplicate legends | `ToneLegend` ×2 → dedupe to 1 |
| `attendance/OverallTrackerSubpage.tsx` | 388 | 3 shims, `ViewModeToggle` → `SegmentedControl`, 2 tiles, legend ×5 | same pattern, 285 loc smaller |
| `exams/AcademicsHub.tsx` | 449 | amazeui `Card`, 5 `rounded-3xl`, 3 headers, 5 tiles | top-level hub; sets the tone |
| `timetable/SlotDetailSheet.tsx` | 309 | local `Section` ×3, 2 tiles, 1 empty state, **wrong token module** | the token-module fix matters |
| `exams/CourseQBankTab.tsx` | 310 | hand-rolled segmented control, off-scale + gray tile, 2 `EmptyState` | small, and `academics` hub reaches it |

`SlotDetailSheet.tsx` L31 imports `CHIP, TONE_BADGE, TONE_TEXT` from `@/lib/libraries/ui`
rather than `@/lib/uiTokens`. That module is a 6-line `export * from "../uiTokens"`, so the
tokens are identical — but the import path lies about where the grammar lives. Repoint it.

## Gate

```
pnpm test        # 854, or report the delta
pnpm typecheck
pnpm lint
```

Tests in scope: `dayDetailSheet.test.tsx` (Phase 1), `localStorageSubpage.test.tsx` (1 DOM-heavy
file, 2 class assertions — should not be touched by either phase).

## Net effect

Roughly −250 lines. Nine files fully on-grammar, six more materially improved, and the
conversion cost empirically established before Phase 3 commits to ~10 more files.
