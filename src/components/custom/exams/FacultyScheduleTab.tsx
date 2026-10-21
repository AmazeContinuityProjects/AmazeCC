"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useAtom } from "jotai";
import { ChevronRight, GraduationCap, Search, Users } from "lucide-react";
import { attendanceDataAtom, marksDataAtom } from "@/store/dataAtoms";
import {
  EmptyPanel,
  ListRowText,
  ListShell,
  ListSkeleton,
  PageShell,
  SectionHeader,
  ToneBadge,
} from "../shared/primitives";
import { LIST_ROW, SEARCH_FIELD, TONE_ICON_TILE } from "@/lib/uiTokens";
import FacultyScheduleModal from "./FFCS/components/modals/FacultyScheduleModal";
import {
  buildFacultyNameGroups,
  findFirstMatchingGroup,
  loadFacultyOfferings,
  type FacultyNameGroup,
} from "./FFCS/logic/facultyGroups";
import type { TimetableState } from "./FFCS/types";

/**
 * The faculties on the courses in the reader's active FFCS timetable.
 *
 * One of three sources that decide who counts as "your" professor — the current
 * timetable (VTOP attendance) and the current semester (VTOP marks) are the
 * other two and are read from jotai inside the component. This one is the
 * *planned* set: what the reader is building in the FFCS planner, which need
 * not be enrolled yet.
 *
 * Reads both `ffcs_timetables` and `ffcs_activeTimetableId` — the hook that owns
 * them (`useTimetables`) is the planner's, so this page reads the same storage
 * keys directly rather than dragging that hook in. Returns nothing rather than
 * throwing when the storage is absent or corrupt; a reader who has never opened
 * the planner simply contributes no names here.
 */
export function readCurrentCourseFaculties(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem("ffcs_timetables");
    if (!raw) return [];
    const timetables = JSON.parse(raw) as TimetableState[];
    const activeId = window.localStorage.getItem("ffcs_activeTimetableId");
    const active = timetables.find((t) => t.id === activeId) ?? timetables[0];
    if (!active?.courses?.length) return [];

    const seen = new Set<string>();
    const names: string[] = [];
    for (const course of active.courses) {
      const faculty = String(course?.faculty ?? "").trim();
      if (faculty && !seen.has(faculty)) {
        seen.add(faculty);
        names.push(faculty);
      }
    }
    return names;
  } catch {
    return [];
  }
}

/** The courses a faculty teaches, as a one-line subtitle: `BCSE101 · CSSE202 · +1`. */
function courseSummary(group: FacultyNameGroup): string {
  const codes: string[] = [];
  for (const offering of group.offerings) {
    const code = String(offering.CODE ?? "").trim();
    if (code && !codes.includes(code)) codes.push(code);
  }
  if (codes.length === 0) return "No courses on the report";
  const shown = codes.slice(0, 3).join(" · ");
  const rest = codes.length - 3;
  return rest > 0 ? `${shown} · +${rest}` : shown;
}

/**
 * Find a faculty schedule.
 *
 * The page the home screen's "Find Faculty Schedule" button opens. The list is
 * the grade-history grammar — a `SectionHeader` over a `ListShell` of tappable
 * rows — with one deliberate difference: the faculties on the reader's own
 * courses are hoisted into a section above everyone else, because "which of my
 * professors is free when" is the question this page is actually asked. The
 * search bar sits above both and reaches every faculty on the report, so the
 * hoisting costs nothing for a name the reader is only now remembering.
 */
