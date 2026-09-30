# Phase 5 — the four dialects

The only phase in this plan that is not a token swap. Everything here is a **surface rewrite**:
the areas do not use the target palette, so the classes have to be replaced rather than
imported.

Estimate: ~6,500 lines. Treat it as its own project with its own review, not as a tail on
Phases 1-4.

## Why these are different

`TILE_SURFACE` (`uiTokens.ts:16-17`) is:

```
rounded-[24px] bg-white/80 dark:bg-zinc-900/70 backdrop-blur-xl
border border-zinc-200/70 dark:border-zinc-800/80 shadow-xs
```

A `TILE_CARD` swap works when the file already has a zinc surface with the wrong wrapper. It does
not work when the surface is a different colour system, because the mapping is a design decision,
not a substitution.

| Dialect | Signature | Dark surface | Target dark surface |
|---|---|---|---|
| **gray/slate** | `bg-white/50 border-gray-200/80` | `dark:bg-slate-900/50` | `dark:bg-zinc-900/70` |
| **white-alpha** | `bg-white/40 border-white/50` | `dark:bg-white/5` | `dark:bg-zinc-900/70` |
| **semantic** | `bg-background border-border` | via CSS vars | `dark:bg-zinc-900/70` |

The semantic dialect is the odd one: `bg-background` / `border-border` / `text-muted-foreground`
are *theme-aware* CSS variables, so those files arguably adapt to the accent palette
automatically, while a hard-coded zinc does not. That is a real argument for the semantic
dialect, not just an oversight.

**The decision, stated plainly:** the target is the zinc surface because that is what the
reference implementation and the 16 clean files use. Where a semantic-token file is doing
something the zinc surface cannot (theme adaptation, a genuinely different surface role), that
is a legitimate local exception and should be recorded in the file's header comment, not
silently converted. Convert the ones that are the same surface in a different colour; leave and
document the ones that are not.

## 5.1 FFCS — the semantic dialect

The largest single item. 6 files, ~4,546 lines, **283 semantic-token hits**.

| File | loc | `sem` hits | `dash` | Decision |
|---|---|---|---|---|
| `exams/FFCSTimetableTab.tsx` | 2612 | **139** | 5 | Convert |
| `exams/FFCS/components/modals/AutoGeneratorModal.tsx` | 1250 | **97** | 3 | Convert |
| `exams/FFCS/components/modals/TargetCoursesModal.tsx` | 218 | 12 | – | Convert |
| `exams/FFCS/components/modals/SocialMatrixModal.tsx` | 149 | 16 | 1 | Convert |
| `exams/FFCS/components/modals/FriendTimetableViewModal.tsx` | 99 | 5 | – | Convert |
| `exams/FFCSGuideModal.tsx` | 102 | 10 | – | Convert |

The four modals are the cheapest entry: each has a semantic shell, one or two `EmptyPanel`
candidates, and a `BottomSheet` that already exists. Do all four first — ~568 lines, and it
establishes the semantic→zinc mapping before the two giants.

### `FFCSTimetableTab.tsx` — the shape of the work

Already delegates its grid: `TimetableView` at L1816 and L50, via
`FFCS/components/TimetableGrid.tsx` (62 loc, clean). So the retint is the *shell*, not the data
visualisation. That is what makes a 2,612-line file tractable.

| Line(s) | Work |
|---|---|
| L2281-2294 | hand-rolled segmented control → `SegmentedControl` |
| L2306, L2378, L2477, L2607, L2679, L2716, L2788, L2827, L2899 | **10** hand-rolled dashed empty states → `EmptyPanel variant="dashed"` |
| L1871, L2675, L2784 | 3 amazeui `EmptyState` → `EmptyPanel` |
| 8 locations | hand-rolled modal shells → `BottomSheet` |
| L1688 | `animate-pulse` loading block → `ListSkeleton` |
| throughout | the 139 `bg-background` / `border-border` / `text-muted-foreground` → `TILE_CARD` / `TONE_BADGE` |

Do this file **after** the four modals, and in its own commit. It is the one file in the plan
where a reviewer needs a checklist rather than a diff.

### `AutoGeneratorModal.tsx`

1,250 lines, 97 hits, plus 3 dashed empty states (L1333, L1496, L1591), a hand-rolled icon
button (L1157) and a full-screen page shell (L587). Retint the shell first, then the
`EmptyPanel`s — the reverse order means reviewing a diff where every class changed at once,
which is how visual regressions get through.

## 5.2 Hostel — the gray/slate dialect

