"use client";

import { useEffect, useState } from "react";
import { getTypedStorageItem, setTypedStorageItem } from "@/lib/storage";
import { RefreshCcw, Sparkles, Info, Clock, CheckCircle2, Search, CalendarDays } from "lucide-react";
import { WORKER_BASE } from "@/lib/workerBase";
import { FIELD_INPUT, FOCUS_RING, MICRO_LABEL, PRIMARY_BUTTON, SEARCH_ICON, TILE_CARD } from "@/lib/uiTokens";

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
      <div className="flex flex-col items-center justify-center p-8 text-center text-text-muted">
        <p className="text-sm font-medium">You are not registered as a Hosteller.</p>
        <button onClick={handleHostelDetailsFetch} className={`mt-4 ${PRIMARY_BUTTON} text-xs`}>
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
      const cached = getTypedStorageItem(fileName) as { list?: any[] } | null;
      if (cached?.list) setSchedule(cached.list);
    } catch (err) {
      console.warn("Storage read failed:", err);
    }

    if (!getTypedStorageItem(fileName)) {
      try {
        const res = await fetch(localUrl);
        const data = await res.json();
        setSchedule(data.list || []);
        setTypedStorageItem(fileName, data);
      } catch (err) {
        console.error("Error loading laundry from public folder:", err);
      }
    }

    fetch(remoteUrl, { cache: "no-store" })
      .then((res) => res.json())
      .then((data) => {
        setSchedule(data.list || []);
        setTypedStorageItem(fileName, data);
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
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 pb-4 border-b border-border-muted">
        <div>
          <h1 className="text-xl md:text-3xl font-black font-outfit tracking-tight text-text-heading">Laundry Hub</h1>
          <div className="flex flex-wrap items-center gap-2 mt-1">
            <span className="text-xs text-text-secondary font-semibold">Block {hostel} Schedule</span>
            <span className="text-xs bg-sky-500/10 text-sky-600 dark:text-sky-400 px-2 py-0.5 rounded-md font-extrabold flex items-center gap-1">
              <Sparkles size={10} /> Data from unmessify
            </span>
          </div>
        </div>

        {/* Controls: Segmented toggles */}
        {gender && (
          <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
            {/* Gender Segmented */}
            <div className="flex rounded-lg bg-surface-secondary p-1 shrink-0">
              {["Male", "Female"].map((g) => (
                <button
                  key={g}
                  onClick={() => {
                    setGender(g);
                    setHostel(hostelOptions[g][0]);
                  }}
                  className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all cursor-pointer ${
                    gender === g
                      ? "bg-white dark:bg-surface text-sky-600 dark:text-sky-400 shadow-xs"
                      : "text-text-secondary hover:text-text-heading"
                  }`}
                >
                  {g}
                </button>
              ))}
            </div>

            {/* Hostel Block Selector Segmented control */}
            <div className="flex rounded-lg bg-surface-secondary p-1 shrink-0 overflow-x-auto scrollbar-none">
              {hostelOptions[gender]?.map((h) => (
                <button
                  key={h}
                  onClick={() => setHostel(h)}
                  className={`px-3.5 py-1.5 text-xs font-bold rounded-md transition-all cursor-pointer ${
                    hostel === h
                      ? "bg-white dark:bg-surface text-sky-600 dark:text-sky-400 shadow-xs"
                      : "text-text-secondary hover:text-text-heading"
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
        <div className={`${TILE_CARD} space-y-4`}>
          <div className="space-y-1">
            <span className={MICRO_LABEL}>Personal Slot Finder</span>
            <h3 className="text-sm font-bold text-text-heading">Find slots by Room</h3>
          </div>

          <div className="relative">
            <input
              type="text"
              placeholder="Enter Room (e.g. 405)"
              value={searchRoom}
              onChange={(e) => setSearchRoom(e.target.value)}
              className={`${FIELD_INPUT} pl-9`}
            />
            <Search className={SEARCH_ICON} />
          </div>

          <div className="space-y-3.5 pt-2">
            {hasSlotToday ? (
              <div className="bg-emerald-500/10 border border-emerald-500/20 p-4 rounded-2xl space-y-2 text-xs text-emerald-600 dark:text-emerald-400">
                <div className="flex items-center gap-2 font-bold">
                  <CheckCircle2 size={16} />
                  <span>Laundry Slot is Today!</span>
                </div>
                <p className="text-text-secondary">
                  You can drop off clothes for room range{" "}
                  {matchingSlots.find((s) => parseInt(s.Date, 10) === today)?.RoomNumber} today.
                </p>
              </div>
            ) : nextSlot ? (
              <div className="bg-sky-500/10 border border-sky-500/20 p-4 rounded-2xl space-y-2 text-xs text-sky-600 dark:text-sky-400">
                <div className="flex items-center gap-2 font-bold">
                  <Clock size={16} />
                  <span>Next Slot: Day {nextSlot.Date}</span>
                </div>
                <p className="text-text-secondary">Scheduled for room range {nextSlot.RoomNumber}.</p>
              </div>
            ) : (
              <div className="bg-surface-secondary border border-border-muted p-4 rounded-2xl space-y-2 text-xs text-text-muted italic">
                <p>Enter a valid room number to locate your slots in {hostel} Block.</p>
              </div>
            )}
          </div>
        </div>

        {/* Dynamic slots preview */}
        <div className={`lg:col-span-2 ${TILE_CARD} flex flex-col justify-between`}>
          <div className="space-y-3">
            <span className={MICRO_LABEL}>Your Scheduled Dates</span>
            <h3 className="text-sm font-bold text-text-heading">All matching dates for Room {searchRoom || "—"}</h3>

            {matchingSlots.length > 0 ? (
              <div className="flex flex-wrap gap-2.5 pt-2">
                {matchingSlots.map((slot, idx) => {
                  const isCurrentDay = parseInt(slot.Date, 10) === today;
                  return (
                    <div
                      key={idx}
                      className={`px-3 py-2 rounded-2xl border text-xs font-bold transition-all ${
                        isCurrentDay
                          ? "bg-emerald-500/15 border-emerald-500/25 text-emerald-600 dark:text-emerald-400"
                          : "bg-surface-secondary border-border-muted text-text-secondary"
                      }`}
                    >
                      <span className="block text-text-muted font-semibold mb-0.5">Date</span>
                      <span className="tabular-nums text-sm">{slot.Date}</span>
                      {isCurrentDay && (
                        <span className="block text-xs uppercase tracking-wider text-emerald-600 dark:text-emerald-400 mt-0.5">
                          Today
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-xs text-text-muted italic pt-2">
                No matching dates found. Change the block or input a correct room number.
              </p>
            )}
          </div>

          <div className="flex items-center gap-2 text-xs text-text-muted border-t border-border-muted pt-3 mt-4">
            <Info size={12} className="text-sky-500" />
            <span>
              Slots are mapped automatically from block records. Each room range is granted two drop-off days per month.
            </span>
          </div>
        </div>
      </div>

      {/* Split pane: Compact widget calendar + Day details view */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Left: Compact Monthly Grid */}
        <div className={`${TILE_CARD} space-y-3`}>
          <div className="flex items-center justify-between border-b border-border-muted pb-2">
            <h3 className={`${MICRO_LABEL} flex items-center gap-1.5`}>
              <CalendarDays size={13} className="text-sky-500" /> Slot Calendar
            </h3>
            <div className="flex items-center gap-2 text-xs font-semibold">
              <div className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                <span>Today</span>
              </div>
              <div className="flex items-center gap-1 text-sky-500">
                <span className="h-1.5 w-1.5 rounded-full bg-sky-500" />
                <span>Your Slot</span>
              </div>
            </div>
          </div>

          {schedule.length > 0 ? (
            <div className="space-y-1.5">
              {/* Day headers */}
              <div className="grid grid-cols-7 gap-1 text-center text-xs font-bold text-text-muted">
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

                  let cellStyle = "text-text-secondary hover:bg-surface-secondary";
                  if (isToday) {
                    cellStyle =
                      "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 font-bold";
                  } else if (isUserSlot) {
                    cellStyle = "bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/20 font-bold";
                  } else if (slot) {
                    cellStyle = "bg-surface-secondary text-text-heading border border-border-muted";
                  }

                  if (isClicked) {
                    cellStyle += " ring-2 ring-sky-400 ring-offset-2 ring-offset-background scale-105";
                  }

                  return (
                    <button
                      key={`day-${dayNum}`}
                      onClick={() => setSelectedDay(dayNum)}
                      className={`w-8 h-8 sm:w-10 sm:h-10 flex flex-col items-center justify-center text-xs transition-all relative hit-expand ${FOCUS_RING} ${cellStyle}`}
                    >
                      <span>{dayNum}</span>
                      {/* Optional slot indicator dot */}
                      {slot && !isToday && !isUserSlot && (
                        <span className="absolute bottom-1 h-1 w-1 rounded-full bg-text-muted" />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          ) : (
            <p className="text-center text-xs text-text-muted italic py-4">No schedule data cached.</p>
          )}
        </div>

        {/* Right: Selected Day details card */}
        <div className={`${TILE_CARD} flex flex-col justify-between`}>
          <div className="space-y-4">
            <span className={MICRO_LABEL}>Selected Slot Details</span>

            {selectedDay ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-bold text-text-heading">Date of Month: {selectedDay}</h4>
                  {selectedDay === today && (
                    <span className="text-xs bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 px-2.5 py-0.5 rounded-md font-extrabold uppercase">
                      Today
                    </span>
                  )}
                </div>

                {selectedSlot ? (
                  <div className="space-y-3">
                    <div className="bg-surface-secondary border border-border-muted rounded-2xl p-3.5 space-y-2 text-xs">
                      <div>
                        <span className={`${MICRO_LABEL} block mb-0.5`}>Room Slot Range</span>
                        <span className="font-bold text-text-heading text-sm">{selectedSlot.RoomNumber}</span>
                      </div>

                      <div className="pt-2 border-t border-border-muted flex items-center justify-between text-xs">
                        <span>Status:</span>
                        {isSelectedUserSlot ? (
                          <span className="font-bold text-sky-600 dark:text-sky-400 uppercase">Your Laundry Slot</span>
                        ) : selectedDay === today ? (
                          <span className="font-bold text-emerald-600 dark:text-emerald-400 uppercase">
                            Active Today
                          </span>
                        ) : (
                          <span className="font-semibold text-text-muted uppercase">Other Room Slot</span>
                        )}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="bg-surface-secondary border border-border-muted p-4 rounded-2xl text-center text-xs text-text-muted italic">
                    No active laundry slots scheduled for this date.
                  </div>
                )}
              </div>
            ) : (
              <p className="text-xs text-text-muted italic">Click on any date in the calendar grid to inspect slots.</p>
            )}
          </div>

          <div className="flex items-start gap-2 text-xs text-text-muted border-t border-border-muted pt-3 mt-4">
            <Info size={12} className="text-sky-500 shrink-0 mt-0.5" />
            <span>
              Select the date matching your room range, take your bag to the laundry drop counter before 5:00 PM.
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
