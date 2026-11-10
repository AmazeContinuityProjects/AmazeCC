"use client";

import { Wand2, Users, CalendarDays } from "lucide-react";

/** Extracted from FFCSGuidedSelector's `renderMobilePreflightCard`; markup unchanged. */
export interface MobilePreflightCardProps {}

export default function MobilePreflightCard({}: MobilePreflightCardProps) {
  return (
    <div
      data-testid="mobile-preflight-screen"
      className="w-full max-w-md mx-auto flex-1 flex flex-col justify-center gap-4 my-auto animate-in fade-in duration-200"
    >
      {/* Top category label */}
      <div className="space-y-1.5 text-center sm:text-left">
        <div className="mb-1">
          <span className="text-[10px] font-black uppercase tracking-wider text-indigo-400 font-outfit">
            Mobile First · Timetable Studio
          </span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight font-outfit">
          Mobile-First Timetable Builder
        </h1>
        <p className="text-xs text-zinc-400 leading-relaxed font-medium">
          Step-by-step mobile timetable designer with live clash checking, faculty ratings, and fast multi-timetable
          switching.
        </p>
      </div>

      {/* Feature Highlight Cards */}
      <div className="grid grid-cols-1 gap-2.5">
        <div className="flex items-center gap-3 p-3 rounded-2xl bg-zinc-900/80 border border-zinc-800 shadow-sm">
          <div className="w-8 h-8 rounded-xl bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center shrink-0">
            <Wand2 className="w-4 h-4 text-indigo-400" />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-bold text-zinc-200">Clash-Free Timetable Generator</p>
            <p className="text-[11px] text-zinc-400 truncate">Automatic ranking with preferred slots and timings</p>
          </div>
        </div>

        <div className="flex items-center gap-3 p-3 rounded-2xl bg-zinc-900/80 border border-zinc-800 shadow-sm">
          <div className="w-8 h-8 rounded-xl bg-purple-500/20 border border-purple-500/30 flex items-center justify-center shrink-0">
            <Users className="w-4 h-4 text-purple-400" />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-bold text-zinc-200">Faculty Ratings & Swapping</p>
            <p className="text-[11px] text-zinc-400 truncate">Compare faculty scores and swap slots seamlessly</p>
          </div>
        </div>

        <div className="flex items-center gap-3 p-3 rounded-2xl bg-zinc-900/80 border border-zinc-800 shadow-sm">
          <div className="w-8 h-8 rounded-xl bg-blue-500/20 border border-blue-500/30 flex items-center justify-center shrink-0">
            <CalendarDays className="w-4 h-4 text-blue-400" />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-bold text-zinc-200">Multi-Timetable Browser</p>
            <p className="text-[11px] text-zinc-400 truncate">Switch, create, and manage schedules side-by-side</p>
          </div>
        </div>
      </div>
    </div>
  );
}
