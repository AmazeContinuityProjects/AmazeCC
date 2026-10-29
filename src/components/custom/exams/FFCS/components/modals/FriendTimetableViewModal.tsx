import React from 'react';
import { AnimatePresence } from 'framer-motion';
import { Eye, ArrowLeft, ArrowRight } from 'lucide-react';
import { TimetableState, AddedCourse } from '../../types';
import { getBatchColorClass } from '@/lib/utils';
import { TimetableGrid } from '../TimetableGrid';
import { CourseListTable } from '@amazecontinuityprojects/amazeui';
import { groupSelectedCourses } from '../../logic/groupSelectedCourses';
import BottomSheet from '../../../../shared/BottomSheet';
import { renderCourseTypeChips } from '../CourseTypeChips';

export interface SelectedFriendTimetableData {
  name: string;
  timetables: TimetableState[];
  currentIndex: number;
}

export interface FriendTimetableViewModalProps {
  data: SelectedFriendTimetableData | null;
  setData: React.Dispatch<React.SetStateAction<SelectedFriendTimetableData | null>>;
  theoryPeriods: any[];
  labPeriods: any[];
}


export function FriendTimetableViewModal({
  data, setData, theoryPeriods, labPeriods
}: FriendTimetableViewModalProps) {
  /**
   * A sheet now, and deliberately without `if (!data) return null`: the closed
   * tree is an empty `<AnimatePresence>` so the exit animation can play, while
   * every read of `data` below stays narrowed by the `{data && ...}` around it.
   *
   * The sheet owns the chrome — grabber, one X, swipe-down, Escape, system back —
   * so the header keeps only the title and the option cycler, which the sheet
   * cannot stand in for. The z pair is passed through rather than left at the
   * sheet default because the planner can be in fullscreen (z-100) behind this,
   * and a sheet at the default z-60 would land underneath it.
   *
   * The grid is still wrapped in its own `overflow-auto`: `TimetableGrid` is
   * `w-max`, so only that box should scroll sideways, not the whole sheet.
   */
  return (
    <AnimatePresence>
      {data && (
        <BottomSheet
          onClose={() => setData(null)}
          overlayId="ffcs-friend-timetable"
          maxWidth="max-w-6xl"
          panelZIndex={300}
          backdropZIndex={295}
          contentClassName="space-y-4"
          title={`${data.name}'s Timetable`}
          subtitle={
            data.timetables.length > 1
              ? `${data.currentIndex + 1} of ${data.timetables.length}`
              : undefined
          }
          icon={<Eye className="w-5 h-5" />}
          accent="bg-blue-500/10 border-blue-500/20 text-blue-500"
          closeLabel={`Close ${data.name}'s timetable`}
          trailing={
            data.timetables.length > 1 ? (
              <div className="flex items-center gap-2 bg-zinc-200/60 dark:bg-zinc-700/50 rounded-lg p-1">
                <button
                  onClick={() => setData(prev => prev ? {...prev, currentIndex: (prev.currentIndex - 1 + prev.timetables.length) % prev.timetables.length} : null)}
                  className="p-1 hover:bg-surface rounded-md transition-colors"
                  aria-label="Previous option"
                >
                  <ArrowLeft className="w-4 h-4" />
                </button>
                <span className="text-xs font-semibold px-2">Cycle Options</span>
                <button
                  onClick={() => setData(prev => prev ? {...prev, currentIndex: (prev.currentIndex + 1) % prev.timetables.length} : null)}
                  className="p-1 hover:bg-surface rounded-md transition-colors"
                  aria-label="Next option"
                >
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            ) : undefined
          }
        >

          <div className="bg-surface-secondary/5 rounded-xl relative overflow-auto custom-scrollbar p-4 sm:p-6">
            <div className="flex flex-col gap-6 w-max min-w-full pb-4">
              <TimetableGrid 
                courses={data.timetables[data.currentIndex].courses as AddedCourse[]} 
                customCourses={data.timetables[data.currentIndex].courses as AddedCourse[]}
                fullSize={true}
                blockedSlots={new Set()} 
                toggleBlockSlot={() => {}} 
                selectedGapDetails={null} 
                theoryPeriods={theoryPeriods}
                labPeriods={labPeriods}
              />

              {/* One row per course, via the planner's own grouper: a friend's
                  saved timetable holds the halves the planner holds, and the
                  table renders a Credits column per row. The local reduce this
                  replaces kept only the first row per code, so the lab half
                  vanished from the row — its slots, its venue, and any credit
                  it carried. groupSelectedCourses joins them instead. */}
              <CourseListTable
                courses={groupSelectedCourses(data.timetables[data.currentIndex].courses as AddedCourse[])}
                renderTypeChips={renderCourseTypeChips}
                getBatchBadgeClass={getBatchColorClass}
              />
            </div>
          </div>
        </BottomSheet>
      )}
    </AnimatePresence>
  );
}
