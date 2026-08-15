"use client";

import MarksDisplay from "./MarksDisplay";
import SubpageLayout from "../shared/SubpageLayout";

export default function MarksSubTab({ data, setActiveSubTab }) {
    return (
        <SubpageLayout
            title="Current Sem Marks"
            onBack={() => setActiveSubTab("overview")}
        >
            <MarksDisplay data={data} />
        </SubpageLayout>
    );
}
