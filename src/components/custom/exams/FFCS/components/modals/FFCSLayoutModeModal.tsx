"use client";

import React, { useState } from "react";
import { Compass, LayoutDashboard, Check, Sparkles } from "lucide-react";
import BottomSheet from "../../../../shared/BottomSheet";

export interface FFCSLayoutModeModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentMode: "guided" | "modern";
  onSelectMode: (mode: "guided" | "modern", remember: boolean) => void;
}

export default function FFCSLayoutModeModal({
  isOpen,
  onClose,
  currentMode,
  onSelectMode,
}: FFCSLayoutModeModalProps) {
  const [selected, setSelected] = useState<"guided" | "modern">(currentMode);
  const [remember, setRemember] = useState(true);

  if (!isOpen) return null;

  const handleApply = () => {
    onSelectMode(selected, remember);
    onClose();
  };

  return (
    <BottomSheet
      onClose={onClose}
      overlayId="ffcs-layout-mode-modal"
      maxWidth="max-w-xl"
      panelZIndex={350}
      backdropZIndex={345}
      contentClassName="space-y-5"
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3 border-b border-border-strong/60 pb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-500 flex items-center justify-center shrink-0 shadow-xs">
            <Sparkles className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <h2 className="text-lg font-black text-text-heading tracking-tight leading-tight">
              Choose Your Planner Experience
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
              Select between Guided Hero Mode and the Standard Single Page View. You can switch between them anytime.
            </p>
          </div>
        </div>
      </div>

      {/* Mode Choices */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
        {/* Guided Hero Mode */}
        <button
          type="button"
          onClick={() => setSelected("guided")}
          className={`relative p-4 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between gap-3 group ${
            selected === "guided"
              ? "bg-indigo-500/10 border-indigo-500/50 shadow-sm ring-1 ring-indigo-500/30"
              : "bg-surface hover:bg-surface-secondary/60 border-border-strong/70 hover:border-border-strong"
          }`}
        >
          <div>
            <div className="flex items-center justify-between mb-2.5">
              <div className="w-9 h-9 rounded-xl bg-indigo-500/15 border border-indigo-500/25 text-indigo-500 flex items-center justify-center shrink-0">
                <Compass className="w-4 h-4" />
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 border border-indigo-500/25">
                  Mobile First
                </span>
                <div
                  className={`w-5 h-5 rounded-full flex items-center justify-center border transition-colors ${
                    selected === "guided"
                      ? "bg-indigo-600 border-indigo-600 text-white"
                      : "border-border-strong text-transparent"
                  }`}
                >
                  <Check className="w-3 h-3 stroke-[3]" />
                </div>
              </div>
            </div>

            <h3 className="font-bold text-sm text-text-heading mb-1 flex items-center gap-1.5">
              Guided Hero Mode
            </h3>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Step-by-step course builder with live clash validation, professor ratings, and clean full-screen focus.
            </p>
          </div>

          <div className="pt-2.5 border-t border-border-strong/40 flex flex-col gap-1 text-[11px] text-muted-foreground font-medium">
            <span className="flex items-center gap-1.5 text-text-heading/80">
              <span className="text-indigo-500 font-bold">✓</span> Guided step-by-step wizard
            </span>
            <span className="flex items-center gap-1.5 text-text-heading/80">
              <span className="text-indigo-500 font-bold">✓</span> Distraction-free hero cards
            </span>
            <span className="flex items-center gap-1.5 text-text-heading/80">
              <span className="text-indigo-500 font-bold">✓</span> Quick professor review lookups
            </span>
          </div>
        </button>

        {/* Standard Single Page View */}
        <button
          type="button"
          onClick={() => setSelected("modern")}
          className={`relative p-4 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between gap-3 group ${
            selected === "modern"
              ? "bg-blue-500/10 border-blue-500/50 shadow-sm ring-1 ring-blue-500/30"
              : "bg-surface hover:bg-surface-secondary/60 border-border-strong/70 hover:border-border-strong"
          }`}
        >
          <div>
            <div className="flex items-center justify-between mb-2.5">
              <div className="w-9 h-9 rounded-xl bg-blue-500/15 border border-blue-500/25 text-blue-500 flex items-center justify-center shrink-0">
                <LayoutDashboard className="w-4 h-4" />
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-blue-500/15 text-blue-600 dark:text-blue-400 border border-blue-500/25">
                  All-in-One
                </span>
                <div
                  className={`w-5 h-5 rounded-full flex items-center justify-center border transition-colors ${
                    selected === "modern"
                      ? "bg-blue-600 border-blue-600 text-white"
                      : "border-border-strong text-transparent"
                  }`}
                >
                  <Check className="w-3 h-3 stroke-[3]" />
                </div>
              </div>
            </div>

            <h3 className="font-bold text-sm text-text-heading mb-1 flex items-center gap-1.5">
              Standard Single Page View
            </h3>
            <p className="text-xs text-muted-foreground leading-relaxed">
              All-in-one planner dashboard with the full interactive weekly timetable grid, course search, and stats side-by-side.
            </p>
          </div>

          <div className="pt-2.5 border-t border-border-strong/40 flex flex-col gap-1 text-[11px] text-muted-foreground font-medium">
            <span className="flex items-center gap-1.5 text-text-heading/80">
              <span className="text-blue-500 font-bold">✓</span> Full weekly grid & heatmap
            </span>
            <span className="flex items-center gap-1.5 text-text-heading/80">
              <span className="text-blue-500 font-bold">✓</span> Side-by-side course & slot picker
            </span>
            <span className="flex items-center gap-1.5 text-text-heading/80">
              <span className="text-blue-500 font-bold">✓</span> Interactive slot cell blocking
            </span>
          </div>
        </button>
      </div>

      {/* Preferences & Actions */}
      <div className="pt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-t border-border-strong/50">
        <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer select-none">
          <input
            type="checkbox"
            checked={remember}
            onChange={(e) => setRemember(e.target.checked)}
            className="w-4 h-4 rounded border-border-strong text-indigo-600 focus:ring-indigo-500/30 cursor-pointer"
          />
          <span>Remember my preference for future visits</span>
        </label>

        <div className="flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-3.5 py-2 rounded-xl text-xs font-semibold text-muted-foreground hover:text-text-heading hover:bg-surface-secondary/80 border border-border-strong/60 transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleApply}
            className={`px-4 py-2 rounded-xl text-xs font-bold text-white transition-all shadow-sm cursor-pointer ${
              selected === "guided"
                ? "bg-indigo-600 hover:bg-indigo-500"
                : "bg-blue-600 hover:bg-blue-500"
            }`}
          >
            Switch to {selected === "guided" ? "Guided Hero Mode" : "Standard View"}
          </button>
        </div>
      </div>
    </BottomSheet>
  );
}
