"use client";

import type { ReactNode } from "react";
import { BackButton } from "@amazecontinuityprojects/amazeui";
import TitleBlock from "./TitleBlock";

/**
 * Page shell + page header.
 *
 * Every "real" page in the app opens with the same chrome: a max-width column
 * with a fixed vertical rhythm, a small eyebrow above a heavy title, an
 * optional session/subtitle line, and a cluster of icon actions with an
 * optional back button. That chrome used to be copy-pasted per page (nine
 * copies of the shell string alone), so it lives here now.
 *
 * The line block itself is `TitleBlock`; this owns the column, the action row
 * and the two header arrangements. Surface tokens live in `@/lib/uiTokens`.
 */

const SHELL_BASE =
  "w-full max-w-4xl mx-auto space-y-6 pt-3 sm:pt-5 md:pb-8 animate-in fade-in duration-300 text-left";

const HEADER_ROOT = "px-1";
const ACTION_ROW = "flex items-start justify-between gap-3";
const ACTION_CLUSTER = "flex items-center gap-2 pt-0.5 shrink-0";

export type PageHeaderLayout =
  /** Back + actions on their own row, title block underneath (curriculum). */
  | "actions-above"
  /** Title block and actions sharing one row (mobile home). */
  | "title-inline";

export interface PageShellProps {
  /** Small kicker above the title, e.g. "Academics" or "Attendance · On-Duty". */
  eyebrow?: ReactNode;
  title: ReactNode;
  subtitle?: ReactNode;
  /** Icon buttons / ghost actions. Kept on one shrink-0 cluster. */
  actions?: ReactNode;
  /**
   * Renders a back button to the left of the action cluster. Omit to render
   * the cluster flush right.
   */
  onBack?: () => void;
  layout?: PageHeaderLayout;
  /**
   * Most pages block text selection (`select-none`) because they are dense
   * stat surfaces. Set this on pages that were not doing that, so adopting the
   * shell does not quietly make their copy unselectable.
   */
  selectable?: boolean;
  /** Extra classes merged onto the shell (the app sets `text-center` globally). */
  className?: string;
  children: ReactNode;
}

export default function PageShell({
  eyebrow,
  title,
  subtitle,
  actions,
  onBack,
  layout = "actions-above",
  selectable = false,
  className = "",
  children,
}: PageShellProps) {
  const shell = selectable ? `${SHELL_BASE} select-text` : `${SHELL_BASE} select-none`;
  const titleBlock = <TitleBlock eyebrow={eyebrow} title={title} subtitle={subtitle} />;

  // Back is always far left, the action cluster always far right and
  // shrink-0, so a long title can truncate but never squeeze a button.
  const back = onBack ? <BackButton onClick={onBack} className="self-start" /> : null;
  const cluster = actions ? <div className={ACTION_CLUSTER}>{actions}</div> : null;

  if (layout === "actions-above") {
    return (
      <div className={`${shell} ${className}`.trim()}>
        <div className={HEADER_ROOT}>
          {onBack || actions ? (
            <div className={`${ACTION_ROW} mb-4 sm:mb-5`}>
              {onBack ? back : <span />}
              {cluster}
            </div>
          ) : null}
          {titleBlock}
        </div>
        {children}
      </div>
    );
  }

  return (
    <div className={`${shell} ${className}`.trim()}>
      <div className={`${HEADER_ROOT} ${ACTION_ROW}`}>
        {back}
        {titleBlock}
        {cluster}
      </div>
      {children}
    </div>
  );
}
