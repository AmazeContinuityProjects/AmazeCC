# The grammar, restated

The target dialect, written as rules so a conversion can be checked rather than judged. Every
rule cites the file that defines it and the file that already obeys it.

## Where the grammar lives

| Layer | Location | Role |
|---|---|---|
| Class-string tokens | `src/lib/uiTokens.ts` (112 lines) | Surfaces, controls, tone maps |
| React primitives | `src/components/custom/shared/primitives/` (14 files) | Structure and behaviour |
| Design intent | `design/DESIGN_LANGUAGE.md` | Radius, spacing, motion, icons |
| Reference impl | `exams/CourseDetailSubpage.tsx` L1388-1550 | The overview block |

The primitives' own barrel says the right thing (`primitives/index.ts:15`): *"Migrating a page
is a mechanical swap; nothing here is required."* That is the intent, and it holds for phases
1-4.

## Rules

### R1 — Three surfaces, and only three

`uiTokens.ts:16-37` defines one `TILE_SURFACE` and three derivations:

| Token | Use |
|---|---|
| `TILE` | A surface that pushes its children apart (`flex flex-col justify-between`) |
| `TILE_CARD` | A surface that stacks children in normal flow |
| `TILE_INTERACTIVE` | `TILE` plus the hover/active affordance |

The surface is `rounded-[24px] bg-white/80 dark:bg-zinc-900/70 backdrop-blur-xl border
border-zinc-200/70 dark:border-zinc-800/80 shadow-xs`. That exact string, retyped by hand, is
the single most common violation — 34 occurrences of `backdrop-blur-xl` across 15 files.

`TILE_INTERACTIVE` exists because that interaction suffix was copy-pasted at every call site in
Libraries and Simplified Mobile Home. A missed suffix reads as a dead surface.

### R2 — Grouped rows are one `ListShell`, not N cards

`LIST_SHELL` (`uiTokens.ts:43`) is the container; `LIST_ROW` (`:46`) is the row. The canonical
row, from `CourseDetailSubpage.tsx:1441-1462`:

```
40×40 rounded-2xl TONE_ICON_TILE  →  ListRowText  →  value + ChevronRight
```

`LibrariesTab.tsx:663-667` is the same shape. Dividers come from `LIST_SHELL`'s
`divide-y divide-zinc-200/60`; curves appear only on the shell's outer top and bottom.

### R3 — Section headers are `SectionHeader`, never retyped

`Surfaces.tsx:11` — indigo `w-4 h-4` icon, `text-sm font-black ... font-outfit tracking-tight`
title, optional `SECTION_CHIP` count, optional `right` slot.

48 hand-rolled equivalents exist across 18 files. `TasksTab.tsx:393-439` is the instructive
case: it already models the `right` slot by hand.

### R4 — Filters are `SegmentedControl`; ordered pickers are `ChipTabs`

`Controls.tsx:70` and `:136`. The distinction matters and is documented in the source: a
segmented control is for values you can all see at once; a chip strip is for an ordered set that
may run off screen, and it scrolls rather than wrapping, because a picker that reflows into two
rows stops reading as a sequence.

`FreeClassroomsTab.tsx:183-229` has a day-strip that is a segmented control with day data. That
is an **accepted exception** — it is already on-grammar visually and the data shape does not fit
`SegmentedControl`'s label-only contract.

### R5 — A tile is constant; a rotating value is an `InsightCarousel`

`Surfaces.tsx:43-54` states this and gives the reason: *"A tile is a measurement that does not
change under the reader. A set of values worth rotating through is an `InsightCarousel`, and
something that navigates belongs in a section header as an action, not here. The calendar page
tried all three in one row and none of them read."*

`StatTile` pins `height` rather than using a min-height on purpose (`Surfaces.tsx:47-48`): with
three stacked lines a min-height lets content grow into the padding and collide.

### R6 — Drill-downs use `useSubpageStack` + `SubpageScreen`

`Subpage.tsx` (97 lines) exists because, per its own docstring, every page hand-rolled
`type Screen = "landing" | ...`, a `back()` that pops to landing, and a root-exit escape hatch.
148 hits of this pattern exist across 22 files.

