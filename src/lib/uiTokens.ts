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
 * The shared tile surface. Every "card" in the app is this panel; only the
 * padding, layout and sizing utilities on top differ.
 *
 * The interior comes from the `.card-surface` class in `globals.css` — by
 * default the grade-insights card's gray on the course predictor (`--surface`
 * in light, the `--surface-secondary` gray step in dark, no blur), switchable
 * to the classic translucent zinc glass by the profile page's "Card look"
 * setting, which `Main.tsx` applies as `data-card-surface`. Colour tints (tone
 * badges, tone icon tiles, tinted cards) keep painting on top untouched, and
 * the class carries no radius/edge of its own.
 *
 * The outline is `--border-strong`, not `--border-muted`. On a near-white
 * `--surface` a `--border-muted` hairline is not readable as an edge at all, and
 * a tile with no edge is a tile with no shape — the card and the page behind it
 * read as one wash. `--border-strong` is the step that survives on white; see
 * the border-step override in `globals.css`.
 */
const TILE_SURFACE =
  "rounded-md bg-surface border border-line";

export const TILE = `${TILE_SURFACE} p-4 sm:p-5 flex flex-col justify-between text-left relative overflow-hidden`;

/**
 * `TILE` plus the interaction affordance.
 *
 * This exact suffix was copy-pasted at every tile call site in Libraries and
 * Simplified Mobile Home. Extracted because the social landing has eleven
 * interactive tiles and a missed suffix reads as a dead surface.
 */
export const TILE_INTERACTIVE = `${TILE} transition-colors duration-[120ms] hover:bg-surface-2 cursor-pointer`;

/** The interaction affordance, separated so it can pair with any surface. */
const TILE_AFFORDANCE = "transition-colors duration-[120ms] hover:bg-surface-2 cursor-pointer";

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
  "w-full min-h-11 px-3 py-2 rounded-sm bg-surface border border-line text-[15px] text-ink placeholder:text-muted focus:outline-none focus:border-accent focus:ring-3 focus:ring-accent-soft";

export const LIST_SHELL =
  "overflow-hidden rounded-md bg-surface border border-line divide-y divide-line-2";

export const LIST_ROW =
  "w-full flex items-center gap-3 py-3 px-4 min-h-11 text-left transition-colors duration-[120ms] hover:bg-surface-2";

export const CHIP =
  "text-[11.5px] font-medium px-2 py-0.5 rounded-sm bg-surface-2 text-ink-2";

export const SECTION_CHIP = CHIP;

export const ICON_BUTTON =
  "grid h-11 w-11 shrink-0 place-items-center rounded-sm text-ink-2 transition-colors duration-[120ms] hover:bg-surface-2 cursor-pointer";

/**
 * Active/inactive segmented-control segments.
 *
 * `SEG_ACTIVE` deliberately carries no text colour: the accent colour is the
 * caller's choice, and baking it in would leave two competing `text-*` classes
 * for the cascade to arbitrate. (The dark surface is `--surface`, which is what
 * all nine segmented controls in the app already use.)
 */
export const SEG_ACTIVE = "bg-surface shadow-[0_1px_2px_rgba(0,0,0,0.08)] font-semibold";
export const SEG_IDLE =
  "text-ink-2 hover:text-ink";

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
  red: "bg-danger-soft text-danger border-danger/20",
  amber: "bg-warn-soft text-warn border-warn/20",
  emerald: "bg-ok-soft text-ok border-ok/20",
  blue: "bg-accent-soft text-accent border-accent/20",
  indigo: "bg-accent-soft text-accent border-accent/20",
  sky: "bg-accent-soft text-accent border-accent/20",
  violet: "bg-course-3/10 text-course-3 border-course-3/20",
  cyan: "bg-course-1/10 text-course-1 border-course-1/20",
  zinc: "bg-surface-2 text-ink-2 border-line-2",
};

export const TONE_TEXT: Record<string, string> = {
  red: "text-danger",
  amber: "text-warn",
  emerald: "text-ok",
  blue: "text-accent",
  indigo: "text-accent",
  sky: "text-accent",
  violet: "text-course-3",
  cyan: "text-course-1",
  zinc: "text-ink-2",
};

