"use client";

import { OptionPicker, cn } from "@amazecontinuityprojects/amazeui";
import SettingRow from "./SettingRow";
import { OPTION_PICKER_TRIGGER, optionPickerSize } from "@/lib/uiTokens";

/**
 * A labelled option picker.
 *
 * Every option selector in the app is one of these now, backed by amazeui's
 * `OptionPicker` rather than a native `<select>`. One wrapper means the call
 * sites share a control rather than each re-deriving the chrome, and the popup is
 * a themed, scrollable list instead of the OS menu.
 *
 * ## Trade-offs against the native `<select>` it replaced
 *
 * The trigger is a real `<button type="button">` — focusable and activatable by
 * keyboard — but `OptionPicker` sets no `role="combobox"`, `aria-haspopup`,
 * `aria-expanded` or `aria-label` on it, and accepts no passthrough props to add
 * them. A screen reader therefore announces the trigger's value and "button"
 * without announcing that it opens a listbox. `role` and `aria-label` are
 * accepted here and land on this component's wrapper, which is what keeps an
 * otherwise unlabelled field nameable in the tree.
 *
 * The other loss is `disabled` on *individual* options: `OptionPicker` only takes
 * `disabled` for the whole field.
 */

export interface SelectOption<T extends string> {
  value: T;
  label: string;
}

export default function SelectField<T extends string>({
  title,
  description,
  value,
  options,
  onChange,
  stacked = false,
  className = "",
  disabled = false,
  searchable,
  size = "xl",
  role,
  "aria-label": ariaLabel,
}: {
  title?: React.ReactNode;
  description?: React.ReactNode;
  value: T;
  options: readonly SelectOption<T>[];
  onChange: (value: T) => void;
  stacked?: boolean;
  className?: string;
  disabled?: boolean;
  /** Defaults to on only when the list is long enough to be worth searching. */
  searchable?: boolean;
  /**
   * Trigger height. Not a class: Tailwind emits `h-*` in ascending order, so a
   * size set in `className` loses to one set in the shared token no matter where
   * it appears in the string. `xl` is the default and matches the `py-3` the
   * native `<select>` used to give; `auto` collapses to a bare text link.
   */
  size?: "xs" | "sm" | "md" | "lg" | "xl" | "auto";
  role?: string;
  "aria-label"?: string;
}) {
  // `OptionPicker` re-filters on every keystroke, so give it its own array
  // rather than letting it hold onto the caller's.
  const pickerOptions = options.map((o) => ({ value: String(o.value), label: o.label }));

  // Short lists read faster scrolled than typed into.
  const wantsSearch = searchable ?? pickerOptions.length > 8;

  const picker = (
    <div
      className={cn("relative w-full", stacked ? "" : "sm:w-64", className).trim()}
      {...(role ? { role } : {})}
      {...(ariaLabel ? { "aria-label": ariaLabel } : {})}
    >
      <OptionPicker
        value={String(value)}
        onChange={(next) => onChange(next as T)}
        options={pickerOptions}
        disabled={disabled}
        searchable={wantsSearch}
        className={cn(OPTION_PICKER_TRIGGER, optionPickerSize(size))}
      />
    </div>
  );

  if (!title) return picker;

  return (
    <SettingRow
      title={title}
      description={description}
      stacked={stacked}
      className={className}
      control={picker}
    />
  );
}
