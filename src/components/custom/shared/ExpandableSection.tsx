import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";

interface ExpandableSectionProps {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
  className?: string;
  headerClassName?: string;
  contentClassName?: string;
  badge?: React.ReactNode;
  icon?: React.ReactNode;
}

export default function ExpandableSection({
  title,
  children,
  defaultOpen = false,
  className,
  headerClassName,
  contentClassName,
  badge,
  icon,
}: ExpandableSectionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className={cn("w-full", className)}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "flex items-center justify-between w-full p-4 text-left font-semibold text-gray-800 dark:text-gray-200 midnight:text-gray-200 hover:bg-gray-50 dark:hover:bg-slate-800/50 midnight:hover:bg-gray-900 transition-colors",
          headerClassName
        )}
      >
        <span className="flex items-center gap-2">
          {icon}
          {title}
        </span>
        <div className="flex items-center gap-3">
          {badge}
          {isOpen ? (
            <ChevronUp size={18} className="text-gray-400" />
          ) : (
            <ChevronDown size={18} className="text-gray-400" />
          )}
        </div>
      </button>
      <div
        className={cn(
          "transition-all duration-300 ease-in-out overflow-hidden",
          isOpen ? "max-h-[800px] opacity-100" : "max-h-0 opacity-0"
        )}
      >
        <div className={cn("p-4 bg-gray-50/50 dark:bg-slate-800/20 midnight:bg-gray-900/20", contentClassName)}>
          {children}
        </div>
      </div>
    </div>
  );
}
