# Phase 6 and verification

Phase 6 converts the reference implementation itself. This file covers that, and the
verification gates for every phase.

## Why Phase 6 exists

`CourseDetailSubpage.tsx` is the file the entire plan cites. It is 2,140 lines, and the overview
block at L1388-1550 is exemplary — two `InsightCarousel` heroes over one `ListShell`, every row
a 40×40 `TONE_ICON_TILE` + `ListRowText` + value + `ChevronRight`.

Outside that block it has **14 violations**:

| Line(s) | Violation | Fix |
|---|---|---|
| L97, L138, L146-150, L656-660 | hand-rolled subpage state machine: the `innerTab` union, `useOverlayBack`, `handleBack` | → `useSubpageStack` + `SubpageScreen` |
| L1361 | hand-rolled page shell string | → `PageShell` |
| L1363-1378 | hand-rolled back button + title block | → `PageShell onBack` / `eyebrow` / `title` |
| L1122-1125, L1138-1141, L1185-1196, L1954-1959 | 4 hand-rolled section headers | → `SectionHeader` |
| L1197-1211 | hand-rolled segmented control | → `SegmentedControl` |
| L976, L983, L1344 | 3 hand-rolled icon buttons | → `IconButton` |
| L1334, L1852, L1888, L1895 | inline tiles, `rounded-3xl` + gray dialect (`border-gray-200/50`, `dark:bg-black/40`) | → `TILE_CARD` |
| L1991, L2052 | 2 hand-rolled `TILE_SURFACE` copies | → `TILE_CARD` |
| L2039 | hand-rolled empty state | → `EmptyPanel` |
| L1834-1836 | hand-rolled `Skeleton` stack, `rounded-3xl` | → `ListSkeleton` |
| L1645 | amazeui `Card` | → `TILE_CARD` |
| L1031, L1054, L1443, L1466, L1487, L1508 | 6 rows spelling `LIST_ROW` by hand | → import the token |
| L1012-1024 | local `TONE_TEXT`/`TONE_BADGE` | **Phase 3** |

The L1031/1054/1443/1466/1487/1508 rows are the instructive ones. They are **visually
correct** — the same class string, typed out. Importing the token changes nothing on screen and
makes the token greppable, which is the whole point of having it.

### The `innerTab` machine is the real work

L97 declares the union; L146-150 registers two `useOverlayBack` entries; L656-660 is
`handleBack`; `CourseDashboard.tsx` (94 loc) owns the outer level and the deep-link resolution
via `localStorage["course_dashboard_target"]`.

That is `useSubpageStack` plus a route concern, and `CourseDashboard`'s `localStorage` deep-link
is the part that needs care — the hook is deliberately local UI state that "must not survive a
reload" (`Subpage.tsx:14-16`), and a deep link is exactly a reload-settable initial screen. That
works via the `initial` option, but it is worth a test.

**Do Phase 6 after Phases 1-4.** Two reasons: `SimplifiedAcademicsPage` (which sets
`selectedCode` on this router) is Phase 2, so the router's caller is already converted; and
Phase 4's `useSubpageStack` conversions will have established whether the hook actually fits,
which is a question `CurriculumPage` (Phase 1) answers first.

### Order within the file

1. The 6 `LIST_ROW` rows + 2 `TILE_CARD` copies (no visual change)
2. Local tone maps (already Phase 3)
3. 4 section headers, 3 icon buttons, 1 segmented control, 1 empty state, skeletons
4. The gray-dialect tiles L1334/1852/1888/1895
5. `PageShell` + the `innerTab` machine — **own commit, needs the deep-link test**

## Verification gates

Run per phase, not per commit within a phase.

```bash
pnpm test        # vitest run — baseline 854 across 46 files
pnpm typecheck   # tsc --noEmit
pnpm lint        # eslint
```

`pnpm build` (`next build --webpack`, `output: 'export'`) once at the end of Phases 4, 5 and 6.
Not per phase: it is slow, and no phase introduces a new dependency or a bundler-visible
construct. Phase 5 is the exception worth a build check — `AutoGeneratorModal` is dynamically
imported, and a retint that moved an import across a `dynamic()` boundary would only show up in
a build.

