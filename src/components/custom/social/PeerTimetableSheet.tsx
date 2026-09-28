"use client";

/**
 * One peer's timetable.
 *
 * Replaces `FriendTimetableModal`. The important behaviour is what happens on a
 * `coarse` grant: the server sends slot occupancy with every entry emptied and no
 * course list, so there is genuinely nothing to show beyond free/busy. This
 * sheet says so, rather than rendering an empty grid the user reads as a bug.
 */

import { useMemo } from "react";
import { EyeOff, MapPin, Clock } from "lucide-react";
import BottomSheet from "../shared/BottomSheet";
import { CHIP, TONE_TEXT } from "@/lib/libraries/ui";
import { DAYS, computeOverlap, parseSlotKey, slotMap, type Day } from "@/lib/social/schedule";
import { relativePublished, type PeerTimetable } from "@/lib/social/usePeerTimetables";
import type { BusyMap } from "@/lib/social/types";
import { initials } from "./rows";

function busyDays(busyMap: BusyMap): { day: Day; count: number }[] {
  return DAYS.map((day) => ({
    day,
    count: Object.keys(busyMap ?? {}).filter((k) => k.startsWith(`${day}:`)).length,
  })).filter((d) => d.count > 0);
}

export default function PeerTimetableSheet({
  peer,
  ownBusyMap,
  onClose,
}: {
  peer: PeerTimetable;
  ownBusyMap: BusyMap;
  onClose: () => void;
}) {
  const metrics = useMemo(
    () => (peer.loaded ? computeOverlap(ownBusyMap, peer.busyMap) : null),
    [peer.loaded, peer.busyMap, ownBusyMap]
  );
  const byDay = useMemo(() => busyDays(peer.busyMap), [peer.busyMap]);

  const clashSlots = useMemo(
    () =>
      Object.keys(peer.busyMap ?? {}).filter(
        (k) => ownBusyMap?.[k] !== undefined
      ),
    [peer.busyMap, ownBusyMap]
  );

  return (
    <BottomSheet onClose={onClose} overlayId="social-peer-sheet" maxWidth="max-w-md">
      <div className="text-left space-y-5">
        <div className="flex items-center gap-3">
          <span className="w-10 h-10 rounded-2xl flex items-center justify-center text-[11px] font-black font-outfit border border-indigo-500/20 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 shrink-0">
            {initials(peer.name)}
          </span>
          <div className="min-w-0 flex-1">
            <h3 className="text-sm font-black text-zinc-900 dark:text-white font-outfit leading-tight truncate">
              {peer.name}
            </h3>
            <p className="text-[11px] text-zinc-500 dark:text-zinc-400 font-medium truncate">
              {peer.handle} · published {relativePublished(peer.publishedAt)}
            </p>
          </div>
          {peer.stale && <span className={`${CHIP} shrink-0 border-amber-500/20 text-amber-600 dark:text-amber-400`}>Stale</span>}
        </div>

        {peer.noGrant ? (
          <div className="p-5 rounded-2xl border border-dashed border-zinc-300 dark:border-zinc-800 text-center">
            <p className="text-xs font-bold text-zinc-500 dark:text-zinc-400">
              You are not paired with this student, so their timetable is not available.
            </p>
          </div>
        ) : peer.error ? (
          <div className="p-3 rounded-2xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/40">
            <p className="text-xs font-bold text-red-600 dark:text-red-400">
              Could not read this pairing. It may have been revoked, or the session may have
              expired — try a sync.
            </p>
          </div>
        ) : !peer.loaded ? (
          <p className="text-xs font-bold text-zinc-500 dark:text-zinc-400">Loading…</p>
        ) : (
          <>
            {metrics && (
              <div className="grid grid-cols-3 gap-2">
                {[
                  { label: "match", value: `${metrics.matchPct}%`, tone: metrics.matchPct >= 70 ? "emerald" : metrics.matchPct >= 40 ? "amber" : "red" },
                  { label: "clash", value: `${metrics.sharedClassHours}h`, tone: metrics.sharedClassHours === 0 ? "emerald" : "amber" },
                  { label: "free now", value: metrics.freeNow ? "Yes" : "No", tone: metrics.freeNow ? "emerald" : "zinc" },
                ].map((s) => (
                  <div key={s.label} className="p-3 rounded-2xl border border-zinc-200/70 dark:border-zinc-800 text-center">
                    <p className={`text-lg font-black font-outfit leading-none ${TONE_TEXT[s.tone] ?? TONE_TEXT.zinc}`}>
                      {s.value}
                    </p>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-500 mt-1">
                      {s.label}
                    </p>
                  </div>
                ))}
              </div>
            )}

            {peer.visibility === "coarse" ? (
              <div className="p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-950/60 border border-zinc-200/70 dark:border-zinc-800 space-y-2">
                <p className="flex items-center gap-1.5 text-[11px] font-black text-zinc-700 dark:text-zinc-300 uppercase tracking-wider">
                  <EyeOff className="w-3.5 h-3.5 text-zinc-400" />
                  Coarse sharing
                </p>
                <p className="text-[11px] text-zinc-500 dark:text-zinc-400 font-medium leading-relaxed">
                  This pair shares free/busy only. Course codes, titles and venues are withheld by
                  the server, so there is nothing more to show here. Either of you can switch the
                  pair to full detail from Pairs.
                </p>
              </div>
            ) : peer.courses.length > 0 ? (
              <div className="space-y-2">
                <p className="flex items-center gap-1.5 text-[11px] font-black text-zinc-700 dark:text-zinc-300 uppercase tracking-wider">
                  <Clock className="w-3.5 h-3.5 text-indigo-500" />
                  Courses
                </p>
                {peer.courses.map((c, i) => (
                  <div
                    key={`${c.classId || c.code}-${i}`}
                    className="p-3 rounded-2xl border border-zinc-200/70 dark:border-zinc-800"
                  >
                    <p className="text-xs font-black text-zinc-800 dark:text-zinc-200 font-outfit truncate">
                      {c.code} · {c.title}
                    </p>
                    <p className="text-[11px] text-zinc-500 dark:text-zinc-400 font-medium mt-0.5 flex items-center gap-1 truncate">
                      {c.venue && <MapPin className="w-3 h-3 shrink-0" />}
                      {c.venue || "—"}
                      {c.componentType ? ` · ${c.componentType}` : ""}
                    </p>
                  </div>
                ))}
              </div>
            ) : null}

            <div className="space-y-2">
              <p className="text-[11px] font-black text-zinc-700 dark:text-zinc-300 uppercase tracking-wider">
                Their week
              </p>
              <div className="flex flex-wrap gap-1.5">
                {byDay.length === 0 ? (
                  <p className="text-[11px] text-zinc-500 dark:text-zinc-400 font-medium">
                    Nothing published for this term.
                  </p>
                ) : (
                  byDay.map((d) => (
                    <span key={d.day} className={`${CHIP} border-zinc-200/60`}>
                      {d.day} {d.count}
                    </span>
                  ))
                )}
              </div>
            </div>

            {clashSlots.length > 0 && (
              <div className="space-y-2">
                <p className="text-[11px] font-black text-zinc-700 dark:text-zinc-300 uppercase tracking-wider">
                  You both have class in
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {clashSlots.slice(0, 12).map((k) => {
                    const parsed = parseSlotKey(k);
                    const slot = parsed ? slotMap[parsed.day]?.[parsed.slotId] : null;
                    return (
                      <span key={k} className={`${CHIP} border-amber-500/30 text-amber-700 dark:text-amber-300`}>
                        {parsed?.day} {parsed?.slotId}
                        {slot ? ` · ${slot.time}` : ""}
                      </span>
                    );
                  })}
                  {clashSlots.length > 12 && (
                    <span className={`${CHIP} border-zinc-200/60`}>+{clashSlots.length - 12} more</span>
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </BottomSheet>
  );
}
