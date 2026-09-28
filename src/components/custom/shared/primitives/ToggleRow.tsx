"use client";

import type { ReactNode } from "react";
import Switch from "./Switch";
import SettingRow from "./SettingRow";

/**
 * `SettingRow` + `Switch`, with the row wired as the hit target.
 *
 * This is the shape 14 of the 14 settings switches want, so the switch does not
 * take an accessible name: the row already provides the label, and giving both
 * one makes the control announce its title twice.
 */
export default function ToggleRow({
  title,
  description,
  checked,
  onCheckedChange,
  disabled,
  stacked = false,
  className = "",
}: {
  title: ReactNode;
  description?: ReactNode;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  disabled?: boolean;
  stacked?: boolean;
  className?: string;
}) {
  return (
    <SettingRow
      title={title}
      description={description}
      stacked={stacked}
      onRowClick={() => !disabled && onCheckedChange(!checked)}
      className={className}
      control={
        <Switch checked={checked} onCheckedChange={onCheckedChange} disabled={disabled} />
      }
    />
  );
}
