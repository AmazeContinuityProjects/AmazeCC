"use client";

import SubTabStrip from "../shared/SubTabStrip";

export default function HostelSubTabs({
  HostelActiveSubTab,
  setHostelActiveSubTab,
}) {
  return (
    <SubTabStrip
      tabs={[
        { id: "mess", label: "Mess" },
        { id: "laundry", label: "Laundry" },
        { id: "leave", label: "Leave" },
        { id: "counselling", label: "Counselling" },
      ]}
      activeTab={HostelActiveSubTab}
      onChange={setHostelActiveSubTab}
    />
  );
}
