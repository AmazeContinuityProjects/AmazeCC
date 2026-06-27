import React, { useState } from "react";
import MoreSubTabs from "./MoreSubTabs";
import FFCSTimetableTab from "../Exams/FFCSTimetableTab";
import SocialTab from "../social/SocialTab";
import EventHubTab from "../events/EventHubTab";

export default function MoreTab({ attendanceData, activeMoreSubTab, setActiveMoreSubTab, IDs, isSubpageOpen, setIsSubpageOpen, registeredEvents, setRegisteredEvents }: {
  attendanceData: any;
  activeMoreSubTab: string;
  setActiveMoreSubTab: (tab: string) => void;
  IDs: any;
  isSubpageOpen?: boolean;
  setIsSubpageOpen?: (isOpen: boolean) => void;
  registeredEvents: any[];
  setRegisteredEvents: (events: any[]) => void;
}) {

  return (
    <div className="animate-fadeIn w-full max-w-7xl mx-auto">
      <div className={`md:hidden ${isSubpageOpen ? "hidden" : ""}`}>
        <MoreSubTabs
          activeMoreSubTab={activeMoreSubTab}
          setActiveMoreSubTab={setActiveMoreSubTab}
        />
      </div>



      <div className="mt-4">
        {activeMoreSubTab === "social" && <SocialTab attendanceData={attendanceData} />}
        {activeMoreSubTab === "ffcs" && <FFCSTimetableTab />}
        {activeMoreSubTab === "events" && <EventHubTab IDs={IDs} setIsSubpageOpen={setIsSubpageOpen} registeredEvents={registeredEvents} setRegisteredEvents={setRegisteredEvents} />}
      </div>
    </div>
  );
}
