"use client";

import SubTabStrip from "../shared/SubTabStrip";

export default function HostelSubTabs({
  HostelActiveSubTab,
  setHostelActiveSubTab,
}) {
  return (
    <SubTabStrip
      tabs={[
        { id: "overview", label: "Overview" },
        { id: "mess", label: "Mess Menu" },
        { id: "laundry", label: "Laundry" },
        { id: "leave", label: "Leave" },
        { id: "counselling", label: "Counselling" },
      ]}
      activeTab={HostelActiveSubTab}
      onChange={setHostelActiveSubTab}
    />
  );
}
