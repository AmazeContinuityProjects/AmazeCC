import { ArrowUpRight } from "lucide-react";
import SubTabStrip from "../shared/SubTabStrip";
import { navigateToFFCSPlanner } from "@/lib/ffcsNavigation";

/** The FFCS planner is a separate standalone tool, not a tab inside More. */
export default function MoreSubTabs({ activeMoreSubTab, setActiveMoreSubTab }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="min-w-0 flex-1">
        <SubTabStrip
          tabs={[{ id: "social", label: "Social" }]}
          activeTab={activeMoreSubTab}
          onChange={(tab) => setActiveMoreSubTab(tab)}
        />
      </div>
      <button
        type="button"
        onClick={() => navigateToFFCSPlanner()}
        className="inline-flex min-h-11 items-center gap-1.5 rounded-xl border border-border-muted bg-surface px-3 py-2 text-sm font-semibold text-info transition-colors hover:bg-surface-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring cursor-pointer"
      >
        Open FFCS Planner
        <ArrowUpRight className="h-4 w-4 shrink-0" aria-hidden="true" />
      </button>
    </div>
  );
}
