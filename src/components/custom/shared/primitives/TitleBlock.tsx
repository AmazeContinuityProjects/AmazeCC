"use client";

import type { ReactNode } from "react";

/**
 * The kicker + title (+ subtitle) line block.
 *
 * All three lines are optional, so one component covers the shapes the app
 * actually uses: triple (eyebrow / title / subtitle, e.g. OD hours), double
 * (eyebrow / title, e.g. Libraries, Curriculum, Social) and single (title only).
 *
 * These are the app-wide values. They were previously copy-pasted into twelve
 * page headers in two competing dialects — semibold `mb-1` (8 sites) and
 * uppercase-tracked `mb-1.5` (4). Semibold wins: it is the majority, and it is
 * the calmer of the two for a kicker that repeats on every screen.
 */

const EYEBROW = "text-xs font-semibold text-text-muted dark:text-text-secondary leading-none mb-1";
const TITLE =
  "text-xl sm:text-2xl font-black text-text-heading tracking-tight leading-tight font-outfit truncate";
const SUBTITLE = "text-xs text-text-secondary dark:text-text-muted font-medium mt-1";
const GROUP = "flex flex-col items-start min-w-0 text-left";

export type TitleTag = "h1" | "h2" | "h3";

export interface TitleBlockProps {
  /** Small kicker above the title, e.g. "Academics" or "Attendance · On-Duty". */
  eyebrow?: ReactNode;
  title: ReactNode;
  /** Muted line under the title, e.g. a session id or a one-line summary. */
  subtitle?: ReactNode;
  /** Heading level. Defaults to `h1`; use `h2` when nested under a page h1. */
  as?: TitleTag;
  /** Drop `truncate` when the title is expected to wrap (e.g. on a detail page). */
  wrap?: boolean;
  className?: string;
}

export default function TitleBlock({
  eyebrow,
  title,
  subtitle,
  as: Tag = "h1",
  wrap = false,
  className = "",
}: TitleBlockProps) {
  return (
    <div className={`${GROUP} ${className}`.trim()}>
      {eyebrow ? <p className={EYEBROW}>{eyebrow}</p> : null}
      <Tag className={wrap ? TITLE.replace(" truncate", "") : TITLE}>{title}</Tag>
      {subtitle ? <p className={SUBTITLE}>{subtitle}</p> : null}
    </div>
  );
}
