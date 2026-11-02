"use client";

import { Users } from "lucide-react";
import { getBatchColorClass } from "@/lib/utils";
import { splitSlots } from "@/lib/slots";
import type { CourseLock, ParsedCourse } from "../types";
import { renderCourseTypeChips } from "./CourseTypeChips";
import { GRADE_BADGE_TONE_CLASSES, type GradeBadge, type GradeLetter } from "@/lib/ffcsPlannerGrades";

export interface TargetCourseLockOption {
  code: string;
  title: string;
  types?: string[];
  batches?: string[];
}

interface TargetCourseLockCardProps {
  course: TargetCourseLockOption;
  offerings: readonly ParsedCourse[];
  selection: CourseLock | undefined;
  onSelectionChange: (selection: CourseLock | null) => void;
  tone?: "purple" | "neutral";
  /** The student's curriculum category, shown only when the picker filters by it. */
  category?: string;
  /**
   * Did `category` come from an exact curriculum listing, or from a mere
   * shared code start (default: listed)? A candidate wears the amber
   * open-elective look instead of the curriculum emerald.
   */
  curriculumListed?: boolean;
  /**
   * The grade-history rule for this course, or null when none applies. A
   * blocked badge (`S` already earned) comes with `disabled` from the host —
   * this card renders the badge either way.
   */
  grade?: GradeBadge | null;
  /**
   * The same record, set big at the card's right edge (see `gradeLetter`):
   * the badge says the RULE, the letter says what was actually earned.
   */
  letter?: GradeLetter | null;
  /** Selection disallowed (a completed `S` subject). Mutes the whole card. */
  disabled?: boolean;
}

