import { Suspense } from "react";
import type { Metadata } from "next";
import FriendFinderDisclaimerView from "./FriendFinderDisclaimerView";

export const metadata: Metadata = {
  title: "AmazeCC Friend Finder - Data Sharing & Liability Disclaimer",
  description:
    "Important voluntary data sharing notice, liability disclaimer, and privacy boundaries for the AmazeCC Friend Finder timetable matching service.",
};

export default function FriendFinderDisclaimerPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-slate-50 dark:bg-[#03060F] flex items-center justify-center text-sm text-slate-500">
          Loading Disclaimer…
        </div>
      }
    >
      <FriendFinderDisclaimerView />
    </Suspense>
  );
}
