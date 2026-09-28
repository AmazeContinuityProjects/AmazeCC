"use client";

import { useMemo } from "react";
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
  /**
   * Restrict the grid to these handles.
   *
   * `undefined` means everyone, which is the original behaviour. A set means a
   * group, and the grid's "everyone free" is then ANDed across just those people.
   */
  onlyHandles,
  title = "Common Free Grid",
  subTitle = "Everyone's week",
}: {
  onBack: () => void;
  onOpenPeer?: (handle: string) => void;
  onlyHandles?: readonly string[];
  title?: string;
  subTitle?: string;
}) {
  const { ownBusyMap } = useSocialData();
  const { peers } = usePeerTimetables();

  const scoped = useMemo(() => {
    if (!onlyHandles) return peers;
    const wanted = new Set(onlyHandles);
    return peers.filter((p) => wanted.has(p.handle));
  }, [peers, onlyHandles]);

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
          {title}
        </h1>
      </div>

      <SectionHeader icon={CalendarRange} title={subTitle} />

      {scoped.length === 0 ? (
        <p className="px-1 text-sm text-zinc-500 dark:text-zinc-400">
          Nobody in this group has published a timetable yet.
        </p>
      ) : (
        <CommonFreeSlotsGrid
          ownBusyMap={ownBusyMap}
          peers={scoped}
          onOpenPeer={onOpenPeer}
        />
      )}
    </div>
  );
}
