"use client";

import React, { useState, useEffect, useMemo } from "react";
import { Search, MapPin, Loader2, Clock, CalendarDays, DoorOpen, Copy, Check } from "lucide-react";
import { cn } from "@amazecontinuityprojects/amazeui";

import SelectField from "../shared/primitives/SelectField";
import type { ParsedCourse } from "@/lib/ffcsTypes";
import {
  buildDayIndex,
  buildPeriodSlots,
  resolveNow,
  resolvePeriods,
  DAY_LABELS,
  type DayId,
  type FreeRoomCourse,
} from "@/lib/freeClassrooms";
import { fetchLiveDay, type LiveDay } from "@/lib/roomAvailability";
import { mergeDay, type MergedOccupant } from "@/lib/roomMerge";
import { getCurrentSemesterId } from "@/lib/officialOd";
import { CAMPUS_SCHEMAS, GLOBAL_CAMPUS } from "@/lib/campusSchema";
import { useAtom } from "jotai";
import { settingsAtom } from "@/store/settingsAtoms";
import {
  GLOBAL_SEMESTER_CHANGE_EVENT,
  getSelectedFinalReportPath,
  getSelectedFinalSemesterId,
  mapToFinalSemesterId,
} from "@/lib/ffcsReports";
import BottomSheet from "../shared/BottomSheet";
import { DotPill, ListRowText, ListShell, ToneBadge } from "../shared/primitives";
import { LIST_ROW } from "@/lib/uiTokens";
import ClassDetailsModal from "../exams/ClassDetailsModal";

/**
 * `ffcs_raw_courses` has three writers and two shapes. The FFCS timetable tab
 * writes the room as `ROOM`; the free-classroom page writes the lib's `VENUE`.
 * Whichever screen the user visited last owns the key, so this widget could
 * load rows with no `ROOM` key at all — and the room scan below died on
 * `undefined.toUpperCase()`, taking the entire home page with it.
 *
 * `parseCachedCourses` is the tested normaliser: it strips the BOM, folds the
 * `ROOM`/`VENUE` aliases into `VENUE`, and returns nothing rather than
 * throwing when the cache is corrupt. Every field is then guaranteed a string.
 */
/**
 * The three filter fields share this chrome: an icon sits in the left gutter,
 * so the trigger needs left padding for it and a smaller label than the default.
 */
const WIDGET_FIELD =
  "[&>button:first-child]:pl-9 [&>button:first-child]:pr-2 [&>button:first-child]:bg-gray-50 dark:[&>button:first-child]:bg-slate-800 [&>button:first-child]:font-semibold";

/**
 * Free Classrooms, on the home page.
 *
 * The answer comes from the same place the full page's does: the FFCS report
 * merged with the class details students have contributed to the server. The
 * widget asks the server for the day it is showing and merges the two, so the
 * two surfaces cannot disagree — including about which day is today.
 */
