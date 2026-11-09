"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAtom } from "jotai";
import { ChevronRight, GraduationCap, Search, Users } from "lucide-react";
import { attendanceDataAtom, marksDataAtom } from "@/store/dataAtoms";
import { settingsAtom } from "@/store/settingsAtoms";
import {
  EmptyPanel,
  ListShell,
  ListSkeleton,
  PageShell,
  SectionHeader,
  SegmentedControl,
  ToneBadge,
} from "../shared/primitives";
import { LIST_ROW, SEARCH_FIELD } from "@/lib/uiTokens";
import FacultyScheduleModal from "./FFCS/components/modals/FacultyScheduleModal";
import { VitfacReviewPill, FacultyAvatar } from "./FFCS/components/FacultyReviewSheet";
import {
  buildFacultyNameGroups,
  facultyNameMatches,
  findFirstMatchingGroup,
  loadFacultyOfferings,
  type FacultyNameGroup,
} from "./FFCS/logic/facultyGroups";
import type { TimetableState } from "@/lib/ffcsTypes";
import {
  FINAL_FFCS_REPORTS,
  GLOBAL_SEMESTER_CHANGE_EVENT,
  broadcastGlobalSemesterChange,
  finalSemesterToVtopId,
  getSelectedFinalSemesterId,
  mapToFinalSemesterId,
  type FinalFFCSSemesterId,
} from "@/lib/ffcsReports";
import { splitSlots } from "@/lib/slots";

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
export interface CurrentCourseFacultyRef {
  name: string;
  employeeId?: string;
  classId?: string;
  courseCode?: string;
  slot?: string;
}

export function readCurrentCourseRefs(): CurrentCourseFacultyRef[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem("ffcs_timetables");
    if (!raw) return [];
    const timetables = JSON.parse(raw) as TimetableState[];
    const activeId = window.localStorage.getItem("ffcs_activeTimetableId");
    const active = timetables.find((t) => t.id === activeId) ?? timetables[0];
    if (!active?.courses?.length) return [];

    const refs: CurrentCourseFacultyRef[] = [];
    for (const course of active.courses) {
      const name = String(course?.faculty ?? "").trim();
      const employeeId = String(course?.employeeId ?? "").trim() || undefined;
      const classId = String(course?.classId ?? "").trim() || undefined;
      const courseCode = String(course?.code ?? "").trim() || undefined;
      const slot = Array.isArray(course?.slots) ? course.slots.join("+") : undefined;
      if (name || employeeId) {
        refs.push({ name, employeeId, classId, courseCode, slot });
      }
    }
    return refs;
  } catch {
    return [];
  }
}

