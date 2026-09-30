"use client";

import { useState, type ReactNode } from "react";
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
    zinc: "bg-text-secondary",
  };
  const box = size === "sm" ? "w-1.5 h-1.5" : "w-2 h-2";
  return (
    <span className={`${box} rounded-full shrink-0 ${dots[tone] ?? dots.zinc} ${className}`.trim()} />
  );
}

/**
 * Tone dot + label, in one pill.
 *
 * This is `ToneBadge` with a leading dot, and it exists because the same
 * `inline-flex gap-1.5 rounded-full border uppercase` string with six different
 * hand-written tone class lists was pasted into every event row of the old
 * calendar. The tone map is already the single source of colour
 * (`TONE_BADGE`); this just adds the dot and the dot's colour so a caller
 * supplies text and a tone name, nothing else.
 */
export function DotPill({
  tone = "zinc",
  children,
  size = "sm",
  className = "",
}: {
  tone?: string;
  children: ReactNode;
  size?: "sm" | "md";
  className?: string;
}) {
  const sizing = size === "sm" ? "text-[9px] px-1.5 py-0.5" : "text-[10px] sm:text-[11px] px-2 py-0.5";
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border font-bold uppercase tracking-wide whitespace-nowrap ${
        TONE_BADGE[tone] ?? TONE_BADGE.zinc
      } ${sizing} ${className}`.trim()}
    >
      <ToneDot tone={tone} size="sm" />
      {children}
    </span>
  );
}

/**
 * Tone key: a row of dots with labels, for reading a colour-coded surface.
 *
 * Takes the pairs and nothing else — the caller does not restate `ToneDot`'s
 * box, colour or sizing for each entry.
 */
export function ToneLegend({
  items,
  className = "",
}: {
  items: readonly { tone: string; label: ReactNode }[];
  className?: string;
}) {
  if (!items.length) return null;
  return (
    <div
      className={`flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-[11px] font-bold text-text-secondary dark:text-text-muted ${className}`.trim()}
    >
      {items.map((item) => (
        <span key={item.label as string} className="inline-flex items-center gap-1.5">
          <ToneDot tone={item.tone} size="md" />
          {item.label}
        </span>
      ))}
    </div>
  );
}

/**
 * A user's photo, at list-row size.
 *
 * Only for "this is *my* event" rows — a registration the user made for
 * themselves, where the picture answers "is this mine?" faster than any label.
 * It is not a user avatar in general: anything showing someone else's face
 * would be a different decision, with a different privacy default.
 *
 * Renders nothing without `src`, rather than a placeholder. The caller gates the
 * URL on the user's own photo-visibility setting, so an absent `src` is the
 * normal case for a user who turned that off, and a grey silhouette in every
 * EventHub row would read as a broken image rather than a choice.
 */
export function AvatarDot({
  src,
  name,
  className = "",
}: {
  src?: string;
  /** Used for the alt text, and to derive initials if the image fails. */
  name?: string;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  if (!src || failed) return null;

  const initials = String(name ?? "")
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    // `next/image` cannot be used here: the photo comes from whatever host
    // VTOP served it from, which is not in `remotePatterns`, and the site is a
    // static export with unoptimized images. Same reasoning as `BookCover`.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={name ? `${name}'s registered event` : "Your registered event"}
      onError={() => setFailed(true)}
      loading="lazy"
      decoding="async"
      className={`h-5 w-5 shrink-0 rounded-full object-cover ring-1 ring-black/5 dark:ring-white/10 ${className}`.trim()}
      data-initials={initials}
    />
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
        <p className="text-xs font-bold text-text-secondary dark:text-text-muted mt-2">{title}</p>
        {description ? (
          <p className="text-[11px] text-text-muted dark:text-text-secondary mt-1">{description}</p>
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
    zinc: "bg-surface-secondary text-text-secondary",
  };

  return (
    <div
      className={`p-10 rounded-[32px] bg-surface/70 dark:bg-surface/60 backdrop-blur-md border border-border-muted/60 dark:border-border/80 text-center space-y-4 shadow-2xs ${className}`.trim()}
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
        <h3 className="font-black text-base text-text-heading font-outfit">{title}</h3>
        {description ? (
          <p className="text-xs text-text-secondary dark:text-text-muted mt-1 max-w-sm mx-auto font-medium">
            {description}
          </p>
        ) : null}
      </div>
      {action ? <div className="flex justify-center">{action}</div> : null}
    </div>
  );
}
