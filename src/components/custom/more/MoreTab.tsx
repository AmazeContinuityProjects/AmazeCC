import React, { useState } from "react";
import MoreSubTabs from "./MoreSubTabs";
import FFCSTimetableTab from "../Exams/FFCSTimetableTab";
import UtilitiesTab from "./UtilitiesTab";
import SocialTab from "../social/SocialTab";

export default function MoreTab({ attendanceData, activeMoreSubTab, setActiveMoreSubTab }) {

  return (
    <div className="animate-fadeIn w-full max-w-7xl mx-auto">
      <div className="md:hidden">
        <MoreSubTabs
          activeMoreSubTab={activeMoreSubTab}
          setActiveMoreSubTab={setActiveMoreSubTab}
        />
      </div>



      <div className="mt-4 px-2 md:px-0">
        {activeMoreSubTab === "social" && <SocialTab attendanceData={attendanceData} />}
        {activeMoreSubTab === "ffcs" && <FFCSTimetableTab />}
        {activeMoreSubTab === "utilities" && <UtilitiesTab />}
      </div>
    </div>
  );
}