3 core files plus `HostelCounsellingView`, 5 files, ~1,300 lines.

| File | loc | `gray` hits | `wa` | Work |
|---|---|---|---|---|
| `MessDisplay.tsx` | 510 | – | – | 4 control clusters, 3 tiles, 1 empty state |
| `LaundryDisplay.tsx` | 425 | 6 | – | 4 tiles, 2 toggles, search, legend, pill |
| `LeaveDisplay.tsx` | 374 | 5 | 1 | 5 tiles, 3 headers, 5 status pills, KVP grid, `divide-y` list, **5 raw form fields** |
| `HostelOverview.tsx` | 318 | 5 | – | 5 tiles, 4 buttons, KVP grid, links list |
| `HostelCounsellingView.tsx` | 64 | 1 | – | skeleton, header, info card |

**The shared header.** `MessDisplay`, `LaundryDisplay` and `LeaveDisplay` each have an
identical hand-rolled header bar: `flex flex-col md:flex-row … pb-4 border-b border-gray-150`.
One `PageShell` fixes all three. Extract that first, verify it in one file, then apply.

**`LeaveDisplay.tsx` L303-358** is the worst form offender in the repo — five raw
`select`/`input`/`textarea` with hard-coded `bg-slate-950 border-gray-800`. → `SelectField` /
`FIELD_INPUT`.

**`HostelOverview.tsx` L294-307** hand-rolls a list of links. → `ListShell` + `ListRowText`,
which is the shape `rows.tsx` already uses for the social equivalent.

**`HostelCounsellingView.tsx` is blocked on `Dashboard.tsx`.** As noted in Phase 4,
`Dashboard.tsx:1058-1067` wraps it in a second header and a `bg-info-surface text-info` reload
button. Fix both in the same commit or the screen shows two headers.

## 5.3 Dayscholar — the white-alpha dialect

2 files, 620 lines, **14 white-alpha hits**.

| File | loc | `wa` | `gray` | Work |
|---|---|---|---|---|
| `BusFinder.tsx` | 298 | 7 | 2 | amazeui `Card`/`CardHeader`/`CardTitle` L2, `SearchInput` L6, `EmptyState` L7, hand-rolled header L38-43, 6 white-alpha panels, decorative `blur-2xl` blobs L61/63/126 |
| `TransportRegistration.tsx` | 322 | 7 | 1 | `CardShell` (`solid-card`) L16-20, 1 empty state, 1 status pill, 6 white-alpha panels, 2 actions, 1 header |

`BusFinder.tsx` is the single densest shim user outside FFCS: **5 of 6 shim families in one
file**, plus amazeui's `Card`. It is also only 298 lines. Convert it first in this section — best
effort-to-value ratio in the phase.

The decorative blobs (L61, L63, L126) are not a primitive problem. `DESIGN_LANGUAGE.md:108-115`
rules out "random blob shapes", so they are a design violation independent of the dialect. Decide
per blob: remove, or keep and document.

## 5.4 CabShare — white-alpha, and partly semantic

7 files, ~1,180 lines.

| File | loc | `wa` | rad | Work |
|---|---|---|---|---|
| `SearchTrips.tsx` | 323 | 11 | 5 | 4 surfaces, 2 `EmptyState`, 3 form fields, 1 loading panel, meta chips, primary action |
| `CreateTrip.tsx` | 262 | 9 | 1 | 1 shell, 1 icon-tile header, **6 raw form fields**, 1 radio-chip group |
| `MyTrips.tsx` | 223 | 11 | 4 | 2 `EmptyState`, 2 headers, 4 surfaces, 2 status pills, 2 icon buttons, 1 spinner |
| `CabShareAuthModal.tsx` | 192 | 4 | 2 | 2 panels, 1 icon tile, 2 inputs, hand-rolled page shell |
| `CabShareMatchCard.tsx` | 177 | – | 3 | 3 saturated `bg-amber-600`/`bg-violet-600`/`bg-blue-700` banners, 3 inner icon tiles |
| `CabShareTab.tsx` | 141 | 3 | 1 | `PageHeader`, `SubTabStrip`, 1 meta pill, 1 aside tile, quick-action rows, callout |
| `ShareTripButton.tsx` | 37 | – | – | 1 ghost pill that is exactly `GHOST_BUTTON` |

