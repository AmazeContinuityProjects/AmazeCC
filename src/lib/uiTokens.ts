/**
 * Design tokens shared across the app's surfaces.
 *
 * Exactly three surface grammars (tile / list shell / list row) and one button
 * + chip style, so every screen speaks the same visual dialect.
 *
 * Colours are semantic tokens, not zinc steps. That is what makes the accent
 * colour picker reach them: `Main.tsx` repaints `--surface`, `--border-muted`,
 * `--text-heading` and friends on `documentElement` when the palette changes,
 * and anything reading a variable follows. Zinc steps now resolve to those same
 * variables via the `@theme inline` block in `globals.css`, so the ~95 files
 * still written in zinc also follow — but a token that names the variable is
 * legible about why it changes colour, and a zinc step is not.
 *
 * Kept free of any feature-specific import so pages (Libraries, OD hours, exam
 * schedule, …) can all speak the same visual dialect.
 */

/**
 * The shared tile surface. Every "card" in the app is this translucent panel;
 * only the padding, layout and sizing utilities on top differ.
 *
 * The outline is `--border-strong`, not `--border-muted`. On a near-white
 * `--surface` a `--border-muted` hairline is not readable as an edge at all, and
 * a tile with no edge is a tile with no shape — the card and the page behind it
 * read as one wash. `--border-strong` is the step that survives on white; see
 * the border-step override in `globals.css`.
 */
const TILE_SURFACE =
  "rounded-[24px] bg-surface/80 dark:bg-surface/70 backdrop-blur-xl border border-border-strong dark:border-border shadow-xs";

export const TILE = `${TILE_SURFACE} p-4 sm:p-5 flex flex-col justify-between text-left relative overflow-hidden`;

/**
 * `TILE` plus the interaction affordance.
 *
 * This exact suffix was copy-pasted at every tile call site in Libraries and
 * Simplified Mobile Home. Extracted because the social landing has eleven
 * interactive tiles and a missed suffix reads as a dead surface.
 */
export const TILE_INTERACTIVE = `${TILE} transition-all hover:scale-[1.01] active:scale-[0.98] cursor-pointer`;

/** The interaction affordance, separated so it can pair with any surface. */
const TILE_AFFORDANCE = "transition-all hover:scale-[1.01] active:scale-[0.98] cursor-pointer";

/**
 * An interactive surface whose children sit in a ROW.
 *
 * `TILE` is a column: it ships `flex flex-col justify-between` so a label, a
 * value and a footer can be pushed apart. A row-shaped surface — a course pill,
 * a nav card, a list entry that is itself a button — must not use it. Appending
 * `flex items-center` to `TILE_INTERACTIVE` does not work, because `flex-col` and
 * `items-center` are different properties: the result is a column whose items
 * are centred, which is the bug this token exists to make impossible.
 *
 * Built on `TILE_CARD` (no flex at all) with the row direction stated outright,
 * so there is nothing to override.
 */
export const TILE_INTERACTIVE_ROW = `${TILE_SURFACE} p-3.5 sm:p-4 flex flex-row items-center justify-between gap-3 text-left relative overflow-hidden ${TILE_AFFORDANCE}`;

/**
 * Same surface as `TILE`, but children stay in normal document flow.
 *
 * Deliberately no `flex flex-col justify-between` and no `relative`: the cards
 * that used this recipe stack plain sections, so adding the column flex (or a
 * containing block) would change their layout.
 */
export const TILE_CARD = `${TILE_SURFACE} p-4 sm:p-5 overflow-hidden`;

/** The boxed search input, shared by the Libraries catalog and Social people search. */
export const SEARCH_FIELD =
  "w-full px-4 py-2.5 rounded-2xl bg-surface dark:bg-surface-secondary border border-border-strong dark:border-border text-sm font-bold text-text-heading dark:text-text-heading placeholder:text-text-muted placeholder:font-medium focus:outline-none focus:border-border-strong";

export const LIST_SHELL =
  "overflow-hidden rounded-2xl border border-border-strong dark:border-border bg-surface/80 dark:bg-surface/70 backdrop-blur-xl shadow-xs divide-y divide-border-muted dark:divide-border/70";

export const LIST_ROW =
  "w-full flex items-center gap-3 py-3 px-4 text-left transition-colors hover:bg-surface-secondary dark:hover:bg-surface-hover/40";

export const CHIP =
  "text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-md bg-surface-tertiary dark:bg-surface-secondary text-text-secondary dark:text-text-muted border border-border-muted dark:border-border";

