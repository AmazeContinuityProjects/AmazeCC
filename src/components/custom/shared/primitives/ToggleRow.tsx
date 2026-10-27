"use client";

import type { ReactNode } from "react";
import { SwitchTrack } from "./Switch";
import SettingRow from "./SettingRow";

/**
 * `SettingRow` whose row button *is* the switch.
 *
 * This is the shape 14 of the 14 settings switches want, and the reason the
 * trailing control is a decorative `SwitchTrack` rather than a real `Switch`:
 * `<button>` inside `<button>` is invalid HTML (a hydration error waiting to
 * happen), and one control with one name and one state is the better screen
 * reader story anyway — the row carries `role="switch"` + `aria-checked`, and
 * the switch takes no accessible name of its own so the title is not
 * announced twice.
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
      switchChecked={checked}
      className={className}
      control={<SwitchTrack checked={checked} disabled={disabled} />}
    />
  );
}
