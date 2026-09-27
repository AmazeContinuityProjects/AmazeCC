# UI Redesign

The Social tab is rebuilt on the same grammar as the Libraries tab and Simplified Mobile Home. No new design language is introduced.

---

## 1. Why

`SocialTab.tsx` is 832 lines with six responsibilities and not one extracted component. The tell is that it imports **zero** shared design tokens — its `TILE`, `LIST_SHELL`, `LIST_ROW` and `ICON_BUTTON` strings are hand-copied verbatim from `src/lib/libraries/ui.ts`, and it has **seven** different empty states, none of which matches the house `EMPTY_STATE`. Meanwhile the modals pull in amazeui's `FetchButton` (blue gradient) and `Input` (gray borders, blue focus), so the feature is simultaneously indigo, purple, emerald, blue and gray.

## 2. Token module

`src/lib/libraries/ui.ts` is promoted to `src/lib/design/tokens.ts` — same exports, a re-export shim left behind — and Simplified Mobile Home's inlined copies are swept onto it. The sweep is small and mechanical: 3 `TILE` copies, 1 `LIST_SHELL`, 2 `ICON_BUTTON`, 3 large-radius shells.

Two tokens are added for what Social needs and the other pages lack:

| Token | Why |
|---|---|
| `TILE_INTERACTIVE` | `TILE` plus `transition-all hover:scale-[1.01] active:scale-[0.98] cursor-pointer` — currently copy-pasted at every tile call site |
| `SEARCH_FIELD` | The boxed search input; the Libraries catalog search needed it too |

## 3. The grammar, restated

Reference: `LibrariesTab.tsx:640-947` and `SimplifiedMobileHome.tsx:801-968`.

| Element | Rule |
|---|---|
| Page root | `w-full max-w-4xl mx-auto space-y-6 pt-3 sm:pt-5 md:pb-8 animate-in fade-in duration-300 text-left select-none` |
| Eyebrow | `text-xs font-semibold text-zinc-400 dark:text-zinc-500 leading-none mb-1` |
| Page title | `text-xl sm:text-2xl font-black text-zinc-900 dark:text-white tracking-tight leading-tight font-outfit truncate` |
| Hero tile | `TILE` + `h-32 sm:h-36`, three rows: label/badge, hero, footer |
| Tile label | `text-[10px] sm:text-xs font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-500 font-outfit truncate` |
| Tile hero | `text-3xl sm:text-4xl font-black font-outfit tracking-tight leading-none block` |
| Carousel headline | one step smaller, `text-2xl sm:text-3xl`, `t-2xl`-style truncation |
| Carousel | `AnimatePresence mode="wait"`, `m.div` `y: 6 → 0 → -6`, `duration: 0.2`, 5000 ms interval, hover/touch pause |
| Dots | `h-1.5 rounded-full transition-all duration-300`, active `w-3 bg-indigo-500`, idle `w-1.5 bg-zinc-200 dark:bg-zinc-700` |
| Section header | `<Icon className="w-4 h-4 text-indigo-500" />` + `text-sm font-black` + `SECTION_CHIP` |
| List shell | `LIST_SHELL` — divided, rows bleed to the content edge |
| Row | `LIST_ROW`, then icon tile → text block (`min-w-0 flex-1`) → optional count chip → `ChevronRight` |
| Empty state | `EMPTY_STATE` — one grammar, dashed border, no background |

Colour discipline, as in Libraries: at most **three semantic hues plus indigo**, and colour is allowed in only four places — a `TONE_BADGE`, a `TONE_TEXT` number, a 40×40 `TONE_ICON_TILE`, or a 1.5px status dot. Everything else is zinc.

## 4. Landing

**Header** — Simplified Mobile Home's identity pattern, because More and Tools already own the back navigation and a `BackButton` here would be wrong. Avatar, `Campus` eyebrow, `Social` title, and a right-hand `ICON_BUTTON` group: share-my-handle and add-peer.

**Tile 1 — People (pinned).** Hero count of paired peers. Badge is `Synced` / `Stale` / `Offline` from the last derivation. Footer: "N free right now". Tapping opens People.

