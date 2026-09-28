"use client";

import type { ReactNode } from "react";
import { cn } from "@amazecontinuityprojects/amazeui";
import { ICON_BUTTON, GHOST_BUTTON, SEG_ACTIVE, SEG_IDLE } from "@/lib/uiTokens";

/**
 * Icon-only action for page headers. `title` doubles as the accessible name
 * so the rendered button is never unlabelled.
 */
export function IconButton({
  onClick,
  title,
  children,
  disabled,
  className = "",
}: {
  onClick: () => void;
  title: string;
  children: ReactNode;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      aria-label={title}
      disabled={disabled}
      className={`${ICON_BUTTON} disabled:opacity-50 ${className}`.trim()}
    >
      {children}
    </button>
  );
}

/** Low-emphasis inline action (refresh, try again, add to calendar). */
export function GhostButton({
  onClick,
  children,
  title,
  className = "",
}: {
  onClick: () => void;
  children: ReactNode;
  title?: string;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={`${GHOST_BUTTON} ${className}`.trim()}
    >
      {children}
    </button>
  );
}

/**
 * Segmented filter.
 *
 * Three shapes exist in the app and all three are this control:
 *  - default: text segments that wrap when there are many
 *  - `grow`: equal-width segments that scroll horizontally on overflow
 *  - `icon`: icon + label segments
 */
export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  grow = false,
  scroll = false,
  className = "",
}: {
  options: readonly { value: T; label: string; icon?: ReactNode; title?: string }[];
  value: T;
  // NoInfer keeps T pinned to the option values, so a plain
  // `useState` setter (whose parameter is a wider SetStateAction) is accepted.
  onChange: (value: NoInfer<T>) => void;
  /** Equal-width segments (`flex-1`) — pair with `scroll` for long lists. */
  grow?: boolean;
  /** Scroll horizontally instead of wrapping, for many segments on phones. */
  scroll?: boolean;
  className?: string;
}) {
  const container = grow
    ? "flex items-center gap-1"
    : "flex flex-wrap items-center max-w-full";
  const overflow = scroll ? " overflow-x-auto hide-scrollbar" : "";

  return (
    <div
      className={`${container} p-0.5 bg-zinc-100 dark:bg-zinc-800/80 rounded-xl border border-zinc-200/60 dark:border-zinc-700/60 text-xs${overflow} ${className}`.trim()}
    >
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onChange(opt.value)}
          aria-pressed={value === opt.value}
          title={opt.title}
          aria-label={opt.title ?? (opt.icon ? opt.label : undefined)}
          // cn/twMerge so the accent colour reliably overrides the segment's
          // idle colour instead of leaving both to the cascade.
          className={cn(
            "rounded-lg font-bold transition-all cursor-pointer whitespace-nowrap",
            grow ? "flex-1 px-2.5 py-1.5 text-[11px]" : "px-2.5 py-1 text-xs",
            opt.icon && "flex items-center justify-center gap-1",
            value === opt.value ? SEG_ACTIVE : SEG_IDLE,
            value === opt.value && "text-indigo-600 dark:text-indigo-400"
          )}
        >
          {opt.icon ? <span className="shrink-0 flex items-center">{opt.icon}</span> : null}
          {opt.label ? <span className={opt.icon ? "hidden xs:inline" : ""}>{opt.label}</span> : null}
        </button>
      ))}
    </div>
  );
}

/**
 * Horizontal choice pills.
 *
 * `SegmentedControl` is a filter for values you can all see at once; this is a
 * picker for an ordered set that may run off the screen (months, categories,
 * years). Four copies of this strip existed before it was named: the old
 * calendar page and both modes of `AttendanceCalendarView`.
 *
 * Scrolls horizontally on overflow rather than wrapping, because an ordered
 * picker that reflows into two rows stops reading as a sequence. `options` is
 * `{ value, label }` and nothing else — the caller only supplies text.
 */
export function ChipTabs<T extends string>({
  options,
  value,
  onChange,
  size = "md",
  className = "",
}: {
  options: readonly { value: T; label: ReactNode; title?: string }[];
  value: T;
  onChange: (value: NoInfer<T>) => void;
  size?: "sm" | "md";
  className?: string;
}) {
  const sizing = size === "sm" ? "text-[10px] px-2.5 py-1" : "text-[11px] px-3 py-1.5";

  return (
    <div
      role="tablist"
      className={`flex w-full items-center gap-1.5 overflow-x-auto hide-scrollbar ${className}`.trim()}
    >
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            role="tab"
            aria-selected={active}
            title={opt.title}
            onClick={() => onChange(opt.value)}
            className={cn(
              "shrink-0 whitespace-nowrap rounded-xl font-black transition-all cursor-pointer",
              sizing,
              active
                ? "bg-indigo-600 text-white shadow-xs"
                : "bg-zinc-100 dark:bg-zinc-800/80 text-zinc-500 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200"
            )}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
