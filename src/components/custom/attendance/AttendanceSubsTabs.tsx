"use client";

import SubTabStrip from "../shared/SubTabStrip";

export default function AttendanceSubTabs({ activeSubTab, setActiveAttendanceSubTab }) {
  return (
    <SubTabStrip
      tabs={[
        { id: "attendance", label: "Attendance" },
        { id: "calendar", label: "Calendar" },
      ]}
      activeTab={activeSubTab}
      onChange={setActiveAttendanceSubTab}
    />
  );
}
