import { cn } from "@/lib/utils";

interface ProgressBarProps {
  value: number;
  max?: number;
  className?: string;
  barClassName?: string;
  color?: "blue" | "emerald" | "amber" | "red";
  showLabel?: boolean;
  size?: "sm" | "md";
}

const barColors = {
  blue: "bg-blue-500",
  emerald: "bg-emerald-500",
  amber: "bg-amber-500",
  red: "bg-red-500",
};

const sizes = {
  sm: "h-1.5",
  md: "h-2",
};

export default function ProgressBar({
  value,
  max = 100,
  className,
  barClassName,
  color = "blue",
  showLabel = false,
  size = "md",
}: ProgressBarProps) {
  const pct = Math.min(Math.max((value / max) * 100, 0), 100);

  return (
    <div className={cn("w-full", className)}>
      <div
        className={cn(
          "w-full rounded-full overflow-hidden bg-gray-200 dark:bg-gray-800 midnight:bg-gray-800",
          sizes[size]
        )}
      >
        <div
          className={cn(
            "h-full rounded-full transition-all duration-500 ease-out",
            barColors[color],
            barClassName
          )}
          style={{ width: `${pct}%` }}
        />
      </div>
      {showLabel && (
        <p className="text-xs text-gray-500 dark:text-gray-400 midnight:text-gray-400 mt-1">
          {Math.round(pct)}%
        </p>
      )}
    </div>
  );
}
