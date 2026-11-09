import { Suspense } from "react";
import type { Metadata } from "next";
import FriendFinderPageView from "./FriendFinderPageView";

export const metadata: Metadata = {
  title: "AmazeCC Friend Finder - Find Classmates & Timetable Overlaps",
  description:
    "Find your friends and classmates across shared courses, slots, and faculties for Winter Semester 2026-2027 (CH20262705) on AmazeCC.",
};

export default function FriendFinderPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-slate-50 dark:bg-[#03060F] flex items-center justify-center text-sm text-slate-500">
          Loading Friend Finder…
        </div>
      }
    >
      <FriendFinderPageView />
    </Suspense>
  );
}