export default function FacultyScheduleTab({ onBack }: { onBack?: () => void }) {
  const [groups, setGroups] = useState<FacultyNameGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [ffcsNames, setFfcsNames] = useState<string[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  // The current timetable (attendance) and the current semester's enrolled
  // courses (marks) are global jotai atoms, so this page reads them directly
  // rather than threading two more props down through Dashboard — the atoms are
  // the same ones Main already populates on sync.
  const [attendanceData] = useAtom(attendanceDataAtom);
  const [marksData] = useAtom(marksDataAtom);

  // The report is the planner's cache to share: read it first, fetch the CSV
  // only when the reader has never been there. A failed load leaves `groups`
  // empty and the empty state explains why.
  useEffect(() => {
    let cancelled = false;
    setFfcsNames(readCurrentCourseFaculties());
    (async () => {
      try {
        const offerings = await loadFacultyOfferings();
        if (!cancelled) setGroups(buildFacultyNameGroups(offerings));
      } catch {
        // No report available — the empty state below is the message.
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  /**
   * Every name that ties a course the reader is actually sitting in to a
   * faculty member, unioned across the app's three sources of that fact:
   *
   *  1. the FFCS planner's registration — what they are *planning* to take;
   *  2. the current timetable — VTOP attendance rows, which carry `faculty`;
   *  3. the current semester — VTOP marks rows, which carry `faculty` too.
   *
   * They overlap almost completely in a normal week, so this dedupes raw
   * strings; the section itself then dedupes again by group key, so a professor
   * spelled two different ways across marks and attendance still hoists as one
   * row. The FFCS read is mount-time (storage is not reactive); the other two
   * are atoms and re-run whenever a sync repopulates them.
   */
  const currentNames = useMemo(() => {
    const names: string[] = [...ffcsNames];
    const push = (raw: unknown) => {
      const value = String(raw ?? "").trim();
      if (value) names.push(value);
    };

    const marksCourses = (marksData as { courses?: unknown[] } | null)?.courses;
    if (Array.isArray(marksCourses)) {
      for (const course of marksCourses) push((course as { faculty?: unknown })?.faculty);
    }

    const attendanceItems = (attendanceData as { attendance?: unknown[] } | null)?.attendance;
    if (Array.isArray(attendanceItems)) {
      for (const item of attendanceItems) push((item as { faculty?: unknown })?.faculty);
    }

    return Array.from(new Set(names));
  }, [ffcsNames, marksData, attendanceData]);

  /**
   * Which groups are on the reader's own courses.
   *
   * A name from any source is resolved to a group the same way the rest of the
   * app resolves one (`findFirstMatchingGroup`), so "PARTHIBAN V" as typed by
   * the planner lands on the report's first spelling of that person. Keys, not
   * names, are what the section membership compares — two spellings of one
   * professor across marks, attendance and the FFCS draft must hoist a single
   * row, not three.
   */
  const currentKeys = useMemo(() => {
    const keys = new Set<string>();
    for (const name of currentNames) {
      const group = findFirstMatchingGroup(groups, name);
      if (group) keys.add(group.key);
    }
    return keys;
  }, [groups, currentNames]);

  const query = search.trim().toLowerCase();

  /** Name spellings and course code/title — a reader may search either. */
  const matchesQuery = useCallback(
    (group: FacultyNameGroup) => {
      if (!query) return true;
      if (group.canonical.toLowerCase().includes(query)) return true;
      if (group.names.some((name) => name.toLowerCase().includes(query))) return true;
      return group.offerings.some(
        (offering) =>
          offering.CODE.toLowerCase().includes(query) ||
          offering.TITLE.toLowerCase().includes(query)
      );
    },
    [query]
  );

  const currentGroups = useMemo(
    () => groups.filter((g) => currentKeys.has(g.key) && matchesQuery(g)),
    [groups, currentKeys, matchesQuery]
  );
  const otherGroups = useMemo(
    () => groups.filter((g) => !currentKeys.has(g.key) && matchesQuery(g)),
    [groups, currentKeys, matchesQuery]
  );

  const searching = query.length > 0;
  const resultCount = currentGroups.length + otherGroups.length;

  /** The grade-history row: icon, name + courses, chevron. */
  const renderRow = (group: FacultyNameGroup) => (
    <button
      key={group.key}
      type="button"
      onClick={() => setSelected(group.canonical)}
      className={`${LIST_ROW} cursor-pointer`}
    >
      <span
        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border ${
          currentKeys.has(group.key) ? TONE_ICON_TILE.indigo : TONE_ICON_TILE.sky
        }`}
      >
        <GraduationCap className="h-4.5 w-4.5" />
      </span>
      <ListRowText
        title={group.canonical}
        subtitle={courseSummary(group)}
        titleTooltip={group.canonical}
      />
      <ChevronRight className="h-4 w-4 text-zinc-400 shrink-0" />
    </button>
  );

  const content = loading ? (
    <ListSkeleton rows={6} leading="dot" trailing />
  ) : groups.length === 0 ? (
    <EmptyPanel
      icon={<GraduationCap className="h-7 w-7" />}
      tone="indigo"
      title="No faculty report yet"
      description="The FFCS course report could not be loaded. Open the FFCS planner once to cache it, then come back."
    />
  ) : (
    <div className="space-y-6">
      {/* Reaches every faculty, not just the hoisted section — that is the point
          of putting it above the list rather than beside one section's header. */}
      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search all faculty by name or course…"
          aria-label="Search all faculty"
          className={`${SEARCH_FIELD} pl-11`}
        />
      </div>

      {searching ? (
        <div className="space-y-3">
          <SectionHeader icon={Search} title="Results" count={resultCount} />
          {resultCount === 0 ? (
            <EmptyPanel
              icon={<Search className="h-7 w-7" />}
              title="No faculty found"
              description={`Nothing matches “${search.trim()}”. Try a full name (PARTHIBAN V) or a course code (BCSE101).`}
              action={
                <button
                  type="button"
                  onClick={() => setSearch("")}
                  className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-black text-white transition-colors hover:bg-indigo-700"
                >
                  Clear search
                </button>
              }
            />
          ) : (
            <ListShell>{[...currentGroups, ...otherGroups].map(renderRow)}</ListShell>
          )}
        </div>
      ) : (
        <>
          {currentGroups.length > 0 ? (
            <div className="space-y-3">
              <SectionHeader
                icon={GraduationCap}
                title="Your course faculties"
                count={currentGroups.length}
                right={<ToneBadge tone="indigo">Yours first</ToneBadge>}
              />
              <ListShell>{currentGroups.map(renderRow)}</ListShell>
            </div>
          ) : (
            /* Nothing hoisted yet — say so instead of leaving the reader
               wondering where their own professors went. Name the two ways in:
               a synced timetable/semester, or an FFCS draft. */
            <div className="rounded-2xl border border-dashed border-border-muted p-4 text-[11px] leading-relaxed font-medium text-text-secondary dark:text-text-muted">
              Once your timetable and marks are synced — or you add courses in the
              FFCS planner — the faculties teaching{" "}
              <span className="font-bold text-text-heading">your</span> courses will be
              listed here first.
            </div>
          )}

          <div className="space-y-3">
            <SectionHeader
              icon={Users}
              title={currentGroups.length > 0 ? "All other faculty" : "All faculty"}
              count={otherGroups.length}
            />
            {otherGroups.length === 0 ? (
              <EmptyPanel
                variant="dashed"
                title="Nothing else to show"
                description="Every faculty on the report teaches one of your courses."
              />
            ) : (
              <ListShell>{otherGroups.map(renderRow)}</ListShell>
            )}
          </div>
        </>
      )}
    </div>
  );

  return (
    <>
      <PageShell
        onBack={onBack}
        eyebrow="Faculty Schedule"
        title="Find a faculty's classes"
        subtitle="Your professors first, then every faculty on the FFCS report."
        selectable
      >
        {content}
      </PageShell>

      <FacultyScheduleModal
        open={selected !== null}
        onClose={() => setSelected(null)}
        groups={groups}
        loading={loading}
        initialFaculty={selected ?? undefined}
      />
    </>
  );
}
