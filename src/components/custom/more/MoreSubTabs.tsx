import SubTabStrip from "../shared/SubTabStrip";
import { navigateToFFCSPlanner } from "@/lib/ffcsNavigation";

export default function MoreSubTabs({ activeMoreSubTab, setActiveMoreSubTab }) {
  return (
    <SubTabStrip
      tabs={[
        { id: "social", label: "Share timetable" },
        { id: "ffcs", label: "FFCS Planner" },
      ]}
      activeTab={activeMoreSubTab}
      onChange={(tab) => (tab === "ffcs" ? navigateToFFCSPlanner() : setActiveMoreSubTab(tab))}
    />
  );
}
