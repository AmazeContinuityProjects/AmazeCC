"use client";

import { useMemo, useState } from "react";
import { Loader2, RefreshCcw, Search, Users, X } from "lucide-react";
import BackButton from "../shared/BackButton";
import { EMPTY_STATE, ICON_BUTTON, LIST_SHELL, SEARCH_FIELD } from "@/lib/libraries/ui";
import { PeopleRow, SectionHeader } from "./rows";
import { useOverlap, usePeerTimetables } from "@/lib/social/usePeerTimetables";
import { useSocialData } from "@/lib/social/useSocialData";

/**
 * People.
 *
 * Search lives here rather than on the landing, because the landing is a summary
 * and a search box on a summary is a second thing to look at.
 *
 * Every row's meta is real: the common-free count comes from actual slot
 * arithmetic and the publish age from the server's timestamp. A peer who has not
 * published says so — it does not render a row of zeroes.
 */
export default function PeopleSubpage({
  onBack,
  onOpenPeer,
  onAddPeer,
}: {
  onBack: () => void;
  onOpenPeer: (handle: string) => void;
  onAddPeer: () => void;
}) {
  const { ownBusyMap } = useSocialData();
  const { peers, loading, refresh } = usePeerTimetables();
  const overlap = useOverlap(ownBusyMap, peers);
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return peers;
    return peers.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.handle.toLowerCase().includes(q)
    );
  }, [peers, query]);

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-3">
        <BackButton onClick={onBack} className="self-start" />
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={refresh}
            disabled={loading}
            aria-label="Refresh peer timetables"
            title="Refresh peer timetables"
            className={`${ICON_BUTTON} disabled:opacity-50`}
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCcw className="w-4 h-4" />}
          </button>
          <button
            type="button"
            onClick={onAddPeer}
            className="px-3 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs transition-colors cursor-pointer"
          >
            Add peer
          </button>
        </div>
      </div>

      <div className="px-1">
        <p className="text-xs font-semibold text-zinc-400 dark:text-zinc-500 leading-none mb-1">
          Campus
        </p>
        <h1 className="text-xl sm:text-2xl font-black text-zinc-900 dark:text-white tracking-tight leading-tight font-outfit truncate">
          People
        </h1>
      </div>

      {peers.length > 0 && (
        <div className="relative px-1">
          <Search className="w-4 h-4 text-zinc-400 absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search name or handle"
            aria-label="Search people"
            className={`${SEARCH_FIELD} pl-10 pr-9`}
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery("")}
              aria-label="Clear search"
              className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-lg text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 transition-colors cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      )}

      <SectionHeader icon={Users} title="Paired peers" count={peers.length} />

      {peers.length === 0 ? (
        <div className={EMPTY_STATE}>
          <p className="text-xs font-bold text-zinc-500 dark:text-zinc-400">
            No pairings yet
          </p>
          <p className="text-[11px] text-zinc-400 dark:text-zinc-500 font-medium mt-1.5 leading-relaxed">
            Pair with someone using their handle and their timetable will appear here. Pairing is
            mutual, so you will both be able to see each other.
          </p>
          <button
            type="button"
            onClick={onAddPeer}
            className="mt-4 px-4 py-2.5 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs transition-colors cursor-pointer"
          >
            Add your first peer
          </button>
        </div>
      ) : filtered.length === 0 ? (
        <div className={EMPTY_STATE}>
          <p className="text-xs font-bold text-zinc-500 dark:text-zinc-400">
            No one matches &quot;{query}&quot;
          </p>
        </div>
      ) : (
        <div className={LIST_SHELL}>
          {filtered.map((peer) => (
            <PeopleRow
              key={peer.handle}
              peer={peer}
              metrics={overlap.get(peer.handle)}
              onOpen={() => onOpenPeer(peer.handle)}
            />
          ))}
        </div>
      )}

      {peers.length > 0 && loading && (
        <p className="px-1 -mt-3 text-[11px] text-zinc-400 dark:text-zinc-500 font-medium flex items-center gap-1.5">
          <Loader2 className="w-3 h-3 animate-spin" />
          Refreshing peer timetables…
        </p>
      )}

      {peers.length > 0 && (
        <p className="px-1 -mt-3 text-[11px] leading-relaxed text-zinc-400 dark:text-zinc-500 font-medium">
          Publish ages come from the server. A peer past 14 days is badged stale, because a
          dropped class still reads as busy until they sync.
        </p>
      )}
    </div>
  );
}
