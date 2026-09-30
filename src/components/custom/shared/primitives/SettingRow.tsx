"use client";

import type { ReactNode } from "react";
import { ListRowText } from "./Surfaces";

/**
 * One settings line: title, description, and a control on the right.
 *
 * The old rows were `flex items-center justify-between py-3` with a bare
 * switch at the end, which meant a 31x51 control in a ~48px row and a tap
 * target that was only the switch itself. These are the roomier replacement:
 * ~72px tall, `gap-4`, and the whole row is the hit area when `onRowClick` is
 * given.
 *
 * `stacked` puts the control on its own line below the description, which is
 * the better read for the rows whose descriptions run long on a phone.
 */

const ROW_BASE =
  "flex items-center justify-between gap-4 px-4 py-4 min-h-[4.5rem] transition-colors";
const ROW_TAPPABLE =
  "w-full text-left cursor-pointer hover:bg-surface-secondary/70 dark:hover:bg-surface-hover/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-indigo-500";
const ROW_STACKED =
  "flex-col items-stretch justify-center gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4";

export interface SettingRowProps {
  title: ReactNode;
  description?: ReactNode;
  /** The switch / select / button. Rendered in the trailing slot. */
  control?: ReactNode;
  /** Marks the whole row as a hit target. Use for rows whose control toggles. */
  onRowClick?: () => void;
  /** Control below the copy instead of beside it. */
  stacked?: boolean;
  /** Rendered between the copy and the control, e.g. a status dot. */
  badge?: ReactNode;
  className?: string;
}

export default function SettingRow({
  title,
  description,
  control,
  onRowClick,
  stacked = false,
  badge,
  className = "",
}: SettingRowProps) {
  const Tag = onRowClick ? "button" : "div";

  return (
    <Tag
      {...(onRowClick ? { type: "button" as const, onClick: onRowClick } : {})}
      className={`${ROW_BASE} ${stacked ? ROW_STACKED : ""} ${
        onRowClick ? ROW_TAPPABLE : ""
      } ${className}`.trim()}
    >
      <ListRowText title={title} subtitle={description} right={badge} />
      {control ? (
        <div className={`flex items-center gap-2 shrink-0 ${stacked ? "sm:w-64" : ""}`.trim()}>
          {control}
        </div>
      ) : null}
    </Tag>
  );
}