export const SECTION_CHIP = CHIP;

export const ICON_BUTTON =
  "p-2.5 rounded-xl bg-surface-tertiary hover:bg-border-muted dark:bg-surface dark:hover:bg-surface-hover border border-border-muted dark:border-border text-text-primary dark:text-text-primary transition-all active:scale-95 cursor-pointer shadow-2xs shrink-0";

/**
 * Active/inactive segmented-control segments.
 *
 * `SEG_ACTIVE` deliberately carries no text colour: the accent colour is the
 * caller's choice, and baking it in would leave two competing `text-*` classes
 * for the cascade to arbitrate. (The dark surface is `--surface`, which is what
 * all nine segmented controls in the app already use.)
 */
export const SEG_ACTIVE = "bg-white dark:bg-surface shadow-2xs font-extrabold";
export const SEG_IDLE =
  "text-text-secondary dark:text-text-muted hover:text-text-heading dark:hover:text-text-heading";

/**
 * Pill tone recipes: `bg-<c>-500/10 border-<c>-500/20 text-<c>-600 dark:text-<c>-400`
 *
 * The semantic hues (`red`, `amber`, `emerald`, `violet`, `cyan`) stay fixed on
 * purpose: a "3 absences" badge has to read as red whatever the accent is, and
 * letting the picker repaint it would destroy the meaning. The accent family
 * (`indigo`, `sky`, `blue`) is remapped to `--theme-accent` by the block at the
 * top of `globals.css`, so those follow the picker. `zinc` is neutral and reads
 * the surface tokens.
 */
export const TONE_BADGE: Record<string, string> = {
  red: "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20",
  amber: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
  emerald: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
  blue: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20",
  indigo:
    "bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 border-indigo-200/50 dark:border-indigo-800/40",
  sky: "bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/20",
  violet: "bg-violet-500/10 text-violet-600 dark:text-violet-400 border-violet-500/20",
  cyan: "bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border-cyan-500/20",
  zinc:
    "bg-surface-secondary text-text-secondary dark:text-text-muted border-border-muted",
};

export const TONE_TEXT: Record<string, string> = {
  red: "text-red-600 dark:text-red-400",
  amber: "text-amber-600 dark:text-amber-400",
  emerald: "text-emerald-600 dark:text-emerald-400",
  blue: "text-blue-600 dark:text-blue-400",
  indigo: "text-indigo-600 dark:text-indigo-400",
  sky: "text-sky-600 dark:text-sky-400",
  violet: "text-violet-600 dark:text-violet-400",
  cyan: "text-cyan-600 dark:text-cyan-400",
  zinc: "text-text-secondary dark:text-text-muted",
};

export const TONE_ICON_TILE: Record<string, string> = {
  sky: "bg-sky-500/10 border-sky-500/20 text-sky-600 dark:text-sky-400",
  emerald: "bg-emerald-500/10 border-emerald-500/20 text-emerald-600 dark:text-emerald-400",
  amber: "bg-amber-500/10 border-amber-500/20 text-amber-600 dark:text-amber-400",
  violet: "bg-violet-500/10 border-violet-500/20 text-violet-600 dark:text-violet-400",
  red: "bg-red-500/10 border-red-500/20 text-red-600 dark:text-red-400",
  indigo: "bg-indigo-500/10 border-indigo-500/20 text-indigo-600 dark:text-indigo-400",
  // Neutral well, for an icon that identifies a destination rather than a state
  // (a repository, a brand mark). `TONE_BADGE.zinc` reads the surface tokens;
  // this one stays a fixed step so it still reads as a tile on both surfaces.
  zinc: "bg-zinc-500/10 border-zinc-500/20 text-zinc-600 dark:text-zinc-300",
};

export const EMPTY_STATE =
  "p-8 rounded-[28px] border border-dashed border-border-strong dark:border-border text-center";

export const FIELD_INPUT =
  "w-full px-4 py-2.5 rounded-2xl bg-surface dark:bg-surface-secondary border border-border-strong dark:border-border text-sm font-bold text-text-heading dark:text-text-heading placeholder:text-text-muted placeholder:font-medium focus:outline-none focus:border-border-strong";

/** Small ghost action used for secondary row/page actions (Libraries, dues). */
export const GHOST_BUTTON =
  "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-surface-tertiary dark:bg-surface-secondary text-text-secondary dark:text-text-muted hover:bg-border-muted dark:hover:bg-surface-hover transition-colors cursor-pointer shrink-0";
