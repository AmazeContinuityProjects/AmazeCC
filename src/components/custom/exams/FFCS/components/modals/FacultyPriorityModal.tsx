"use client";

import React, { useEffect, useMemo, useState } from "react";
import { ArrowDown, ArrowUp, ListOrdered, Plus, X } from "lucide-react";
import BottomSheet from "../../../../shared/BottomSheet";
import { splitFacultyNames } from "@/lib/ffcsFacultyPriority";
import type { ParsedCourse } from "../../types";

/**
 * Per-course faculty ranking — "I'd rather have Prof A than Prof B".
 *
 * The one thing FFCS-inator's picker has that ours did not: a hand-ordered
 * list of the faculties offering a course, driving generation instead of an
 * aggregate score. Move up/down rather than drag: this list is short (a course
 * has a handful of faculties), the arrows are keyboard-reachable, and the
 * planner's own ranking-priority control already established the pattern
 * (`FFCSGuidedSelector`'s combined ranking order) — two drag implementations
 * in one product would be one more than needed.
 *
 * The order persists per course code in `ffcs_facultyPriority` and is read
 * fresh by every generation run; nothing else in the UI reorders because of it.
 */
export interface FacultyPriorityModalProps {
  isOpen: boolean;
  onClose: () => void;
  courseCode: string;
  courseTitle: string;
  /** Every report row for this course code — the pool the ranking draws from. */
  offerings: readonly ParsedCourse[];
  /**
   * The faculties the student has already picked for this course (from the
   * lock's `allowedFaculty` and/or the chosen offerings). When non-empty the
   * pool is scoped to these names — you rank *among your selection*, not the
   * whole catalogue. Generation already filters to the selection before it
   * applies the ranking, so a scoped list is exactly the order it will use.
   */
  selectedFaculties?: readonly string[];
  /** Current saved order for this course, best first. */
  priority: readonly string[];
  onSave: (order: string[]) => void;
}

type FacultyOption = { name: string; count: number };