export default function FreeClassroomsWidget() {
  const [courses, setCourses] = useState<ParsedCourse[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [settings] = useAtom(settingsAtom);
  const activeSemesterId = useMemo(
    () => mapToFinalSemesterId(settings?.currSemesterID) ?? getSelectedFinalSemesterId(),
    [settings?.currSemesterID],
  );
  const [semesterVersion, setSemesterVersion] = useState(0);

  useEffect(() => {
    const onGlobalChange = () => setSemesterVersion((v) => v + 1);
    window.addEventListener(GLOBAL_SEMESTER_CHANGE_EVENT, onGlobalChange);
    window.addEventListener("storage", onGlobalChange);
    return () => {
      window.removeEventListener(GLOBAL_SEMESTER_CHANGE_EVENT, onGlobalChange);
      window.removeEventListener("storage", onGlobalChange);
    };
  }, []);

  const [selectedDay, setSelectedDay] = useState<DayId>("mon");
  const [selectedPeriod, setSelectedPeriod] = useState<string>("");
  const [selectedBlock, setSelectedBlock] = useState<string>("All");

  /** The server's answer for the day on screen. */
  const [live, setLive] = useState<LiveDay | null>(null);

  /** Room inspector state */
  const [inspectedRoom, setInspectedRoom] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  /** Selected class occupant for detail sheet */
  const [selectedClassOccupant, setSelectedClassOccupant] = useState<{
    occupant: MergedOccupant;
    occupants: MergedOccupant[];
    roomCode: string;
    periodLabel: string;
    dayLabel: string;
  } | null>(null);

  const schema = CAMPUS_SCHEMAS[GLOBAL_CAMPUS];

  /**
   * The periods of the selected day.
   *
   * The union of the lecture and lab lists, and the overlapping ones merged —
   * the same period list the full page shows, so the two agree on what
   * "8:55 AM" means.
   */
  const periods = useMemo(() => resolvePeriods(schema, selectedDay), [schema, selectedDay]);

  /** The VTOP slots running in each period of the day. */
  const slots = useMemo(() => buildPeriodSlots(periods), [periods]);

  // Autofill current day and time
  useEffect(() => {
    const now = resolveNow(periods);
    if (periods.length === 0) return;
    setSelectedDay(now.day);
    setSelectedPeriod((current) =>
      periods.some((p) => p.key === current) ? current : (now.period?.key ?? periods[0].key),
    );
  }, [periods]);

  // Load CSV data
  useEffect(() => {
    const loadCourses = async () => {
      setLoading(true);
      setError(null);

      // Dynamically resolve from the active semester's final course allocation
      // report (winter or fall) based on selected semester.
      try {
        const XLSX = await import("xlsx");
        const reportPath = getSelectedFinalReportPath(activeSemesterId);
        const response = await fetch(reportPath);
        if (!response.ok) throw new Error("Failed to load FFCS report");
        const arrayBuffer = await response.arrayBuffer();
        const data = new Uint8Array(arrayBuffer);
        const workbook = XLSX.read(data, { type: "array" });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const jsonData = XLSX.utils.sheet_to_json<any>(sheet);

        const parsed: ParsedCourse[] = jsonData
          .map((row: any) => {
            const cleanRow: any = {};
            for (const k in row) {
              const cleanKey = k
                .replace(/^\uFEFF/, "")
                .trim()
                .toUpperCase();
              cleanRow[cleanKey] = row[k];
            }
            const venue = String(cleanRow.ROOM || cleanRow.VENUE || "").trim();
            return {
              CODE: String(cleanRow.CODE || cleanRow["COURSE CODE"] || cleanRow.COURSE_CODE || "").trim(),
              TITLE: String(cleanRow.TITLE || cleanRow["COURSE TITLE"] || cleanRow.COURSE_TITLE || "").trim(),
              TYPE: String(cleanRow.TYPE || "").trim(),
              CREDITS: String(cleanRow.CREDITS || "0").trim(),
              ROOM: venue,
              VENUE: venue,
              SLOT: String(cleanRow.SLOT || "").trim(),
              FACULTY: String(cleanRow.FACULTY || cleanRow["EMPLOYEE NAME"] || cleanRow.EMPLOYEE_NAME || "").trim(),
              ERP_ID: String(cleanRow["ERP ID"] || cleanRow.ERP_ID || cleanRow.EMPLOYEE_ID || "").trim() || undefined,
              CLASS_ID: String(cleanRow["CLASS ID"] || cleanRow.CLASS_ID || "").trim() || undefined,
            };
          })
          .filter((c) => c.CODE);

        setCourses(parsed);
      } catch (err: any) {
        setError(err.message || "Failed to load FFCS data");
      } finally {
        setLoading(false);
      }
    };

    loadCourses();
  }, [activeSemesterId, semesterVersion]);

  /**
   * Ask the server about the day on screen.
   *
   * A failure is not an error state: the report is still here, and the answer
   * is the report's.
   */
  useEffect(() => {
    const semesterId = getCurrentSemesterId();
    if (!semesterId || periods.length === 0) return;

    let cancelled = false;
    fetchLiveDay({
      semesterId,
      day: selectedDay,
      periods: periods.map((p) => ({
        key: p.key,
        slots: [...(slots.get(p.key) ?? [])],
      })),
      runLength: 1,
    })
      .then((res) => {
        if (!cancelled) setLive(res);
      })
      .catch(() => {
        if (!cancelled) setLive(null);
      });

    return () => {
      cancelled = true;
    };
  }, [selectedDay, periods, slots]);

  const index = useMemo(() => {
    if (courses.length === 0 || periods.length === 0) return null;
    return buildDayIndex(courses as FreeRoomCourse[], periods, slots);
  }, [courses, periods, slots]);

  const merged = useMemo(() => {
    if (!index) return null;
    return mergeDay({
      index,
      periodKeys: periods.map((p) => p.key),
      live,
      runLength: 1,
    });
  }, [index, periods, live]);

  /**
   * The free rooms, from the report and the server merged.
   *
   * A room is offered only when neither source has a class booked in it.
   */
  const freeVenuesByBlock = useMemo(() => {
    if (!selectedPeriod || !merged) return {};

    const period = merged.periods.get(selectedPeriod);
    if (!period) return {};

    const roomByCode = new Map(merged.rooms.map((r) => [r.code, r]));
    const grouped: Record<string, { theory: string[]; lab: string[] }> = {};
    for (const code of period.free.rooms) {
      const room = roomByCode.get(code);
      if (!room) continue;
      const block = room.block || "Other";
      if (!grouped[block]) grouped[block] = { theory: [], lab: [] };
      (room.kind === "lab" ? grouped[block].lab : grouped[block].theory).push(code);
    }

    Object.keys(grouped).forEach((block) => {
      grouped[block].theory.sort();
      grouped[block].lab.sort();
    });

    return grouped;
  }, [merged, selectedPeriod]);

  /** Room inspector timeline for the currently inspected room */
  const timeline = useMemo(() => {
    if (!inspectedRoom || !merged) return [];
    return periods.map((p) => {
      const occupants = merged.periods.get(p.key)?.occupants.get(inspectedRoom) ?? [];
      return {
        period: p,
        occupants,
        isSelected: p.key === selectedPeriod,
      };
    });
  }, [inspectedRoom, merged, periods, selectedPeriod]);

  const handleCopyRoom = (room: string) => {
    navigator.clipboard?.writeText(room);
    setCopied(room);
    setTimeout(() => setCopied((c) => (c === room ? null : c)), 1800);
  };

  return (
    <div className="card-surface border border-border-strong dark:border-border rounded-[24px] p-5 shadow-sm mt-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-indigo-50 dark:bg-indigo-900/20 flex items-center justify-center text-indigo-500">
            <Search className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-gray-900 dark:text-white leading-tight">Free Classrooms</h3>
            <p className="text-xs text-gray-500 font-medium">Find an empty spot to sit</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
        <div className="relative">
          <CalendarDays className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <SelectField
            value={selectedDay}
            onChange={(val) => setSelectedDay(val as DayId)}
            options={[
              { value: "mon", label: "Monday" },
              { value: "tue", label: "Tuesday" },
              { value: "wed", label: "Wednesday" },
              { value: "thu", label: "Thursday" },
              { value: "fri", label: "Friday" },
            ]}
            searchable={false}
            size="md"
            stacked
            role="group"
            aria-label="Day"
            className={WIDGET_FIELD}
          />
        </div>
        <div className="relative">
          <Clock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <SelectField
            value={selectedPeriod}
            onChange={(val) => setSelectedPeriod(val)}
            options={periods.map((p) => ({ value: p.key, label: p.label }))}
            searchable={false}
            size="md"
            stacked
            role="group"
            aria-label="Time period"
            className={WIDGET_FIELD}
          />
        </div>
        <div className="relative">
          <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <SelectField
            value={selectedBlock}
            onChange={(val) => setSelectedBlock(val)}
            options={[
              { value: "All", label: "All Blocks" },
              ...Object.keys(freeVenuesByBlock)
                .sort()
                .map((block) => ({ value: block, label: block })),
            ]}
            searchable={false}
            size="md"
            stacked
            role="group"
            aria-label="Block"
            className={WIDGET_FIELD}
          />
        </div>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-8 text-indigo-500">
          <Loader2 className="w-6 h-6 animate-spin mb-2" />
          <p className="text-xs font-semibold">Scanning timetable...</p>
        </div>
      ) : error ? (
        <div className="bg-red-50 dark:bg-red-900/10 text-red-600 dark:text-red-400 p-4 rounded-2xl text-xs font-medium text-center">
          {error}
        </div>
      ) : (
        <div className="space-y-4 max-h-[300px] overflow-y-auto pr-1 custom-scrollbar">
          {Object.keys(freeVenuesByBlock).length === 0 ||
          (selectedBlock !== "All" && !freeVenuesByBlock[selectedBlock]) ? (
            <div className="text-center py-6 text-gray-400">
              <MapPin className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm font-medium">No free venues found for this slot.</p>
            </div>
          ) : (
            Object.entries(freeVenuesByBlock)
              .filter(([block]) => selectedBlock === "All" || block === selectedBlock)
              .sort(([a], [b]) => a.localeCompare(b))
              .map(([block, { theory, lab }]) => (
                <div
                  key={block}
                  className="bg-gray-50/50 dark:bg-slate-800/30 rounded-2xl p-3 border border-gray-100 dark:border-gray-800/50"
                >
                  <h4 className="text-sm font-bold text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-indigo-500"></span>
                    {block} Block ({theory.length + lab.length})
                  </h4>

                  {theory.length > 0 && (
                    <div className="mb-2">
                      <p className="text-[10px] uppercase font-bold text-gray-400 mb-1 tracking-wider">Theory</p>
                      <div className="flex flex-wrap gap-1.5">
                        {theory.map((room) => (
                          <button
                            key={room}
                            type="button"
                            onClick={() => setInspectedRoom(room)}
                            className="px-2 py-1 bg-white dark:bg-slate-800 hover:bg-zinc-100 dark:hover:bg-zinc-700/60 border border-gray-200 dark:border-gray-700 hover:border-indigo-300 dark:hover:border-indigo-600 rounded-lg text-[11px] font-bold text-gray-700 dark:text-gray-300 hover:text-indigo-600 dark:hover:text-indigo-400 shadow-2xs transition-all active:scale-95 cursor-pointer"
                            title={`Inspect schedule for ${room}`}
                          >
                            {room.split("-")[1] || room}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {lab.length > 0 && (
                    <div>
                      <p className="text-[10px] uppercase font-bold text-gray-400 mb-1 tracking-wider">Lab</p>
                      <div className="flex flex-wrap gap-1.5">
                        {lab.map((room) => (
                          <button
                            key={room}
                            type="button"
                            onClick={() => setInspectedRoom(room)}
                            className="px-2 py-1 bg-blue-50/50 dark:bg-blue-900/20 hover:bg-blue-100/60 dark:hover:bg-blue-900/40 border border-blue-100 dark:border-blue-800/50 hover:border-blue-300 dark:hover:border-blue-700 rounded-lg text-[11px] font-bold text-blue-600 dark:text-blue-400 hover:text-blue-700 shadow-2xs transition-all active:scale-95 cursor-pointer"
                            title={`Inspect schedule for ${room}`}
                          >
                            {room.split("-")[1] || room}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))
          )}
        </div>
      )}

      {/* ── ROOM INSPECTOR SHEET ── */}
      {inspectedRoom && (
        <BottomSheet
          onClose={() => setInspectedRoom(null)}
          overlayId="widget-room-inspector"
          maxWidth="max-w-xl"
          title={inspectedRoom}
          subtitle={`${DAY_LABELS[selectedDay]?.full ?? selectedDay} · ${timeline.filter((t) => t.occupants.length === 0).length}/${timeline.length} free`}
          icon={<DoorOpen className="w-5 h-5" />}
          accent="bg-emerald-500/10 border-emerald-500/20 text-emerald-600 dark:text-emerald-400"
          closeLabel="Close room inspector"
          trailing={
            <button
              type="button"
              onClick={() => handleCopyRoom(inspectedRoom)}
              title="Copy room code"
              className="p-1.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors cursor-pointer"
            >
              {copied === inspectedRoom ? (
                <Check className="w-3.5 h-3.5 text-emerald-500" />
              ) : (
                <Copy className="w-3.5 h-3.5" />
              )}
            </button>
          }
        >
          <div className="space-y-4 text-left">
            <ListShell>
              {timeline.map(({ period, occupants, isSelected }) => (
                <WidgetListRow
                  key={`${selectedDay}-${period.key}`}
                  icon={<Clock className="w-4 h-4" />}
                  title={period.label}
                  subtitle={
                    occupants.length
                      ? occupants
                          .map((o) =>
                            [
                              o.title || o.courseCode,
                              o.courseCode && o.title ? o.courseCode : "",
                              o.faculty ? `${o.faculty}${o.erpId ? ` (#${o.erpId})` : ""}` : "",
                            ]
                              .filter(Boolean)
                              .join(" · "),
                          )
                          .join(" + ")
                      : "Free and available"
                  }
                  tone={occupants.length ? "zinc" : "emerald"}
                  badge={occupants.length ? "Taken" : "Free"}
                  selected={isSelected}
                  onClick={() => {
                    if (occupants.length > 0) {
                      setSelectedClassOccupant({
                        occupant: occupants[0],
                        occupants,
                        roomCode: inspectedRoom,
                        periodLabel: period.label,
                        dayLabel: DAY_LABELS[selectedDay]?.full ?? selectedDay,
                      });
                    } else {
                      setSelectedPeriod(period.key);
                    }
                  }}
                />
              ))}
            </ListShell>
          </div>
        </BottomSheet>
      )}

      {/* ── CLASS DETAILS MODAL ── */}
      <ClassDetailsModal
        isOpen={Boolean(selectedClassOccupant)}
        onClose={() => setSelectedClassOccupant(null)}
        occupant={selectedClassOccupant?.occupant ?? null}
        occupants={selectedClassOccupant?.occupants}
        roomCode={selectedClassOccupant?.roomCode}
        dayLabel={selectedClassOccupant?.dayLabel}
        periodLabel={selectedClassOccupant?.periodLabel}
      />
    </div>
  );
}

/** One line of the room's day in the widget room inspector. */
function WidgetListRow({
  icon,
  title,
  subtitle,
  tone,
  badge,
  selected,
  onClick,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  tone: string;
  badge: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(LIST_ROW, "gap-3 cursor-pointer", selected && "bg-indigo-50/60 dark:bg-indigo-950/20")}
    >
      <span
        className={cn(
          "w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border",
          tone === "emerald"
            ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-600 dark:text-emerald-400"
            : "bg-zinc-100 dark:bg-zinc-800 border-zinc-200/60 dark:border-zinc-700/60 text-zinc-500 dark:text-zinc-400",
        )}
      >
        {icon}
      </span>
      <ListRowText title={title} subtitle={subtitle} />
      {selected && <DotPill tone="indigo">Selected</DotPill>}
      <ToneBadge tone={tone}>{badge}</ToneBadge>
    </button>
  );
}
