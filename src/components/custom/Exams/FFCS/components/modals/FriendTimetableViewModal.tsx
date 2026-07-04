import React from 'react';
import { Eye, ArrowLeft, ArrowRight, X } from 'lucide-react';
import { TimetableState, AddedCourse } from '../../types';
import { getBatchColorClass } from '@/lib/utils';
import { TimetableGrid } from '../TimetableGrid';
import { CourseListTable } from '@amazecontinuityprojects/amazeui';

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
  renderTypeChips: (types?: string | string[], size?: 'sm' | 'md' | 'default') => React.ReactNode;
}


export function FriendTimetableViewModal({
  data, setData, theoryPeriods, labPeriods, renderTypeChips
}: FriendTimetableViewModalProps) {
  if (!data) return null;

  const selectedFriendTimetablesData = data;
  const setSelectedFriendTimetablesData = setData;

  const getGroupedCourses = (courses: AddedCourse[]) => {
      return Object.values(courses.reduce((acc, course) => {
        if (!acc[course.code]) {
            acc[course.code] = { ...course, credits: String(parseFloat(course.credits || '0')) };
        }
        return acc;
      }, {} as Record<string, AddedCourse>));
  };

  return (
    <>      
        <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-black/60 ">
          <div className="bg-background rounded-2xl border border-border shadow-2xl w-full max-w-6xl max-h-[90vh] overflow-hidden flex flex-col">
            <div className="p-4 border-b border-border flex items-center justify-between bg-muted/30">
              <div className="flex items-center gap-4">
                <h3 className="font-bold text-lg text-foreground flex items-center gap-2">
                  <Eye className="w-5 h-5 text-blue-500" /> {selectedFriendTimetablesData.name}'s Timetable {selectedFriendTimetablesData.timetables.length > 1 ? `(${selectedFriendTimetablesData.currentIndex + 1}/${selectedFriendTimetablesData.timetables.length})` : ''}
                </h3>
                {selectedFriendTimetablesData.timetables.length > 1 && (
                  <div className="flex items-center gap-2 bg-muted/50 rounded-lg p-1">
                    <button
                      onClick={() => setSelectedFriendTimetablesData(prev => prev ? {...prev, currentIndex: (prev.currentIndex - 1 + prev.timetables.length) % prev.timetables.length} : null)}
                      className="p-1 hover:bg-background rounded-md transition-colors"
                    >
                      <ArrowLeft className="w-4 h-4" />
                    </button>
                    <span className="text-xs font-semibold px-2">Cycle Options</span>
                    <button
                      onClick={() => setSelectedFriendTimetablesData(prev => prev ? {...prev, currentIndex: (prev.currentIndex + 1) % prev.timetables.length} : null)}
                      className="p-1 hover:bg-background rounded-md transition-colors"
                    >
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>
              <button 
                onClick={() => setSelectedFriendTimetablesData(null)}
                className="text-muted-foreground hover:text-foreground transition-colors p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 overflow-auto bg-muted/5 custom-scrollbar relative">
              <div className="flex flex-col gap-6 w-max min-w-full pb-4">
                <TimetableGrid 
                  courses={selectedFriendTimetablesData.timetables[selectedFriendTimetablesData.currentIndex].courses as AddedCourse[]} 
                  customCourses={selectedFriendTimetablesData.timetables[selectedFriendTimetablesData.currentIndex].courses as AddedCourse[]}
                  fullSize={true}
                  blockedSlots={new Set()} 
                  toggleBlockSlot={() => {}} 
                  selectedGapDetails={null} 
                  theoryPeriods={theoryPeriods}
                  labPeriods={labPeriods}
                />

                <CourseListTable
                  courses={getGroupedCourses(selectedFriendTimetablesData.timetables[selectedFriendTimetablesData.currentIndex].courses as AddedCourse[])}
                  renderTypeChips={renderTypeChips}
                  getBatchBadgeClass={getBatchColorClass}
                />
            </div>
            </div>
          </div>
        </div>
      
    </>
  );
}