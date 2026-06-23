import React, { useState } from "react";
import { Lock, X, Search } from "lucide-react";
import { CourseLock, ParsedCourse } from "../../types";

interface TargetCoursesModalProps {
  isOpen: boolean;
  onClose: () => void;
  courseLocks: CourseLock[];
  setCourseLocks: React.Dispatch<React.SetStateAction<CourseLock[]>>;
  masterCourses: ParsedCourse[];
  uniqueCourseCodes: { code: string; title: string; types?: string[] }[];
  renderTypeChips: (typesInput: string | string[], size?: 'sm' | 'md') => React.ReactNode;
}

export const TargetCoursesModal: React.FC<TargetCoursesModalProps> = ({
  isOpen,
  onClose,
  courseLocks,
  setCourseLocks,
  masterCourses,
  uniqueCourseCodes,
  renderTypeChips,
}) => {
  const [searchQuery, setSearchQuery] = useState("");

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-background border border-border shadow-2xl rounded-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[85vh]">
        <div className="p-4 sm:p-5 border-b border-border flex justify-between items-center bg-muted/30">
          <h2 className="text-xl font-bold flex items-center gap-2 text-foreground">
            <Lock className="text-purple-500 w-6 h-6" /> Target Courses
          </h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="w-6 h-6" />
          </button>
        </div>
        
        <div className="p-4 sm:p-6 overflow-y-auto flex-1 flex flex-col gap-4 custom-scrollbar">
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
          
          <div className="relative mb-2">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input 
              type="text"
              placeholder="Search master course list..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full bg-background border border-border rounded-lg pl-9 pr-4 py-2 text-sm focus:outline-none focus:border-purple-500/50"
            />
          </div>

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
                return opt.SLOT.split('+').map(s => s.trim());
              }).flat())).sort();

              return (
                <div key={c.code} className={`flex flex-col gap-2 p-3 rounded-xl border transition-colors ${isSelected ? 'bg-muted/30 border-purple-500/50 shadow-sm' : 'bg-transparent border-transparent hover:border-border hover:bg-muted/50'}`}>
                  <label className="flex items-start gap-3 cursor-pointer">
                    <input 
                      type="checkbox" 
                      className="mt-1 rounded bg-background border-border text-purple-500 focus:ring-purple-500/30"
                      checked={isSelected}
                      onChange={(e) => {
                        if (e.target.checked) setCourseLocks(prev => [...prev, { code: c.code, title: c.title, allowedSlots: [], allowedFaculty: [] }]);
                        else setCourseLocks(prev => prev.filter(s => s.code !== c.code));
                      }}
                    />
                    <div className="flex flex-col flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-base text-foreground">{c.code}</span>
                         {renderTypeChips(c.types || [], 'sm')}
                      </div>
                      <span className="text-xs text-muted-foreground line-clamp-2">{c.title}</span>
                    </div>
                  </label>

                  {isSelected && uniqueSlots.length > 1 && (() => {
                    const availableSeries = Array.from(new Set(
                      uniqueSlots.map(slot => {
                        const firstSlot = slot.split('+')[0].trim().toUpperCase();
                        const match = firstSlot.match(/^[T]?([A-G])/);
                        return match ? match[1] : null;
                      }).filter(Boolean) as string[]
                    )).sort();

                    return (
                      <div className="pl-8 mt-2">
                        <div className="text-[11px] font-bold text-muted-foreground mb-2 uppercase tracking-wider">Filter Slots (Optional)</div>
                        
                        {availableSeries.length > 0 && (
                          <div className="mb-3">
                            <div className="text-[10px] font-bold text-foreground/70 mb-1.5 uppercase">Quick Select Series</div>
                            <div className="flex flex-wrap gap-1.5">
                              {availableSeries.map(series => {
                                const seriesSlots = uniqueSlots.filter(slot => {
                                  const firstSlot = slot.split('+')[0].trim().toUpperCase();
                                  const match = firstSlot.match(/^[T]?([A-G])/);
                                  return match && match[1] === series;
                                });
                                const allSelected = seriesSlots.every(s => sel.allowedSlots.includes(s));
                                
                                return (
                                  <button
                                    key={series}
                                    type="button"
                                    onClick={(e) => {
                                      e.preventDefault();
                                      e.stopPropagation();
                                      setCourseLocks(prev => prev.map(p => {
                                        if (p.code !== c.code) return p;
                                        let newSlots = [...p.allowedSlots];
                                        if (allSelected) {
                                          newSlots = newSlots.filter(s => !seriesSlots.includes(s));
                                        } else {
                                          seriesSlots.forEach(s => {
                                            if (!newSlots.includes(s)) newSlots.push(s);
                                          });
                                        }
                                        return { ...p, allowedSlots: newSlots };
                                      }));
                                    }}
                                    className={`px-2 py-1 rounded text-xs font-bold transition-colors ${
                                      allSelected 
                                        ? 'bg-purple-500 text-white shadow-sm' 
                                        : 'bg-muted hover:bg-muted/80 text-foreground/70'
                                    }`}
                                  >
                                    {series} Series
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
                            <label key={slot} className={`flex items-center gap-2 cursor-pointer border rounded-md p-1.5 px-3 transition-colors ${isOffChecked ? 'bg-purple-500/10 border-purple-500/30 text-purple-600' : 'hover:bg-muted/50 text-muted-foreground border-border/50'}`}>
                              <input 
                                type="checkbox" 
                                className="rounded w-3.5 h-3.5 border-border text-purple-500 focus:ring-purple-500/30"
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
        </div>
        <div className="p-4 border-t border-border bg-muted/20 flex justify-between items-center">
          <span className="text-sm font-medium text-foreground">
            <span className="text-purple-500 font-bold">{courseLocks.length}</span> courses selected
          </span>
          <button 
            onClick={onClose}
            className="bg-foreground text-background px-6 py-2 rounded-xl text-sm font-bold shadow hover:bg-foreground/90 transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
