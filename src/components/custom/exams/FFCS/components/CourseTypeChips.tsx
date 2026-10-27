import type { ReactNode } from "react";
import { defaultColor, typeColors, typeLabels } from "../constants";

export type CourseTypeChipSize = "sm" | "md" | "default";

interface CourseTypeChipsProps {
  typesInput?: string | string[];
  size?: CourseTypeChipSize;
  /** Keep the selected-course list's existing 10px text at its compact size. */
  compactText?: boolean;
}

export function CourseTypeChips({
  typesInput,
  size = "md",
  compactText = false,
}: CourseTypeChipsProps) {
  if (!typesInput || (Array.isArray(typesInput) && typesInput.length === 0)) return null;

  let types = Array.isArray(typesInput)
    ? [...typesInput]
    : typesInput.split("+");
  types = types.map((type) => type.trim().toUpperCase()).filter(Boolean);

  if (types.includes("ETH") && types.includes("ELA")) {
    types = [...types.filter((type) => type !== "ETH" && type !== "ELA"), "ETH+ELA"];
  }
  if (types.includes("TH") && types.includes("LO")) {
    types = [...types.filter((type) => type !== "TH" && type !== "LO"), "TH+LO"];
  }

  const padding = size === "sm" ? "px-1.5" : "px-2";
  const textSize = size === "sm" && !compactText ? "text-[9px]" : "text-[10px]";

  return (
    <span className="flex flex-wrap gap-1">
      {types.map((type) => {
        const color = typeColors[type] || defaultColor;
        const displayName = typeLabels[type] || type;
        return (
          <span
            key={type}
            title={displayName}
            className={`inline-flex items-center font-bold rounded-md border ${padding} py-0.5 ${textSize} ${color.bg} ${color.text} ${color.border}`}
          >
            {displayName}
          </span>
        );
      })}
    </span>
  );
}

/** Adapter for table components that accept a chip-rendering callback. */
export function renderCourseTypeChips(
  typesInput?: string | string[],
  size: CourseTypeChipSize = "md"
): ReactNode {
  return <CourseTypeChips typesInput={typesInput} size={size} />;
}
