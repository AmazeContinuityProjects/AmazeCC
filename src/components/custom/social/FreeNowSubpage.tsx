"use client";

/**
 * Free Right Now.
 *
 * The empty state explains the timezone rather than saying "No friends added
 * yet", because the actual reason the list is empty is almost always that it is
 * 11pm or Sunday — not that the user has nobody.
 */

import { useMemo } from "react";
import { Clock, Sparkles } from "lucide-react";
import { EMPTY_STATE, LIST_SHELL } from "@/lib/libraries/ui";
import { FreeNowRow, SectionHeader } from "./rows";
import { PageShell } from "../shared/primitives";
import { SLOT_MAP } from "@/lib/generated/timetable";
import { slotCoveringNow, parseSlotKey } from "@/lib/social/schedule";
import { useOverlap, usePeerTimetables } from "@/lib/social/usePeerTimetables";
import { useSocialData } from "@/lib/social/useSocialData";

/** "MON · A1 · 8:00-8:50", or null outside teaching hours. */
function currentSlotLabel(now = new Date()): { label: string; key: string } | null {
  const key = slotCoveringNow(now);
  if (!key) return null;
  const parsed = parseSlotKey(key);
  if (!parsed) return null;
  const slot = SLOT_MAP[parsed.day]?.[parsed.slotId];
  return { key, label: slot ? `${parsed.day} · ${parsed.slotId} · ${slot.time}` : `${parsed.day} · ${parsed.slotId}` };
}

export default function FreeNowSubpage({
  onBack,
  onOpenPeer,
}: {
  onBack: () => void;
  onOpenPeer: (handle: string) => void;
}) {
  const { ownBusyMap } = useSocialData();
  const { peers, loading } = usePeerTimetables();
  const overlap = useOverlap(ownBusyMap, peers);
  const now = useMemo(() => currentSlotLabel(), []);

  const freeNow = useMemo(() => peers.filter((p) => p.loaded && overlap.get(p.handle)?.freeNow), [peers, overlap]);

  /** Where a `full` peer is in the current slot, so the row says something. */
  const detailFor = (handle: string) => {
    const peer = peers.find((p) => p.handle === handle);
    if (!peer || !now || peer.visibility !== "full") return { slotLabel: null, venue: null };
    const entry = peer.busyMap?.[now.key];
    return { slotLabel: now.label, venue: entry?.v || null };
  };

  return (
    <PageShell eyebrow="Campus" title="Free Right Now" onBack={onBack}>
      <SectionHeader icon={Clock} title={now ? now.label : "Outside class hours"} count={freeNow.length} />

      {loading ? (
        <div className={EMPTY_STATE} aria-busy="true">
          <span className="w-10 h-10 rounded-2xl mx-auto flex items-center justify-center border border-zinc-200 dark:border-zinc-800">
            <Clock className="w-4.5 h-4.5 text-zinc-400 animate-pulse" />
          </span>
          <p className="text-xs font-bold text-zinc-500 dark:text-zinc-400 mt-3">Checking who is free…</p>
        </div>
      ) : freeNow.length === 0 ? (
        <div className={EMPTY_STATE}>
          <span className="w-10 h-10 rounded-2xl mx-auto flex items-center justify-center border border-zinc-200 dark:border-zinc-800">
            <Clock className="w-4.5 h-4.5 text-zinc-400" />
          </span>
          <p className="text-xs font-bold text-zinc-500 dark:text-zinc-400 mt-3">
            {now ? "Nobody is free in this slot" : "It is outside class hours"}
          </p>
          <p className="text-xs text-zinc-400 dark:text-zinc-500 font-medium mt-1.5 leading-relaxed max-w-[320px] mx-auto">
            {now ? (
              <>
                Every paired peer has class in {now.label}. Times are your device&apos;s local time — the campus day
                runs 08:00 to 19:25.
              </>
            ) : (
              <>
                Nothing is scheduled right now. The campus teaching day is 08:00–19:25, Monday to Friday, in your
                device&apos;s local time.
              </>
            )}
          </p>
        </div>
      ) : (
        <div className={LIST_SHELL}>
          {freeNow.map((peer) => {
            const { slotLabel, venue } = detailFor(peer.handle);
            return (
              <FreeNowRow
                key={peer.handle}
                peer={peer}
                slotLabel={slotLabel}
                venue={venue}
                onOpen={() => onOpenPeer(peer.handle)}
              />
            );
          })}
        </div>
      )}

      {freeNow.length > 0 && (
        <p className="px-1 -mt-3 text-xs leading-relaxed text-zinc-400 dark:text-zinc-500 font-medium flex items-start gap-1.5">
          <Sparkles className="w-3 h-3 mt-px shrink-0" />A legacy free/busy-only pair shows no venue — the server
          withholds it, not this screen.
        </p>
      )}
    </PageShell>
  );
}