export const TONE_ICON_TILE: Record<string, string> = {
  // Calm Notebook: no tinted wells. Every well is the same quiet neutral;
  // the glyph carries the tone, so status still reads at a glance.
  sky: "bg-surface-2 border-line-2 text-accent",
  emerald: "bg-surface-2 border-line-2 text-ok",
  amber: "bg-surface-2 border-line-2 text-warn",
  violet: "bg-surface-2 border-line-2 text-course-3",
  red: "bg-surface-2 border-line-2 text-danger",
  indigo: "bg-surface-2 border-line-2 text-accent",
  zinc: "bg-surface-2 border-line-2 text-ink-2",
};

export const EMPTY_STATE =
  "p-8 rounded-md border border-dashed border-line text-center";

export const FIELD_INPUT =
  "w-full min-h-11 px-3 py-2 rounded-sm bg-surface border border-line text-[15px] text-ink placeholder:text-muted focus:outline-none focus:border-accent focus:ring-3 focus:ring-accent-soft";

/**
 * Size and surface for the `OptionPicker` trigger (shared/primitives).
 *
 * `OptionPicker` puts `className` on its own wrapper `div` and renders the
 * trigger as that div's first child, so the trigger's hard-coded chrome
 * (`h-9 rounded-md border-input bg-transparent`) has to be overridden through
 * the wrapper. `[&>button:first-child]` rather than `[&>div:first-child]`: the
 * trigger is a real `<button>`, and on the mobile path the component also renders
 * a modal `div` inside that same wrapper, which a `div` selector would catch.
 *
 * **Height and font size are deliberately not here.** Tailwind emits `h-*` in
 * ascending order, so a caller's `[&>button:first-child]:h-9` would be *beaten*
 * by an `h-10` set here no matter which came later in the class string — and
 * the trigger's label is a child with its own size, which a size on the button
 * cannot override anyway. `SelectField` takes a `size` prop for both.
 */
export const OPTION_PICKER_TRIGGER =
  "[&>button:first-child]:rounded-sm [&>button:first-child]:border-line " +
  "[&>button:first-child]:bg-surface [&>button:first-child]:font-medium " +
  "[&>button:first-child]:focus-visible:ring-2 [&>button:first-child]:focus-visible:ring-accent " +
  "[&>button:first-child_span]:font-medium [&>button:first-child_span]:text-ink";

/**
 * Trigger height, and the size of the label inside it.
 *
 * The label is a child of the button carrying its own `text-sm`, so its size has
 * to be set on the child or the button's size is simply ignored.
 */
const OPTION_PICKER_SIZE: Record<string, string> = {
  // Inline controls that sit in a header strip or a chip row.
  xs: "[&>button:first-child]:h-6 [&>button:first-child]:px-2 [&>button:first-child_span]:text-[11px]",
  sm: "[&>button:first-child]:h-7 [&>button:first-child]:px-2.5 [&>button:first-child_span]:text-xs",
  // Compact fields: the old `py-1.5` selects.
  md: "[&>button:first-child]:h-8 [&>button:first-child]:px-3 [&>button:first-child_span]:text-xs",
  lg: "[&>button:first-child]:h-11 [&>button:first-child]:px-4 [&>button:first-child_span]:text-sm",
  // The default: what the native `<select>`'s `py-3` used to give.
  xl: "[&>button:first-child]:h-10 [&>button:first-child]:px-3 [&>button:first-child_span]:text-sm",
  // A bare text link in a header — height has to collapse to the line box.
  auto: "[&>button:first-child]:h-auto [&>button:first-child]:p-0 [&>button:first-child_span]:text-[11px]",
};

export const optionPickerSize = (size: string): string => OPTION_PICKER_SIZE[size] ?? OPTION_PICKER_SIZE.xl;

/** Small ghost action used for secondary row/page actions (Libraries, dues). */
export const GHOST_BUTTON =
  "inline-flex min-h-11 items-center gap-1.5 px-3 py-1.5 rounded-sm text-ink-2 hover:bg-surface-2 transition-colors duration-[120ms] cursor-pointer shrink-0";
