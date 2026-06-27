"use client";
import SubTabStrip from "../shared/SubTabStrip";

const PROFILE_TABS = [
  { id: "info", label: "My Info" },
  { id: "credentials", label: "Credentials" },
];

export default function ProfileSubTabs({ activeTab, onChange }: { activeTab: string; onChange: (id: string) => void }) {
  return <SubTabStrip tabs={PROFILE_TABS} activeTab={activeTab} onChange={onChange} />;
}

export { PROFILE_TABS };
