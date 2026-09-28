"use client";

import type { ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import SettingRow from "./SettingRow";

/**
 * A labelled native `<select>`.
 *
 * Deliberately still native: the OS picker is better than anything a div can
 * fake on a phone, and these are all short option lists. Only the chrome is
 * unified — the 10 settings selects had one hand-rolled class string, now one
 * token.
 */

const SELECT =
  "w-full appearance-none bg-zinc-50 dark:bg-zinc-950/50 border border-zinc-200/60 dark:border-zinc-800 rounded-xl pl-3 pr-9 py-3 text-sm font-bold text-zinc-800 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer";

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
}: {
  title?: ReactNode;
  description?: ReactNode;
  value: T;
  options: readonly SelectOption<T>[];
  onChange: (value: T) => void;
  stacked?: boolean;
  className?: string;
}) {
  const select = (
    <div className={`relative w-full ${stacked ? "" : "sm:w-64"}`.trim()}>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as T)}
        className={SELECT}
        aria-label={typeof title === "string" ? title : undefined}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <ChevronDown
        className="w-4 h-4 text-zinc-400 dark:text-zinc-500 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none"
        aria-hidden
      />
    </div>
  );

  if (!title) return select;

  return (
    <SettingRow
      title={title}
      description={description}
      stacked={stacked}
      className={className}
      control={select}
    />
  );
}
