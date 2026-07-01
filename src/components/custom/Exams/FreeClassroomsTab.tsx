import React from "react";
import SubpageLayout from "../shared/SubpageLayout";
import FreeClassroomsWidget from "../mobile/FreeClassroomsWidget";

export default function FreeClassroomsTab({ setActiveSubTab }: { setActiveSubTab: (tab: string) => void }) {
  return (
    <SubpageLayout title="Free Classrooms" onBack={() => setActiveSubTab("overview")}>
      <div className="pt-2">
        <FreeClassroomsWidget />
      </div>
    </SubpageLayout>
  );
}
