"use client";

import { useEffect, useState } from "react";
import {
  BedDouble,
  ChevronRight,
  CreditCard,
  ExternalLink,
  Footprints,
  Shirt,
  UtensilsCrossed,
} from "lucide-react";
import TabHelpFooter from "../shared/TabHelpFooter";

interface HostelOverviewProps {
  hostelData: any;
  setHostelActiveSubTab: (tab: string) => void;
}

export default function HostelOverview({ hostelData, setHostelActiveSubTab }: HostelOverviewProps) {
  const [activeMeal, setActiveMeal] = useState({ name: "Breakfast", icon: "🍳", time: "7:30 AM - 9:00 AM" });
  const [menuItems, setMenuItems] = useState<string>("");
  const [nextMealCountdown, setNextMealCountdown] = useState<string>("");

  const getActiveMealDetails = () => {
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
      return { name: "Breakfast", icon: "🍳", time: "7:30 AM - 9:00 AM" };
    } else if (totalMinutes < 840) {
      const diff = 840 - totalMinutes;
      setNextMealCountdown(`Lunch ends in ${Math.floor(diff / 60)}h ${diff % 60}m`);
      return { name: "Lunch", icon: "🍲", time: "12:30 PM - 2:00 PM" };
    } else if (totalMinutes < 1050) {
      const diff = 1050 - totalMinutes;
      setNextMealCountdown(`Snacks ends in ${Math.floor(diff / 60)}h ${diff % 60}m`);
      return { name: "Snacks", icon: "☕", time: "4:30 PM - 5:30 PM" };
    } else if (totalMinutes < 1260) {
      const diff = 1260 - totalMinutes;
      setNextMealCountdown(`Dinner ends in ${Math.floor(diff / 60)}h ${diff % 60}m`);
      return { name: "Dinner", icon: "🍽️", time: "7:30 PM - 9:00 PM" };
    } else {
      setNextMealCountdown("Kitchen is closed. Reopens at 7:30 AM");
      return { name: "Breakfast", icon: "🍳", time: "Tomorrow 7:30 AM" };
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
      const cached = localStorage.getItem(fileName);
      if (cached) {
        const parsed = JSON.parse(cached);
        const weekday = new Date().toLocaleDateString("en-US", { weekday: "long" });
        const todayMenu = parsed.list?.find((day: any) => day.Day === weekday);
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

  const mealOpen = !nextMealCountdown.startsWith("Kitchen is closed");
  const mealEnd = activeMeal.time.split(" - ")[1] || activeMeal.time;
  const title = (v: string) =>
    v && v !== "N/A" ? v.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase()) : "";

  const rows: { icon: any; title: string; sub: string; tone?: "warn" | "ok"; tab: string }[] = [
    {
      icon: UtensilsCrossed,
      title: "Mess menu",
      sub: `Week menu${messType !== "N/A" ? ` · ${title(messType)}` : ""}`,
      tab: "mess",
    },
    { icon: Shirt, title: "Laundry", sub: "Your weekly washing slots", tab: "laundry" },
    {
      icon: Footprints,
      title: "Leave and outing",
      sub: activeLeave
        ? `${activeLeave.status || "Approved"} · ${activeLeave.from} to ${activeLeave.to}`
        : "Apply, or see request status",
      tone: activeLeave ? "warn" : undefined,
      tab: "leave",
    },
    { icon: BedDouble, title: "Room selection", sub: "Counselling, groups and allocation", tab: "counselling" },
    { icon: CreditCard, title: "Hostel payments", sub: "Fees and receipts", tab: "payment" },
  ];

  return (
    <div className="mx-auto w-full max-w-2xl space-y-5 text-left">
      <div className="px-1">
        <h1 className="text-[24px] font-semibold tracking-tight text-ink">Hostel</h1>
        <p className="mt-0.5 text-[13.5px] text-muted">
          {[title(block), room !== "N/A" ? `Room ${room}` : ""].filter(Boolean).join(" · ") || "Your residence"}
        </p>
      </div>

      <button
        type="button"
        onClick={() => setHostelActiveSubTab("mess")}
        className="flex w-full items-start justify-between gap-3 rounded-md border border-line bg-surface px-4 py-3.5 text-left transition-colors duration-[120ms] hover:bg-surface-2"
      >
        <span className="min-w-0">
          <span className="block text-[15px] text-ink">
            {mealOpen ? `${activeMeal.name} until ${mealEnd}` : `Next: ${activeMeal.name}, ${activeMeal.time}`}
          </span>
          <span className="mt-0.5 block text-[13px] text-muted line-clamp-2">
            {menuItems ? menuItems.replace(/\s*\n\s*/g, ", ") : "Open the week menu to load today's dishes."}
          </span>
        </span>
        <span
          className={`shrink-0 rounded-full px-2.5 py-0.5 text-[12px] font-medium ${
            mealOpen ? "bg-ok-soft text-ok" : "bg-surface-2 text-muted"
          }`}
        >
          {mealOpen ? "Open" : "Closed"}
        </span>
      </button>

      <ul className="divide-y divide-line-2 overflow-hidden rounded-md border border-line bg-surface">
        {rows.map(({ icon: Icon, title: t, sub, tone, tab }) => (
          <li key={tab}>
            <button
              type="button"
              onClick={() => setHostelActiveSubTab(tab)}
              className="grid min-h-14 w-full grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 px-3.5 py-3 text-left transition-colors duration-[120ms] hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent"
            >
              <Icon aria-hidden="true" className="h-[18px] w-[18px] text-ink-2" strokeWidth={1.7} />
              <span className="min-w-0">
                <span className="block truncate text-[14.5px] text-ink">{t}</span>
                <span className={`block truncate text-[12.5px] ${tone === "warn" ? "text-warn" : "text-muted"}`}>{sub}</span>
              </span>
              <ChevronRight aria-hidden="true" className="h-4 w-4 text-muted" />
            </button>
          </li>
        ))}
      </ul>

      <section aria-label="Contacts">
        <h2 className="px-1 pb-1.5 text-[13.5px] font-semibold text-ink">Contacts</h2>
        <ul className="divide-y divide-line-2 overflow-hidden rounded-md border border-line bg-surface text-[14px]">
          {[
            { label: "Hostel office", tel: "+914439931555", shown: "+91 44 3993 1555" },
            { label: "Warden office", tel: "+914439931666", shown: "+91 44 3993 1666" },
            { label: "Medical and ambulance", tel: "+914439931108", shown: "+91 44 3993 1108", urgent: true },
          ].map((c) => (
            <li key={c.tel} className="flex min-h-12 items-center justify-between gap-3 px-3.5 py-2.5">
              <span className="text-ink-2">{c.label}</span>
              <a href={`tel:${c.tel}`} className={`font-mono text-[13px] hover:underline ${c.urgent ? "text-danger" : "text-accent"}`}>
                {c.shown}
              </a>
            </li>
          ))}
          <li className="flex min-h-12 items-center justify-between gap-3 px-3.5 py-2.5">
            <span className="text-ink-2">VTOP</span>
            <a
              href="https://vtopcc.vit.ac.in/"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-[13px] text-accent hover:underline"
            >
              Open <ExternalLink size={12} />
            </a>
          </li>
        </ul>
      </section>

      <TabHelpFooter tabId="hostel" />
    </div>
  );
}
