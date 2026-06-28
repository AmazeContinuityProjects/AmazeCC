import React, { useMemo } from 'react';
import { Users, X } from 'lucide-react';
import { TimetableState, Friend, FriendGroup, AddedCourse } from '../../types';
import { calculatePairwiseSocialScore } from '../../../FFCSTimetableTab';

export interface SocialMatrixModalProps {
  isOpen: boolean;
  onClose: () => void;
  timetables: TimetableState[];
  friends: Friend[];
  friendGroups: FriendGroup[];
  socialScoreGroupMethod: 'cumulative' | 'intersection' | 'average' | 'min' | 'max' | string;
  generatorPreviewTimetable: TimetableState | null;
  stagedTimetables: TimetableState[];
  activeTimetableId: string;
}


export function SocialMatrixModal({
  isOpen, onClose, timetables, friends, friendGroups, socialScoreGroupMethod, generatorPreviewTimetable, stagedTimetables, activeTimetableId
}: SocialMatrixModalProps) {
  if (!isOpen) return null;

  const setIsSocialMatrixOpen = (v: boolean) => { if (!v) onClose(); };

  // Calculate pairs
  const calculatePairs = () => {
    let pairs = [];
    timetables.forEach((mt, mtIdx) => {
      friends.forEach((ft, ftIdx) => {
        if (ft.timetables && ft.timetables.length > 0) {
          const score = calculatePairwiseSocialScore(mt.courses as AddedCourse[], ft.timetables[0].courses as AddedCourse[]);
          pairs.push({
            myTimetable: mt,
            friendTimetable: ft,
            score
          });
        }
      });
    });
    return pairs.sort((a, b) => b.score.actualScore - a.score.actualScore);
  };

  const topPairs = useMemo(() => calculatePairs(), [timetables, friends]);

  return (
    <>        <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-black/60 ">
          <div className="bg-background rounded-2xl border border-border shadow-2xl w-full max-w-6xl max-h-[90vh] flex flex-col">
            <div className="p-4 border-b border-border flex items-center justify-between bg-muted/30 shrink-0">
              <h3 className="font-bold text-lg text-foreground flex items-center gap-2">
                <Users className="w-5 h-5 text-pink-500" /> Social Score Breakdown
              </h3>
              <button 
                onClick={() => setIsSocialMatrixOpen(false)}
                className="text-muted-foreground hover:text-foreground transition-colors p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 overflow-auto custom-scrollbar flex-1">
              <div className="space-y-6">
                <div>
                  <h4 className="text-sm font-bold text-muted-foreground uppercase tracking-wider mb-2">How it works</h4>
                  <p className="text-sm text-foreground/80 leading-relaxed max-w-3xl">
                    The Social Score is a percentage indicating how well your timetable aligns with your friends' timetables.
                    It awards points for <strong className="text-foreground">Shared Classes</strong> (+3 per slot), 
                    <strong className="text-foreground"> Shared Free Half-Days</strong> (+5), and 
                    <strong className="text-foreground"> Mutually Free Slots</strong> (+1), measured against the maximum possible score if you had the exact same timetable.
                  </p>
                </div>
                
                {friends.length === 0 ? (
                  <div className="text-center py-12 border border-dashed border-border rounded-xl">
                    <Users className="w-12 h-12 text-muted-foreground/50 mx-auto mb-3" />
                    <p className="text-muted-foreground font-medium">You have no friends imported.</p>
                    <p className="text-sm text-muted-foreground/80 mt-1">Add friends in the Social tab to see the comparison matrix!</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto rounded-xl border border-border custom-scrollbar">
                    <table className="w-full text-sm text-center border-collapse">
                      <thead className="bg-muted/50 border-b border-border">
                        <tr>
                          <th className="py-3 px-4 text-left font-semibold border-r border-border min-w-[200px] sticky left-0 bg-muted/95 z-20">My Options \ Friends</th>
                          {friends.map(f => (
                            f.timetables?.map((ft, fIdx) => (
                              <th key={`${f.id}-${ft.id}`} className="py-3 px-4 font-semibold whitespace-nowrap border-r border-border/50 last:border-r-0">
                                <div className="flex flex-col items-center gap-1">
                                  <span>{f.name}</span>
                                  <span className="text-xs text-muted-foreground font-normal">{ft.name || `Option ${fIdx + 1}`}</span>
                                </div>
                              </th>
                            ))
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {Array.from(new Map([...(generatorPreviewTimetable ? [generatorPreviewTimetable] : []), ...timetables, ...stagedTimetables]
                          .filter(t => t && t.courses && t.courses.length > 0)
                          .map(t => [t.id, t])).values())
                          .map((mt, rIdx) => (
                          <tr key={mt.id} className="hover:bg-muted/10 transition-colors">
                            <td className="py-3 px-4 text-left font-medium border-r border-border whitespace-nowrap sticky left-0 bg-background/95 z-10 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">
                              {mt.name || (mt.id === activeTimetableId ? 'Active Timetable' : `Option ${rIdx + 1}`)}
                              {mt.id === activeTimetableId && <span className="ml-2 text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded uppercase font-bold tracking-wider">Active</span>}
                            </td>
                            {friends.map(f => (
                              f.timetables?.map(ft => {
                                const score = calculatePairwiseSocialScore(mt.courses as AddedCourse[], ft.courses as AddedCourse[]);
                                const pct = score.percentage;
                                let colorClass = "text-muted-foreground";
                                let bgClass = "";
                                if (pct >= 80) { colorClass = "text-emerald-700 dark:text-emerald-400 font-bold"; bgClass = "bg-emerald-500/10"; }
                                else if (pct >= 60) { colorClass = "text-yellow-700 dark:text-yellow-400 font-bold"; bgClass = "bg-yellow-500/10"; }
                                else if (pct >= 40) { colorClass = "text-orange-700 dark:text-orange-400 font-medium"; bgClass = "bg-orange-500/10"; }
                                else if (pct > 0) { colorClass = "text-red-700 dark:text-red-400"; bgClass = "bg-red-500/10"; }
                                
                                return (
                                  <td key={`${mt.id}-${f.id}-${ft.id}`} className={`py-3 px-4 transition-colors group relative border-r border-border/50 last:border-r-0 ${bgClass}`}>
                                    <span className={colorClass}>{pct}%</span>
                                    {/* Tooltip for breakdown */}
                                    <div className="opacity-0 group-hover:opacity-100 transition-opacity absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 bg-foreground text-background text-xs p-3 rounded-lg shadow-xl pointer-events-none z-50">
                                      <div className="font-bold border-b border-background/20 pb-2 mb-2 text-center uppercase tracking-wider text-[10px]">Score Breakdown</div>
                                      <div className="flex justify-between items-center mb-1">
                                        <span className="text-background/80">Actual Score:</span> 
                                        <span className="font-bold">{score.actualScore} pts</span>
                                      </div>
                                      <div className="flex justify-between items-center">
                                        <span className="text-background/80">Max Potential:</span> 
                                        <span className="font-bold">{score.maxScore} pts</span>
                                      </div>
                                      <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-foreground"></div>
                                    </div>
                                  </td>
                                );
                              })
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
    </>
  );
}