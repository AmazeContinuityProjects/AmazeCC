"use client";

import { CalendarRange } from "lucide-react";
import BackButton from "../shared/BackButton";
import { SectionHeader } from "./rows";
import CommonFreeSlotsGrid from "./CommonFreeSlotsGrid";
import { usePeerTimetables } from "@/lib/social/usePeerTimetables";
import { useSocialData } from "@/lib/social/useSocialData";

/**
 * Common Free Grid.
 *
 * A thin shell around the grid, so the subpage owns the chrome (back, eyebrow,
 * title) and the grid owns only the data. The grid itself is deliberately not
 * wrapped in a `TILE` — the old version nested four rounded bordered surfaces
 * around a single data cell.
 */
export default function CommonFreeGridSubpage({
  onBack,
  onOpenPeer,
}: {
  onBack: () => void;
  onOpenPeer?: (handle: string) => void;
}) {
  const { ownBusyMap } = useSocialData();
  const { peers } = usePeerTimetables();

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-3">
        <BackButton onClick={onBack} className="self-start" />
      </div>

      <div className="px-1">
        <p className="text-xs font-semibold text-zinc-400 dark:text-zinc-500 leading-none mb-1">
          Campus
        </p>
        <h1 className="text-xl sm:text-2xl font-black text-zinc-900 dark:text-white tracking-tight leading-tight font-outfit truncate">
          Common Free Grid
        </h1>
      </div>

      <SectionHeader icon={CalendarRange} title="Everyone's week" />

      <CommonFreeSlotsGrid ownBusyMap={ownBusyMap} peers={peers} onOpenPeer={onOpenPeer} />
    </div>
  );
}
