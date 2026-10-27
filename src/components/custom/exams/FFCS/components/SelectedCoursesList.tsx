"use client";

import { Trash2, Users } from "lucide-react";
import type { AddedCourse } from "../types";
import { defaultColor, getCourseBadgeProps, typeColors, typeLabels } from "../constants";
import { getBatchColorClass } from "@/lib/utils";
import { FacultyAvatar, VitfacReviewPill } from "./FacultyAvatar";
import { groupSelectedCourses, type SelectedCourseGroup } from "../logic/groupSelectedCourses";

// Re-exported for existing importers; the definitions live in their own
// modules so neither the list component nor these get dragged into a
// route's initial bundle by accident.
export { groupSelectedCourses };
export type { SelectedCourseGroup };

type FacultyInfo = { display: string; title: string };

type SelectedCoursesListProps = {
  courses: AddedCourse[];
  title?: string;
  modern?: boolean;
  onRemove?: (courseIds: string[]) => void;
  onFacultyClick?: (course: SelectedCourseGroup) => void;
  onReviewClick?: (faculty: { name: string; employeeId?: string; courseCode: string }) => void;
  getFacultyInfo?: (course: SelectedCourseGroup, rawHalves: AddedCourse[]) => FacultyInfo;
  onClear?: () => void;
};

function TypeChips({ typesInput, size = "md" }: { typesInput: string; size?: "sm" | "md" }) {
  if (!typesInput) return null;
  let types = typesInput.split("+").map((type) => type.trim().toUpperCase()).filter(Boolean);
  if (types.includes("ETH") && types.includes("ELA")) {
    types = [...types.filter((type) => type !== "ETH" && type !== "ELA"), "ETH+ELA"];
  }
  if (types.includes("TH") && types.includes("LO")) {
    types = [...types.filter((type) => type !== "TH" && type !== "LO"), "TH+LO"];
  }
  const padding = size === "sm" ? "px-1.5" : "px-2";
  return (
    <span className="flex flex-wrap gap-1">
      {types.map((type) => {
        const color = typeColors[type] || defaultColor;
        return (
          <span
            key={type}
            title={typeLabels[type] || type}
            className={`inline-flex items-center font-bold rounded-md border ${padding} py-0.5 text-[10px] ${color.bg} ${color.text} ${color.border}`}
          >
            {typeLabels[type] || type}
          </span>
        );
      })}
    </span>
  );
}

