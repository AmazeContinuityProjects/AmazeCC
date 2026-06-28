import { ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";

interface BackButtonProps {
  onClick: () => void;
  className?: string;
}

export default function BackButton({ onClick, className }: BackButtonProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "p-2 rounded-full bg-white  dark:bg-gray-900",
        "shadow-sm border border-gray-200  dark:border-gray-800",
        "hover:bg-gray-100 dark:hover:bg-slate-700 dark:hover:bg-gray-800",
        "transition-all duration-200",
        className
      )}
    >
      <ArrowLeft size={18} className="text-gray-600  dark:text-gray-400" />
    </button>
  );
}
