# Phase 3 — tone maps and token homes

Ten files. Small diffs, disproportionate effect: five of them already look correct on screen and
are wrong only in that they do not share a single source of truth.

## The bug that motivates this phase

`uiTokens.ts:63-67`:

```ts
export const SEG_ACTIVE = "bg-white dark:bg-zinc-900 shadow-2xs font-extrabold";
export const SEG_IDLE = "text-zinc-500 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200";
```

The comment above it says why `SEG_ACTIVE` carries no text colour: *"the accent colour is the
caller's choice, and baking it in would leave two competing `text-*` classes for the cascade to
arbitrate."* `Controls.tsx:113` then supplies `text-indigo-600 dark:text-indigo-400` at the call
site.

`tasks/TasksTab.tsx:75-78` declares its own:

```ts
const SEG_ACTIVE = "bg-indigo-600 text-white shadow-2xs font-extrabold";
const SEG_IDLE = "text-zinc-500 dark:text-zinc-400";
```

Two definitions of the same name, in direct contradiction, in a file that also hand-rolls a
segmented control at L348-366. The local one bakes the accent in, which is the exact thing the
real token's comment says not to do. The result is that a `SegmentedControl` converted from
`TasksTab` will not match what `TasksTab` renders today.

## 0.3 prerequisite

Phase 0's radius normalisation must land first, or these diffs carry unrelated radius noise.

## The five shadowing files

### `tasks/TasksTab.tsx` (507 loc) — the worst

| Line | Shadow | Action |
|---|---|---|
| L56-62 | local `TONE_TEXT` | import from `@/lib/uiTokens` |
| L64-71 | local `TONE_BADGE` | import |
| L73 | `CARD_BASE = \`${TILE} min-h-36 sm:min-h-40\`` | → `StatTile` (`height` prop already takes this) |
| L75-78 | local `SEG_ACTIVE`/`SEG_IDLE` | import; then the L348-366 hand-rolled strip → `SegmentedControl` |
| L311-334 | hand-rolled hero stat card | → `StatTile` |
| L348-366 | hand-rolled view-mode control | → `SegmentedControl` (it already has icons, so `opt.icon`) |
| L369-388 | hand-rolled course-filter strip | → `ChipTabs` |
| L393-439 | hand-rolled section header (with the `right` slot modelled) | → `SectionHeader` |
| L414-437 | 3 hand-rolled status pills | → `ToneBadge` |
| L293-305 | 2 hand-rolled action buttons | → `GhostButton` |
| 6 `dash` hits | hand-rolled empty states | → `EmptyPanel variant="dashed"` |

`StatTile` is the interesting swap. `CARD_BASE` exists because a hero stat tile was needed
before `StatTile` was written; `StatTile`'s own docstring (`Surfaces.tsx:43-54`) is the argument
for it — constant measurements belong in a tile, rotating values in an `InsightCarousel`.

### `payments/PaymentsTab.tsx` (780 loc)

| Line | Shadow | Action |
|---|---|---|
| L107-114 | local `TONE_TEXT` | import |
| L116-124 | local `TONE_BADGE` | import |
| L127 | `CARD_BASE = \`${TILE} min-h-32 sm:min-h-36\`` | → `StatTile` |
| L129-130 | local `LIST_ROW`, **missing the `hover:bg-*` transition** | import the real one; this is a visible regression on hover |
| L398-402 | hand-rolled error panel | → `EmptyPanel` / `TONE_BADGE.red` |
| L529-541 | hand-rolled section header | → `SectionHeader` |
| L543-563 | hand-rolled segmented control, an inline `SEG_ACTIVE` copy | → `SegmentedControl` |
| L18, L469, L723-724 | amazeui `Skeleton` | → `ListSkeleton` |

The local `LIST_ROW` is worth a note: it drops `hover:bg-zinc-50 dark:hover:bg-zinc-800/40` and
the `transition-colors`. Importing the real token **adds** a hover state the page does not
currently have. That is the correct outcome, but it is a visible change, so it gets called out
rather than slipped in.

### `exams/CourseDetailSubpage.tsx` L1012-1018 (2,140 loc)

| Line | Shadow | Action |
|---|---|---|
| L1012-1016 | local `TONE_TEXT` | import |
| L1018-1024 | local `TONE_BADGE` | import |

Phase 6 handles the rest of this file. The tone maps go here because they are the phase's whole
subject, and because the local maps are *inside* the reference implementation — a file the
whole plan cites should not be one of the five offenders.

### `tasks/TaskCard.tsx` (218 loc)

| Line | Shadow | Action |
|---|---|---|
| L27-56 | `KIND_CONFIG.badgeClass` — a third local tone map, reading tone names to class strings | → `TONE_BADGE[tone]` |
| L86 | inlined `TILE_CARD` with different padding | → `TILE_CARD` |
| L114-119 | hand-rolled kind badge | → `ToneBadge` |
| L122-131 | hand-rolled course-code chip | → `CHIP` |
| L134-138 | hand-rolled "Overdue" pill | → `ToneBadge tone="red"` |
| L188-198, L200-213 | 2 hand-rolled icon buttons | → `IconButton` |
| L142-148 | hand-rolled title block | → `ListRowText` |

