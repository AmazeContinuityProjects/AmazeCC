"use client";

import { useState, useEffect, useCallback } from "react";
import CreateTrip from "./CreateTrip";
import SearchTrips from "./SearchTrips";
import MyTrips from "./MyTrips";
import { ChevronRight, Lock, Plus, UserRoundCheck } from "lucide-react";
import { cn } from "@amazecontinuityprojects/amazeui";
import CabShareAuthModal from "./CabShareAuthModal";
import { api } from "@/lib/sync-engine";
import { readJsonResponse } from "./cabShareFallback";
import { PageShell, ChipTabs, ListSkeleton, SectionHeader, StatTile, ToneBadge } from "../../shared/primitives";
import { TILE_INTERACTIVE_ROW, TILE_CARD } from "@/lib/uiTokens";

const TABS = [
  { value: "search", label: "Find Ride" },
  { value: "create", label: "Post Ride" },
  { value: "my-trips", label: "My Trips" },
] as const;

type CabShareScreen = (typeof TABS)[number]["value"];

export default function CabShareTab({ onBack }: { onBack?: () => void }) {
  const [activeTab, setActiveTab] = useState<CabShareScreen>("search");
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
      const res = await api(`cabshare/trips/me?reg_number=${cabShareUser.reg_number}`, { parse: "raw" });
      const data = await readJsonResponse(res as Response);
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

  // The pending tally the poll has always computed but nothing showed: it is the
  // one number on this page the reader cannot get anywhere else, and it is what
  // makes "My Trips" worth opening.
  const signedInAs = cabShareUser?.name || cabShareUser?.reg_number;

  if (loading) {
    return (
      <PageShell
        eyebrow="Hostel"
        title="Cab Share"
        subtitle="Find students heading the same way."
        selectable
        onBack={onBack}
      >
        <ListSkeleton rows={4} />
      </PageShell>
    );
  }

  return (
    <PageShell
      eyebrow="Hostel"
      title="Cab Share"
      subtitle="Find students heading the same way."
      // Host names, ride notes and phone numbers are the page's content, and a
      // reader copying a number to dial it is the obvious thing to do here.
      selectable
      onBack={onBack}
      actions={
        cabShareUser ? (
          <ToneBadge tone="emerald" icon={<UserRoundCheck className="h-3 w-3" />}>
            {signedInAs}
          </ToneBadge>
        ) : null
      }
    >
      <CabShareAuthModal
        isOpen={!cabShareUser}
        onAuthSuccess={(user) => {
          localStorage.setItem("cabshare_user", JSON.stringify(user));
          setCabShareUser(user);
        }}
      />

      {cabShareUser && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-3 sm:gap-4">
            <StatTile
              label="Pending requests"
              value={pendingCount}
              badge={pendingCount > 0 ? "Action needed" : "All clear"}
              tone={pendingCount > 0 ? "amber" : "emerald"}
              sub={pendingCount > 0 ? "Students waiting on your reply" : "No replies outstanding"}
              height="min-h-32 sm:min-h-36"
            />

            <button
              type="button"
              onClick={() => setActiveTab("create")}
              className={cn(TILE_INTERACTIVE_ROW, "flex-col items-start justify-end gap-2 p-4 sm:p-5")}
            >
              <span className="flex w-full items-center justify-between gap-2">
                <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-500 font-outfit truncate">
                  Post a ride
                </span>
                <ChevronRight className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
              </span>
              <span className="my-auto flex w-full items-center gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400">
                  <Plus className="h-5 w-5" />
                </span>
                <span className="min-w-0 text-left">
                  <span className="block text-base font-black font-outfit tracking-tight leading-tight text-text-heading">
                    Split your cab
                  </span>
                  <span className="block text-[11px] text-text-secondary dark:text-text-muted font-medium mt-0.5 truncate">
                    {pendingCount > 0 ? `${pendingCount} pending on your rides` : "Offer your route to others"}
                  </span>
                </span>
              </span>
            </button>
          </div>

          <ChipTabs options={TABS} value={activeTab} onChange={setActiveTab} />

          <div className="animate-in fade-in slide-in-from-bottom-4 duration-300">
            {activeTab === "search" && <SearchTrips cabShareUser={cabShareUser} />}
            {activeTab === "create" && <CreateTrip cabShareUser={cabShareUser} onTripCreated={() => setActiveTab("my-trips")} />}
            {activeTab === "my-trips" && <MyTrips cabShareUser={cabShareUser} pendingCount={pendingCount} />}
          </div>

          <div className="space-y-3">
            <SectionHeader icon={Lock} title="Privacy" />
            <div className={cn(TILE_CARD, "text-xs font-medium leading-relaxed text-text-secondary dark:text-text-muted")}>
              Phone numbers are shared only after a ride request is accepted. Until then a
              matched student sees your name and register number only.
            </div>
          </div>
        </div>
      )}
    </PageShell>
  );
}
