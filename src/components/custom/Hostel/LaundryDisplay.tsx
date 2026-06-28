"use client";

import { useEffect, useState } from "react";
import { RefreshCcw, Sparkles, Info, Clock, CheckCircle2, Search, CalendarDays } from "lucide-react";

const LaundryLinks: Record<string, Record<string, string>> = {
  Male: {
    A: "https://kanishka-developer.github.io/unmessify/json/en/VITC-A-L.json",
    C: "https://kanishka-developer.github.io/unmessify/json/en/VITC-CB-L.json",
    D1: "https://kanishka-developer.github.io/unmessify/json/en/VITC-D1-L.json",
    D2: "https://kanishka-developer.github.io/unmessify/json/en/VITC-D2-L.json",
    E: "https://kanishka-developer.github.io/unmessify/json/en/VITC-E-L.json",
  },
  Female: {
    B: "https://kanishka-developer.github.io/unmessify/json/en/VITC-B-L.json",
    C: "https://kanishka-developer.github.io/unmessify/json/en/VITC-CG-L.json",
  },
};

export default function LaundrySchedule({ hostelData, handleHostelDetailsFetch }: any) {
  if (!hostelData?.hostelInfo?.isHosteller) {
    return (
      <div className="flex flex-col items-center justify-center p-8 text-center text-gray-500 dark:text-gray-400">
        <p className="text-sm font-medium">You are not registered as a Hosteller.</p>
        <button
          onClick={handleHostelDetailsFetch}
          className="mt-4 px-4 py-2 rounded-xl bg-sky-500 hover:bg-sky-600 text-white font-semibold transition-colors flex items-center gap-2"
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

    const normalizedGender =
      hostelData.hostelInfo.gender?.toLowerCase() === "female" ? "Female" : "Male";
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

  const cleanSearchRoomNum = (searchRoom && typeof searchRoom === "string")
    ? (searchRoom.match(/\d+/) ? parseInt(searchRoom.match(/\d+/)![0], 10) : null)
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
    return schedule.find(item => parseInt(item.Date, 10) === dayNum);
  };

  // Details for currently clicked calendar day
  const selectedSlot = selectedDay ? getDaySchedule(selectedDay) : null;
  const isSelectedUserSlot = selectedSlot ? isRoomInSlotRange(selectedSlot.RoomNumber) : false;

  return (
    <div className="space-y-6">
      {/* Header layout */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 pb-4 border-b border-gray-150 dark:border-gray-800">
        <div>
          <h1 className="text-xl md:text-3xl font-bold text-gray-900 dark:text-white tracking-tight">Laundry Hub</h1>
          <div className="flex flex-wrap items-center gap-2 mt-1">
            <span className="text-xs text-gray-550 dark:text-gray-400 font-semibold">Block {hostel} Schedule</span>
            <span className="text-[9px] bg-sky-500/10 text-sky-400 px-2 py-0.5 rounded-full font-bold flex items-center gap-1">
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
                      ? "bg-white dark:bg-slate-700 text-sky-400 shadow-xs"
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
                      ? "bg-white dark:bg-slate-700 text-sky-400 shadow-xs"
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
        <div className="bg-white/50 dark:bg-slate-900/50 border border-gray-200/80 dark:border-gray-800 rounded-2xl p-5 shadow-2xs space-y-4">
          <div className="space-y-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-sky-400 block">Personal Slot Finder</span>
            <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100">Find slots by Room</h3>
          </div>

          <div className="relative">
            <input
              type="text"
              placeholder="Enter Room (e.g. 405)"
              value={searchRoom}
              onChange={(e) => setSearchRoom(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-xs border border-gray-250 dark:border-gray-800 bg-white/50 dark:bg-slate-950 rounded-xl text-gray-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-sky-400"
            />
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
          </div>

          <div className="space-y-3.5 pt-2">
            {hasSlotToday ? (
              <div className="bg-emerald-500/10 border border-emerald-500/15 p-4 rounded-xl space-y-2 text-xs text-emerald-400">
                <div className="flex items-center gap-2 font-bold">
                  <CheckCircle2 size={16} />
                  <span>Laundry Slot is Today!</span>
                </div>
                <p className="text-[10px] text-gray-500">You can drop off clothes for room range {matchingSlots.find(s => parseInt(s.Date, 10) === today)?.RoomNumber} today.</p>
              </div>
            ) : nextSlot ? (
              <div className="bg-sky-500/10 border border-sky-400/20 p-4 rounded-xl space-y-2 text-xs text-sky-400">
                <div className="flex items-center gap-2 font-bold">
                  <Clock size={16} />
                  <span>Next Slot: Day {nextSlot.Date}</span>
                </div>
                <p className="text-[10px] text-gray-500">Scheduled for room range {nextSlot.RoomNumber}.</p>
              </div>
            ) : (
              <div className="bg-gray-500/5 border border-gray-500/10 p-4 rounded-xl space-y-2 text-xs text-gray-400 italic">
                <p className="text-[10px]">Enter a valid room number to locate your slots in {hostel} Block.</p>
              </div>
            )}
          </div>
        </div>

        {/* Dynamic slots preview */}
        <div className="lg:col-span-2 bg-white/50 dark:bg-slate-900/50 border border-gray-200/80 dark:border-gray-800 rounded-2xl p-5 shadow-2xs flex flex-col justify-between">
          <div className="space-y-3">
            <span className="text-[10px] font-bold uppercase tracking-wider text-sky-400 block">Your Scheduled Dates</span>
            <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100">All matching dates for Room {searchRoom || "—"}</h3>
            
            {matchingSlots.length > 0 ? (
              <div className="flex flex-wrap gap-2.5 pt-2">
                {matchingSlots.map((slot, idx) => {
                  const isCurrentDay = parseInt(slot.Date, 10) === today;
                  return (
                    <div
                      key={idx}
                      className={`px-3 py-2 rounded-xl border text-xs font-bold transition-all ${
                        isCurrentDay
                          ? "bg-emerald-500/15 border-emerald-500/25 text-emerald-400 scale-105"
                          : "bg-white/50 dark:bg-slate-950/40 border-gray-200 dark:border-gray-800 text-gray-700 dark:text-gray-300"
                      }`}
                    >
                      <span className="block text-[10px] text-gray-400 font-semibold mb-0.5">Date</span>
                      <span className="text-sm">{slot.Date}</span>
                      {isCurrentDay && <span className="block text-[8px] uppercase tracking-wider text-emerald-400 mt-0.5">Today</span>}
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-xs text-gray-455 italic pt-2">No matching dates found. Change the block or input a correct room number.</p>
            )}
          </div>

          <div className="flex items-center gap-2 text-[10px] text-gray-400 border-t border-gray-150 dark:border-gray-800/80 pt-3 mt-4">
            <Info size={12} className="text-sky-400" />
            <span>Slots are mapped automatically from block records. Each room range is granted two drop-off days per month.</span>
          </div>
        </div>

      </div>

      {/* Split pane: Compact widget calendar + Day details view */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* Left: Compact Monthly Grid */}
        <div className="bg-white/50 dark:bg-slate-900/50 border border-gray-200/80 dark:border-gray-800 rounded-2xl p-4 shadow-2xs space-y-3">
          <div className="flex items-center justify-between border-b border-gray-150 dark:border-gray-800 pb-2">
            <h3 className="text-xs font-bold uppercase tracking-widest text-gray-400 flex items-center gap-1.5">
              <CalendarDays size={13} className="text-sky-400" /> Slot Calendar
            </h3>
            <div className="flex items-center gap-2 text-[9px] font-semibold">
              <div className="flex items-center gap-1 text-emerald-400">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                <span>Today</span>
              </div>
              <div className="flex items-center gap-1 text-sky-450">
                <span className="h-1.5 w-1.5 rounded-full bg-sky-500" />
                <span>Your Slot</span>
              </div>
            </div>
          </div>

          {schedule.length > 0 ? (
            <div className="space-y-1.5">
              {/* Day headers */}
              <div className="grid grid-cols-7 gap-1 text-center text-[9px] font-bold text-gray-450">
                {weekDays.map((wd, i) => (
                  <div key={i} className="py-0.5">{wd}</div>
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
                    cellStyle = "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 font-bold";
                  } else if (isUserSlot) {
                    cellStyle = "bg-sky-500/10 text-sky-400 border border-sky-500/20 font-bold";
                  } else if (slot) {
                    cellStyle = "bg-gray-100/50 dark:bg-slate-850/30 text-gray-900 dark:text-gray-100 border border-gray-150/40 dark:border-gray-800/40";
                  }

                  if (isClicked) {
                    cellStyle += " ring-2 ring-sky-400 ring-offset-2 ring-offset-slate-900/40 scale-105";
                  }

                  return (
                    <button
                      key={`day-${dayNum}`}
                      onClick={() => setSelectedDay(dayNum)}
                      className={`w-8 h-8 sm:w-10 sm:h-10 rounded-full flex flex-col items-center justify-center text-xs transition-all relative ${cellStyle}`}
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
        <div className="bg-white/50 dark:bg-slate-900/50 border border-gray-200/80 dark:border-gray-800 rounded-2xl p-5 shadow-2xs flex flex-col justify-between">
          <div className="space-y-4">
            <span className="text-[10px] font-bold uppercase tracking-wider text-sky-400 block">Selected Slot Details</span>
            
            {selectedDay ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-bold text-gray-900 dark:text-gray-150">Date of Month: {selectedDay}</h4>
                  {selectedDay === today && (
                    <span className="text-[9px] bg-emerald-500/20 text-emerald-400 px-2.5 py-0.5 rounded-full font-bold uppercase">Today</span>
                  )}
                </div>

                {selectedSlot ? (
                  <div className="space-y-3">
                    <div className="bg-gray-50/50 dark:bg-slate-850/20 border border-gray-150 dark:border-gray-850/60 rounded-xl p-3.5 space-y-2 text-xs">
                      <div>
                        <span className="text-[9px] font-bold uppercase tracking-wider text-gray-450 block mb-0.5">Room Slot Range</span>
                        <span className="font-bold text-gray-850 dark:text-gray-100 text-sm">{selectedSlot.RoomNumber}</span>
                      </div>
                      
                      <div className="pt-2 border-t border-gray-150 dark:border-gray-800/80 flex items-center justify-between text-[10px]">
                        <span>Status:</span>
                        {isSelectedUserSlot ? (
                          <span className="font-bold text-sky-400 uppercase">Your Laundry Slot</span>
                        ) : selectedDay === today ? (
                          <span className="font-bold text-emerald-450 uppercase">Active Today</span>
                        ) : (
                          <span className="font-semibold text-gray-450 uppercase">Other Room Slot</span>
                        )}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="bg-gray-500/5 border border-gray-500/10 p-4 rounded-xl text-center text-xs text-gray-455 italic">
                    No active laundry slots scheduled for this date.
                  </div>
                )}
              </div>
            ) : (
              <p className="text-xs text-gray-455 italic">Click on any date in the calendar grid to inspect slots.</p>
            )}
          </div>

          <div className="flex items-start gap-2 text-[10px] text-gray-405 border-t border-gray-150 dark:border-gray-800/80 pt-3 mt-4">
            <Info size={12} className="text-sky-400 shrink-0 mt-0.5" />
            <span>Select the date matching your room range, take your bag to the laundry drop counter before 5:00 PM.</span>
          </div>
        </div>

      </div>
    </div>
  );
}
