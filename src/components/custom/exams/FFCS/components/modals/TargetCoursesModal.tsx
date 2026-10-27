import React, { useState } from "react";
import { AnimatePresence } from "framer-motion";
import { ClipboardPaste, FileSpreadsheet, Lock, Search, X } from "lucide-react";
import SearchInput from "../../../../shared/SearchInput";
import BottomSheet from "../../../../shared/BottomSheet";
import { CourseLock, ParsedCourse, AddedCourse } from "../../types";
import { SegmentedControl } from "@/components/custom/shared/primitives";
import { CourseImportPanel, type ImportMode } from "../CourseImportPanel";
import { TargetCourseLockCard } from "../TargetCourseLockCard";

interface TargetCoursesModalProps {
  isOpen: boolean;
  onClose: () => void;
  courseLocks: CourseLock[];
  setCourseLocks: React.Dispatch<React.SetStateAction<CourseLock[]>>;
  masterCourses: ParsedCourse[];
  uniqueCourseCodes: { code: string; title: string; types?: string[]; batches?: string[] }[];
  /** Adds rows to the master list. Owns merging; this modal does not mutate it. */
  onImportCourses: (courses: ParsedCourse[]) => void;
  /** Optional callback to also load imported courses directly into active timetable */
  onImportToTimetable?: (courses: AddedCourse[]) => void;
}

/**
 * The Course Selector.
 *
 * Search is where the modal starts, because most of the time the student is
 * picking from a catalogue already loaded for them. `Paste` and `File` are the
 * two ways to bring a catalogue that is not loaded — a friend's list, last
 * semester's export, a club handout — and both stop at a preview before
 * anything is added. The tabs switch the body rather than stacking, so the
 * selected-courses chips stay visible throughout: what you have already
 * picked is the thing you most need to see while deciding whether a pasted
 * list is the right one.
 */
export const TargetCoursesModal: React.FC<TargetCoursesModalProps> = ({
  isOpen,
  onClose,
  courseLocks,
  setCourseLocks,
  masterCourses,
  uniqueCourseCodes,
  onImportCourses,
  onImportToTimetable,
}) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [mode, setMode] = useState<ImportMode | "search">("search");

  /*
    The sheet owns the chrome now — grabber, one X, swipe-down, Escape and system
    back — so the header keeps only what the sheet cannot say: what this is. The
    z pair is passed through rather than left at the sheet default because the
    planner can be in fullscreen (z-100) behind this, and a sheet at the default
    z-60 would land underneath it.

    `contentClassName` carries the body's old `flex flex-col gap-4`, because the
    sheet's content wrapper is that div now: same padding, same scroll, same
    children at the same depth.
  */
  return (
    <AnimatePresence>
      {isOpen && (
        <BottomSheet
          onClose={onClose}
          overlayId="ffcs-target-courses"
          maxWidth="max-w-2xl"
          panelZIndex={300}
          backdropZIndex={295}
          contentClassName="flex flex-col gap-4"
          title="Target Courses"
          icon={<Lock className="w-5 h-5" />}
          accent="bg-purple-500/10 border-purple-500/20 text-purple-500"
          closeLabel="Close target courses"
        >
          <SegmentedControl<ImportMode | "search">
            grow
            value={mode}
            onChange={setMode}
            className="self-start"
            options={[
              { value: "search", label: "Search", icon: <Search className="w-3.5 h-3.5" /> },
              { value: "paste", label: "Paste", icon: <ClipboardPaste className="w-3.5 h-3.5" /> },
              { value: "file", label: "File", icon: <FileSpreadsheet className="w-3.5 h-3.5" /> },
            ]}
          />

          <p className="text-sm text-muted-foreground">
            Select the courses you intend to take. Both the manual planner and auto-generator will filter results based on your target courses.
          </p>

          {courseLocks.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {courseLocks.map(lock => (
                <div key={lock.code} className="bg-purple-500/10 border border-purple-500/30 text-purple-500 rounded-lg px-3 py-1.5 flex items-center gap-2 text-sm font-medium">
                  <span>{lock.code}</span>
                  <button 
                    onClick={() => setCourseLocks(prev => prev.filter(p => p.code !== lock.code))}
                    className="hover:bg-purple-500/20 p-0.5 rounded-full transition-colors"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {mode === "search" ? (
            <>
          <SearchInput placeholder="Search master course list..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} containerClassName="mb-2" />

          <div className="grid grid-cols-1 gap-2">
            {uniqueCourseCodes.filter(c => 
              c.code.toLowerCase().includes(searchQuery.toLowerCase()) || 
              c.title.toLowerCase().includes(searchQuery.toLowerCase())
            ).length === 0 && (
              <div className="text-center py-8 text-muted-foreground text-sm">
                No courses found matching "{searchQuery}"
              </div>
            )}
            {uniqueCourseCodes.filter(c => 
              c.code.toLowerCase().includes(searchQuery.toLowerCase()) || 
              c.title.toLowerCase().includes(searchQuery.toLowerCase())
            ).slice(0, 50).map(c => {
              const selection = courseLocks.find((lock) => lock.code === c.code);
              const offerings = masterCourses.filter((course) => course.CODE === c.code);
              return (
                <TargetCourseLockCard
                  key={c.code}
                  course={c}
                  offerings={offerings}
                  selection={selection}
                  onSelectionChange={(nextSelection) => {
                    if (!nextSelection) {
                      setCourseLocks((previous) => previous.filter((lock) => lock.code !== c.code));
                      return;
                    }
                    setCourseLocks((previous) => {
                      const index = previous.findIndex((lock) => lock.code === c.code);
                      if (index === -1) return [...previous, nextSelection];
                      return previous.map((lock, lockIndex) => lockIndex === index ? nextSelection : lock);
                    });
                  }}
                />
              );
            })}
          </div>
            </>
          ) : (
            <CourseImportPanel mode={mode} onImport={onImportCourses} onImportToTimetable={onImportToTimetable} />
          )}
          <div className="pt-3 mt-1 border-t border-border-strong bg-surface-secondary/20 flex justify-between items-center">
            <span className="text-sm font-medium text-text-heading">
              <span className="text-purple-500 font-bold">{courseLocks.length}</span> courses selected
            </span>
            <button 
              onClick={onClose}
              className="bg-foreground text-background px-6 py-2 rounded-xl text-sm font-bold shadow hover:bg-foreground/90 transition-colors"
            >
              Done
            </button>
          </div>
        </BottomSheet>
      )}
    </AnimatePresence>
  );
};
