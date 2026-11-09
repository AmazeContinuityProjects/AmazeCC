"use client";

/**
 * Classes Together.
 *
 * Your courses, each with the paired people in your exact class and those
 * taking the same course in another section. Matching lives in
 * `lib/social/sharedClasses.ts`; this file only lays it out.
 */

import { useMemo } from "react";
import { BookOpen, MapPin, UserRound } from "lucide-react";
import BackButton from "../shared/BackButton";
import { CHIP, EMPTY_STATE, LIST_SHELL } from "@/lib/libraries/ui";
import { SectionHeader, initials } from "./rows";
import { usePeerTimetables } from "@/lib/social/usePeerTimetables";
import { useSocialData } from "@/lib/social/useSocialData";
import { sharedClassesByCourse, type PeerClassMatch } from "@/lib/social/sharedClasses";

function PeerChip({
  match,
  onOpen,
  showFaculty,
}: {
  match: PeerClassMatch;
  onOpen: () => void;
  showFaculty?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="inline-flex items-center gap-1.5 max-w-full pl-1 pr-2.5 py-1 rounded-full border border-zinc-200/80 dark:border-zinc-800 hover:border-indigo-300 dark:hover:border-indigo-700 bg-white dark:bg-zinc-900 transition-colors cursor-pointer"
      title={showFaculty && match.theirs.faculty ? `${match.name} · ${match.theirs.faculty}` : match.name}
    >
      <span className="w-6 h-6 rounded-full bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 text-[9px] font-black font-outfit flex items-center justify-center shrink-0">
        {initials(match.name)}
      </span>
      <span className="text-[11px] font-bold text-zinc-700 dark:text-zinc-200 truncate">{match.name}</span>
      {showFaculty && match.theirs.faculty && (
        <span className="text-[10px] font-medium text-zinc-400 dark:text-zinc-500 truncate">
          · {match.theirs.faculty}
        </span>
      )}
    </button>
  );
}

export default function ClassesTogetherSubpage({
  onBack,
  onOpenPeer,
}: {
  onBack: () => void;
  onOpenPeer: (handle: string) => void;
}) {
  const { ownCourses } = useSocialData();
  const { peers, loading } = usePeerTimetables();

  const rows = useMemo(() => sharedClassesByCourse(ownCourses, peers), [ownCourses, peers]);
  const coarseCount = useMemo(
    () => peers.filter((p) => p.loaded && !p.noGrant && p.visibility === "coarse").length,
    [peers],
  );

  const empty = (title: string, body: string) => (
    <div className={EMPTY_STATE}>
      <span className="w-10 h-10 rounded-2xl mx-auto flex items-center justify-center border border-zinc-200 dark:border-zinc-800">
        <BookOpen className="w-4.5 h-4.5 text-zinc-400" />
      </span>
      <p className="text-xs font-bold text-zinc-500 dark:text-zinc-400 mt-3">{title}</p>
      <p className="text-[11px] text-zinc-400 dark:text-zinc-500 font-medium mt-1.5 leading-relaxed max-w-[320px] mx-auto">
        {body}
      </p>
    </div>
  );

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-3">
        <BackButton onClick={onBack} className="self-start" />
      </div>

      <div className="px-1">
        <p className="text-xs font-semibold text-zinc-400 dark:text-zinc-500 leading-none mb-1">This term</p>
        <h1 className="text-xl sm:text-2xl font-black text-zinc-900 dark:text-white tracking-tight leading-tight font-outfit truncate">
          Classes Together
        </h1>
      </div>

      <SectionHeader icon={BookOpen} title="Shared courses" count={rows.length} />

      {ownCourses.length === 0 ? (
        empty(
          "Your courses are not published yet",
          "Run a sync so your timetable is derived from VTOP, then come back.",
        )
      ) : loading && rows.length === 0 ? (
        <div className={EMPTY_STATE} aria-busy="true">
          <span className="w-10 h-10 rounded-2xl mx-auto flex items-center justify-center border border-zinc-200 dark:border-zinc-800">
            <BookOpen className="w-4.5 h-4.5 text-zinc-400 animate-pulse" />
          </span>
          <p className="text-xs font-bold text-zinc-500 dark:text-zinc-400 mt-3">Comparing timetables…</p>
        </div>
      ) : peers.length === 0 ? (
        empty("Nobody to compare with yet", "Pair with classmates and the courses you share show up here.")
      ) : rows.length === 0 ? (
        empty("No shared courses", "None of the people you are paired with take any of your courses this term.")
      ) : (
        <div className={LIST_SHELL}>
          {rows.map((row) => (
            <div key={row.course.classId || `${row.course.code}-${row.course.componentType}`} className="p-4 space-y-3">
              <div className="min-w-0">
                <p className="text-xs font-black text-zinc-800 dark:text-zinc-200 font-outfit truncate">
                  {row.course.code} · {row.course.title}
                </p>
                <p className="text-[11px] text-zinc-500 dark:text-zinc-400 font-medium mt-0.5 flex items-center gap-1 truncate">
                  {row.course.venue && <MapPin className="w-3 h-3 shrink-0" />}
                  {[row.course.venue, row.course.componentType, row.course.faculty].filter(Boolean).join(" · ") || "—"}
                </p>
              </div>

              {row.sameClass.length > 0 && (
                <div className="space-y-1.5">
                  <p className="text-[10px] font-black uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                    In your class · {row.sameClass.length}
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {row.sameClass.map((m) => (
                      <PeerChip key={m.handle} match={m} onOpen={() => onOpenPeer(m.handle)} />
                    ))}
                  </div>
                </div>
              )}

              {row.otherSection.length > 0 && (
                <div className="space-y-1.5">
                  <p className="text-[10px] font-black uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
                    Other sections · {row.otherSection.length}
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {row.otherSection.map((m) => (
                      <PeerChip key={m.handle} match={m} showFaculty onOpen={() => onOpenPeer(m.handle)} />
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {coarseCount > 0 && (
        <p className="px-1 -mt-3 text-[11px] leading-relaxed text-zinc-400 dark:text-zinc-500 font-medium flex items-start gap-1.5">
          <UserRound className="w-3 h-3 mt-px shrink-0" />
          {coarseCount === 1 ? "1 pair shares" : `${coarseCount} pairs share`} free/busy only, so their courses cannot
          be compared.
        </p>
      )}
      {rows.length > 0 && (
        <p className="px-1 -mt-3 text-[11px] leading-relaxed text-zinc-400 dark:text-zinc-500 font-medium">
          <span className={`${CHIP} mr-1`}>In your class</span>means the same VTOP class: same section, faculty and
          slots.
        </p>
      )}
    </div>
  );
}
