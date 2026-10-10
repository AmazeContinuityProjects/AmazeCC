"use client";

import React, { useState, useEffect, useMemo } from "react";
import { Search, MapPin, Loader2, Clock, CalendarDays, RefreshCw } from "lucide-react";

import SelectField from "../shared/primitives/SelectField";
import type { ParsedCourse } from "../exams/FFCS/types";
import { slotSpellings } from "@/lib/slots";
import { parseCachedCourses } from "@/lib/freeClassrooms";


// Import schemas
import chennaiSchema from "@/data/campus/chennai.json";
import apSchema from "@/data/campus/ap.json";
import bhopalSchema from "@/data/campus/bhopal.json";

const CAMPUS_SCHEMAS: Record<string, any> = {
  chennai: chennaiSchema,
  ap: apSchema,
  bhopal: bhopalSchema
};

const GLOBAL_CAMPUS = "chennai"; // Since FFCSTimetableTab hardcodes it

const timeToMinutes = (timeStr: string) => {
  if (!timeStr) return 0;
  const [time, period] = timeStr.trim().split(" ");
  let [hours, minutes] = time.split(":").map(Number);
  if (period === "PM" && hours !== 12) hours += 12;
  if (period === "AM" && hours === 12) hours = 0;
  return hours * 60 + minutes;
};

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
function coursesFromCache(raw: string): ParsedCourse[] {
  return parseCachedCourses(raw).map((c) => ({
    CODE: c.CODE ?? "",
    TITLE: c.TITLE ?? "",
    TYPE: c.TYPE ?? "",
    CREDITS: "0",
    ROOM: c.VENUE ?? "",
    SLOT: c.SLOT ?? "",
    FACULTY: c.FACULTY ?? "",
  }));
}

/**
 * The three filter fields share this chrome: an icon sits in the left gutter,
 * so the trigger needs left padding for it and a smaller label than the default.
 */
const WIDGET_FIELD =
  "[&>button:first-child]:pl-9 [&>button:first-child]:pr-2 [&>button:first-child]:bg-gray-50 dark:[&>button:first-child]:bg-slate-800 [&>button:first-child]:font-semibold";

