"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { RefreshCcw } from "lucide-react";
import type { Creds } from "../exams/courseHelpers";

function FeatureLoading() {
  return <div className="min-h-40 animate-pulse rounded-2xl bg-slate-100 dark:bg-zinc-900" role="status" aria-label="Loading hostel" />;
}

const MessDisplay = dynamic(() => import("../hostel/MessDisplay"), { loading: FeatureLoading });
const LaundryDisplay = dynamic(() => import("../hostel/LaundryDisplay"), { loading: FeatureLoading });
const LeaveDisplay = dynamic(() => import("../hostel/LeaveDisplay"), { loading: FeatureLoading });
const HostelOverview = dynamic(() => import("../hostel/HostelOverview"), { loading: FeatureLoading });
const HostelCounsellingView = dynamic(() => import("../hostel/HostelCounsellingView"), { loading: FeatureLoading });
const PaymentsTab = dynamic(() => import("../PaymentsTab"), { loading: FeatureLoading });

interface DashboardHostelFeatureProps {
  activeSubTab: string;
  setActiveSubTab: (tab: string) => void;
  hostelData: any;
  onFetchHostelDetails: () => Promise<void>;
  loginToVTOP: () => Promise<Creds>;
  onSystemBack: () => void;
}

/** Hostel route and its selected subsection. */
export default function DashboardHostelFeature({
  activeSubTab,
  setActiveSubTab,
  hostelData,
  onFetchHostelDetails,
  loginToVTOP,
  onSystemBack,
}: DashboardHostelFeatureProps) {
  const [counsellingRefreshKey, setCounsellingRefreshKey] = useState(0);

  return (
    <div className="animate-fadeIn">
      {activeSubTab === "overview" && <HostelOverview hostelData={hostelData} setHostelActiveSubTab={setActiveSubTab} />}
      {activeSubTab === "mess" && <MessDisplay hostelData={hostelData} handleHostelDetailsFetch={onFetchHostelDetails} />}
      {activeSubTab === "laundry" && <LaundryDisplay hostelData={hostelData} handleHostelDetailsFetch={onFetchHostelDetails} />}
      {activeSubTab === "leave" && <LeaveDisplay leaveData={hostelData.leaveHistory} handleHostelDetailsFetch={onFetchHostelDetails} />}
      {activeSubTab === "payment" && <PaymentsTab loginToVTOP={loginToVTOP} onBack={onSystemBack} />}
      {activeSubTab === "counselling" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">Hostel Counselling</h2>
            <button
              onClick={() => setCounsellingRefreshKey(key => key + 1)}
              className="p-2.5 rounded-full bg-info-surface text-info hover:bg-info-surface transition-colors"
              title="Reload"
            >
              <RefreshCcw className="h-5 w-5" />
            </button>
          </div>
          <HostelCounsellingView loginToVTOP={loginToVTOP} refreshKey={counsellingRefreshKey} />
        </div>
      )}
    </div>
  );
}
