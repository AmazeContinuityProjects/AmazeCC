"use client";

/**
 * The Dashboard's "Common Free Slots" sheet.
 *
 * This is a **legacy** surface: `AttendanceTabs.tsx` still feeds it the old
 * `Friend[]` + `myAttendance` pair, because the Dashboard has its own
 * friends list that predates the server-derived model. It is kept working by
 * adapting those inputs here rather than by keeping the old grid alive.
 *
 * That adapter is worth the few lines. The previous grid built its occupancy by
 * fanning each `slotId` across every day it appeared on, which marked a friend
 * busy on days they were not in class (docs/social-tt/09-schedule-math.md §5.1).
 * Routing through `busyMapFromClassSlots` fixes that here too, for free — the
 * Dashboard gets the day-aware behaviour without anyone having to touch it.
 *
 * Removed in Phase 6, with the rest of the legacy friends model.
 */

import { useMemo } from "react";
import BottomSheet from "../shared/BottomSheet";
import CommonFreeSlotsGrid from "./CommonFreeSlotsGrid";
import { Friend } from "@/lib/socialUtils";
import { buildBusyMap, busyMapFromClassSlots } from "@/lib/social/schedule";
import type { BusyMap } from "@/lib/social/types";

interface CommonFreeSlotsModalProps {
  friends: Friend[];
  myAttendance: any[];
  groupName?: string;
  onClose: () => void;
}

export default function CommonFreeSlotsModal({
  friends,
  myAttendance,
  groupName,
  onClose,
}: CommonFreeSlotsModalProps) {
  const ownBusyMap = useMemo<BusyMap>(
    () =>
      buildBusyMap(
        (myAttendance || []).map((c: any) => ({
          code: c?.courseCode ?? "",
          title: c?.courseTitle ?? "",
          slotVenue: String(c?.slotName ?? ""),
        }))
      ),
    [myAttendance]
  );

  const peers = useMemo(
    () =>
      (friends || []).map((f) => ({
        handle: f.id,
        name: f.name || f.nickname,
        busyMap: busyMapFromClassSlots(f.classSlots),
        // The legacy list has no per-pair visibility, and it holds full detail,
        // so it behaves as a full grant.
        visibility: "full" as const,
        loaded: true,
      })),
    [friends]
  );

  return (
    <BottomSheet onClose={onClose} overlayId="social-common-slots" maxWidth="max-w-5xl">
      <div className="flex flex-col min-h-0 space-y-4">
        <div className="p-4 sm:p-5 border border-zinc-200/70 dark:border-zinc-800/80 rounded-2xl bg-zinc-50/80 dark:bg-zinc-900/70">
          <h2 className="text-base font-black text-zinc-900 dark:text-white font-outfit">
            {groupName ? `${groupName} - Common Free Slots` : "Common Free Slots"}
          </h2>
          <p className="text-[11px] text-zinc-500 dark:text-zinc-400 font-medium mt-1">
            Comparing your schedule with {friends.length} friend
            {friends.length !== 1 ? "s" : ""}
          </p>
        </div>

        <div className="px-1 pb-1">
          <CommonFreeSlotsGrid ownBusyMap={ownBusyMap} peers={peers} />
        </div>
      </div>
    </BottomSheet>
  );
}
