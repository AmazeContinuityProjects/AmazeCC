"use client";

import React, { useState, useMemo } from "react";
import { AnimatePresence } from "framer-motion";
import { ClipboardPaste, CheckCircle2, AlertTriangle, Sparkles, BookOpen, Layers } from "lucide-react";
import BottomSheet from "../../../../shared/BottomSheet";
import type { AddedCourse, ParsedCourse } from "../../types";
import {
  isVtopRegistrationText,
  parseVtopRegistrationText,
  vtopRowsToAddedCourses,
  parsePastedText,
  toParsedCourses,
  parsedCoursesToAddedCourses,
  type VtopCourseRow,
} from "@/features/import/parsePastedText";
import { track } from "@/lib/analytics";

interface PasteRegisteredCoursesModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLoadCourses: (addedCourses: AddedCourse[], parsedCourses: ParsedCourse[], replaceExisting: boolean) => void;
}

export const PasteRegisteredCoursesModal: React.FC<PasteRegisteredCoursesModalProps> = ({
  isOpen,
  onClose,
  onLoadCourses,
}) => {
  const [text, setText] = useState("");
  const [replaceExisting, setReplaceExisting] = useState(true);

  const parsedData = useMemo(() => {
    if (!text.trim()) return null;

    if (isVtopRegistrationText(text)) {
      const vtopRows = parseVtopRegistrationText(text);
      if (vtopRows.length > 0) {
        const addedCourses = vtopRowsToAddedCourses(vtopRows);
        const parsedCourses: ParsedCourse[] = vtopRows.map((r) => ({
          CODE: r.code,
          TITLE: r.title,
          TYPE: r.type,
          CREDITS: r.credits,
          ROOM: r.venue,
          SLOT: r.slot,
          FACULTY: r.faculty,
          ERP_ID: r.employeeId,
          CLASS_ID: r.classId,
          BATCH: "",
        }));

        return {
          type: "vtop" as const,
          vtopRows,
          addedCourses,
          parsedCourses,
          totalCredits: addedCourses.reduce((sum, c) => sum + (parseFloat(c.credits) || 0), 0),
          uniqueCount: new Set(addedCourses.map((c) => c.code)).size,
        };
      }
    }

    // Fallback to standard line parser
    const options = parsePastedText(text);
    const parsedCourses = toParsedCourses(options);
    const addedCourses = parsedCoursesToAddedCourses(parsedCourses);

    return {
      type: "generic" as const,
      vtopRows: [] as VtopCourseRow[],
      addedCourses,
      parsedCourses,
      totalCredits: addedCourses.reduce((sum, c) => sum + (parseFloat(c.credits) || 0), 0),
      uniqueCount: new Set(addedCourses.map((c) => c.code)).size,
    };
  }, [text]);

  const canApply = Boolean(parsedData && parsedData.addedCourses.length > 0);

  const handleApply = () => {
    if (!parsedData || !canApply) return;
    track("ffcs_paste_registered_courses", {
      count: parsedData.addedCourses.length,
      mode: parsedData.type,
      replace: replaceExisting,
    });
    onLoadCourses(parsedData.addedCourses, parsedData.parsedCourses, replaceExisting);
    setText("");
    onClose();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <BottomSheet
          onClose={onClose}
          overlayId="ffcs-paste-registered-courses"
          maxWidth="max-w-2xl"
          panelZIndex={350}
          backdropZIndex={345}
          contentClassName="flex flex-col gap-4"
          title="Paste Registered Courses"
          subtitle="Paste copied text from VTOP (Registration or View/Modify page) to load your schedule directly."
          icon={<ClipboardPaste className="w-5 h-5" />}
          accent="bg-purple-500/10 border-purple-500/20 text-purple-500"
          closeLabel="Close paste modal"
        >
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <label htmlFor="vtop-paste-textarea" className="text-xs font-semibold text-text-heading flex items-center gap-1.5">
                <BookOpen className="w-3.5 h-3.5 text-purple-500" />
                <span>Paste Table or Text from VTOP</span>
              </label>
              {parsedData && parsedData.addedCourses.length > 0 && (
                <span className="text-xs font-medium text-emerald-500 flex items-center gap-1 bg-emerald-500/10 px-2.5 py-0.5 rounded-full border border-emerald-500/20">
                  <Sparkles className="w-3 h-3" />
                  {parsedData.addedCourses.length} offerings ({parsedData.uniqueCount} courses, {parsedData.totalCredits} credits)
                </span>
              )}
            </div>

            <textarea
              id="vtop-paste-textarea"
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={7}
              spellCheck={false}
              placeholder={`Paste your courses from VTOP here...\n\nExample:\nBACSE202 -Database Systems- Embedded Theory\n3.0 Concentration\nRegular CH2026270502880 - COE01\nAB4-305\nF1+TF1 VISWANATHAN V COE01\nRegistered and Approved Delete`}
              className="w-full bg-surface border border-border-strong rounded-xl p-3 text-xs font-mono text-text-heading resize-y focus:outline-none focus:border-purple-500/50 focus:ring-1 focus:ring-purple-500/50 transition-all custom-scrollbar placeholder:text-muted-foreground/60"
            />

            {/* Live Preview */}
            {parsedData && parsedData.addedCourses.length > 0 ? (
              <div className="flex flex-col gap-2 bg-surface-secondary/20 border border-border-strong rounded-xl p-3">
                <div className="flex items-center justify-between text-xs font-medium text-text-heading">
                  <span className="font-semibold flex items-center gap-1.5">
                    <Layers className="w-3.5 h-3.5 text-blue-500" /> Detected Courses Preview:
                  </span>
                  <span className="text-muted-foreground text-[11px]">
                    {parsedData.type === "vtop" ? "VTOP Registration Format detected" : "Standard text format"}
                  </span>
                </div>

                <div className="max-h-48 overflow-y-auto custom-scrollbar divide-y divide-border-strong/40 pr-1">
                  {parsedData.addedCourses.map((c, idx) => (
                    <div key={idx} className="py-1.5 flex items-center justify-between text-xs gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className={`px-2 py-0.5 rounded text-[11px] font-bold text-white shrink-0 ${c.color || "bg-blue-600"}`}>
                          {c.code}
                        </span>
                        <span className="truncate text-text-heading font-medium" title={c.title}>
                          {c.title}
                        </span>
                        <span className="text-[10px] uppercase font-bold text-muted-foreground bg-surface-secondary px-1.5 py-0.5 rounded shrink-0">
                          {c.type}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 shrink-0 text-muted-foreground text-[11px]">
                        <span className="font-mono font-semibold text-text-heading">{c.slots.join("+")}</span>
                        {c.venue && <span>{c.venue}</span>}
                        <span className="truncate max-w-[120px]" title={c.faculty}>{c.faculty}</span>
                        <span className="font-medium text-text-heading">{c.credits} cr</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : text.trim() ? (
              <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-amber-500 text-xs flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>Could not detect any valid course codes or slots. Please check the pasted text.</span>
              </div>
            ) : null}

            {/* Options */}
            <div className="flex items-center justify-between pt-2 border-t border-border-strong/40 text-xs">
              <label className="flex items-center gap-2 cursor-pointer select-none text-text-heading font-medium">
                <input
                  type="checkbox"
                  checked={replaceExisting}
                  onChange={(e) => setReplaceExisting(e.target.checked)}
                  className="rounded border-border-strong text-purple-600 focus:ring-purple-500 w-4 h-4 cursor-pointer"
                />
                <span>Replace courses in current timetable</span>
              </label>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-3 py-1.5 text-xs text-muted-foreground hover:text-text-heading transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleApply}
                  disabled={!canApply}
                  className="bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold px-4 py-2 rounded-xl transition-all flex items-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed shadow-sm"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  Load into Timetable
                </button>
              </div>
            </div>
          </div>
        </BottomSheet>
      )}
    </AnimatePresence>
  );
};

export default PasteRegisteredCoursesModal;