`CreateTrip.tsx` L137-247 has **six** raw form fields and `SearchTrips.tsx` L178-209 has three.
Across Phases 4-5 that is ~20 raw form fields on `SelectField`/`FIELD_INPUT`. Consider doing
them as one sweep at the end rather than per-file, so the form grammar is consistent across
`LeaveDisplay`, `CreateTrip`, `SearchTrips`, `TaskEditSheet`, `AttendanceTabs` and
`OfficialOdSection`.

`CabShareMatchCard.tsx` is the only file using fully saturated fills (`bg-amber-600`). R7 allows
colour in four places; a saturated banner is not one of them. → `TILE_CARD` + `TONE_ICON_TILE` +
`ToneBadge`.

## 5.5 The rest of the dialect files

Lower density, same treatment.

| File | loc | `wa` | `gray` | Work |
|---|---|---|---|---|
| `onboarding/AmazeOnboardingFlow.tsx` | 970 | – | – | 5 `tile`, 4 `rad`. Multi-step flow with its own shell — a `PageShell` per step |
| `header/ProfilePage.tsx` | 3015 | – | – | 22 hand-rolled icon buttons. Biggest non-FFCS file; mostly `IconButton` |
| `header/NavigationTabs.tsx` | 2134 | – | 3 | 1 `tile`, 2 `rad`. Owns the mobile bottom pill (L979) — high visibility, low risk |
| `exams/CourseDetailSubpage.tsx` | 2140 | 9 | – | 6 `tile`, 6 `rad` — **Phase 6** |
| `LoginForm.tsx` | 1170 | – | – | 7 `rad`, 3 `head`, 3 `icon` |
| `Main.tsx` | 2605 | 1 | – | 2 shims, 1 `icon` |
| `FresherWelcomePage.tsx` / `FresherWelcomeModal.tsx` | 389 / 180 | – | – | 1 `rad`, 1 shim |
| `app/privacy/page.tsx` / `app/terms/page.tsx` | 157 / 150 | – | – | 2 `tile` + 1 `rad` each |
| `palette/EventSearchPalette.tsx` | 574 | – | – | 1 `icon` |
| `shared/CommandPalette.tsx` | 428 | – | – | 1 `tile` |
| `attendance/*` residual | ~2,300 | 1-3 each | – | 1-3 `dash`/`icon`/`tile` each |
| `libraries/DuesView.tsx`, `CatalogSearch.tsx` | 260 / 650 | – | – | 4 `dash`, 2 `head` — **libraries is otherwise the reference; keep it that way** |

`ProfilePage.tsx` at 3,015 lines with 22 icon buttons is worth its own checkpoint. It is a
settings page, so the grammar question is whether it wants `SettingRow` / `ToggleRow` / `Switch`
(of which there are three, and it imports none) rather than 22 `IconButton` calls.

## Sequencing

Do the cheap proof first, so the mapping is established before the giants:

1. `BusFinder` (298 loc, 5 shim families, 7 `wa`)
2. The four FFCS modals (568 loc, establishes the semantic→zinc mapping)
3. The three hostel headers (one `PageShell`, applied 3×)
4. `LeaveDisplay` + `CreateTrip` form fields
5. `FFCSTimetableTab` + `AutoGeneratorModal` (own commits, checklist review)
6. `ProfilePage` icon buttons
7. The residual sweep

## Gate

```
pnpm test        # 854
pnpm typecheck
pnpm lint
```

Two tests are in scope and neither should need changes:

- `timetable-vertical-render.test.tsx` — 9 class assertions, all on grid cells. Grid cells are
  **not** a violation (see [01-grammar.md](./01-grammar.md)), and this phase does not touch them.
- `timetable-horizontal-law.test.tsx` — 1 class assertion, same reasoning.

`localStorageSubpage.test.tsx` (29 DOM queries, 2 class assertions) is in the residual sweep and
may need a look. If so, per the abort condition in [00-overview.md](./00-overview.md), fix the
assertion only if the new markup is the intended grammar, and report which.

## Abort condition

If a conversion here turns out to need a **new surface token** — something that is genuinely not
`TILE`, `TILE_CARD` or `LIST_SHELL` — **stop and report the proposed token and its justification**
before adding it. The whole plan rests on there being exactly three surfaces. A fourth one
introduced casually in Phase 5 would be the same fragmentation this plan exists to remove, and
`DESIGN_LANGUAGE.md:276` is explicit: *"Prefer composition over creation."*

## Net effect

Roughly −600 lines. One dialect in the product instead of four. The largest and most
review-intensive item in the plan, and the one most likely to surface a genuine reason for a
fourth surface — which is worth the cost of finding out deliberately.
