"use client";

import { useEffect, useState } from "react";
import { getTypedStorageItem } from "@/lib/storage";
import { ArrowRight, Info, ExternalLink, CheckCircle2, Sun, Utensils, Coffee, Moon, Shirt, Users } from "lucide-react";
import { Button } from "@amazecontinuityprojects/amazeui";
import TabHelpFooter from "../shared/TabHelpFooter";
import {
  FOCUS_RING,
  ICON_WELL,
  MICRO_LABEL,
  PRIMARY_BUTTON,
  TEXT_CAPTION,
  TEXT_BLOCK,
  TILE_CARD,
  TONE_ICON_TILE,
} from "@/lib/uiTokens";
import { HOSTEL_CONTACTS, HOSTEL_CONTACT_CAVEAT, VTOP_HOSTEL_URL } from "./hostelContactData";

interface HostelOverviewProps {
  hostelData: any;
  setHostelActiveSubTab: (tab: string) => void;
}

type Meal = { name: string; Icon: typeof Sun; time: string };

export default function HostelOverview({ hostelData, setHostelActiveSubTab }: HostelOverviewProps) {
  const [activeMeal, setActiveMeal] = useState<Meal>({ name: "Breakfast", Icon: Sun, time: "7:30 AM - 9:00 AM" });
  const [menuItems, setMenuItems] = useState<string>("");
  const [nextMealCountdown, setNextMealCountdown] = useState<string>("");

  const getActiveMealDetails = (): Meal => {
    const now = new Date();
    const hour = now.getHours();
    const minute = now.getMinutes();
    const totalMinutes = hour * 60 + minute;

    // Breakfast: 7:30 AM (450) - 9:00 AM (540)
    // Lunch: 12:30 PM (750) - 2:00 PM (840)
    // Snacks: 4:30 PM (990) - 5:30 PM (1050)
    // Dinner: 7:30 PM (1170) - 9:00 PM (1260)

    if (totalMinutes < 540) {
      const diff = 540 - totalMinutes;
      setNextMealCountdown(`Breakfast ends in ${Math.floor(diff / 60)}h ${diff % 60}m`);
      return { name: "Breakfast", Icon: Sun, time: "7:30 AM - 9:00 AM" };
    } else if (totalMinutes < 840) {
      const diff = 840 - totalMinutes;
      setNextMealCountdown(`Lunch ends in ${Math.floor(diff / 60)}h ${diff % 60}m`);
      return { name: "Lunch", Icon: Utensils, time: "12:30 PM - 2:00 PM" };
    } else if (totalMinutes < 1050) {
      const diff = 1050 - totalMinutes;
      setNextMealCountdown(`Snacks ends in ${Math.floor(diff / 60)}h ${diff % 60}m`);
      return { name: "Snacks", Icon: Coffee, time: "4:30 PM - 5:30 PM" };
    } else if (totalMinutes < 1260) {
      const diff = 1260 - totalMinutes;
      setNextMealCountdown(`Dinner ends in ${Math.floor(diff / 60)}h ${diff % 60}m`);
      return { name: "Dinner", Icon: Moon, time: "7:30 PM - 9:00 PM" };
    } else {
      setNextMealCountdown("Kitchen is closed. Reopens at 7:30 AM");
      return { name: "Breakfast", Icon: Sun, time: "Tomorrow 7:30 AM" };
    }
  };

  useEffect(() => {
    const meal = getActiveMealDetails();
    setActiveMeal(meal);

    try {
      const isFemale = hostelData.hostelInfo?.gender?.toLowerCase() === "female";
      const genderLetter = isFemale ? "W" : "M";
      const rawType = hostelData.hostelInfo?.messInfo?.toUpperCase() || "VEG";
      const typeLetter = rawType.includes("NON") ? "N" : rawType.includes("SPECIAL") ? "S" : "V";

      const fileName = `VITC-${genderLetter}-${typeLetter}.json`;
      const cached = getTypedStorageItem(fileName) as { list?: any[] } | null;
      if (cached?.list) {
        const weekday = new Date().toLocaleDateString("en-US", { weekday: "long" });
        const todayMenu = cached.list.find((day: any) => day.Day === weekday);
        if (todayMenu) {
          setMenuItems(todayMenu[meal.name] || "");
        }
      }
    } catch (e) {
      console.warn("Failed to load cached mess data:", e);
    }
  }, [hostelData]);

  // Extract hostel profile info
  const info = hostelData?.hostelInfo || {};
  const block = info.blockName || "N/A";
  const room = info.roomNo || "N/A";
  const messType = info.messInfo || "N/A";

  // Parse active leaves
  const leaveHistory = hostelData?.leaveHistory || [];
  const parseDate = (dateStr: string) => {
    const parts = dateStr.split(/[-/ ]/);
    if (parts.length === 3) {
      const [day, monthStr, year] = parts;
      const month = new Date(`${monthStr} 1, 2000`).getMonth();
      return new Date(Number(year), month, parseInt(day));
    }
    return new Date(dateStr);
  };
  const now = new Date();
  const activeLeaves = leaveHistory.filter((leave: any) => {
    const from = parseDate(leave.from);
    const to = parseDate(leave.to);
    const daysSinceEnd = (now.getTime() - to.getTime()) / (1000 * 60 * 60 * 24);
    return (from <= now && now <= to) || from > now || (daysSinceEnd > 0 && daysSinceEnd <= 3);
  });
  const activeLeave = activeLeaves[0];

  const MealIcon = activeMeal.Icon;

  return (
    <div className="space-y-6">
      {/* Title Header */}
      <div>
        <h1 className="text-xl md:text-3xl font-black font-outfit tracking-tight text-text-heading">Hostel Hub</h1>
        <p className={`${TEXT_CAPTION} font-medium mt-1`}>
          Manage your residential status, laundry schedules, leave details, and dining.
        </p>
      </div>

      {/* Grid Dashboard layout — these cards are the contextual open links into
          each hostel section, so a separate tab strip is unnecessary. */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Card: Today's Mess */}
        <div className={`${TILE_CARD} flex flex-col justify-between hover:border-indigo-500/40 transition-all`}>
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <span className={MICRO_LABEL}>Mess Dining</span>
              <span className="tabular-nums text-text-muted font-semibold text-xs">{activeMeal.time}</span>
            </div>
            <div className="flex items-center gap-3">
              <span className={`${ICON_WELL} ${TONE_ICON_TILE.amber}`}>
                <MealIcon size={20} />
              </span>
              <div className={TEXT_BLOCK}>
                <h3 className="text-sm font-bold text-text-heading">Current Meal: {activeMeal.name}</h3>
                <p className="tabular-nums text-text-muted text-xs mt-0.5">{nextMealCountdown}</p>
              </div>
            </div>
            <div className="bg-surface-secondary border border-border-muted rounded-2xl p-3 text-xs max-h-24 overflow-y-auto">
              {menuItems ? (
                <p className="text-pretty whitespace-pre-line text-text-secondary font-medium leading-relaxed">
                  {menuItems}
                </p>
              ) : (
                <p className="text-text-muted italic">
                  No menu cached. Tap view full menu to load it from the remote database.
                </p>
              )}
            </div>
          </div>
          <Button
            onClick={() => setHostelActiveSubTab("mess")}
            className={`w-full ${PRIMARY_BUTTON} text-xs mt-4 justify-center h-9`}
          >
            <span>View Full Menu</span>
            <ArrowRight size={14} />
          </Button>
        </div>

        {/* Card: Laundry */}
        <div className={`${TILE_CARD} flex flex-col justify-between hover:border-indigo-500/40 transition-all`}>
          <div className="space-y-3">
            <span className={`${MICRO_LABEL} block`}>Laundry Schedule</span>
            <div className="flex items-center gap-3">
              <span className={`${ICON_WELL} ${TONE_ICON_TILE.sky}`}>
                <Shirt size={20} />
              </span>
              <div className={TEXT_BLOCK}>
                <h3 className="text-sm font-bold text-text-heading">Weekly Slots</h3>
                <p className="text-text-muted text-xs mt-0.5">Check when laundry is available for your room range</p>
              </div>
            </div>

            <div className="bg-surface-secondary border border-border-muted rounded-2xl p-3 text-xs space-y-2">
              <div className="flex justify-between items-center gap-2 text-text-secondary">
                <span>Active Slot today:</span>
                <span className="font-semibold text-sky-600 dark:text-sky-400">Available</span>
              </div>
              <div className="text-text-muted leading-relaxed">
                Matches current calendar dates. Standard slots allocate up to two washings per week.
              </div>
            </div>
          </div>
          <Button
            onClick={() => setHostelActiveSubTab("laundry")}
            className={`w-full ${PRIMARY_BUTTON} text-xs mt-4 justify-center h-9`}
          >
            <span>Check Schedule</span>
            <ArrowRight size={14} />
          </Button>
        </div>

        {/* Card: Leave Management */}
        <div className={`${TILE_CARD} flex flex-col justify-between hover:border-indigo-500/40 transition-all`}>
          <div className="space-y-3">
            <span className={`${MICRO_LABEL} block`}>Leaves &amp; Outings</span>

            {activeLeave ? (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <CheckCircle2 size={16} className="text-emerald-500 shrink-0" />
                  <span className="text-xs font-semibold text-text-primary truncate">Leave Request Found</span>
                </div>
                <div className="bg-surface-secondary border border-border-muted rounded-2xl p-3 text-xs text-text-secondary space-y-1">
                  <div className="truncate">
                    <strong>From:</strong> {activeLeave.from}
                  </div>
                  <div className="truncate">
                    <strong>To:</strong> {activeLeave.to}
                  </div>
                  <div className="truncate">
                    <strong>Place:</strong> {activeLeave.visitPlace}
                  </div>
                  <div className="mt-1 pt-1.5 border-t border-border-muted flex items-center justify-between text-xs">
                    <span>Status:</span>
                    <span className="font-semibold text-emerald-600 dark:text-emerald-400 uppercase">
                      {activeLeave.status || "Approved"}
                    </span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Info size={16} className="text-text-muted shrink-0" />
                  <span className="text-xs font-semibold text-text-primary">No Active Leave</span>
                </div>
                <p className="text-pretty text-text-muted leading-relaxed">
                  You do not currently have any active outings or leaves. Ensure to file on time via VTOP.
                </p>
              </div>
            )}
          </div>
          <Button
            onClick={() => setHostelActiveSubTab("leave")}
            className={`w-full ${PRIMARY_BUTTON} text-xs mt-4 justify-center h-9`}
          >
            <span>Manage Leaves</span>
            <ArrowRight size={14} />
          </Button>
        </div>

        {/* Card: Room Selection & Counselling */}
        <div className={`${TILE_CARD} flex flex-col justify-between hover:border-indigo-500/40 transition-all`}>
          <div className="space-y-3">
            <span className={`${MICRO_LABEL} block`}>Room selection &amp; counselling</span>
            <div className="flex items-center gap-3">
              <span className={`${ICON_WELL} ${TONE_ICON_TILE.violet}`}>
                <Users size={20} />
              </span>
              <div className={TEXT_BLOCK}>
                <h3 className="text-sm font-bold text-text-heading">Booking Status</h3>
                <p className="text-text-muted text-xs mt-0.5">Check group requests and allocation status</p>
              </div>
            </div>

            <div className="bg-surface-secondary border border-border-muted rounded-2xl p-3 text-xs space-y-1.5">
              <p className="text-text-secondary font-semibold">Room Allocation:</p>
              <p className="text-text-muted italic">
                Open the counselling status view to verify your Leader OTP. You can return here any time.
              </p>
            </div>
          </div>
          <Button
            onClick={() => setHostelActiveSubTab("counselling")}
            className={`w-full ${PRIMARY_BUTTON} text-xs mt-4 justify-center h-9`}
          >
            <span>View Booking Status</span>
            <ArrowRight size={14} />
          </Button>
        </div>

        {/* Card: Hostel Information */}
        <div className={`${TILE_CARD} md:col-span-2`}>
          <div className="space-y-4">
            <span className={`${MICRO_LABEL} block`}>Hostel Room Information</span>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
              <div>
                <span className={`${MICRO_LABEL} block mb-0.5`}>Hostel Block</span>
                <span className="tabular-nums font-bold text-text-primary">{block}</span>
              </div>
              <div>
                <span className={`${MICRO_LABEL} block mb-0.5`}>Room Number</span>
                <span className="tabular-nums font-bold text-text-primary">{room}</span>
              </div>
              <div>
                <span className={`${MICRO_LABEL} block mb-0.5`}>Mess Selection</span>
                <span className="font-bold text-text-primary capitalize">{messType} Mess</span>
              </div>
              <div>
                <span className={`${MICRO_LABEL} block mb-0.5`}>Chief Warden</span>
                <span className="font-bold text-text-primary">{HOSTEL_CONTACTS.chiefWarden}</span>
              </div>
            </div>
            <p className="text-xs text-text-muted">{HOSTEL_CONTACT_CAVEAT}</p>

            <div className="h-px bg-border-muted" />

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <p className={`${MICRO_LABEL} mb-2`}>Emergency Contacts</p>
                <div className="space-y-1.5 text-xs text-text-secondary">
                  {[
                    HOSTEL_CONTACTS.phones.hostelOffice,
                    HOSTEL_CONTACTS.phones.wardenOffice,
                    HOSTEL_CONTACTS.phones.medical,
                  ].map((c) => (
                    <div key={c.label} className="flex items-center justify-between gap-2">
                      <span>{c.label}:</span>
                      <a
                        href={`tel:${c.tel}`}
                        className={`font-semibold ${FOCUS_RING} rounded ${
                          c.label.includes("Medical") ? "text-rose-500" : "text-sky-600 dark:text-sky-400"
                        } hover:underline`}
                      >
                        {c.display}
                      </a>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <p className={`${MICRO_LABEL} mb-2`}>Useful Links</p>
                <div className="space-y-1 text-xs text-text-secondary">
                  <a
                    href={VTOP_HOSTEL_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`flex items-center justify-between hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors ${FOCUS_RING} rounded`}
                  >
                    <span>VTOP Portal</span>
                    <ExternalLink size={11} className="text-text-muted" />
                  </a>
                  <a
                    href={VTOP_HOSTEL_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`flex items-center justify-between hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors ${FOCUS_RING} rounded`}
                  >
                    <span>Mess Change Request Form (on VTOP)</span>
                    <ExternalLink size={11} className="text-text-muted" />
                  </a>
                  <a
                    href={VTOP_HOSTEL_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`flex items-center justify-between hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors ${FOCUS_RING} rounded`}
                  >
                    <span>Hostel Grievance Register (on VTOP)</span>
                    <ExternalLink size={11} className="text-text-muted" />
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Tab Help Footer */}
      <TabHelpFooter tabId="hostel" />
    </div>
  );
}
