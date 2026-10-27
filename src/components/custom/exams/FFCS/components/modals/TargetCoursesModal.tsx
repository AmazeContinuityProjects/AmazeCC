import React, { useState } from "react";
import { AnimatePresence } from "framer-motion";
import { ClipboardPaste, FileSpreadsheet, Lock, Search, Users, X } from "lucide-react";
import SearchInput from "../../../../shared/SearchInput";
import BottomSheet from "../../../../shared/BottomSheet";
import { CourseLock, ParsedCourse, AddedCourse } from "../../types";
import { getBatchColorClass } from "@/lib/utils";
import { SegmentedControl } from "@/components/custom/shared/primitives";
import { CourseImportPanel, type ImportMode } from "../CourseImportPanel";
import { renderCourseTypeChips } from "../CourseTypeChips";
import { splitSlots } from "@/lib/slots";

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
              const sel = courseLocks.find(s => s.code === c.code);
              const isSelected = !!sel;
              
              const courseOpts = masterCourses.filter(mc => mc.CODE === c.code);
              const uniqueSlots = Array.from(new Set(courseOpts.map(opt => {
                return splitSlots(opt.SLOT);
              }).flat())).sort();

              return (
                <div key={c.code} className={`flex flex-col gap-2 p-3 rounded-xl border transition-colors ${isSelected ? 'bg-surface-secondary/30 border-purple-500/50 shadow-sm' : 'bg-transparent border-transparent hover:border-border-strong hover:bg-surface-secondary/50'}`}>
                  <label className="flex items-start gap-3 cursor-pointer">
                    <input 
                      type="checkbox" 
                      className="mt-1 rounded bg-surface border-border-strong text-purple-500 focus:ring-purple-500/30"
                      checked={isSelected}
                      onChange={(e) => {
                        if (e.target.checked) setCourseLocks(prev => [...prev, { code: c.code, title: c.title, allowedSlots: [], allowedFaculty: [] }]);
                        else setCourseLocks(prev => prev.filter(s => s.code !== c.code));
                      }}
                    />
                    <div className="flex flex-col flex-1">
                      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-1">
                        <div className="flex flex-col gap-1 min-w-0">
                          <span className="font-bold text-base text-text-heading">{c.code}</span>
                          <div className="flex items-center gap-1 flex-wrap">
                            {renderCourseTypeChips(c.types || [], 'sm')}
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5 flex-wrap sm:shrink-0">
                          {c.batches && c.batches.length > 0 && c.batches.map(b => (
                            <span key={b} className={`text-xs font-bold px-2 py-0.5 rounded-md border ${getBatchColorClass(b)}`}>
                              {b}
                            </span>
                          ))}
                        </div>
                      </div>
                      <span className="text-xs text-muted-foreground line-clamp-2">{c.title}</span>
                    </div>
                  </label>

                  {isSelected && uniqueSlots.length > 1 && (() => {
                    const clusterMap = new Map<string, { clusterKey: string; clusterLabel: string; letter: string; slots: string[] }>();
                    const letterMap = new Map<string, string[]>();

                    const getSlotClusterKey = (slot: string): { cluster: string; letter: string } => {
                      const s = slot.trim().toUpperCase();
                      const theoryMatch = s.match(/^[T]*([A-G])([1-2])$/);
                      if (theoryMatch) {
                        return { cluster: `${theoryMatch[1]}${theoryMatch[2]}`, letter: theoryMatch[1] };
                      }
                      const labMatch = s.match(/^L([0-9]+)$/);
                      if (labMatch) {
                        const num = parseInt(labMatch[1], 10);
                        const cluster = num <= 30 ? "Lab (Morning)" : "Lab (Evening)";
                        return { cluster, letter: "Lab" };
                      }
                      const generalMatch = s.match(/^[T]*([A-Z])([0-9]+)?$/);
                      if (generalMatch) {
                        const letter = generalMatch[1];
                        const num = generalMatch[2] || "";
                        return { cluster: num ? `${letter}${num}` : letter, letter };
                      }
                      return { cluster: s, letter: s };
                    };

                    uniqueSlots.forEach((slot) => {
                      const { cluster, letter } = getSlotClusterKey(slot);
                      if (!clusterMap.has(cluster)) {
                        clusterMap.set(cluster, {
                          clusterKey: cluster,
                          clusterLabel: cluster.endsWith("1") || cluster.endsWith("2") ? `${cluster} Slots` : `${cluster} Series`,
                          letter,
                          slots: [],
                        });
                      }
                      clusterMap.get(cluster)!.slots.push(slot);

                      if (!letterMap.has(letter)) {
                        letterMap.set(letter, []);
                      }
                      letterMap.get(letter)!.push(slot);
                    });

                    const availableClusters = Array.from(clusterMap.keys()).sort();
                    const availableBroadLetters = Array.from(letterMap.keys()).sort();

                    return (
                      <div className="pl-8 mt-2 space-y-2">
                        <div className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Filter Slots (Optional)</div>
                        
                        {availableClusters.length > 0 && (
                          <div className="space-y-1">
                            <div className="text-[10px] font-bold text-text-heading/70 uppercase">Quick Select Slot Bundles</div>
                            <div className="flex flex-wrap gap-1.5">
                              {availableClusters.map((clusterKey) => {
                                const clusterSlots = clusterMap.get(clusterKey)?.slots || [];
                                const allSelected = clusterSlots.length > 0 && clusterSlots.every(s => sel.allowedSlots.includes(s));
                                
                                return (
                                  <button
                                    key={clusterKey}
                                    type="button"
                                    onClick={(e) => {
                                      e.preventDefault();
                                      e.stopPropagation();
                                      setCourseLocks(prev => prev.map(p => {
                                        if (p.code !== c.code) return p;
                                        let newSlots = [...p.allowedSlots];
                                        if (allSelected) {
                                          newSlots = newSlots.filter(s => !clusterSlots.includes(s));
                                        } else {
                                          clusterSlots.forEach(s => {
                                            if (!newSlots.includes(s)) newSlots.push(s);
                                          });
                                        }
                                        return { ...p, allowedSlots: newSlots };
                                      }));
                                    }}
                                    className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-colors flex items-center gap-1 ${
                                      allSelected 
                                        ? 'bg-purple-500 text-white shadow-sm ring-1 ring-purple-300' 
                                        : 'bg-surface-secondary hover:bg-surface-secondary/80 text-text-heading/70'
                                    }`}
                                    title={`Toggle ${clusterKey} bundle (${clusterSlots.join(", ")})`}
                                  >
                                    <span>{clusterKey.endsWith("1") || clusterKey.endsWith("2") ? `${clusterKey} Slots` : clusterKey}</span>
                                    <span className="text-[10px] font-normal opacity-80">
                                      ({clusterSlots.join(", ")})
                                    </span>
                                  </button>
                                );
                              })}

                              {/* Broad Series buttons */}
                              {availableBroadLetters.filter((letter) => (letterMap.get(letter)?.length || 0) > (clusterMap.get(`${letter}1`)?.slots.length || 0)).map((letter) => {
                                const letterSlots = letterMap.get(letter) || [];
                                const allSelected = letterSlots.length > 0 && letterSlots.every(s => sel.allowedSlots.includes(s));

                                return (
                                  <button
                                    key={`broad-${letter}`}
                                    type="button"
                                    onClick={(e) => {
                                      e.preventDefault();
                                      e.stopPropagation();
                                      setCourseLocks(prev => prev.map(p => {
                                        if (p.code !== c.code) return p;
                                        let newSlots = [...p.allowedSlots];
                                        if (allSelected) {
                                          newSlots = newSlots.filter(s => !letterSlots.includes(s));
                                        } else {
                                          letterSlots.forEach(s => {
                                            if (!newSlots.includes(s)) newSlots.push(s);
                                          });
                                        }
                                        return { ...p, allowedSlots: newSlots };
                                      }));
                                    }}
                                    className={`px-2 py-1 rounded text-xs font-bold transition-colors ${
                                      allSelected 
                                        ? 'bg-indigo-600 text-white shadow-sm' 
                                        : 'bg-surface-secondary/60 hover:bg-surface-secondary text-muted-foreground'
                                    }`}
                                    title={`Toggle All ${letter} Series (${letterSlots.join(", ")})`}
                                  >
                                    All {letter} Series
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        )}

                        <div className="flex flex-wrap gap-2 pr-1">
                          {uniqueSlots.map(slot => {
                          const isOffChecked = sel.allowedSlots.includes(slot);
                          return (
                            <label key={slot} className={`flex items-center gap-2 cursor-pointer border rounded-md p-1.5 px-3 transition-colors ${isOffChecked ? 'bg-purple-500/10 border-purple-500/30 text-purple-600' : 'hover:bg-surface-secondary/50 text-muted-foreground border-border-strong/50'}`}>
                              <input 
                                type="checkbox" 
                                className="rounded w-3.5 h-3.5 border-border-strong text-purple-500 focus:ring-purple-500/30"
                                checked={isOffChecked}
                                onChange={(e) => {
                                  setCourseLocks(prev => prev.map(p => {
                                    if (p.code !== c.code) return p;
                                    if (e.target.checked) return { ...p, allowedSlots: [...p.allowedSlots, slot] };
                                    return { ...p, allowedSlots: p.allowedSlots.filter(s => s !== slot) };
                                  }));
                                }}
                              />
                              <span className="text-xs font-bold">{slot}</span>
                              {(() => {
                                const facultyCount = new Set(
                                  masterCourses
                                    .filter((m) => m.CODE === c.code && m.SLOT === slot)
                                    .map((m) => m.FACULTY.trim().toLowerCase())
                                ).size || 1;
                                return (
                                  <span
                                    className="inline-flex items-center gap-1 text-[10px] font-semibold px-1 py-0.2 rounded bg-surface-secondary/70 border border-border-strong/70 text-muted-foreground shrink-0"
                                    title={`${facultyCount} ${facultyCount === 1 ? 'faculty' : 'faculties'} teaching this slot`}
                                  >
                                    <Users className="w-2.5 h-2.5 text-muted-foreground/60 shrink-0" />
                                    <span>{facultyCount}</span>
                                  </span>
                                );
                              })()}
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  )})()}
                </div>
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
