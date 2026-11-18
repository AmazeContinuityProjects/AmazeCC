"use client";

import { Compass, Layers, LayoutDashboard, Sparkles } from "lucide-react";
import ExperienceModePickerModal, {
  type ExperienceModeOption,
} from "../../../../shared/primitives/ExperienceModePickerModal";

export type LayoutMode = "guided" | "modern" | "classic";

export interface FFCSLayoutModeModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentMode: LayoutMode;
  onSelectMode: (mode: LayoutMode, remember: boolean) => void;
}

const MODE_OPTIONS: readonly ExperienceModeOption<LayoutMode>[] = [
  {
    value: "guided",
    title: "Guided Hero Mode",
    description: "Step-by-step course building with live clash checks, faculty reviews, and focused mobile controls.",
    badge: "Mobile First",
    Icon: Compass,
    iconClass: "bg-indigo-500/10 text-indigo-500 border-indigo-500/20",
    selectedClass: "bg-indigo-500/5",
    activeColor: "bg-indigo-600 hover:bg-indigo-500",
  },
  {
    value: "modern",
    title: "Standard Single Page View",
    description: "The all-in-one planner with course search, timetable controls, and the interactive weekly grid.",
    badge: "All-in-One",
    Icon: LayoutDashboard,
    iconClass: "bg-blue-500/10 text-blue-500 border-blue-500/20",
    selectedClass: "bg-blue-500/5",
    activeColor: "bg-blue-600 hover:bg-blue-500",
  },
  {
    value: "classic",
    title: "Classic View",
    description:
      "The original two-panel dashboard with timetable management, course selection, social score, and exports.",
    badge: "Classic",
    Icon: Layers,
    iconClass: "bg-amber-500/10 text-amber-600 border-amber-500/20",
    selectedClass: "bg-amber-500/5",
    activeColor: "bg-amber-600 hover:bg-amber-500",
  },
];

export default function FFCSLayoutModeModal({ isOpen, onClose, currentMode, onSelectMode }: FFCSLayoutModeModalProps) {
  return (
    <ExperienceModePickerModal<LayoutMode>
      isOpen={isOpen}
      onClose={onClose}
      title="Choose Your Planner Experience"
      subtitle="Pick the workflow that best fits your screen and planning style. You can change this anytime."
      headerIcon={Sparkles}
      options={MODE_OPTIONS}
      currentMode={currentMode}
      onSelectMode={onSelectMode}
      overlayId="ffcs-layout-mode-modal"
      applyLabel={(mode) =>
        mode === "guided"
          ? "Switch to Guided Hero Mode"
          : mode === "modern"
            ? "Switch to Standard View"
            : "Switch to Classic View"
      }
    />
  );
}
