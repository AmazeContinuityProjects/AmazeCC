"use client";

import { useMemo, useState } from "react";
import { Target, X } from "lucide-react";
import SearchInput from "../../../shared/SearchInput";
import { SectionHeader } from "../../../shared/primitives";
import type { CourseLock, ParsedCourse } from "../types";
import { TargetCourseLockCard, type TargetCourseLockOption } from "./TargetCourseLockCard";

interface GeneratorTargetCoursesWidgetProps {
  reportCourses: readonly ParsedCourse[];
  isLoadingReport?: boolean;
  targets: readonly CourseLock[];
  onSelectionChange: (course: TargetCourseLockOption, selection: CourseLock | null) => void;
}

/**
 * Generator-owned target picker for the modern Courses pane. It mirrors the
 * planner's lock controls while using the active semester report and private
 * generator state.
 */
export function GeneratorTargetCoursesWidget({
  reportCourses,
  isLoadingReport = false,
  targets,
  onSelectionChange,
}: GeneratorTargetCoursesWidgetProps) {
  const [query, setQuery] = useState("");
  const catalog = useMemo(() => {
    const byCode = new Map<string, { course: TargetCourseLockOption; offerings: ParsedCourse[] }>();
    for (const row of reportCourses) {
      const code = row.CODE.trim();
      if (!code) continue;
      let entry = byCode.get(code);
      if (!entry) {
        entry = {
          course: { code, title: row.TITLE.trim() || code, types: [], batches: [] },
          offerings: [],
        };
        byCode.set(code, entry);
      }
      entry.offerings.push(row);
      for (const type of row.TYPE.split("+").map((value) => value.trim()).filter(Boolean)) {
        if (!entry.course.types?.includes(type)) entry.course.types?.push(type);
      }
      for (const batch of (row.BATCH ?? "").split(",").map((value) => value.trim()).filter(Boolean)) {
        if (!entry.course.batches?.includes(batch)) entry.course.batches?.push(batch);
      }
    }
    return [...byCode.values()].sort((a, b) => a.course.code.localeCompare(b.course.code));
  }, [reportCourses]);
  const targetByCode = useMemo(
    () => new Map(targets.map((target) => [target.code, target])),
    [targets]
  );
  const filteredCatalog = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase();
    return catalog.filter(
      ({ course }) =>
        course.code.toLocaleLowerCase().includes(normalizedQuery) ||
        course.title.toLocaleLowerCase().includes(normalizedQuery)
    );
  }, [catalog, query]);

  return (
    <section
      aria-label="Autogenerator target courses"
      className="w-full min-w-0 overflow-hidden rounded-2xl border border-indigo-500/20 bg-surface shadow-sm"
    >
      <header className="hidden border-b border-border-strong/60 bg-indigo-500/[0.035] px-4 py-4 sm:px-5 lg:block">
        <SectionHeader
          icon={Target}
          title="Target courses"
          count={targets.length}
          className="mb-2"
          right={(
            <span className="rounded-full border border-indigo-500/20 bg-indigo-500/10 px-2 py-1 text-[10px] font-semibold text-indigo-600 dark:text-indigo-300">
              Current semester
            </span>
          )}
        />
        <p className="px-1 text-xs leading-relaxed text-muted-foreground sm:text-sm">
          Lock onto courses for this generator run. Slot filters here stay separate from planner target locks.
        </p>
      </header>

      <div className="w-full min-w-0 space-y-4 p-4 sm:p-5">
      {targets.length > 0 && (
        <div role="group" aria-label="Selected generator target courses" className="flex flex-wrap gap-2">
          {targets.map((target) => (
            <div
              key={target.code}
              className="flex items-center gap-2 rounded-lg border border-purple-500/30 bg-purple-500/10 px-3 py-1.5 text-sm font-medium text-purple-500"
            >
              <span>{target.code}</span>
              <button
                type="button"
                aria-label={`Remove ${target.code} from generator targets`}
                onClick={() => onSelectionChange({ code: target.code, title: target.title }, null)}
                className="rounded-full p-0.5 transition-colors hover:bg-purple-500/20"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      <SearchInput
        placeholder="Search current semester report..."
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        containerClassName="mb-2"
        aria-label="Search current semester courses"
      />

      {isLoadingReport ? (
        <div role="status" className="rounded-xl border border-border-strong bg-surface-secondary/20 p-8 text-center text-sm text-muted-foreground">
          Loading the current semester report…
        </div>
      ) : catalog.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border-strong bg-surface-secondary/20 p-8 text-center text-sm text-muted-foreground">
          No courses are available in the current semester report.
        </div>
      ) : filteredCatalog.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border-strong bg-surface-secondary/20 p-8 text-center text-sm text-muted-foreground">
          No courses found matching “{query}”.
        </div>
      ) : (
        <div className="grid w-full min-w-0 max-h-[60vh] grid-cols-1 gap-2 overflow-y-auto custom-scrollbar">
          {filteredCatalog.map(({ course, offerings }) => (
            <TargetCourseLockCard
              key={course.code}
              course={course}
              offerings={offerings}
              selection={targetByCode.get(course.code)}
              tone="neutral"
              onSelectionChange={(selection) => onSelectionChange(course, selection)}
            />
          ))}
        </div>
      )}
      </div>
    </section>
  );
}