/** Search result row shared by planner target locks and generator focus locks. */
export function TargetCourseLockCard({
  course,
  offerings,
  selection,
  onSelectionChange,
  tone = "purple",
  category,
  curriculumListed = true,
  grade = null,
  letter = null,
  disabled = false,
}: TargetCourseLockCardProps) {
  const isSelected = Boolean(selection);
  const cardToneClass = disabled
    ? "border-border-strong/50 bg-surface-secondary/20 opacity-60"
    : tone === "neutral"
      ? isSelected
        ? "border-zinc-500/50 bg-zinc-500/[0.08] shadow-sm dark:border-zinc-400/40 dark:bg-zinc-400/[0.08]"
        : "border-zinc-200/80 bg-zinc-500/[0.025] hover:border-zinc-300 hover:bg-zinc-500/[0.06] dark:border-zinc-800 dark:bg-zinc-500/[0.04] dark:hover:border-zinc-700 dark:hover:bg-zinc-500/[0.08]"
      : isSelected
        ? "border-purple-500/50 bg-surface-secondary/30 shadow-sm"
        : "border-transparent bg-transparent hover:border-border-strong hover:bg-surface-secondary/50";
  const uniqueSlots = Array.from(new Set(offerings.flatMap((offering) => splitSlots(offering.SLOT)))).sort();

  const toggleSlots = (slots: string[]) => {
    if (!selection) return;
    const allSelected = slots.length > 0 && slots.every((slot) => selection.allowedSlots.includes(slot));
    const nextSlots = allSelected
      ? selection.allowedSlots.filter((slot) => !slots.includes(slot))
      : [...new Set([...selection.allowedSlots, ...slots])];
    onSelectionChange({ ...selection, allowedSlots: nextSlots });
  };

  const clusterMap = new Map<string, { letter: string; slots: string[] }>();
  const letterMap = new Map<string, string[]>();
  const getSlotCluster = (slot: string): { cluster: string; letter: string } => {
    const normalized = slot.trim().toUpperCase();
    const theoryMatch = normalized.match(/^[T]*([A-G])([1-2])$/);
    if (theoryMatch) return { cluster: `${theoryMatch[1]}${theoryMatch[2]}`, letter: theoryMatch[1] };
    const labMatch = normalized.match(/^L([0-9]+)$/);
    if (labMatch) {
      const number = Number.parseInt(labMatch[1], 10);
      return { cluster: number <= 30 ? "Lab (Morning)" : "Lab (Evening)", letter: "Lab" };
    }
    const generalMatch = normalized.match(/^[T]*([A-Z])([0-9]+)?$/);
    if (generalMatch) {
      return {
        cluster: generalMatch[2] ? `${generalMatch[1]}${generalMatch[2]}` : generalMatch[1],
        letter: generalMatch[1],
      };
    }
    return { cluster: normalized, letter: normalized };
  };

  for (const slot of uniqueSlots) {
    const { cluster, letter } = getSlotCluster(slot);
    const clusterSlots = clusterMap.get(cluster)?.slots ?? [];
    clusterSlots.push(slot);
    clusterMap.set(cluster, { letter, slots: clusterSlots });
    const letterSlots = letterMap.get(letter) ?? [];
    letterSlots.push(slot);
    letterMap.set(letter, letterSlots);
  }

  const clusters = [...clusterMap.entries()].sort(([a], [b]) => a.localeCompare(b));
  const broadLetters = [...letterMap.keys()].sort().filter((letter) => {
    const totalSlots = letterMap.get(letter)?.length ?? 0;
    const firstClusterSlots = clusterMap.get(`${letter}1`)?.slots.length ?? 0;
    return totalSlots > firstClusterSlots;
  });

  return (
    <div className={`w-full min-w-0 flex flex-col gap-2 rounded-xl border p-3 transition-colors ${cardToneClass}`}>
      <label className={`flex items-start gap-3 ${disabled ? "cursor-not-allowed" : "cursor-pointer"}`}>
        <input
          type="checkbox"
          className="mt-1 rounded bg-surface border-border-strong text-purple-500 focus:ring-purple-500/30 disabled:opacity-50"
          checked={isSelected}
          disabled={disabled}
          onChange={(event) => {
            if (event.target.checked) {
              onSelectionChange({
                code: course.code,
                title: course.title,
                allowedSlots: [],
                allowedFaculty: [],
              });
            } else {
              onSelectionChange(null);
            }
          }}
        />
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
            <span className="flex min-w-0 flex-col gap-1">
              <span className="font-bold text-base text-text-heading">{course.code}</span>
              <span className="flex flex-wrap items-center gap-1">
                {renderCourseTypeChips(course.types ?? [], "sm")}
                {grade && (
                  <span title={grade.title} className={GRADE_BADGE_TONE_CLASSES[grade.tone]}>
                    {grade.text}
                  </span>
                )}
                {category && (
                  <span
                    title={
                      curriculumListed
                        ? `In your curriculum — counts toward ${category}`
                        : "Not in your curriculum — shares a code start with a course that is (open-elective candidate)"
                    }
                    className={`rounded-md border px-1.5 py-0.5 text-[10px] font-bold ${
                      curriculumListed
                        ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-500"
                        : "border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400"
                    }`}
                  >
                    {category}
                  </span>
                )}
              </span>
            </span>
            {(letter || (course.batches && course.batches.length > 0)) && (
              <span className="flex flex-wrap items-center gap-1.5 sm:shrink-0">
                {course.batches?.map((batch) => (
                  <span
                    key={batch}
                    className={`rounded-md border px-2 py-0.5 text-xs font-bold ${getBatchColorClass(batch)}`}
                  >
                    {batch}
                  </span>
                ))}
                {letter && (
                  <span title={letter.title} className={letter.className}>
                    {letter.text}
                  </span>
                )}
              </span>
            )}
          </span>
          <span className="line-clamp-2 text-xs text-muted-foreground">{course.title}</span>
        </span>
      </label>

      {isSelected && uniqueSlots.length > 1 && selection && (
        <div className="mt-2 space-y-2 pl-8">
          <div className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
            Filter Slots (Optional)
          </div>
          {clusters.length > 0 && (
            <div className="space-y-1">
              <div className="text-[10px] font-bold uppercase text-text-heading/70">Quick Select Slot Bundles</div>
              <div className="flex flex-wrap gap-1.5">
                {clusters.map(([cluster, value]) => {
                  const selected =
                    value.slots.length > 0 && value.slots.every((slot) => selection.allowedSlots.includes(slot));
                  const label = cluster.endsWith("1") || cluster.endsWith("2") ? `${cluster} Slots` : cluster;
                  return (
                    <button
                      key={cluster}
                      type="button"
                      onClick={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        toggleSlots(value.slots);
                      }}
                      className={`flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-bold transition-colors ${selected ? "bg-purple-500 text-white shadow-sm ring-1 ring-purple-300" : "bg-surface-secondary text-text-heading/70 hover:bg-surface-secondary/80"}`}
                      title={`Toggle ${cluster} bundle (${value.slots.join(", ")})`}
                    >
                      <span>{label}</span>
                      <span className="text-[10px] font-normal opacity-80">({value.slots.join(", ")})</span>
                    </button>
                  );
                })}
                {broadLetters.map((letter) => {
                  const letterSlots = letterMap.get(letter) ?? [];
                  const selected =
                    letterSlots.length > 0 && letterSlots.every((slot) => selection.allowedSlots.includes(slot));
                  return (
                    <button
                      key={`broad-${letter}`}
                      type="button"
                      onClick={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        toggleSlots(letterSlots);
                      }}
                      className={`rounded px-2 py-1 text-xs font-bold transition-colors ${selected ? "bg-indigo-600 text-white shadow-sm" : "bg-surface-secondary/60 text-muted-foreground hover:bg-surface-secondary"}`}
                      title={`Toggle all ${letter} series (${letterSlots.join(", ")})`}
                    >
                      All {letter} Series
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <div className="flex flex-wrap gap-2 pr-1">
            {uniqueSlots.map((slot) => {
              const checked = selection.allowedSlots.includes(slot);
              const facultyCount =
                new Set(
                  offerings
                    .filter((offering) => offering.SLOT === slot)
                    .map((offering) => offering.FACULTY.trim().toLowerCase()),
                ).size || 1;
              return (
                <label
                  key={slot}
                  className={`flex cursor-pointer items-center gap-2 rounded-md border p-1.5 px-3 transition-colors ${checked ? "border-purple-500/30 bg-purple-500/10 text-purple-600" : "border-border-strong/50 text-muted-foreground hover:bg-surface-secondary/50"}`}
                >
                  <input
                    type="checkbox"
                    className="h-3.5 w-3.5 rounded border-border-strong text-purple-500 focus:ring-purple-500/30"
                    checked={checked}
                    onChange={(event) => {
                      const nextSlots = event.target.checked
                        ? [...selection.allowedSlots, slot]
                        : selection.allowedSlots.filter((current) => current !== slot);
                      onSelectionChange({ ...selection, allowedSlots: nextSlots });
                    }}
                  />
                  <span className="text-xs font-bold">{slot}</span>
                  <span
                    className="inline-flex shrink-0 items-center gap-1 rounded border border-border-strong/70 bg-surface-secondary/70 px-1 py-0.2 text-[10px] font-semibold text-muted-foreground"
                    title={`${facultyCount} ${facultyCount === 1 ? "faculty" : "faculties"} teaching this slot`}
                  >
                    <Users className="h-2.5 w-2.5 shrink-0 text-muted-foreground/60" />
                    <span>{facultyCount}</span>
                  </span>
                </label>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