`libraries/LibrariesTab.tsx:67,340,836` is the shape — and note it is *older* than
`useSubpageStack`. Copy its tone discipline, not its state machine.

### R7 — Colour appears in four places only

Per `social/rows.tsx:11-13`, restating Libraries' discipline:

1. the icon well (`TONE_ICON_TILE`)
2. the status dot (`ToneDot` / `DotPill`)
3. a tone-mapped number (`TONE_TEXT`)
4. a tone-mapped pill (`TONE_BADGE`)

Everything else is zinc. At most three semantic hues plus indigo per screen.

### R8 — Tone maps come from the module, always

`uiTokens.ts:70-102` defines `TONE_BADGE`, `TONE_TEXT`, `TONE_ICON_TILE`. Five files redeclare
them. `TasksTab.tsx:75` is the bug this rule exists to prevent — see
[00-overview.md](./00-overview.md).

Note the token recipe: `bg-<c>-500/10 border-<c>-500/20 text-<c>-600 dark:text-<c>-400`.
`tasks/TaskBadge.tsx:41-55` uses the old `bg-red-50 border-red-200/60` form instead.

### R9 — Radius comes from the scale

Shipped values, which is what `DESIGN_LANGUAGE.md` is being updated to match:

| Value | Where |
|---|---|
| 8 | `rounded-lg` — segmented segments, inner chips |
| 12 | `rounded-xl` — icon buttons (`ICON_BUTTON`), tone tiles |
| 16 | `rounded-2xl` — `LIST_SHELL`, `CHIP`, most content cards |
| 24 | `rounded-[24px]` — `TILE` surface, `InsightCarousel`, `BottomSheet` (28) |
| 28 | `BottomSheet.tsx:226,244`, `EMPTY_STATE` (`uiTokens.ts:105`) |
| 32 | `EmptyPanel` card variant (`Feedback.tsx:228`) |

The doc currently says "12 / 16 / 24 / 32, no arbitrary values". 8, 28 and 32-in-practice
disagree. Phase 0 resolves this in the doc's favour of the code.

### R10 — Loading is `ListSkeleton`; empty is `EmptyPanel`

`ListSkeleton.tsx`, `Feedback.tsx:180-250`. `EmptyPanel` has two variants — `card` (tinted icon
tile) and `dashed` (lighter outlined box) — covering 25 hand-rolled `border-dashed` blocks.

### R11 — Forms use `SelectField` / `FIELD_INPUT`

`SelectField.tsx`, `uiTokens.ts:107`. At least 25 raw `<select>`/`<input>`/`<textarea>` elements
carry hardcoded `bg-slate-950 border-gray-800` or `border-gray-200 bg-gray-50`.

### R12 — `PageShell` owns the page chrome

`PageShell.tsx:20-21` — one `SHELL_BASE` string that was copy-pasted nine times. It handles the
eyebrow/title/subtitle block, the action cluster, and the back button.

Two props exist to stop adoption from silently changing behaviour, and both matter:

- `selectable` (`:59`) — most pages block text selection; setting it preserves existing
  behaviour
- `wrap` (`:52`) — for titles that are user data, where a one-line ellipsis would discard the
  thing the reader came for

## What is NOT a violation

Three things the audit flagged that should be left alone:

- `timetable/TimetableView.tsx:181-184` — a fixed-height `animate-pulse` box. This is a grid
  placeholder, not a list; `ListSkeleton` would be the wrong shape.
- `FreeClassroomsTab.tsx:183-229` — the day-strip noted in R4.
- `InsightCarousel.tsx:159` and the two `BottomSheet` radii — bespoke surfaces, on-scale by
  the Phase 0 doc amendment.

## Verification per rule

A conversion is done when the file imports from `@/lib/uiTokens` or `shared/primitives`, and no
longer contains: `backdrop-blur-xl` outside a primitive, `rounded-3xl`, a locally declared
`TONE_*`/`LIST_ROW`/`SEG_*`/`CARD_BASE`, a `border-dashed` block, or an import from
`@amazecontinuityprojects/amazeui` that is not `cn` or a type.
