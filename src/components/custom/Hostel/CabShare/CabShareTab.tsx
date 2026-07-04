"use client";

import { useState, useEffect, useCallback } from "react";
import SubTabStrip from "../../shared/SubTabStrip";
import CreateTrip from "./CreateTrip";
import SearchTrips from "./SearchTrips";
import MyTrips from "./MyTrips";
import PageHeader from "../../shared/PageHeader";
import { Car, Loader2, Plus, Search, UserRoundCheck } from "lucide-react";
import CabShareAuthModal from "./CabShareAuthModal";
import { API_BASE } from "../../Main";
import { readJsonResponse } from "./cabShareFallback";

export default function CabShareTab() {
  const [activeTab, setActiveTab] = useState("search");
  const [cabShareUser, setCabShareUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [pendingCount, setPendingCount] = useState(0);

  useEffect(() => {
    const userStr = localStorage.getItem("cabshare_user");
    if (userStr) {
      setCabShareUser(JSON.parse(userStr));
    }
    setLoading(false);
  }, []);

  const refreshPendingCount = useCallback(async () => {
    if (!cabShareUser) return;
    try {
      const res = await fetch(`${API_BASE}/api/cabshare/trips/me?reg_number=${cabShareUser.reg_number}`);
      const data = await readJsonResponse(res);
      if (data?.success) {
        const count = (data.my_trips || []).reduce((acc: number, trip: any) =>
          acc + (trip.requests || []).filter((r: any) => r.status === 'pending').length, 0);
        setPendingCount(count);
      }
    } catch {}
  }, [cabShareUser]);

  useEffect(() => {
    refreshPendingCount();
    const interval = setInterval(refreshPendingCount, 15000);
    return () => clearInterval(interval);
  }, [refreshPendingCount]);

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="w-8 h-8 animate-spin text-gray-500 dark:text-gray-400" />
      </div>
    );
  }

  return (
    <div className="animate-fadeIn space-y-6">
      <PageHeader
        icon={<Car className="w-5.5 h-5.5 text-blue-605 dark:text-blue-400" />}
        title="Cab Share"
        meta={
          cabShareUser ? (
            <span className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-1 text-[10px] font-black uppercase tracking-wider text-emerald-700 dark:border-emerald-900/40 dark:bg-emerald-950/20 dark:text-emerald-400">
              <UserRoundCheck className="h-3.5 w-3.5" />
              {cabShareUser.name || cabShareUser.reg_number}
            </span>
          ) : null
        }
        actions={
          cabShareUser ? (
            <div className="hidden items-center gap-2 text-[11px] font-semibold text-gray-500 dark:text-gray-400 md:flex">
              <span>Find students heading the same way.</span>
            </div>
          ) : null
        }
      />

      <CabShareAuthModal 
        isOpen={!cabShareUser} 
        onAuthSuccess={(user) => {
          localStorage.setItem("cabshare_user", JSON.stringify(user));
          setCabShareUser(user);
        }} 
      />

      {cabShareUser && (
        <>
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_280px]">
            <div className="min-w-0">
              <SubTabStrip
                tabs={[
                  { id: "search", label: "Find Ride" },
                  { id: "create", label: "Post Ride" },
                  { id: "my-trips", label: "My Trips" },
                ]}
                activeTab={activeTab}
                onChange={setActiveTab}
              />

              <div className="pt-2">
                {activeTab === "search" && <SearchTrips cabShareUser={cabShareUser} />}
                {activeTab === "create" && <CreateTrip cabShareUser={cabShareUser} onTripCreated={() => setActiveTab("my-trips")} />}
                {activeTab === "my-trips" && <MyTrips cabShareUser={cabShareUser} />}
              </div>
            </div>

            <aside className="rounded-3xl border border-gray-200 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-black lg:sticky lg:top-4">
              <div className="space-y-4">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-wider text-gray-400 dark:text-gray-500">Quick actions</p>
                  <div className="mt-3 grid gap-2">
                    <button
                      onClick={() => setActiveTab("search")}
                      className="flex items-center gap-3 rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-left transition-colors hover:border-blue-200 hover:bg-blue-50 dark:border-white/10 dark:bg-white/[0.03] dark:hover:border-blue-900/40 dark:hover:bg-blue-950/20"
                    >
                      <Search className="h-4.5 w-4.5 text-blue-600 dark:text-blue-400" />
                      <span className="text-sm font-bold text-gray-800 dark:text-gray-200">Find a ride</span>
                    </button>
                    <button
                      onClick={() => setActiveTab("create")}
                      className="flex items-center gap-3 rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-left transition-colors hover:border-emerald-200 hover:bg-emerald-50 dark:border-white/10 dark:bg-white/[0.03] dark:hover:border-emerald-900/40 dark:hover:bg-emerald-950/20"
                    >
                      <Plus className="h-4.5 w-4.5 text-emerald-600 dark:text-emerald-400" />
                      <span className="text-sm font-bold text-gray-800 dark:text-gray-200">Post a ride</span>
                    </button>
                  </div>
                </div>

                <div className="rounded-2xl border border-blue-100 bg-blue-50 p-4 dark:border-blue-900/40 dark:bg-blue-950/20">
                  <p className="text-xs font-black uppercase tracking-wider text-blue-700 dark:text-blue-400">Privacy</p>
                  <p className="mt-2 text-xs font-medium leading-relaxed text-blue-900/70 dark:text-blue-200/70">
                    Phone numbers are shared only after a ride request is accepted.
                  </p>
                </div>
              </div>
            </aside>
          </div>
        </>
      )}
    </div>
  );
}