export function readCurrentCourseFaculties(): string[] {
  const refs = readCurrentCourseRefs();
  const seen = new Set<string>();
  const names: string[] = [];
  for (const ref of refs) {
    if (ref.name && !seen.has(ref.name)) {
      seen.add(ref.name);
      names.push(ref.name);
    }
  }
  return names;
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
export default function FacultyScheduleTab({
  onBack,
  handleReloadRequest,
}: {
  onBack?: () => void;
  /**
   * The shell's reload action. A semester switch goes through it so the new
   * term's data is synced (it forces a full sync) instead of only relabeling
   * the page — optional so bare renders (tests, standalone mounts) keep the
   * legacy local+global relabel.
   */
  handleReloadRequest?: (semesterId?: string, modeId?: string) => Promise<void>;
}) {
  const [settings, setSettings] = useAtom(settingsAtom);
  const globalFinalSemester = useMemo(
    () => mapToFinalSemesterId(settings?.currSemesterID) ?? getSelectedFinalSemesterId(),
    [settings?.currSemesterID],
  );
  const [semesterId, setSemesterId] = useState<FinalFFCSSemesterId>(globalFinalSemester);
  const [groups, setGroups] = useState<FacultyNameGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [ffcsRefs, setFfcsRefs] = useState<CurrentCourseFacultyRef[]>([]);
  /**
   * `true` when this page was opened from the simplified mobile home, whose
   * "Find Faculty Schedule" button asks for the faculties on the reader's
   * *enrolled* courses. The planner's drafts are then left out of the hoisted
   * section: a plan is not an enrolment, and on the home screen the two read
   * as the same claim ("my professor") — which is the pollution this guards
   * against. Written by the home's launch handler as
   * `faculty_schedule_source = "home"`, read once here, and cleared on
   * unmount so a later launch (header nav, app library, command palette)
   * starts from the default again.
   */
  const [openedFromHome, setOpenedFromHome] = useState(false);
  const launchSourceRead = useRef(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [selectedErp, setSelectedErp] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  // Sync when global semester changes in settingsAtom
  useEffect(() => {
    if (globalFinalSemester && globalFinalSemester !== semesterId) {
      setSemesterId(globalFinalSemester);
    }
  }, [globalFinalSemester, semesterId]);

  // Sync on window event or storage event
  useEffect(() => {
    const handleGlobalChange = (e: Event) => {
      const customEvent = e as CustomEvent<{ semesterId?: FinalFFCSSemesterId }>;
      const nextSem = customEvent.detail?.semesterId || getSelectedFinalSemesterId();
      if (nextSem && nextSem !== semesterId) {
        setSemesterId(nextSem);
      }
    };

    window.addEventListener(GLOBAL_SEMESTER_CHANGE_EVENT, handleGlobalChange);
    window.addEventListener("storage", handleGlobalChange);
    return () => {
      window.removeEventListener(GLOBAL_SEMESTER_CHANGE_EVENT, handleGlobalChange);
      window.removeEventListener("storage", handleGlobalChange);
    };
  }, [semesterId]);

  const handleSemesterSwitch = useCallback(
    (next: FinalFFCSSemesterId) => {
      if (next === semesterId) return;
      setSemesterId(next);
      if (handleReloadRequest) {
        // The reload owns the global semester write, the broadcast, and the
        // full sync the new term's caches need — this page only tracks it.
        void handleReloadRequest(finalSemesterToVtopId(next));
      } else {
        broadcastGlobalSemesterChange(next);
        setSettings((prev) => ({ ...prev, currSemesterID: finalSemesterToVtopId(next) }));
      }
    },
    [semesterId, handleReloadRequest, setSettings],
  );

  // The current timetable (attendance) and the current semester's enrolled
  // courses (marks) are global jotai atoms, so this page reads them directly
  // rather than threading two more props down through Dashboard — the atoms are
  // the same ones Main already populates on sync.
  const [attendanceData] = useAtom(attendanceDataAtom);
  const [marksData] = useAtom(marksDataAtom);

  // The report is the planner's cache to share: read it first, fetch the CSV
  // only when the reader has never been there. A failed load leaves `groups`
  // empty and the empty state explains why.
  //
  // The launch source is read once per mount (the flag is a launch signal, not
  // state — re-reading it after a semester switch or React's StrictMode re-run
  // would race with the unmount clear), and `openedFromHome` joins the deps of
  // the load below so the refs are rebuilt the moment it is known to be `true`.
  useEffect(() => {
    if (launchSourceRead.current) return;
    launchSourceRead.current = true;
    try {
      if (window.localStorage.getItem("faculty_schedule_source") === "home") {
        setOpenedFromHome(true);
      }
    } catch {}
  }, []);

  useEffect(
    () => () => {
      try {
        window.localStorage.removeItem("faculty_schedule_source");
      } catch {}
    },
    [],
  );

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setFfcsRefs(openedFromHome ? [] : readCurrentCourseRefs());
    (async () => {
      try {
        const offerings = await loadFacultyOfferings(semesterId);
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
  }, [semesterId, openedFromHome]);

  // Handle external navigation target (e.g. from SimplifiedMobileHome)
  useEffect(() => {
    if (typeof window === "undefined" || groups.length === 0) return;
    try {
      const targetErp = window.localStorage.getItem("faculty_schedule_target_erp");
      const targetName = window.localStorage.getItem("faculty_schedule_target_name");
      if (targetErp) {
        window.localStorage.removeItem("faculty_schedule_target_erp");
        const match = findFirstMatchingGroup(groups, targetName || "", targetErp);
        if (match) {
          setSelected(match.canonical);
          setSelectedErp(match.erpId || targetErp);
        }
      } else if (targetName) {
        window.localStorage.removeItem("faculty_schedule_target_name");
        const match = findFirstMatchingGroup(groups, targetName);
        if (match) {
          setSelected(match.canonical);
          setSelectedErp(match.erpId || null);
        }
      }
    } catch {}
  }, [groups]);

  /**
   * Union all course references across the app's three sources:
   *  1. the FFCS planner's registration — what they are *planning* to take;
   *  2. the current timetable — VTOP attendance rows;
   *  3. the current semester — VTOP marks rows.
   */
  const currentCourseRefs = useMemo<CurrentCourseFacultyRef[]>(() => {
    const refs: CurrentCourseFacultyRef[] = [...ffcsRefs];

    const marksCourses = (marksData as { courses?: unknown[] } | null)?.courses;
    if (Array.isArray(marksCourses)) {
      for (const raw of marksCourses) {
        const course = raw as { faculty?: unknown; courseCode?: unknown; classId?: unknown };
        const name = String(course?.faculty ?? "").trim();
        const classId = String(course?.classId ?? "").trim() || undefined;
        const courseCode = String(course?.courseCode ?? "").trim() || undefined;
        if (name || classId) {
          refs.push({ name, classId, courseCode });
        }
      }
    }

    const attendanceItems = (attendanceData as { attendance?: unknown[] } | null)?.attendance;
    if (Array.isArray(attendanceItems)) {
      for (const raw of attendanceItems) {
        const item = raw as { faculty?: unknown; courseCode?: unknown; slotName?: unknown; classId?: unknown };
        const name = String(item?.faculty ?? "").trim();
        const classId = String(item?.classId ?? "").trim() || undefined;
        const courseCode = String(item?.courseCode ?? "").trim() || undefined;
        const slot = String(item?.slotName ?? "").trim() || undefined;
        if (name || classId) {
          refs.push({ name, classId, courseCode, slot });
        }
      }
    }

    return refs;
  }, [ffcsRefs, marksData, attendanceData]);

  /**
   * Resolves which groups belong to the reader's own courses, leveraging ERP IDs
   * and class IDs to accurately match each faculty member's full schedule.
   */
  const currentKeys = useMemo(() => {
    const keys = new Set<string>();

    for (const ref of currentCourseRefs) {
      // 1. Direct ERP ID match
      if (ref.employeeId) {
        const match = findFirstMatchingGroup(groups, ref.name, ref.employeeId);
        if (match) {
          keys.add(match.key);
          continue;
        }
      }

      // 2. Class ID match against report offerings
      if (ref.classId) {
        const match = groups.find((g) =>
          g.offerings.some((o) => o.CLASS_ID && o.CLASS_ID.toUpperCase() === ref.classId!.toUpperCase()),
        );
        if (match) {
          keys.add(match.key);
          continue;
        }
      }

      // 3. Course Code + Slot match
      if (ref.courseCode && (ref.slot || ref.name)) {
        const match = groups.find((g) =>
          g.offerings.some((o) => {
            const cleanRefCode = ref.courseCode!.toUpperCase().replace(/\([LPT]\)$/i, "");
            const cleanOCode = o.CODE.toUpperCase().replace(/\([LPT]\)$/i, "");
            if (
              cleanRefCode !== cleanOCode &&
              !cleanRefCode.startsWith(cleanOCode) &&
              !cleanOCode.startsWith(cleanRefCode)
            ) {
              return false;
            }
            if (ref.slot && o.SLOT) {
              const oSlots = splitSlots(o.SLOT);
              const refSlots = splitSlots(ref.slot);
              const overlaps = refSlots.some((s) => oSlots.includes(s));
              if (overlaps) {
                return !ref.name || facultyNameMatches(o.FACULTY, ref.name);
              }
            }
            return ref.name ? facultyNameMatches(o.FACULTY, ref.name) : false;
          }),
        );
        if (match) {
          keys.add(match.key);
          continue;
        }
      }

      // 4. Name match fallback
      if (ref.name) {
        const match = findFirstMatchingGroup(groups, ref.name);
        if (match) {
          keys.add(match.key);
        }
      }
    }

    return keys;
  }, [groups, currentCourseRefs]);

  const query = search.trim().toLowerCase();

  /** Name spellings and course code/title — a reader may search either. */
  const matchesQuery = useCallback(
    (group: FacultyNameGroup) => {
      if (!query) return true;
      if (group.canonical.toLowerCase().includes(query)) return true;
      if (group.names.some((name) => name.toLowerCase().includes(query))) return true;
      return group.offerings.some(
        (offering) => offering.CODE.toLowerCase().includes(query) || offering.TITLE.toLowerCase().includes(query),
      );
    },
    [query],
  );

  const currentGroups = useMemo(
    () => groups.filter((g) => currentKeys.has(g.key) && matchesQuery(g)),
    [groups, currentKeys, matchesQuery],
  );
  const otherGroups = useMemo(
    () => groups.filter((g) => !currentKeys.has(g.key) && matchesQuery(g)),
    [groups, currentKeys, matchesQuery],
  );

  const searching = query.length > 0;
  const resultCount = currentGroups.length + otherGroups.length;

  /** The grade-history row: avatar (vitfac image), name + courses, review pill, chevron. */
  const renderRow = (group: FacultyNameGroup) => {
    const empId = group.erpId || group.offerings.find((o) => o.ERP_ID)?.ERP_ID;
    return (
      <div
        key={group.key}
        role="button"
        tabIndex={0}
        onClick={() => {
          setSelected(group.canonical);
          setSelectedErp(empId || null);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            setSelected(group.canonical);
            setSelectedErp(empId || null);
          }
        }}
        className={`${LIST_ROW} cursor-pointer`}
      >
        <FacultyAvatar
          employeeId={empId}
          name={group.canonical}
          size="sm"
          tone={currentKeys.has(group.key) ? "indigo" : "blue"}
        />
        <span className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-bold text-text-heading truncate">{group.canonical}</span>
            {empId && (
              <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 shrink-0">
                #{empId}
              </span>
            )}
            <VitfacReviewPill
              employeeId={empId}
              name={group.canonical}
              onClick={(e) => {
                e.stopPropagation();
              }}
            />
          </div>
          <span className="block text-xs text-muted-foreground truncate">
            {courseSummary(group)}
            {group.names.length > 1 ? ` · ${group.names.length} spelling${group.names.length === 1 ? "" : "s"}` : ""}
          </span>
        </span>
        <ChevronRight className="h-4 w-4 text-zinc-400 shrink-0" />
      </div>
    );
  };

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
               a synced timetable/semester, or an FFCS draft (the latter only
               when the planner's picks are being counted at all). */
            <div className="rounded-2xl border border-dashed border-border-muted p-4 text-[11px] leading-relaxed font-medium text-text-secondary dark:text-text-muted">
              Once your timetable and marks are synced
              {openedFromHome ? "" : " — or you add courses in the FFCS planner"} — the faculties teaching{" "}
              <span className="font-bold text-text-heading">your</span> courses will be listed here first.
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
        actions={
          <SegmentedControl
            options={FINAL_FFCS_REPORTS.map((r) => ({ value: r.id, label: r.label }))}
            value={semesterId}
            onChange={(val) => {
              handleSemesterSwitch(val as FinalFFCSSemesterId);
            }}
          />
        }
        selectable
      >
        {content}
      </PageShell>

      <FacultyScheduleModal
        open={selected !== null}
        onClose={() => {
          setSelected(null);
          setSelectedErp(null);
        }}
        groups={groups}
        loading={loading}
        initialFaculty={selected ?? undefined}
        initialErpId={selectedErp ?? undefined}
      />
    </>
  );
}
