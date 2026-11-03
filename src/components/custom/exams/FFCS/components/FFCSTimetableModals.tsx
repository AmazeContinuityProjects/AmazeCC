"use client";

/**
 * The FFCSTimetableTab's two always-mounted surfaces: the settings sheet
 * hosted inside the tour context (so "Replay" can restart a tour) and the
 * keyboard-shortcuts sheet the tab keeps mounted so its exit animation can run.
 * Extracted verbatim from FFCSTimetableTab.
 */

import dynamic from "next/dynamic";
import { AnimatePresence } from "framer-motion";
import { Keyboard } from "lucide-react";
import BottomSheet from "../../../shared/BottomSheet";
import type { FFCSSettingsModalProps } from "./modals/FFCSSettingsModal";
import { useTour } from "../features/tour/TourProvider";

const FFCSSettingsModal = dynamic(() => import("./modals/FFCSSettingsModal").then((m) => m.FFCSSettingsModal), {
  ssr: false,
});

/**
 * The settings sheet, bridged to the tour context. Only descendants of the
 * provider can call `useTour`, and the sheet needs it for exactly one thing:
 * "Replay", which restarts a tour the auto-offer has already forgotten about.
 */
type SettingsModalHostProps = Omit<FFCSSettingsModalProps, "onReplayTour">;

export function SettingsModalHost(props: SettingsModalHostProps) {
  const tour = useTour();
  return <FFCSSettingsModal {...props} onReplayTour={tour.start} />;
}

export function FFCSShortcutsModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const shortcuts = [
    { keys: ["S", "/"], desc: "Open Course Search Palette" },
    { keys: ["T"], desc: "Open Target Courses Modal" },
    { keys: ["G"], desc: "Open Auto-Generator Modal" },
    { keys: ["F"], desc: "Open Friends Manager" },
    { keys: ["N"], desc: "Create a New Timetable" },
    { keys: ["P"], desc: "Open Printable View / Print" },
    { keys: ["1", "-", "9"], desc: "Switch to Timetable 1 to 9" },
    { keys: ["Backspace", "Delete"], desc: "Clear Current Timetable" },
    { keys: ["Esc"], desc: "Close Active Modals" },
  ];

  /*
    A sheet like every other FFCS popup, and mounted unconditionally by the tab
    so the exit animation can run. The z pair matches what the modal used, both
    for parity with the surrounding FFCS surfaces and because the tab can be in
    fullscreen (z-100) behind it.
  */
  return (
    <AnimatePresence>
      {isOpen && (
        <BottomSheet
          onClose={onClose}
          overlayId="ffcs-shortcuts"
          maxWidth="max-w-md"
          panelZIndex={400}
          backdropZIndex={395}
          contentClassName="flex flex-col gap-3"
        >
          <h3 className="font-bold text-base text-text-heading flex items-center gap-2">
            <Keyboard className="w-5 h-5 text-indigo-500" /> Keyboard Shortcuts
          </h3>
          <p className="text-xs text-muted-foreground mb-2">
            Boost your timetable drafting speed with these global hotkeys:
          </p>
          <div className="divide-y divide-border/40">
            {shortcuts.map((shortcut, index) => (
              <div key={index} className="flex items-center justify-between py-2 text-xs">
                <span className="text-muted-foreground">{shortcut.desc}</span>
                <div className="flex items-center gap-1">
                  {shortcut.keys.map((k, kidx) => (
                    <kbd
                      key={kidx}
                      className="px-2 py-1 bg-surface-secondary border border-border-strong rounded-md font-mono text-[10px] font-bold text-text-heading shadow-xs"
                    >
                      {k}
                    </kbd>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <div className="pt-3 border-t border-border-strong text-right">
            <button
              onClick={onClose}
              className="px-4 py-2 bg-indigo-650 hover:bg-indigo-750 text-white text-xs font-bold rounded-xl transition-colors cursor-pointer"
            >
              Got it, thanks!
            </button>
          </div>
        </BottomSheet>
      )}
    </AnimatePresence>
  );
}
