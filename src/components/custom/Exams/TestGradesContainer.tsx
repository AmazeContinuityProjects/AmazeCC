"use client";

import MarksHistoryTab from "./MarksHistoryTab";
import { RefreshCcw } from "lucide-react";
import FetchButton from "../shared/FetchButton";
import SubpageLayout from "../shared/SubpageLayout";

export default function TestGradesContainer({ data, marksData, gradesData, attendance, handleFetchGrades, setActiveSubTab }) {
  if (!data || !marksData?.cgpa) {
    return (
      <div className="py-8">
        <div className="text-center">
          <h1 className="md:hidden text-xl font-bold text-center text-gray-900 dark:text-gray-100 midnight:text-gray-100">
            Grade History
          </h1>
          <h1 className="hidden md:block text-3xl font-bold text-left text-gray-900 dark:text-gray-100 midnight:text-gray-100">
            Grade History
          </h1>
        </div>
        <div className="mt-4">
          <MarksHistoryTab data={data} />
        </div>
      </div>
    );
  }

  return (
    <SubpageLayout
      title="Grade History"
      onBack={() => setActiveSubTab("overview")}
      action={
        <FetchButton onClick={handleFetchGrades} icon={<RefreshCcw className="w-4 h-4" />}>
          <span className="text-sm">Reload</span>
        </FetchButton>
      }
    >
      <MarksHistoryTab data={data} />
    </SubpageLayout>
  );
}
