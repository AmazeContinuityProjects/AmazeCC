"use client";

import type { ReactNode } from "react";
import { TONE_BADGE, EMPTY_STATE } from "@/lib/uiTokens";

/**
 * Status pill, e.g. "today", "3 left", "recovered".
 *
 * Pass `as` to render a dot instead of a pill (used for the series marker in
 * section headers) so the tone map stays the single source of colour.
 */
export function ToneBadge({
  tone = "zinc",
  children,
  size = "md",
  className = "",
}: {
  tone?: string;
  children: ReactNode;
  size?: "sm" | "md";
  className?: string;
}) {
  const sizing = size === "sm" ? "text-[9px] px-1.5 py-0.5" : "text-[9px] sm:text-[10px] px-2 py-0.5";
  return (
    <span
      className={`${sizing} font-extrabold uppercase rounded-md border shrink-0 ${
        TONE_BADGE[tone] ?? TONE_BADGE.zinc
      } ${className}`.trim()}
    >
      {children}
    </span>
  );
}

/** Small filled dot in a tone colour — the list-row and section status marker. */
export function ToneDot({
  tone = "zinc",
  size = "sm",
  className = "",
}: {
  tone?: string;
  size?: "sm" | "md";
  className?: string;
}) {
  const dots: Record<string, string> = {
    emerald: "bg-emerald-500",
    amber: "bg-amber-500",
    sky: "bg-sky-500",
    violet: "bg-violet-500",
    indigo: "bg-indigo-500",
    red: "bg-red-500",
    cyan: "bg-cyan-500",
    zinc: "bg-zinc-500",
  };
  const box = size === "sm" ? "w-1.5 h-1.5" : "w-2 h-2";
  return (
    <span className={`${box} rounded-full shrink-0 ${dots[tone] ?? dots.zinc} ${className}`.trim()} />
  );
}

/**
 * Empty state.
 *
 * Two flavours: a bordered card with a tinted icon tile (the app's house
 * style) and the lighter dashed variant. Both take a `title` plus optional
 * body copy and an action, so callers never hand-roll the container.
 *
 * `icon` is a pre-sized node, e.g. `<CalendarX className="w-7 h-7" />`. Inside
 * the card it inherits the tile's tone colour (lucide icons stroke with
 * `currentColor`); the dashed variant has no tile, so the caller supplies the
 * colour there.
 */
export function EmptyPanel({
  icon,
  tone = "indigo",
  title,
  description,
  action,
  variant = "card",
  className = "",
}: {
  icon?: ReactNode;
  tone?: string;
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  /** `card` = tinted icon tile, `dashed` = lighter outlined box. */
  variant?: "card" | "dashed";
  className?: string;
}) {
  if (variant === "dashed") {
    return (
      <div className={`${EMPTY_STATE} ${className}`.trim()}>
        {icon}
        <p className="text-xs font-bold text-zinc-600 dark:text-zinc-400 mt-2">{title}</p>
        {description ? (
          <p className="text-[11px] text-zinc-400 dark:text-zinc-500 mt-1">{description}</p>
        ) : null}
        {action ? <div className="mt-3 flex justify-center">{action}</div> : null}
      </div>
    );
  }

  const iconTones: Record<string, string> = {
    emerald: "bg-emerald-500/10 text-emerald-500",
    amber: "bg-amber-500/10 text-amber-500",
    red: "bg-red-500/10 text-red-500",
    indigo: "bg-indigo-500/10 text-indigo-500",
    violet: "bg-violet-500/10 text-violet-500",
    sky: "bg-sky-500/10 text-sky-500",
    zinc: "bg-zinc-500/10 text-zinc-500",
  };

  return (
    <div
      className={`p-10 rounded-[32px] bg-white/70 dark:bg-zinc-900/60 backdrop-blur-md border border-zinc-200/60 dark:border-zinc-800/80 text-center space-y-4 shadow-2xs ${className}`.trim()}
    >
      {icon ? (
        <div
          className={`w-14 h-14 rounded-2xl flex items-center justify-center mx-auto ${
            iconTones[tone] ?? iconTones.indigo
          }`}
        >
          {icon}
        </div>
      ) : null}
      <div>
        <h3 className="font-black text-base text-zinc-900 dark:text-white font-outfit">{title}</h3>
        {description ? (
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1 max-w-sm mx-auto font-medium">
            {description}
          </p>
        ) : null}
      </div>
      {action ? <div className="flex justify-center">{action}</div> : null}
    </div>
  );
}
