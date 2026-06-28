import { cn } from "@/lib/utils";

interface ViewModeOption {
  key: string;
  icon: React.ReactNode;
  label?: string;
}

interface ViewModeToggleProps {
  options: ViewModeOption[];
  value: string;
  onChange: (key: string) => void;
  className?: string;
}

export default function ViewModeToggle({
  options,
  value,
  onChange,
  className,
}: ViewModeToggleProps) {
  return (
    <div className={cn("flex bg-gray-100  dark:bg-gray-900 p-1 rounded-lg w-max", className)}>
      {options.map((opt) => (
        <button
          key={opt.key}
          onClick={() => onChange(opt.key)}
          className={cn(
            "p-1.5 rounded-md transition-colors",
            value === opt.key
              ? "bg-white  dark:bg-black text-gray-900  dark:text-gray-100 shadow-sm"
              : "text-gray-500  dark:text-gray-500 hover:text-gray-700 dark:hover:text-gray-200 dark:hover:text-gray-300"
          )}
          title={opt.label}
        >
          {opt.icon}
        </button>
      ))}
    </div>
  );
}
