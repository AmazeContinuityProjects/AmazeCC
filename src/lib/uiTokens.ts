/**
 * Design tokens shared across the app's "zinc" surfaces.
 *
 * These mirror the tokens already used by the Curriculum and Payments pages so
 * the whole app shares one visual language: exactly three surface grammars
 * (tile / list shell / list row) and one button + chip style.
 *
 * Kept free of any feature-specific import so pages (Libraries, OD hours, exam
 * schedule, …) can all speak the same visual dialect.
 */

/**
 * The shared tile surface. Every "card" in the app is this translucent zinc
 * panel; only the padding, layout and sizing utilities on top differ.
 */
const TILE_SURFACE =
  "rounded-[24px] bg-white/80 dark:bg-zinc-900/70 backdrop-blur-xl border border-zinc-200/70 dark:border-zinc-800/80 shadow-xs";

export const TILE = `${TILE_SURFACE} p-4 sm:p-5 flex flex-col justify-between text-left relative overflow-hidden`;

/**
 * `TILE` plus the interaction affordance.
 *
 * This exact suffix was copy-pasted at every tile call site in Libraries and
 * Simplified Mobile Home. Extracted because the social landing has eleven
 * interactive tiles and a missed suffix reads as a dead surface.
 */
export const TILE_INTERACTIVE = `${TILE} transition-all hover:scale-[1.01] active:scale-[0.98] cursor-pointer`;

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
  "w-full px-4 py-2.5 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 text-sm font-bold text-zinc-900 dark:text-white placeholder:text-zinc-400 placeholder:font-medium focus:outline-none focus:border-zinc-400 dark:focus:border-zinc-500";

export const LIST_SHELL =
  "overflow-hidden rounded-2xl border border-zinc-200/70 dark:border-zinc-800/80 bg-white/80 dark:bg-zinc-900/70 backdrop-blur-xl shadow-xs divide-y divide-zinc-200/60 dark:divide-zinc-800/60";

export const LIST_ROW =
  "w-full flex items-center gap-3 py-3 px-4 text-left transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800/40";

export const CHIP =
  "text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-md bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 border border-zinc-200/60 dark:border-zinc-700/60";

export const SECTION_CHIP = CHIP;

export const ICON_BUTTON =
  "p-2.5 rounded-xl bg-zinc-100 hover:bg-zinc-200/80 dark:bg-zinc-900 dark:hover:bg-zinc-800 border border-zinc-200/80 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 transition-all active:scale-95 cursor-pointer shadow-2xs shrink-0";

/**
 * Active/inactive segmented-control segments.
 *
 * `SEG_ACTIVE` deliberately carries no text colour: the accent colour is the
 * caller's choice, and baking it in would leave two competing `text-*` classes
 * for the cascade to arbitrate. (The dark surface is `zinc-900`, which is what
 * all nine segmented controls in the app already use.)
 */
export const SEG_ACTIVE = "bg-white dark:bg-zinc-900 shadow-2xs font-extrabold";
export const SEG_IDLE =
  "text-zinc-500 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200";

/** Pill tone recipes: `bg-<c>-500/10 border-<c>-500/20 text-<c>-600 dark:text-<c>-400` */
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
  zinc: "bg-zinc-500/10 text-zinc-500 dark:text-zinc-400 border-zinc-500/20",
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
  zinc: "text-zinc-500 dark:text-zinc-400",
};

export const TONE_ICON_TILE: Record<string, string> = {
  sky: "bg-sky-500/10 border-sky-500/20 text-sky-600 dark:text-sky-400",
  emerald: "bg-emerald-500/10 border-emerald-500/20 text-emerald-600 dark:text-emerald-400",
  amber: "bg-amber-500/10 border-amber-500/20 text-amber-600 dark:text-amber-400",
  violet: "bg-violet-500/10 border-violet-500/20 text-violet-600 dark:text-violet-400",
  red: "bg-red-500/10 border-red-500/20 text-red-600 dark:text-red-400",
  indigo: "bg-indigo-500/10 border-indigo-500/20 text-indigo-600 dark:text-indigo-400",
};

export const EMPTY_STATE =
  "p-8 rounded-[28px] border border-dashed border-zinc-300 dark:border-zinc-800 text-center";

export const FIELD_INPUT =
  "w-full px-4 py-2.5 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 text-sm font-bold text-zinc-900 dark:text-white placeholder:text-zinc-400 placeholder:font-medium focus:outline-none focus:border-zinc-400 dark:focus:border-zinc-500";

/** Small ghost action used for secondary row/page actions (Libraries, dues). */
export const GHOST_BUTTON =
  "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors cursor-pointer shrink-0";
