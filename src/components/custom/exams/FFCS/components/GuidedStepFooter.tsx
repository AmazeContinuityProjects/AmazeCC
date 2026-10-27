import type { ReactNode } from "react";
import { ChevronLeft } from "lucide-react";

interface GuidedStepFooterProps {
  onPrevious: () => void;
  previousDisabled?: boolean;
  children: ReactNode;
}

export function GuidedStepFooter({
  onPrevious,
  previousDisabled = false,
  children,
}: GuidedStepFooterProps) {
  return (
    <div className="flex items-center gap-2 w-full">
      <button
        type="button"
        disabled={previousDisabled}
        onClick={onPrevious}
        aria-label="Previous Step"
        className={`w-12 h-12 rounded-2xl bg-zinc-900/90 hover:bg-zinc-800 border border-zinc-800 text-white flex items-center justify-center shadow-lg transition-all active:scale-90 hover:scale-105 cursor-pointer shrink-0 ${
          previousDisabled ? "disabled:opacity-40" : ""
        }`}
      >
        <ChevronLeft className="w-5 h-5" />
      </button>
      {children}
    </div>
  );
}
