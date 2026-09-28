"use client";

/**
 * Settings switch.
 *
 * This replaces amazeui's `Switch`, which is a bare pass-through to
 * react-native-web's switch: that one has fixed geometry and its `className`
 * only lands on the wrapper, so it cannot be made larger. The settings page has
 * 14 of them, and a 31x51 control sitting in a 72px-tall row reads as cramped
 * and is a smallish tap target.
 *
 * So this is a plain `<button role="switch">`, which gets keyboard activation
 * and the `switch` role for free, with a track/thumb geometry that is ours.
 */

const TRACK = {
  md: "h-6 w-11",
  lg: "h-8 w-14",
} as const;

const THUMB = {
  md: "h-5 w-5",
  lg: "h-7 w-7",
} as const;

const THUMB_ON = {
  md: "translate-x-5",
  lg: "translate-x-6",
} as const;

/** Off = zinc, on = the app's indigo accent (same as `SEG_ACTIVE`). */
const TRACK_OFF = "bg-zinc-200 dark:bg-zinc-700";
const TRACK_ON = "bg-indigo-500";

export interface SwitchProps {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  /** `lg` is for settings rows; `md` is for dense contexts. */
  size?: keyof typeof TRACK;
  disabled?: boolean;
  /**
   * Accessible name. Pass the row's title when the switch is not inside a
   * label; omit it when the surrounding row already names the control (the
   * `SettingRow` case) to avoid a duplicated announcement.
   */
  label?: string;
  className?: string;
}

export default function Switch({
  checked,
  onCheckedChange,
  size = "lg",
  disabled = false,
  label,
  className = "",
}: SwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onCheckedChange(!checked)}
      className={`relative shrink-0 rounded-full transition-colors duration-200 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-zinc-900 disabled:opacity-50 disabled:cursor-not-allowed ${
        TRACK[size]
      } ${checked ? TRACK_ON : TRACK_OFF} ${className}`.trim()}
    >
      <span
        aria-hidden
        className={`absolute top-0.5 left-0.5 rounded-full bg-white shadow-sm ring-0 transition-transform duration-200 ${
          THUMB[size]
        } ${checked ? THUMB_ON[size] : "translate-x-0"}`}
      />
    </button>
  );
}