export default function SelectedCoursesList({
  courses,
  title = "Selected Courses",
  modern = true,
  onRemove,
  onFacultyClick,
  onReviewClick,
  getFacultyInfo,
  onClear,
}: SelectedCoursesListProps) {
  const groupedCourses = groupSelectedCourses(courses);
  const totalCredits = groupedCourses.reduce((sum, course) => sum + parseFloat(course.credits || "0"), 0);

  const renderFaculty = (course: SelectedCourseGroup, rawHalves: AddedCourse[]) => {
    const employeeId = rawHalves[0]?.employeeId || course.employeeId;
    const facultyInfo = getFacultyInfo?.(course, rawHalves);
    return (
      <div className="flex items-center gap-2 min-w-0">
        <FacultyAvatar employeeId={employeeId} name={course.faculty} size="xs" tone="blue" />
        <div className="flex items-center gap-1.5 flex-wrap min-w-0">
          {onFacultyClick ? (
            <button
              type="button"
              onClick={() => onFacultyClick(course)}
              title={facultyInfo?.title}
              className="flex items-center gap-1.5 text-sm text-text-heading/80 hover:text-blue-500 transition-colors cursor-pointer max-w-full min-w-0"
            >
              <span className="truncate">{course.faculty}</span>
              {facultyInfo && (
                <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-1.5 py-0.5 rounded-md bg-surface-secondary/70 border border-border-strong/70 text-muted-foreground shrink-0">
                  <Users className="w-3.5 h-3.5 text-muted-foreground/60 shrink-0" />
                  <span>{facultyInfo.display}</span>
                </span>
              )}
            </button>
          ) : (
            <span className="text-sm text-text-heading/80 truncate">{course.faculty || "Faculty unstated"}</span>
          )}
          {onReviewClick && (
            <VitfacReviewPill
              employeeId={employeeId}
              name={course.faculty}
              onClick={(event) => {
                event.stopPropagation();
                onReviewClick({ name: course.faculty, employeeId, courseCode: course.code });
              }}
            />
          )}
        </div>
      </div>
    );
  };

  const renderBatches = (course: SelectedCourseGroup, compact = false) => course.batches.map((batch) => (
    <span
      key={batch}
      className={`${compact ? "text-[10px] px-1.5" : "text-xs px-2"} font-bold py-0.5 rounded-md border ${getBatchColorClass(batch)}`}
    >
      {batch}
    </span>
  ));

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
        <h2 className="text-xl font-bold text-text-heading flex flex-wrap items-center gap-2 w-full sm:w-auto">
          {title}
          <span className="bg-blue-500/20 text-blue-400 text-xs py-1 px-2.5 rounded-full border border-blue-500/20 whitespace-nowrap">
            Total Credits: {totalCredits}
          </span>
        </h2>
        {onClear && (
          <button
            type="button"
            onClick={onClear}
            className="text-red-400 hover:bg-red-500/10 px-3 py-1.5 rounded-lg transition-colors text-sm font-medium flex items-center gap-2 print:hidden whitespace-nowrap ml-auto"
          >
            <Trash2 className="w-4 h-4" /> Clear All
          </button>
        )}
      </div>

      <div className="block md:hidden space-y-3 print:hidden">
        {groupedCourses.map((course) => {
          const rawHalves = courses.filter((half) => course.ids.includes(half.id));
          const badgeProps = getCourseBadgeProps(course.color, modern);
          return (
            <div key={course.id} className="p-3.5 rounded-2xl bg-surface border border-border-strong shadow-2xs space-y-2.5">
              <div className="flex items-start justify-between gap-2.5">
                <div className="flex flex-col gap-1 min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <div className={badgeProps.className} style={badgeProps.style}>{course.code}</div>
                    <TypeChips typesInput={course.type} size="sm" />
                    <span className="text-[10px] text-muted-foreground font-semibold bg-surface-secondary/70 px-1.5 py-0.5 rounded border border-border-strong/50">
                      {course.credits} cr
                    </span>
                    {renderBatches(course, true)}
                  </div>
                  <h3 className="text-xs sm:text-sm font-bold text-text-heading leading-snug line-clamp-2">{course.title}</h3>
                </div>
                {onRemove && (
                  <button
                    type="button"
                    onClick={() => onRemove(course.ids)}
                    className="text-muted-foreground hover:text-red-400 p-1.5 rounded-lg hover:bg-red-500/10 transition-colors shrink-0 relative hit-expand touch-press active:scale-[0.95]"
                    title="Remove Course"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
              <div className="flex items-center justify-between gap-2 pt-2 border-t border-border-strong/40">
                {renderFaculty(course, rawHalves)}
              </div>
              <div className="flex items-center justify-between gap-2 text-xs">
                <div className="flex flex-wrap gap-1 items-center">
                  {course.slots.map((slot) => (
                    <span key={slot} className="bg-accent/50 border border-border-strong text-text-heading/80 text-[10px] px-1.5 py-0.5 rounded-md">{slot}</span>
                  ))}
                </div>
                <div className="text-[11px] text-muted-foreground font-medium truncate shrink-0 max-w-[140px]">📍 {course.venue}</div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="hidden md:block overflow-x-auto scrollbar-none">
        <table className="w-full text-left min-w-[600px]">
          <thead>
            <tr className="border-b border-border-strong">
              <th className="py-3 px-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">Course</th>
              <th className="py-3 px-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">Type</th>
              <th className="py-3 px-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">Faculty</th>
              <th className="py-3 px-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">Slots</th>
              <th className="py-3 px-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">Venue</th>
              <th className="py-3 px-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">Credits</th>
              {onRemove && <th className="py-3 px-2 text-xs font-medium text-muted-foreground uppercase tracking-wider text-right print:hidden">Action</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {groupedCourses.map((course) => {
              const rawHalves = courses.filter((half) => course.ids.includes(half.id));
              const badgeProps = getCourseBadgeProps(course.color, modern);
              return (
                <tr key={course.id} className="hover:bg-white/[0.02] transition-colors group">
                  <td className="py-3 px-2">
                    <div className="flex items-center gap-3">
                      <div className={badgeProps.className} style={badgeProps.style}>{course.code}</div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-muted-foreground text-xs max-w-xs">{course.title}</p>
                        {renderBatches(course)}
                      </div>
                    </div>
                  </td>
                  <td className="py-3 px-2 text-sm text-text-heading/80"><TypeChips typesInput={course.type} /></td>
                  <td className="py-3 px-2">{renderFaculty(course, rawHalves)}</td>
                  <td className="py-3 px-2">
                    <div className="flex flex-wrap gap-1">
                      {course.slots.map((slot) => (
                        <span key={slot} className="bg-accent/50 border border-border-strong text-text-heading/80 text-[10px] px-1.5 py-0.5 rounded-md">{slot}</span>
                      ))}
                    </div>
                  </td>
                  <td className="py-3 px-2 text-sm text-text-heading/80 max-w-xs">{course.venue}</td>
                  <td className="py-3 px-2 text-sm text-text-heading/80">{course.credits}</td>
                  {onRemove && (
                    <td className="py-3 px-2 text-right print:hidden">
                      <button type="button" onClick={() => onRemove(course.ids)} className="text-muted-foreground hover:text-red-400 transition-colors p-2" title="Remove Course">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}