export default function FacultyPriorityModal({
  isOpen,
  onClose,
  courseCode,
  courseTitle,
  offerings,
  selectedFaculties,
  priority,
  onSave,
}: FacultyPriorityModalProps) {
  const [ordered, setOrdered] = useState<string[]>([]);
  const [pending, setPending] = useState<string>("");

  // The scope: case-insensitive names the student has selected for this
  // course, or null when nothing is selected — then the whole catalogue is
  // the pool, exactly as before.
  const selectedKeys = useMemo(() => {
    if (!selectedFaculties || selectedFaculties.length === 0) return null;
    return new Set(selectedFaculties.map((name) => name.trim().toLowerCase()));
  }, [selectedFaculties]);

  // The pool: distinct names across every row of this code, with how many
  // offerings each teaches. Split on `/` so a combined theory/lab row's two
  // teachers are both orderable — matching how the generator matches them.
  // When the student has a selection, only the selected names stay in the
  // pool: the ranking is built among the faculties they will actually sit,
  // and everyone else is noise the solver would filter out anyway.
  const pool = useMemo<FacultyOption[]>(() => {
    const counts = new Map<string, number>();
    for (const row of offerings) {
      for (const name of splitFacultyNames(row.FACULTY)) {
        if (selectedKeys && !selectedKeys.has(name.toLowerCase())) continue;
        counts.set(name, (counts.get(name) ?? 0) + 1);
      }
    }
    return Array.from(counts.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [offerings, selectedKeys]);

  // Saved order first, then everyone else alphabetically — the saved list is
  // the answer, the remainder is the menu for extending it.
  const initial = useMemo(() => {
    const inPool = new Set(pool.map((option) => option.name));
    const saved = priority.filter((name) => inPool.has(name));
    const rest = pool.map((option) => option.name).filter((name) => !saved.includes(name));
    return [...saved, ...rest];
  }, [pool, priority]);

  useEffect(() => {
    if (isOpen) {
      setOrdered(initial);
      setPending("");
    }
  }, [isOpen, initial]);

  if (!isOpen) return null;

  const remaining = pool.filter((option) => !ordered.includes(option.name));
  const countOf = (name: string) => pool.find((option) => option.name === name)?.count ?? 0;

  const move = (index: number, direction: -1 | 1) => {
    setOrdered((prev) => {
      const next = [...prev];
      const target = index + direction;
      if (target < 0 || target >= next.length) return prev;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  };

  const remove = (name: string) => setOrdered((prev) => prev.filter((entry) => entry !== name));

  const add = () => {
    if (!pending) return;
    setOrdered((prev) => [...prev, pending]);
    setPending("");
  };

  const handleSave = () => {
    // Saved as the full pool order minus removals: a removed name is the
    // student saying "not this one", which is expressed by its absence —
    // every listed name outranks every unlisted one, removal included.
    onSave(ordered);
    onClose();
  };

  return (
    <BottomSheet
      onClose={onClose}
      overlayId="ffcs-faculty-priority-modal"
      maxWidth="max-w-lg"
      panelZIndex={350}
      backdropZIndex={345}
      contentClassName="space-y-4"
      title="Faculty priority"
      subtitle={`Choose the order you'd prefer faculties in ${courseCode} — generation searches and ranks plans in this order.`}
      icon={<ListOrdered className="w-5 h-5" />}
      accent="bg-indigo-500/10 border-indigo-500/20 text-indigo-500"
    >
      <p className="text-xs text-muted-foreground leading-relaxed -mt-1">
        {courseTitle}
        <span className="block mt-1 text-[11px]">
          #1 is searched first. Faculties you remove rank below every name you keep.
        </span>
        {selectedKeys && (
          <span className="mt-1.5 block rounded-lg border border-indigo-500/20 bg-indigo-500/5 px-2 py-1.5 text-[11px] text-indigo-500 dark:text-indigo-400">
            Ranked among the {pool.length} {pool.length === 1 ? "faculty" : "faculties"} you selected for {courseCode} —
            generation only considers these for this course.
          </span>
        )}
      </p>

      <ol className="space-y-2" aria-label={`Faculty priority for ${courseCode}`}>
        {ordered.map((name, index) => (
          <li
            key={name}
            className="flex items-center gap-2.5 p-2.5 rounded-xl border border-border-strong bg-surface-secondary/50"
          >
            <span
              className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-black shrink-0 border ${
                index === 0
                  ? "bg-indigo-500/15 border-indigo-500/30 text-indigo-400"
                  : "bg-surface-secondary border-border-strong text-muted-foreground"
              }`}
              aria-hidden="true"
            >
              {index + 1}
            </span>
            <span className="flex-1 min-w-0 text-sm text-text-heading font-semibold truncate">{name}</span>
            <span className="text-[10px] font-bold text-muted-foreground bg-surface-secondary border border-border-strong/60 px-1.5 py-0.5 rounded-md shrink-0 whitespace-nowrap">
              {countOf(name)} offering{countOf(name) === 1 ? "" : "s"}
            </span>
            <span className="flex items-center shrink-0">
              <button
                type="button"
                onClick={() => move(index, -1)}
                disabled={index === 0}
                aria-label={`Move ${name} up`}
                className="p-1.5 rounded-lg text-muted-foreground hover:text-indigo-400 hover:bg-indigo-500/10 disabled:opacity-30 transition-colors"
              >
                <ArrowUp className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => move(index, 1)}
                disabled={index === ordered.length - 1}
                aria-label={`Move ${name} down`}
                className="p-1.5 rounded-lg text-muted-foreground hover:text-indigo-400 hover:bg-indigo-500/10 disabled:opacity-30 transition-colors"
              >
                <ArrowDown className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => remove(name)}
                aria-label={`Remove ${name} from the ranking`}
                className="p-1.5 rounded-lg text-muted-foreground hover:text-red-400 hover:bg-red-500/10 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </span>
          </li>
        ))}
        {ordered.length === 0 && (
          <li className="p-3 rounded-xl border border-dashed border-border-strong text-xs text-muted-foreground text-center">
            No faculties listed. Add them below to set a preference.
          </li>
        )}
      </ol>

      {remaining.length > 0 && (
        <div className="flex items-center gap-2">
          <select
            value={pending}
            onChange={(event) => setPending(event.target.value)}
            aria-label="Add a faculty to the ranking"
            className="flex-1 min-w-0 h-10 px-3 rounded-xl bg-surface-secondary border border-border-strong text-sm text-text-heading focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
          >
            <option value="">Add a faculty…</option>
            {remaining.map((option) => (
              <option key={option.name} value={option.name}>
                {option.name} · {option.count} offering{option.count === 1 ? "" : "s"}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={add}
            disabled={!pending}
            className="h-10 px-3.5 rounded-xl bg-indigo-500/15 border border-indigo-500/30 text-indigo-300 text-sm font-bold flex items-center gap-1.5 disabled:opacity-40 hover:bg-indigo-500/25 transition-colors shrink-0"
          >
            <Plus className="w-4 h-4" /> Add
          </button>
        </div>
      )}

      <div className="flex items-center justify-end gap-2 pt-1 border-t border-border-strong/60">
        <button
          type="button"
          onClick={onClose}
          className="px-4 h-10 rounded-xl text-sm font-semibold text-muted-foreground hover:bg-surface-secondary transition-colors"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={handleSave}
          className="px-4 h-10 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-bold transition-colors"
        >
          Save order
        </button>
      </div>
    </BottomSheet>
  );
}