L86 is the cleanest example of the anti-pattern in the whole plan: it is `TILE_CARD` retyped with
`p-3.5` and `shadow-2xs`. Every character is the same; only the padding differs. That is what
`TILE_CARD` plus a `className` is for.

### `events/EventHubSubpage.tsx` (673 loc)

| Line | Shadow | Action |
|---|---|---|
| L42-50 | `ACTION_TONE` — a fourth tone map; the amber/emerald/violet entries are close to `TONE_BADGE` but rounded and sized differently | reconcile against `TONE_BADGE`; keep the local map only if it carries a real difference, and say which |
| L4, L614, L642, L651, L660 | amazeui `Button` ×4, the old gray+blue dialect | → the file's own `ACTION_PRIMARY` (L40-50) |
| L3, L492-494 | amazeui `Skeleton` | → `ListSkeleton` |
| L515-531 | hand-rolled cell that duplicates `KeyValue`'s exact class string | → `KeyValue valueClassName` |
| L588-595 | hand-rolled "About this event" header | → `SectionHeader` |

L515 is worth flagging in review: a `KeyValue` clone means the two will drift, which is how
`KeyValue` came to need a `valueClassName` prop in the first place.

### `timetable/SlotDetailSheet.tsx` (309 loc) — the token-home fix

| Line | Issue | Action |
|---|---|---|
| L31 | imports `CHIP, TONE_BADGE, TONE_TEXT` from `@/lib/libraries/ui` | repoint to `@/lib/uiTokens` |
| L51-69 | local `Section` component — a hand-rolled section header, used at L228, L248, L283 | → `SectionHeader` |
| L166 | hand-rolled dashed empty state | → `EmptyPanel` |
| L177, L256 | 2 inline tiles | → `TILE_CARD` |
| L284-303 | hand-rolled availability pills | → `ToneBadge` |

`@/lib/libraries/ui` is 6 lines: `export * from "../uiTokens"`. Identical tokens, misleading
path. 13 files import through it — 4 in `libraries/` (fine, it is their local path and the file
says so) and **9 outside it** (7 in `social/`, this one, and `SlotDetailSheet`).

Repoint the 9 non-`libraries` files. Leave the 4 in `libraries/` — `libraries/ui.ts:4` documents
the intent: *"This file stays as the feature-local import path used across the Libraries
components."*

## After the five: the remaining tokens

| File | Line | Action |
|---|---|---|
| `exams/MarksDisplay.tsx` | L150 | `PREDICTED_BADGE_CLASSES` → `TONE_BADGE` |
| `exams/AllGradesDisplay.tsx` | L12-20 | `GRADE_BADGE_CLASSES` → `TONE_BADGE` (file is deleted in Phase 0) |
| `exams/courseHelpers.tsx` | L142 | `TypeBadge` → `TONE_BADGE` + `CHIP` |
| `exams/marks-predictor/AddCustomCourseModal.tsx` | L51 | inline 40×40 tone tile → `TONE_ICON_TILE.indigo` |
| `exams/CircularsTab.tsx` | L111 | inline 44×44 tone tile → `TONE_ICON_TILE.blue` |
| `tasks/TaskBadge.tsx` | L41-55, L66 | `bg-red-50 border-red-200/60` is the old `/50`+`/200/60` form, not the token's `/10 bg` + `/20 border` | → `ToneBadge tone={…}` |
| `attendance/*` (3 files) | L213-253, L594-606, L269-285 | hand-rolled dot+label legends | → `ToneLegend`, and dedupe where a file has two |

## Ordering

1. `SlotDetailSheet` token repoint (smallest, unblocks grep)
2. `TaskCard`, `TaskBadge` (contained, 2 files)
3. `EventHubSubpage` (4 amazeui `Button` sites, one reconciliation decision)
4. `PaymentsTab`, `TasksTab` (the two with visible `LIST_ROW`/`SEG_*` changes — review these two
   by eye, do not trust the tests alone)
5. `CourseDetailSubpage` tone maps only; Phase 6 does the rest

## Gate

```
pnpm test        # 854
pnpm typecheck
pnpm lint
```

The grep that defines success:

```
# must return nothing outside uiTokens.ts and primitives/
grep -rn "const TONE_TEXT\|const TONE_BADGE\|const LIST_ROW\|const SEG_ACTIVE\|const CARD_BASE" src/
```

No test file asserts on any of these, so the count must be exactly 854.

## Net effect

Roughly −180 lines of duplicated class maps, five contradictory definitions of `SEG_ACTIVE`
reduced to one, and one `KeyValue`-shaped hover state that was silently missing from
`PaymentsTab` restored.