export default function FreeClassroomsWidget() {
  const [courses, setCourses] = useState<ParsedCourse[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [selectedDay, setSelectedDay] = useState<string>("mon");
  const [selectedTime, setSelectedTime] = useState<string>("");
  const [selectedBlock, setSelectedBlock] = useState<string>("All");

  const schema = CAMPUS_SCHEMAS[GLOBAL_CAMPUS];
  
  // Extract all valid time periods from schema
  const timePeriods = useMemo(() => {
    const periods: string[] = [];
    schema.theory.forEach((p: any) => {
      if (!p.lunch && p.start && p.end) {
        periods.push(`${p.start} - ${p.end}`);
      }
    });
    return periods;
  }, [schema]);

  // Autofill current day and time
  useEffect(() => {
    const autofill = () => {
      const now = new Date();
      const dayIndex = now.getDay();
      
      // Only autofill on Mon-Fri (1-5)
      if (dayIndex >= 1 && dayIndex <= 5) {
        const days = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
        const todayStr = days[dayIndex];
        
        const nowMinutes = now.getHours() * 60 + now.getMinutes();
        let foundPeriod = "";
        
        schema.theory.forEach((p: any) => {
          if (!p.lunch && p.start && p.end) {
            const startMins = timeToMinutes(p.start);
            const endMins = timeToMinutes(p.end);
            // If current time is within or slightly before the slot
            if (nowMinutes >= startMins - 15 && nowMinutes <= endMins) {
              foundPeriod = `${p.start} - ${p.end}`;
            }
          }
        });

        if (foundPeriod) {
          setSelectedDay(todayStr);
          setSelectedTime(foundPeriod);
        } else if (timePeriods.length > 0) {
          setSelectedDay(todayStr);
          setSelectedTime(timePeriods[0]);
        }
      } else if (timePeriods.length > 0) {
        setSelectedDay("mon");
        setSelectedTime(timePeriods[0]);
      }
    };
    autofill();
  }, [schema, timePeriods]);

  // Load CSV data
  useEffect(() => {
    const loadCourses = async () => {
      setLoading(true);
      setError(null);
      
      // Try local cache first to avoid re-parsing if they visited FFCS tab
      try {
        const cached = localStorage.getItem("ffcs_raw_courses");
        if (cached) {
          const parsedCached = coursesFromCache(cached);
          if (parsedCached.length > 0) {
            setCourses(parsedCached);
            setLoading(false);
            return;
          }
        }
      } catch (e) {}

      try {
        const XLSX = await import("xlsx");
        const response = await fetch("/ffcs/ffcsReport.csv");
        if (!response.ok) throw new Error("Failed to load FFCS report");
        const arrayBuffer = await response.arrayBuffer();
        const data = new Uint8Array(arrayBuffer);
        const workbook = XLSX.read(data, { type: "array" });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const jsonData = XLSX.utils.sheet_to_json<any>(sheet);
        
        const parsed: ParsedCourse[] = jsonData.map((row: any) => {
          const cleanRow: any = {};
          for (const k in row) {
            const cleanKey = k.replace(/^\uFEFF/, '').trim().toUpperCase();
            cleanRow[cleanKey] = row[k];
          }
          return {
            CODE: String(cleanRow.CODE || cleanRow["COURSE CODE"] || cleanRow.COURSE_CODE || "").trim(),
            TITLE: String(cleanRow.TITLE || cleanRow["COURSE TITLE"] || cleanRow.COURSE_TITLE || "").trim(),
            TYPE: String(cleanRow.TYPE || "").trim(),
            CREDITS: String(cleanRow.CREDITS || "0").trim(),
            ROOM: String(cleanRow.ROOM || cleanRow.VENUE || "").trim(),
            SLOT: String(cleanRow.SLOT || "").trim(),
            FACULTY: String(cleanRow.FACULTY || "").trim()
          };
        }).filter(c => c.CODE);

        setCourses(parsed);
      } catch (err: any) {
        setError(err.message || "Failed to load FFCS data");
      } finally {
        setLoading(false);
      }
    };

    loadCourses();
  }, []);

  const freeVenuesByBlock = useMemo(() => {
    if (!selectedTime || !selectedDay || courses.length === 0) return {};

    const [reqStart, reqEnd] = selectedTime.split(" - ");
    
    // Find the slots that correspond to this time for the selected day
    let targetSlots = new Set<string>();

    const theoryPeriod = schema.theory.find((p: any) => p.start === reqStart && p.end === reqEnd);
    if (theoryPeriod && theoryPeriod.days && theoryPeriod.days[selectedDay]) {
      // Law courses are booked "A+TA+TAA", with no period number, so the law
      // school's morning slots would never match the schema's "A1"/"TA1"/"TAA1"
      // and every AB5 room would read as free. See `slotSpellings`.
      slotSpellings(theoryPeriod.days[selectedDay]).forEach((s) => targetSlots.add(s));
    }

    const labPeriod = schema.lab.find((p: any) => p.start === reqStart && p.end === reqEnd);
    if (labPeriod && labPeriod.days && labPeriod.days[selectedDay]) {
      targetSlots.add(labPeriod.days[selectedDay]);
    }

    if (targetSlots.size === 0) return {};

    const roomTypes = new Map<string, { theory: number, lab: number }>();

    // Get all valid unique rooms
    const allRooms = new Set<string>();
    const occupiedRooms = new Set<string>();

    courses.forEach(course => {
      const room = String(course?.ROOM ?? "").trim().toUpperCase();
      if (!room || room === "NIL" || room === "UNK-UNK" || room.includes("ONLINE") || room === "N/A") return;
      
      allRooms.add(room);

      if (!roomTypes.has(room)) roomTypes.set(room, { theory: 0, lab: 0 });
      const t = String(course?.TYPE ?? "").trim().toUpperCase();
      const rawSlot = String(course?.SLOT ?? "");
      if (t.includes("LA") || t === "LO" || rawSlot.toUpperCase().includes("L")) {
        roomTypes.get(room)!.lab++;
      } else {
        roomTypes.get(room)!.theory++;
      }

      const courseSlots = rawSlot.split("+").map(s => s.trim().toUpperCase());
      const isOccupied = [...targetSlots].some(ts => courseSlots.includes(ts.toUpperCase()));
      if (isOccupied) {
        occupiedRooms.add(room);
      }
    });

    const freeRooms = [...allRooms].filter(r => !occupiedRooms.has(r));

    // Group by block (everything before the hyphen, e.g., "AB5-208" -> "AB5")
    const grouped: Record<string, { theory: string[], lab: string[] }> = {};
    freeRooms.forEach(room => {
      const parts = room.split("-");
      const block = parts.length > 1 ? parts[0] : "Other";
      if (!grouped[block]) grouped[block] = { theory: [], lab: [] };
      
      const counts = roomTypes.get(room)!;
      const type = counts.lab > counts.theory ? "lab" : "theory";
      
      grouped[block][type].push(room);
    });

    // Sort blocks and rooms
    Object.keys(grouped).forEach(block => {
      grouped[block].theory.sort();
      grouped[block].lab.sort();
    });

    return grouped;
  }, [courses, selectedTime, selectedDay, schema]);

  return (
    <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border border-gray-200/50 dark:border-gray-800/50 rounded-[24px] p-5 shadow-sm mt-6">
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

      <div className="grid grid-cols-3 gap-3 mb-4">
        <div className="relative">
          <CalendarDays className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <SelectField
            value={selectedDay}
            onChange={(val) => setSelectedDay(val)}
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
            value={selectedTime}
            onChange={(val) => setSelectedTime(val)}
            options={timePeriods.map((time) => ({ value: time, label: time }))}
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
          {Object.keys(freeVenuesByBlock).length === 0 || (selectedBlock !== "All" && !freeVenuesByBlock[selectedBlock]) ? (
            <div className="text-center py-6 text-gray-400">
              <MapPin className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm font-medium">No free venues found for this slot.</p>
            </div>
          ) : (
            Object.entries(freeVenuesByBlock)
              .filter(([block]) => selectedBlock === "All" || block === selectedBlock)
              .sort(([a], [b]) => a.localeCompare(b))
              .map(([block, { theory, lab }]) => (
              <div key={block} className="bg-gray-50/50 dark:bg-slate-800/30 rounded-2xl p-3 border border-gray-100 dark:border-gray-800/50">
                <h4 className="text-sm font-bold text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-indigo-500"></span>
                  {block} Block ({theory.length + lab.length})
                </h4>
                
                {theory.length > 0 && (
                  <div className="mb-2">
                    <p className="text-[10px] uppercase font-bold text-gray-400 mb-1 tracking-wider">Theory</p>
                    <div className="flex flex-wrap gap-1.5">
                      {theory.map(room => (
                        <span 
                          key={room}
                          className="px-2 py-1 bg-white dark:bg-slate-800 border border-gray-200 dark:border-gray-700 rounded-lg text-[11px] font-bold text-gray-600 dark:text-gray-300 shadow-sm"
                        >
                          {room.split("-")[1] || room}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                
                {lab.length > 0 && (
                  <div>
                    <p className="text-[10px] uppercase font-bold text-gray-400 mb-1 tracking-wider">Lab</p>
                    <div className="flex flex-wrap gap-1.5">
                      {lab.map(room => (
                        <span 
                          key={room}
                          className="px-2 py-1 bg-blue-50/50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800/50 rounded-lg text-[11px] font-bold text-blue-600 dark:text-blue-400 shadow-sm"
                        >
                          {room.split("-")[1] || room}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
