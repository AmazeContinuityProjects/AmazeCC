"use client";

import React, { useEffect, useState } from "react";
import { Check, Compass, Layers, LayoutDashboard, Sparkles } from "lucide-react";
import BottomSheet from "../../../../shared/BottomSheet";
import { ListRowText, ListShell } from "../../../../shared/primitives";

export interface FFCSLayoutModeModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentMode: "guided" | "modern" | "classic";
  onSelectMode: (mode: "guided" | "modern" | "classic", remember: boolean) => void;
}

const MODE_OPTIONS = [
  {
    value: "guided",
    title: "Guided Hero Mode",
    description: "Step-by-step course building with live clash checks, faculty reviews, and focused mobile controls.",
    badge: "Mobile First",
    Icon: Compass,
    iconClass: "bg-indigo-500/10 text-indigo-500 border-indigo-500/20",
    selectedClass: "bg-indigo-500/5",
  },
  {
    value: "modern",
    title: "Standard Single Page View",
    description: "The all-in-one planner with course search, timetable controls, and the interactive weekly grid.",
    badge: "All-in-One",
    Icon: LayoutDashboard,
    iconClass: "bg-blue-500/10 text-blue-500 border-blue-500/20",
    selectedClass: "bg-blue-500/5",
  },
  {
    value: "classic",
    title: "Classic View",
    description: "The original two-panel dashboard with timetable management, course selection, social score, and exports.",
    badge: "Classic",
    Icon: Layers,
    iconClass: "bg-amber-500/10 text-amber-600 border-amber-500/20",
    selectedClass: "bg-amber-500/5",
  },
] as const;

type LayoutMode = FFCSLayoutModeModalProps["currentMode"];

export default function FFCSLayoutModeModal({
  isOpen,
  onClose,
  currentMode,
  onSelectMode,
}: FFCSLayoutModeModalProps) {
  const [selected, setSelected] = useState<LayoutMode>(currentMode);
  const [remember, setRemember] = useState(true);

  useEffect(() => {
    if (isOpen) setSelected(currentMode);
  }, [isOpen, currentMode]);

  if (!isOpen) return null;

  const handleApply = () => {
    onSelectMode(selected, remember);
    onClose();
  };

  return (
    <BottomSheet
      onClose={onClose}
      overlayId="ffcs-layout-mode-modal"
      maxWidth="max-w-2xl"
      panelZIndex={350}
      backdropZIndex={345}
      contentClassName="space-y-5"
    >
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
              Choose a layout for the planner. You can switch anytime.
            </p>
          </div>
        </div>
      </div>

      <div role="radiogroup" aria-label="Planner layout">
        <ListShell>
          {MODE_OPTIONS.map((option) => {
            const isSelected = selected === option.value;
            return (
              <button
                key={option.value}
                type="button"
                role="radio"
                aria-checked={isSelected}
                onClick={() => setSelected(option.value)}
                className={`w-full flex items-center gap-3 p-3.5 sm:p-4 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-indigo-500 ${
                  isSelected ? option.selectedClass : "hover:bg-surface-secondary/60"
                }`}
              >
                <span className={`w-10 h-10 rounded-xl border flex items-center justify-center shrink-0 ${option.iconClass}`}>
                  <option.Icon className="w-4 h-4" />
                </span>
                <ListRowText
                  title={option.title}
                  titleTag="span"
                  subtitle={option.description}
                />
                <span className="hidden sm:inline-flex text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-full bg-surface-secondary text-muted-foreground border border-border-strong/60 shrink-0">
                  {option.badge}
                </span>
                <span
                  aria-hidden="true"
                  className={`w-5 h-5 rounded-full flex items-center justify-center border shrink-0 transition-colors ${
                    isSelected
                      ? "bg-indigo-600 border-indigo-600 text-white"
                      : "border-border-strong text-transparent"
                  }`}
                >
                  <Check className="w-3 h-3 stroke-[3]" />
                </span>
              </button>
            );
          })}
        </ListShell>
      </div>

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
              selected === "modern" ? "bg-blue-600 hover:bg-blue-500" : "bg-indigo-600 hover:bg-indigo-500"
            }`}
          >
            Switch to {selected === "guided" ? "Guided Hero Mode" : selected === "modern" ? "Standard View" : "Classic View"}
          </button>
        </div>
      </div>
    </BottomSheet>
  );
}
