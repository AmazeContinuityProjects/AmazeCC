"use client";

import { useEffect, useState } from "react";
import { RefreshCcw, Sparkles, Info, Clock, CheckCircle2, Search, CalendarDays } from "lucide-react";
import { WORKER_BASE } from "@/lib/workerBase";

/**
 * Laundry slots, served by the AmazeCC worker instead of unmessify's GitHub
 * Pages. Same reason as the mess menus: the worker caches each file for six
 * hours, so one upstream fetch covers the campus.
 *
 * Note the filenames here differ from the bundled fallbacks in
 * `public/data/laundry/` — the remote files are not gender-suffixed and use
 * `CB`/`CG` for the combined blocks. The map is the source of truth for the
 * remote names; the local copies keep their own naming.
 */
const LaundryLinks: Record<string, Record<string, string>> = {
  Male: {
    A: `${WORKER_BASE}/unmessify/VITC-A-L.json`,
    C: `${WORKER_BASE}/unmessify/VITC-CB-L.json`,
    D1: `${WORKER_BASE}/unmessify/VITC-D1-L.json`,
    D2: `${WORKER_BASE}/unmessify/VITC-D2-L.json`,
    E: `${WORKER_BASE}/unmessify/VITC-E-L.json`,
  },
  Female: {
    B: `${WORKER_BASE}/unmessify/VITC-B-L.json`,
    C: `${WORKER_BASE}/unmessify/VITC-CG-L.json`,
  },
};

