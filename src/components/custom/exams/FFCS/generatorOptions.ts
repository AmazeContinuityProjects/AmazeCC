import { timeToMinutes, type DayId } from "@/lib/slots";

/**
 * Page-level vocabulary of FFCSGeneratorSubpage: the section keys the planner
 * navigates between, the day labels it prints, and the option builders behind
 * the custom-slot time selects. Extracted verbatim; only the subpage imports
 * them.
 */

export type GeneratorSectionKey = "courses" | "ranking" | "schedule" | "constraints" | "social";

export const DAY_LABELS: Record<DayId, string> = {
  mon: "Monday",
  tue: "Tuesday",
  wed: "Wednesday",
  thu: "Thursday",
  fri: "Friday",
};

function minutesToTimeValue(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return `${String(hours).padStart(2, "0")}:${String(remainder).padStart(2, "0")}`;
}

export function buildSlotTimeOptions(
  boundaries: readonly { slot: string; time: string }[],
): { value: string; label: string }[] {
  const options = new Map<string, string>();
  boundaries.forEach(({ slot, time }) => {
    const minutes = timeToMinutes(time);
    if (minutes === null) return;
    const value = minutesToTimeValue(minutes);
    const existing = options.get(value);
    options.set(value, existing ? `${existing}, ${slot}` : `${time} · ${slot}`);
  });
  return [...options].sort(([a], [b]) => a.localeCompare(b)).map(([value, label]) => ({ value, label }));
}
