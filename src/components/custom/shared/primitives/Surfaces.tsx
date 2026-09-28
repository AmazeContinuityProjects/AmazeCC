"use client";

import type { ElementType, ReactNode } from "react";
import { TILE, LIST_SHELL, SECTION_CHIP, TONE_BADGE, TONE_TEXT } from "@/lib/uiTokens";

/**
 * Section header: an indigo icon, a heavy title, an optional count chip and an
 * optional right-hand slot (deep link, filter, action). Copy-pasted in four
 * places before this existed.
 */
export function SectionHeader({
  icon: Icon,
  leading,
  title,
  count,
  right,
  className = "",
}: {
  icon?: ElementType;
  /** Custom marker before the title (e.g. a tone dot). Wins over `icon`. */
  leading?: ReactNode;
  title: ReactNode;
  count?: number;
  right?: ReactNode;
  className?: string;
}) {
  return (
    <div className={`flex items-center justify-between gap-2 px-1 ${className}`.trim()}>
      <div className="flex items-center gap-2 min-w-0">
        {leading ?? (Icon ? <Icon className="w-4 h-4 text-indigo-500 shrink-0" /> : null)}
        <h2 className="text-sm font-black text-zinc-900 dark:text-white font-outfit tracking-tight truncate">
          {title}
        </h2>
        {typeof count === "number" ? (
          <span className={`${SECTION_CHIP} shrink-0`}>{count}</span>
        ) : null}
      </div>
      {right ? <div className="flex items-center gap-2 shrink-0">{right}</div> : null}
    </div>
  );
}

/**
 * Hero stat tile.
 *
 * `height` is pinned rather than a min-height on purpose: with three stacked
 * lines a min-height lets the content grow into the tile's own padding and
 * collide. The default matches the other pages' 32/36 rhythm.
 *
 * Constant by design — a tile is a measurement that does not change under the
 * reader. A set of values worth rotating through is an `InsightCarousel`, and
 * something that navigates belongs in a section header as an action, not here.
 * The calendar page tried all three in one row and none of them read.
 */
export function StatTile({
  label,
  value,
  sub,
  badge,
  tone = "emerald",
  height = "h-32 sm:h-36",
  className = "",
}: {
  label: ReactNode;
  value: ReactNode;
  sub?: ReactNode;
  /** Optional top-right pill, e.g. "2 today". */
  badge?: ReactNode;
  /** Tints `value`, and the badge when one is given. `neutral` = heading ink. */
  tone?: string;
  height?: string;
  className?: string;
}) {
  // "neutral"/"default" means "no tint" — plain heading ink rather than a
  // toned-down grey, so an uncoloured tile does not look disabled.
  const valueTone =
    !tone || tone === "neutral" || tone === "default"
      ? "text-zinc-900 dark:text-white"
      : TONE_TEXT[tone] ?? "text-zinc-900 dark:text-white";

  return (
    <div className={`${TILE} ${height} ${className}`.trim()}>
      <div className="flex items-center justify-between gap-1">
        <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-500 font-outfit truncate">
          {label}
        </span>
        {badge ? (
          <span
            className={`text-[9px] sm:text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-md border shrink-0 ${
              TONE_BADGE[tone] ?? TONE_BADGE.zinc
            }`}
          >
            {badge}
          </span>
        ) : null}
      </div>

      <div className="my-auto min-w-0">
        <p
          className={`text-2xl sm:text-3xl font-black font-outfit tracking-tight leading-tight truncate block ${valueTone}`}
        >
          {value}
        </p>
      </div>

      {sub ? (
        <div className="flex items-center justify-between gap-2 min-w-0">
          <p className="text-[10.5px] sm:text-xs text-zinc-500 dark:text-zinc-400 font-medium truncate">
            {sub}
          </p>
        </div>
      ) : null}
    </div>
  );
}

/** Grouped list container — the workhorse for "N rows that look like one card". */
export function ListShell({
  className = "",
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return <div className={`${LIST_SHELL} ${className}`.trim()}>{children}</div>;
}

const ROW_TITLE =
  "font-bold text-sm text-zinc-900 dark:text-white truncate font-outfit leading-tight";
const ROW_SUBTITLE =
  "text-[11px] text-zinc-500 dark:text-zinc-400 font-medium mt-0.5 truncate";

/**
 * The title + muted subtitle block that sits inside a list row.
 *
 * Twenty-odd rows across the app had this exact pair of class strings and an
 * identical `min-w-0 flex-1` wrapper, so it is written once here. `right` is a
 * slot rather than baked in because what trails a row title is the thing that
 * actually varies — a chip, a tone badge, a chevron, a price.
 */
export function ListRowText({
  title,
  subtitle,
  titleTag: Tag = "p",
  titleTooltip,
  right,
  className = "",
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  /** Sites disagree between `<p>` and `<h3>`; pass the heading when there is one. */
  titleTag?: "p" | "h3" | "h4" | "span";
  /** Native tooltip, for titles that truncate to something unreadable. */
  titleTooltip?: string;
  right?: ReactNode;
  className?: string;
}) {
  return (
    <div className={`min-w-0 flex-1 ${className}`.trim()}>
      <div className="flex items-center gap-2 min-w-0">
        <Tag className={ROW_TITLE} title={titleTooltip}>
          {title}
        </Tag>
        {right ? <div className="flex items-center gap-2 shrink-0">{right}</div> : null}
      </div>
      {subtitle ? <p className={ROW_SUBTITLE}>{subtitle}</p> : null}
    </div>
  );
}

/**
 * Small label-over-value cell for a 2-up facts grid.
 *
 * The label is uppercase micro-type and the value is bold ink, which is the
 * convention wherever a page shows "Label / Value" in a grid.
 */
export function KeyValue({
  label,
  value,
  valueClassName = "",
  className = "",
}: {
  label: ReactNode;
  value: ReactNode;
  /** Recolour the value (status text) or lay it out inline (icon + text). */
  valueClassName?: string;
  className?: string;
}) {
  return (
    <div
      className={`p-3 rounded-2xl bg-zinc-50 dark:bg-zinc-950/50 border border-zinc-200/60 dark:border-zinc-800 ${className}`.trim()}
    >
      <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 block mb-0.5">
        {label}
      </span>
      <span className={`font-extrabold text-zinc-900 dark:text-white ${valueClassName}`.trim()}>
        {value}
      </span>
    </div>
  );
}
