import MoreSubTabs from "./MoreSubTabs";
import FFCSTimetableTab from "../exams/FFCSTimetableTab";
import TimetableShareCard from "../timetable/TimetableShareCard";
import PageHeader from "../shared/PageHeader";
import { LayoutGrid } from "lucide-react";

export default function MoreTab({
  attendanceData,
  activeMoreSubTab,
  setActiveMoreSubTab,
  IDs,
  loginToVTOP,
  isSubpageOpen,
  setIsSubpageOpen,
}: {
  attendanceData: any;
  activeMoreSubTab: string;
  setActiveMoreSubTab: (tab: string) => void;
  IDs: any;
  loginToVTOP?: () => Promise<{ cookies: string[]; authorizedID: string; csrf: string }>;
  isSubpageOpen?: boolean;
  setIsSubpageOpen?: (isOpen: boolean) => void;
}) {
  return (
    <div className="animate-fadeIn w-full max-w-7xl mx-auto md:pb-0">
      <div className="mb-4 space-y-4">
        <PageHeader icon={<LayoutGrid className="h-5 w-5 text-accent" />} title="More" />
        <MoreSubTabs activeMoreSubTab={activeMoreSubTab} setActiveMoreSubTab={setActiveMoreSubTab} />
      </div>

      <div>
        {/* The sub-tab id stays "social" so saved navigation state still lands here. */}
        {activeMoreSubTab === "social" && (
          <TimetableShareCard attendanceData={attendanceData} isDemo={IDs?.VtopUsername === "demo"} />
        )}
        {activeMoreSubTab === "ffcs" && <FFCSTimetableTab />}
      </div>
    </div>
  );
}