**Tile 2 — carousel.** Rotating insight, not a duplicate of the nav — this is the specific defect in the current tile, which re-navigates to `free_now` and `friends` (`SocialTab.tsx:269-290`), duplicating the pill strip below it. Slides are drawn only when their data exists:

| Slide | Headline | Badge | Action |
|---|---|---|---|
| Peers free now | count or `—` | emerald / zinc | Free Right Now |
| Common free slots today | count of slots free for everyone | zinc | Common Free Grid |
| Last sync | relative time | zinc / amber | none (no-op, dot only) |
| Unpaired peers | count | amber | People |

**Sections** — one `LIST_SHELL` with four rows: **People**, **Pairs**, **Free Right Now**, **Common Free Grid**. Icon wells from `TONE_ICON_TILE`; count chips from `CHIP`.

**Removed:** the pill strip (`:467-530`), the Campus Radar banner (`:442-464`, folded into the carousel and the tile), and the bespoke hero app bar (`:310-359`). Those three are the "four redundant entry points" — `free_now` alone is reachable from the radar, a carousel slide *and* its own pill.

## 5. Subpages

Constant chrome, identical to Libraries: `BackButton` returning to the landing, the same eyebrow/title block, and a contextual action in the header's right slot.

**People.** Search lives here, not on the landing. Rows: avatar with a free/busy dot, name, then **real** meta — `N common free slots · last published 3d ago`. A peer past 14 days carries a stale badge; a peer with no record for the current semester reads "not published" rather than showing an empty row. The row is a `<div>` with an inner `<button>`, fixing the nesting at `SocialTab.tsx:596-645`.

**Pairs.** Grants rather than groups — the server has no group concept, because a group is a client-side view over the grant list and a second source of truth would be worse. Shows `visibility` per pair with a toggle, `createdAt`, and revoke. "New pair" lives in the header slot, which fixes the current `hidden sm:flex` button (`:526`) that is unreachable on mobile.

**Free Right Now.** A single `LIST_SHELL` of peers currently free, with a slot/venue column when the grant is `full`. Empty state explains the timezone rather than showing "No friends added yet".

**Common Free Grid.** The 635-line `CommonFreeSlotsGrid`, restyled. It loses the wrapping `TILE` (four nested rounded+bordered surfaces around one data cell today), the toolbar is flattened, the duplicated 40-line `<td>` block is de-duplicated, and the always-dark inline cell inspector becomes a `BottomSheet` (`social-cell-detail`) instead of a black box sitting in a light page.

## 6. Modals

All five move off amazeui's blue `FetchButton` and gray `Input` onto `FIELD_INPUT` and house indigo buttons. `ShareScheduleModal` stops recomputing its token on every render (it calls `exportScheduleCode` **and** `exportShareableLink`, which re-runs the former, on every countdown tick). The 8 `alert()` calls and 2 `confirm()` calls become inline validation and a confirm sheet.

The old share/QR modal is replaced by a handle sheet — copyable handle, QR, and a mutuality disclosure.

## 7. File plan

```
src/components/custom/social/
  SocialTab.tsx            landing + shell, ~260 lines
  useSocialData.ts         shared hook (replaces the double mount)
  rows.tsx                 PeopleRow, PairRow, FreeNowRow
  PeopleSubpage.tsx
  PairsSubpage.tsx
  FreeNowSubpage.tsx
  CommonFreeGridSubpage.tsx
  CommonFreeSlotsGrid.tsx  restyled in place
  schedule.ts              → src/lib/social/schedule.ts
  ShareHandleSheet.tsx     replaces ShareScheduleModal
  AddPeerSheet.tsx         replaces AddFriendModal
  PairPeerSheet.tsx        replaces AddGroupModal
  PeerTimetableSheet.tsx   replaces FriendTimetableModal
  CommonFreeSlotsSheet.tsx replaces CommonFreeSlotsModal
```

`SocialTab.tsx` drops from 832 lines to roughly a quarter of that, and gains the one thing it has never had: extracted components.