export default function LaundrySchedule({ hostelData, handleHostelDetailsFetch }: any) {
  if (!hostelData?.hostelInfo?.isHosteller) {
    return (
      <div className="flex flex-col items-center justify-center p-8 text-center text-muted">
        <p className="text-sm font-medium">You are not registered as a Hosteller.</p>
        <button
          onClick={handleHostelDetailsFetch}
          className="mt-4 px-4 py-2 rounded-sm bg-accent hover:bg-accent/90 text-background font-medium transition-colors flex items-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        >
          <RefreshCcw className="w-4 h-4" /> Reload Data
        </button>
      </div>
    );
  }

  const [gender, setGender] = useState("");
  const [hostel, setHostel] = useState("");
  const [schedule, setSchedule] = useState<any[]>([]);
  const [searchRoom, setSearchRoom] = useState("");

  // Interactive calendar selection state
  const today = new Date().getDate();
  const [selectedDay, setSelectedDay] = useState<number | null>(today);

  const hostelOptions: Record<string, string[]> = {
    Male: ["A", "C", "D1", "D2", "E"],
    Female: ["B", "C"],
  };

  useEffect(() => {
    if (!hostelData.hostelInfo) return;

    const normalizedGender = hostelData.hostelInfo.gender?.toLowerCase() === "female" ? "Female" : "Male";
    const blockName = hostelData.hostelInfo.blockName?.split(" ")[0] || "A";
    const roomNo = hostelData.hostelInfo.roomNo || "";

    setGender(normalizedGender);
    setHostel(blockName);
    setSearchRoom(roomNo);
  }, [hostelData.hostelInfo]);

  async function fetchLaundryWithCache(g: string, h: string) {
    if (!LaundryLinks[g] || !LaundryLinks[g][h]) return;

    const fileName = `VITC-${h}-${g[0]}-L.json`;
    const localUrl = `/data/laundry/${fileName}`;
    const remoteUrl = LaundryLinks[g][h];

    try {
      const cached = localStorage.getItem(fileName);
      if (cached) {
        const parsed = JSON.parse(cached);
        setSchedule(parsed.list || []);
      }
    } catch (err) {
      console.warn("LocalStorage read failed:", err);
    }

    if (!localStorage.getItem(fileName)) {
      try {
        const res = await fetch(localUrl);
        const data = await res.json();
        setSchedule(data.list || []);
        localStorage.setItem(fileName, JSON.stringify(data));
      } catch (err) {
        console.error("Error loading laundry from public folder:", err);
      }
    }

    fetch(remoteUrl, { cache: "no-store" })
      .then((res) => res.json())
      .then((data) => {
        setSchedule(data.list || []);
        localStorage.setItem(fileName, JSON.stringify(data));
      })
      .catch((err) => {
        console.warn("Remote fetch failed, keeping cached:", err);
      });
  }

  useEffect(() => {
    if (!gender || !hostel) return;
    fetchLaundryWithCache(gender, hostel);
  }, [gender, hostel]);

  const cleanSearchRoomNum =
    searchRoom && typeof searchRoom === "string"
      ? searchRoom.match(/\d+/)
        ? parseInt(searchRoom.match(/\d+/)![0], 10)
        : null
      : null;

  const isRoomInSlotRange = (roomRangeStr: any) => {
    if (!cleanSearchRoomNum || !roomRangeStr || typeof roomRangeStr !== "string") return false;
    const matches = roomRangeStr.match(/\d+/g);
    if (matches && matches.length >= 2) {
      const start = parseInt(matches[0], 10);
      const end = parseInt(matches[1], 10);
      return cleanSearchRoomNum >= start && cleanSearchRoomNum <= end;
    }
    return false;
  };

  const matchingSlots = schedule.filter((item) => isRoomInSlotRange(item.RoomNumber));
  const hasSlotToday = matchingSlots.some((slot) => parseInt(slot.Date, 10) === today);
  const nextSlot = matchingSlots.find((slot) => parseInt(slot.Date, 10) >= today);

  // Calendar calculations
  const getDaysInMonth = () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();

    const rawFirstDay = new Date(year, month, 1).getDay();
    const firstDay = rawFirstDay === 0 ? 6 : rawFirstDay - 1; // Monday start
    const totalDays = new Date(year, month + 1, 0).getDate();

    return { firstDay, totalDays };
  };

  const { firstDay, totalDays } = getDaysInMonth();
  const dayPads = Array(firstDay).fill(null);
  const dayNumbers = Array.from({ length: totalDays }, (_, i) => i + 1);
  const calendarCells = [...dayPads, ...dayNumbers];
  const weekDays = ["M", "T", "W", "T", "F", "S", "S"];

  const getDaySchedule = (dayNum: number) => {
    return schedule.find((item) => parseInt(item.Date, 10) === dayNum);
  };

  // Details for currently clicked calendar day
  const selectedSlot = selectedDay ? getDaySchedule(selectedDay) : null;
  const isSelectedUserSlot = selectedSlot ? isRoomInSlotRange(selectedSlot.RoomNumber) : false;

  return (
    <div className="space-y-6">
      {/* Header layout */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 pb-4 border-b border-gray-150 dark:border-gray-800">
        <div>
          <h1 className="text-xl md:text-3xl font-semibold text-ink tracking-tight">Laundry Hub</h1>
          <div className="flex flex-wrap items-center gap-2 mt-1">
            <span className="text-xs text-gray-550 dark:text-gray-400 font-semibold">Block {hostel} Schedule</span>
            <span className="text-[11px] bg-accent-soft text-accent px-2 py-0.5 rounded-full font-semibold flex items-center gap-1">
              <Sparkles size={10} /> Data from unmessify
            </span>
          </div>
        </div>

        {/* Controls: Segmented toggles */}
        {gender && (
          <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
            {/* Gender Segmented */}
            <div className="flex rounded-lg bg-gray-150 dark:bg-slate-800/80 p-1 shrink-0">
              {["Male", "Female"].map((g) => (
                <button
                  key={g}
                  onClick={() => {
                    setGender(g);
                    setHostel(hostelOptions[g][0]);
                  }}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${
                    gender === g
                      ? "bg-surface dark:bg-slate-700 text-accent shadow-xs"
                      : "text-gray-500 dark:text-gray-455 hover:text-gray-700 dark:hover:text-gray-300"
                  }`}
                >
                  {g}
                </button>
              ))}
            </div>

            {/* Hostel Block Selector Segmented control */}
            <div className="flex rounded-lg bg-gray-150 dark:bg-slate-800/80 p-1 shrink-0 overflow-x-auto scrollbar-none">
              {hostelOptions[gender]?.map((h) => (
                <button
                  key={h}
                  onClick={() => setHostel(h)}
                  className={`px-3.5 py-1.5 text-xs font-semibold rounded-md transition-all ${
                    hostel === h
                      ? "bg-surface dark:bg-slate-700 text-accent shadow-xs"
                      : "text-gray-500 dark:text-gray-455 hover:text-gray-700 dark:hover:text-gray-300"
                  }`}
                >
                  {h} Block
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Interactive Personalized Slot Checker */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Slot Quick Finder panel */}
        <div className="bg-surface border border-line rounded-md p-5 shadow-2xs space-y-4">
          <div className="space-y-1">
            <span className="text-[11px] font-semibold text-accent block">
              Personal Slot Finder
            </span>
            <h3 className="text-sm font-semibold text-ink">Find slots by Room</h3>
          </div>

          <div className="relative">
            <input
              type="text"
              placeholder="Enter Room (e.g. 405)"
              value={searchRoom}
              onChange={(e) => setSearchRoom(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-xs border border-gray-250 dark:border-gray-800 bg-surface rounded-md text-gray-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-accent/40"
            />
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
          </div>

          <div className="space-y-3.5 pt-2">
            {hasSlotToday ? (
              <div className="bg-ok-soft border border-ok/15 p-4 rounded-md space-y-2 text-xs text-ok">
                <div className="flex items-center gap-2 font-semibold">
                  <CheckCircle2 size={16} />
                  <span>Laundry Slot is Today!</span>
                </div>
                <p className="text-[11px] text-gray-500">
                  You can drop off clothes for room range{" "}
                  {matchingSlots.find((s) => parseInt(s.Date, 10) === today)?.RoomNumber} today.
                </p>
              </div>
            ) : nextSlot ? (
              <div className="bg-accent-soft border border-accent/20 p-4 rounded-md space-y-2 text-xs text-accent">
                <div className="flex items-center gap-2 font-semibold">
                  <Clock size={16} />
                  <span>Next Slot: Day {nextSlot.Date}</span>
                </div>
                <p className="text-[11px] text-gray-500">Scheduled for room range {nextSlot.RoomNumber}.</p>
              </div>
            ) : (
              <div className="bg-gray-500/5 border border-gray-500/10 p-4 rounded-md space-y-2 text-xs text-gray-400 italic">
                <p className="text-[11px]">Enter a valid room number to locate your slots in {hostel} Block.</p>
              </div>
            )}
          </div>
        </div>

        {/* Dynamic slots preview */}
        <div className="lg:col-span-2 bg-surface border border-line rounded-md p-5 shadow-2xs flex flex-col justify-between">
          <div className="space-y-3">
            <span className="text-[11px] font-semibold text-accent block">
              Your Scheduled Dates
            </span>
            <h3 className="text-sm font-semibold text-ink">
              All matching dates for Room {searchRoom || "—"}
            </h3>

            {matchingSlots.length > 0 ? (
              <div className="flex flex-wrap gap-2.5 pt-2">
                {matchingSlots.map((slot, idx) => {
                  const isCurrentDay = parseInt(slot.Date, 10) === today;
                  return (
                    <div
                      key={idx}
                      className={`px-3 py-2 rounded-md border text-xs font-semibold transition-all ${
                        isCurrentDay
                          ? "bg-ok-soft border-ok/25 text-ok scale-105"
                          : "bg-surface border-line text-gray-700 dark:text-gray-300"
                      }`}
                    >
                      <span className="block text-[11px] text-gray-400 font-semibold mb-0.5">Date</span>
                      <span className="text-sm">{slot.Date}</span>
                      {isCurrentDay && (
                        <span className="block text-[11px] text-ok mt-0.5">
                          Today
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-xs text-gray-455 italic pt-2">
                No matching dates found. Change the block or input a correct room number.
              </p>
            )}
          </div>

          <div className="flex items-center gap-2 text-[11px] text-gray-400 border-t border-gray-150 dark:border-gray-800/80 pt-3 mt-4">
            <Info size={12} className="text-accent" />
            <span>
              Slots are mapped automatically from block records. Each room range is granted two drop-off days per month.
            </span>
          </div>
        </div>
      </div>

      {/* Split pane: Compact widget calendar + Day details view */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Left: Compact Monthly Grid */}
        <div className="bg-surface border border-line rounded-md p-4 shadow-2xs space-y-3">
          <div className="flex items-center justify-between border-b border-gray-150 dark:border-gray-800 pb-2">
            <h3 className="text-xs font-semibold text-gray-400 flex items-center gap-1.5">
              <CalendarDays size={13} className="text-accent" /> Slot Calendar
            </h3>
            <div className="flex items-center gap-2 text-[11px] font-semibold">
              <div className="flex items-center gap-1 text-ok">
                <span className="h-1.5 w-1.5 rounded-full bg-ok" />
                <span>Today</span>
              </div>
              <div className="flex items-center gap-1 text-accent">
                <span className="h-1.5 w-1.5 rounded-full bg-accent" />
                <span>Your Slot</span>
              </div>
            </div>
          </div>

          {schedule.length > 0 ? (
            <div className="space-y-1.5">
              {/* Day headers */}
              <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-semibold text-gray-450">
                {weekDays.map((wd, i) => (
                  <div key={i} className="py-0.5">
                    {wd}
                  </div>
                ))}
              </div>

              {/* Day numbers grid */}
              <div className="grid grid-cols-7 gap-1">
                {calendarCells.map((cell, idx) => {
                  if (cell === null) {
                    return <div key={`pad-${idx}`} className="w-8 h-8 sm:w-10 sm:h-10" />;
                  }

                  const dayNum = cell;
                  const slot = getDaySchedule(dayNum);
                  const isToday = dayNum === today;
                  const isUserSlot = slot ? isRoomInSlotRange(slot.RoomNumber) : false;
                  const isClicked = dayNum === selectedDay;

                  let cellStyle = "text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-800/50";
                  if (isToday) {
                    cellStyle = "bg-ok-soft text-ok border border-ok/30 font-semibold";
                  } else if (isUserSlot) {
                    cellStyle = "bg-accent-soft text-accent border border-accent/20 font-semibold";
                  } else if (slot) {
                    cellStyle =
                      "bg-surface-2 text-ink border border-gray-150/40 dark:border-gray-800/40";
                  }

                  if (isClicked) {
                    cellStyle += " ring-2 ring-accent/40 ring-offset-2 ring-offset-slate-900/40 scale-105";
                  }

                  return (
                    <button
                      key={`day-${dayNum}`}
                      onClick={() => setSelectedDay(dayNum)}
                      className={`w-8 h-8 sm:w-10 sm:h-10 rounded-full flex flex-col items-center justify-center text-xs transition-all relative hit-expand ${cellStyle}`}
                    >
                      <span>{dayNum}</span>
                      {/* Optional slot indicator dot */}
                      {slot && !isToday && !isUserSlot && (
                        <span className="absolute bottom-1 h-1 w-1 rounded-full bg-gray-400 dark:bg-gray-500" />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          ) : (
            <p className="text-center text-xs text-gray-450 italic py-4">No schedule data cached.</p>
          )}
        </div>

        {/* Right: Selected Day details card */}
        <div className="bg-surface border border-line rounded-md p-5 shadow-2xs flex flex-col justify-between">
          <div className="space-y-4">
            <span className="text-[11px] font-semibold text-accent block">
              Selected Slot Details
            </span>

            {selectedDay ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-150">Date of Month: {selectedDay}</h4>
                  {selectedDay === today && (
                    <span className="text-[11px] bg-ok-soft text-ok px-2.5 py-0.5 rounded-full font-semibold">
                      Today
                    </span>
                  )}
                </div>

                {selectedSlot ? (
                  <div className="space-y-3">
                    <div className="bg-surface-2 border border-gray-150 dark:border-gray-850/60 rounded-md p-3.5 space-y-2 text-xs">
                      <div>
                        <span className="text-[11px] font-semibold text-gray-450 block mb-0.5">
                          Room Slot Range
                        </span>
                        <span className="font-semibold text-gray-850 dark:text-gray-100 text-sm">
                          {selectedSlot.RoomNumber}
                        </span>
                      </div>

                      <div className="pt-2 border-t border-gray-150 dark:border-gray-800/80 flex items-center justify-between text-[11px]">
                        <span>Status:</span>
                        {isSelectedUserSlot ? (
                          <span className="font-semibold text-accent">Your Laundry Slot</span>
                        ) : selectedDay === today ? (
                          <span className="font-semibold text-ok">Active Today</span>
                        ) : (
                          <span className="font-semibold text-gray-450">Other Room Slot</span>
                        )}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="bg-gray-500/5 border border-gray-500/10 p-4 rounded-md text-center text-xs text-gray-455 italic">
                    No active laundry slots scheduled for this date.
                  </div>
                )}
              </div>
            ) : (
              <p className="text-xs text-gray-455 italic">Click on any date in the calendar grid to inspect slots.</p>
            )}
          </div>

          <div className="flex items-start gap-2 text-[11px] text-gray-405 border-t border-gray-150 dark:border-gray-800/80 pt-3 mt-4">
            <Info size={12} className="text-accent shrink-0 mt-0.5" />
            <span>
              Select the date matching your room range, take your bag to the laundry drop counter before 5:00 PM.
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