### The 854 assertion

Every phase must report **exactly 854 passing across 46 files**. Not fewer — the count is a
tripwire.

| Delta | Meaning | Action |
|---|---|---|
| drops | a deleted file was imported by a test | **stop and report** |
| drops | a conversion removed a `describe` block | **stop and report** — that was a real test |
| rises | a new test was added | fine, expected in Phase 6 |
| same count, a test rewritten | an assertion was weakened | **stop and report**, see below |

The Phase 0 deletions (`PopupCard`, `AllGradesDisplay`) are the specific case. Neither has a
test, so 854 is expected. If it drops, the grep that declared them dead was wrong.

### Assertion policy

Nine test files assert on rendered DOM:

| Test | DOM | Class | In scope |
|---|---|---|---|
| `simplifiedMobileHome.weekStrip.test.tsx` | 39 | 15 | **no** — home is excluded |
| `localStorageSubpage.test.tsx` | 29 | 2 | Phase 5 residual |
| `timetable-vertical-render.test.tsx` | 9 | 9 | Phase 5 — should need no change |
| `dayDetailSheet.test.tsx` | 12 | 0 | Phase 1 — should need no change |
| `insightCarousel.test.tsx` | 6 | 1 | no — tests the primitive itself |
| `useHorizontalSwipe.test.tsx` | 5 | 3 | no — hook |
| `examScheduleDisplay.filter.test.tsx` | 3 | 2 | Phase 6 |
| `timetable-horizontal-law.test.tsx` | 2 | 1 | Phase 5 — should need no change |
| `intro-song-hydration.test.tsx` | 2 | 0 | no |

**An assertion may be changed only when the new markup is the intended grammar, and only with
the change called out in the commit message.** Weakening an assertion to make a migration pass
defeats the point of having the gate. The three `toHaveClass`-heavy files are the risk:
`timetable-vertical-render` asserts on grid cells, which per
[01-grammar.md](./01-grammar.md) are explicitly *not* in scope, so a failure there means the
conversion over-reached.

## Structural greps

The plan's success criteria are greppable. Run at the end of each phase.

```bash
# 1. The old dialect is unreachable by a local-looking name
grep -rn 'from "\.\./shared/[A-Z]\|from "\./shared/[A-Z]' src/
# after Phase 4: empty

# 2. No hand-retyped tile surface outside the primitives
grep -rn "backdrop-blur-xl" src/ | grep -v "uiTokens.ts\|primitives/"
# after Phase 5: empty

# 3. No locally declared tokens
grep -rn "const TONE_TEXT\|const TONE_BADGE\|const LIST_ROW\|const SEG_ACTIVE\|const CARD_BASE" src/
# after Phase 3: empty

# 4. No off-scale radius
grep -rn "rounded-3xl\|rounded-\[1[0-9]px\]\|rounded-\[2[0-9]px\]" src/
# after Phase 0: only 24/28/32 remain, which are on the amended scale

# 5. amazeui imports are only `cn` and types
grep -rn 'from "@amazecontinuityprojects/amazeui"' src/
# after Phase 5: only cn/type imports remain
```

Grep 5 is the one that proves the plan finished. 77 files import amazeui today.

## What "done" means

| Criterion | Measure |
|---|---|
| Primitives adopted | ≥ 190 of 215 `.tsx` files import `shared/primitives` or `@/lib/uiTokens`, up from 39 |
| Dialects | 1 (zinc), excluding documented per-file exceptions |
| Old dialect | unreachable: greps 1 and 5 both clean |
| Tokens | one source: grep 3 clean |
| Radius | amended scale only: grep 4 clean |
| Dead code | `PopupCard` + `AllGradesDisplay` gone (−992 loc) |
| Lines | net **−800** |
| Tests | 854 passing, none weakened |
| `pnpm build` | passes at end of Phases 4, 5, 6 |

The 182→~25 residual is the primitive folder itself, the shims' local implementations
(`BottomSheet`, `Button`), the app shell (`layout.tsx`, `error.tsx`, `not-found.tsx`, `~offline`),
the two home screens, and the pure-logic files with no JSX. That is the correct floor — none of
them should be importing tokens, because they have no surfaces to style.
