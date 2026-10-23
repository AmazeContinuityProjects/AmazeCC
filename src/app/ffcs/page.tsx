import { Suspense } from "react";
import type { Metadata } from "next";
import FFCSPageView from "./FFCSPageView";

export const metadata: Metadata = {
  title: "FFCS Timetable Planner",
  description: "Plan conflict-free course timetables, check slot collisions, explore faculties, and generate optimal schedules on AmazeCC without logging in.",
};

export default function FFCSPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-slate-50 dark:bg-[#03060F] flex items-center justify-center text-sm text-slate-500">
          Loading FFCS Planner…
        </div>
      }
    >
      <FFCSPageView />
    </Suspense>
  );
}
