import React from "react";
import MoreSubTabs from "./MoreSubTabs";
import FFCSTimetableTab from "../Exams/FFCSTimetableTab";
import SocialTab from "../social/SocialTab";
import EventHubTab from "../events/EventHubTab";
import ClubHubTab from "./ClubHubTab";
import PageHeader from "../shared/PageHeader";
import { LayoutGrid } from "lucide-react";

export default function MoreTab({ attendanceData, activeMoreSubTab, setActiveMoreSubTab, IDs, loginToVTOP, isSubpageOpen, setIsSubpageOpen, registeredEvents, setRegisteredEvents }: {
  attendanceData: any;
  activeMoreSubTab: string;
  setActiveMoreSubTab: (tab: string) => void;
  IDs: any;
  loginToVTOP?: () => Promise<{ cookies: string[]; authorizedID: string; csrf: string }>;
  isSubpageOpen?: boolean;
  setIsSubpageOpen?: (isOpen: boolean) => void;
  registeredEvents: any[];
  setRegisteredEvents: (events: any[]) => void;
}) {

  return (
    <div className="animate-fadeIn w-full max-w-7xl mx-auto pb-24 md:pb-0">
      <div className="mb-4 space-y-4">
        <PageHeader
          icon={<LayoutGrid className="h-5 w-5 text-blue-600 dark:text-blue-400" />}
          title="More"
        />
        <MoreSubTabs activeMoreSubTab={activeMoreSubTab} setActiveMoreSubTab={setActiveMoreSubTab} />
      </div>

      <div>
        {activeMoreSubTab === "social" && <SocialTab attendanceData={attendanceData} isDemo={IDs?.VtopUsername === "demo"} />}
        {activeMoreSubTab === "ffcs" && <FFCSTimetableTab />}
        {activeMoreSubTab === "events" && <EventHubTab IDs={IDs} setIsSubpageOpen={setIsSubpageOpen} registeredEvents={registeredEvents} setRegisteredEvents={setRegisteredEvents} />}
        {activeMoreSubTab === "clubs" && <ClubHubTab IDs={IDs} loginToVTOP={loginToVTOP} />}
      </div>
    </div>
  );
}
