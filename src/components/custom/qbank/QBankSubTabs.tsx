import SubTabStrip from "../shared/SubTabStrip";

export default function QBankSubTabs({ activeSubTab, setActiveSubTab }) {
  return (
    <SubTabStrip
      tabs={[
        { id: "archive", label: "Papers Archive" },
        { id: "pure", label: "Pure QBank" },
      ]}
      activeTab={activeSubTab}
      onChange={setActiveSubTab}
    />
  );
}
