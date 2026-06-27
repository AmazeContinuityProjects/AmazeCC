import SubTabStrip from "../shared/SubTabStrip";

export default function MoreSubTabs({ activeMoreSubTab, setActiveMoreSubTab }) {
  return (
    <SubTabStrip
      tabs={[
        { id: "social", label: "Social" },
        { id: "ffcs", label: "FFCS Planner" },
        { id: "events", label: "Event Hub" },
      ]}
      activeTab={activeMoreSubTab}
      onChange={setActiveMoreSubTab}
    />
  );
}
