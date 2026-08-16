"use client";

import SubTabStrip from "../shared/SubTabStrip";

export default function AttendanceSubTabs({ activeSubTab, setActiveAttendanceSubTab }) {
  return (
    <SubTabStrip
      tabs={[
        { id: "attendance", label: "Attendance" },
        { id: "calendar", label: "Calendar" },
        { id: "predictor", label: "Predictor" },
      ]}
      activeTab={activeSubTab}
      onChange={setActiveAttendanceSubTab}
    />
  );
}
