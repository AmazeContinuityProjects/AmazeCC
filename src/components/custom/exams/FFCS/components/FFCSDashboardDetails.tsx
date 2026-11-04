"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  BookOpen,
  CalendarDays,
  Clock3,
  FileDown,
  FileText,
  GraduationCap,
  Moon,
  PlusCircle,
  Smile,
  Star,
  Sun,
  Trash2,
  Users,
} from "lucide-react";
import BottomSheet from "../../../shared/BottomSheet";
import { FacultyAvatar } from "./FacultyAvatar";
import type { AddedCourse } from "@/lib/ffcsTypes";
import { periodsForSlot } from "@/lib/slots";
import { dayOccupancy, freeHalfDays, timetableMetrics } from "@/lib/timetableMetrics";
import { getTimetableSchema } from "@/lib/campusSchema";
import { getFacultyReview, loadVitfacCatalog, useVitfacEnabled, useVitfacReview } from "@/lib/vitfacService";

/**
 * The dashboard detail sheets of FFCSDashboardHeader: the mobile widget sheet,
 * the clash / weekly-rhythm / course-quality detail views and the small types
 * they share. Extracted verbatim from the header; everything here is rendered
 * by the header body, while the shared stat-tile sizing helpers
 * (`STAT_TILE_MIN_WIDTH`, `getFittingStatTileCount`) stay in the header — the
 * generator strip and its test import them from there.
 */

export type UtilityTab = "timetables" | "social" | "faculty" | "export";
export type MobileWidget = UtilityTab | "selected-course";

export const UTILITY_TABS: Array<{
  value: UtilityTab;
  label: string;
  description: string;
  Icon: React.ElementType;
  iconClass: string;
}> = [
  {
    value: "timetables",
    label: "Timetable Actions",
    description: "Switch plans, rename, duplicate, or back up.",
    Icon: CalendarDays,
    iconClass: "bg-indigo-500/10 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 border-indigo-500/20",
  },
  {
    value: "social",
    label: "Social & Friends",
    description: "Compare schedules and manage friend groups.",
    Icon: Users,
    iconClass: "bg-rose-500/10 dark:bg-rose-500/20 text-rose-600 dark:text-rose-400 border-rose-500/20",
  },
  {
    value: "faculty",
    label: "Faculty & Reviews",
    description: "Explore faculty schedules and reviews.",
    Icon: GraduationCap,
    iconClass: "bg-violet-500/10 dark:bg-violet-500/20 text-violet-600 dark:text-violet-400 border-violet-500/20",
  },
  {
    value: "export",
    label: "Export Dossier",
    description: "Download, print, or share your timetable.",
    Icon: FileDown,
    iconClass: "bg-sky-500/10 dark:bg-sky-500/20 text-sky-600 dark:text-sky-400 border-sky-500/20",
  },
];

export function MobileWidgetSheet({
  isMobile,
  widget,
  onClose,
  children,
}: {
  isMobile: boolean;
  widget: MobileWidget | null;
  onClose: () => void;
  children: React.ReactNode;
}) {
  if (!isMobile) return <>{children}</>;
  if (!widget) return null;
  const widgetInfo = UTILITY_TABS.find((tab) => tab.value === widget);
  const title = widgetInfo?.label ?? "Configure Selected Course";
  const subtitle = widgetInfo?.description ?? "Choose a slot and faculty for the selected course.";
  const Icon = widgetInfo?.Icon ?? PlusCircle;

  return (
    <BottomSheet
      onClose={onClose}
      overlayId="ffcs-mobile-widget"
      maxWidth="max-w-2xl"
      title={title}
      subtitle={subtitle}
      icon={<Icon className="w-5 h-5" />}
      accent={widgetInfo?.iconClass ?? "bg-indigo-500/10 text-indigo-600 border-indigo-500/20 dark:text-indigo-400"}
    >
      {children}
    </BottomSheet>
  );
}
export type DashboardStat = {
  id: string;
  label: string;
  value: React.ReactNode;
  sub: React.ReactNode;
  badge?: React.ReactNode;
  tone: string;
  className?: string;
};

const DAY_LABELS: Record<string, string> = {
  mon: "Monday",
  tue: "Tuesday",
  wed: "Wednesday",
  thu: "Thursday",
  fri: "Friday",
};

export type CourseClash = {
  courseA: AddedCourse;
  courseB: AddedCourse;
  periodA: ReturnType<typeof periodsForSlot>[number];
  periodB: ReturnType<typeof periodsForSlot>[number];
};

export type BlockedSlotClash = {
  course: AddedCourse;
  slot: string;
};

export function ClashDetails({
  courseClashes,
  blockedSlotClashes,
  onRemoveCourse,
  onClose,
}: {
  courseClashes: CourseClash[];
  blockedSlotClashes: BlockedSlotClash[];
  onRemoveCourse: (id: string) => void;
  onClose: () => void;
}) {
  return (
    <BottomSheet
      onClose={onClose}
      overlayId="ffcs-clash-details"
      maxWidth="max-w-2xl"
      title="Clashing Courses"
      subtitle="Review conflicting course and faculty choices"
      icon={<AlertTriangle className="w-5 h-5" />}
      accent="bg-red-500/10 text-red-600 border-red-500/20 dark:text-red-400"
    >
      {courseClashes.length === 0 && blockedSlotClashes.length === 0 ? (
        <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4 text-sm font-semibold text-emerald-700 dark:text-emerald-400">
          This timetable has no course or blocked-slot clashes.
        </div>
      ) : (
        <div className="space-y-3">
          {courseClashes.map(({ courseA, courseB, periodA, periodB }) => (
            <section
              key={`${courseA.id}-${courseB.id}`}
              className="rounded-xl border border-red-500/20 bg-red-500/[0.03] p-3"
            >
              <p className="mb-3 flex items-center gap-1.5 text-xs font-bold text-red-700 dark:text-red-400">
                <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                {DAY_LABELS[periodA.day] ?? periodA.day}: {periodA.start}–{periodA.end}
              </p>
              <div className="grid gap-2 sm:grid-cols-2">
                {[courseA, courseB].map((course) => (
                  <div
                    key={course.id}
                    className="flex min-w-0 items-center gap-2 rounded-lg border border-border-strong bg-surface p-2"
                  >
                    <FacultyAvatar employeeId={course.employeeId} name={course.faculty} size="sm" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-extrabold text-text-heading">{course.code}</p>
                      <p className="truncate text-[11px] text-muted-foreground">
                        {course.faculty || "Faculty not listed"}
                      </p>
                      <p className="truncate text-[10px] font-semibold text-muted-foreground">
                        {course.slots.join(" + ") || "No slot"}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => onRemoveCourse(course.id)}
                      aria-label={`Remove ${course.code} — ${course.faculty || "faculty not listed"}`}
                      className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-red-500/20 text-red-600 transition-colors hover:bg-red-500/10 dark:text-red-400"
                      title={`Remove ${course.code} and its faculty choice`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
              {periodA.start !== periodB.start || periodA.end !== periodB.end ? (
                <p className="mt-2 text-[10px] text-muted-foreground">
                  {courseB.code} period: {periodB.start}–{periodB.end}
                </p>
              ) : null}
            </section>
          ))}
          {blockedSlotClashes.map(({ course, slot }) => (
            <section
              key={`${course.id}-${slot}`}
              className="flex items-center gap-2 rounded-xl border border-amber-500/20 bg-amber-500/[0.03] p-3"
            >
              <FacultyAvatar employeeId={course.employeeId} name={course.faculty} size="sm" />
              <div className="min-w-0 flex-1">
                <p className="text-xs font-extrabold text-text-heading">
                  {course.code} · blocked slot {slot}
                </p>
                <p className="truncate text-[11px] text-muted-foreground">
                  {course.faculty || "Faculty not listed"} · {course.slots.join(" + ")}
                </p>
              </div>
              <button
                type="button"
                onClick={() => onRemoveCourse(course.id)}
                aria-label={`Remove ${course.code} — ${course.faculty || "faculty not listed"}`}
                className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-red-500/20 text-red-600 transition-colors hover:bg-red-500/10 dark:text-red-400"
                title={`Remove ${course.code} and its faculty choice`}
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </section>
          ))}
        </div>
      )}
    </BottomSheet>
  );
}

export function WeeklyRhythmDetails({ courses, onClose }: { courses: AddedCourse[]; onClose: () => void }) {
  const schema = getTimetableSchema();
  const vitfacEnabled = useVitfacEnabled();
  const metrics = useMemo(() => timetableMetrics(courses, schema), [courses, schema]);
  const free = useMemo(() => new Set(freeHalfDays(courses, schema)), [courses, schema]);
  const days = useMemo(
    () =>
      ["mon", "tue", "wed", "thu", "fri"].map((day) => ({
        id: day,
        label: DAY_LABELS[day],
        ...dayOccupancy(courses, schema, day as "mon" | "tue" | "wed" | "thu" | "fri"),
        gapMinutes: metrics.gapsPerDay[day] ?? 0,
      })),
    [courses, metrics, schema],
  );
  const totalClassHours =
    days.reduce(
      (total, day) => total + day.classes.reduce((daily, item) => daily + item.endMin - item.startMin, 0),
      0,
    ) / 60;
  const firstClass = days
    .flatMap((day) => day.classes.map((item) => ({ ...item, day: day.label })))
    .sort((a, b) => a.startMin - b.startMin)[0];
  const lastClass = days
    .flatMap((day) => day.classes.map((item) => ({ ...item, day: day.label })))
    .sort((a, b) => b.endMin - a.endMin)[0];
  const maxGapDay = [...days].sort((a, b) => b.gapMinutes - a.gapMinutes)[0];
  const theoryPeriods = courses.flatMap((course) =>
    course.slots.flatMap((slot) => periodsForSlot(schema, slot).filter((period) => period.type === "theory")),
  );
  const hasMorningTheory = theoryPeriods.some((period) => period.startMin < 840);
  const hasEveningTheory = theoryPeriods.some((period) => period.startMin >= 840);
  const freeLabels = [...free].map((halfDay) => {
    const [day, half] = halfDay.split("_");
    return `${DAY_LABELS[day] ?? day} ${half}`;
  });
  const faculty = useMemo(() => {
    const unique = new Map<string, AddedCourse>();
    courses.forEach((course) => {
      const key = course.employeeId || course.faculty.trim().toLowerCase();
      if (key && !unique.has(key)) unique.set(key, course);
    });
    return [...unique.values()];
  }, [courses]);
  const [facultyReviews, setFacultyReviews] = useState<ReturnType<typeof getFacultyReview>[]>([]);
  const [facultyLoading, setFacultyLoading] = useState(false);

  useEffect(() => {
    let active = true;
    setFacultyLoading(true);
    void loadVitfacCatalog()
      .then(() => {
        if (!active) return;
        setFacultyReviews(
          faculty.map((course) => getFacultyReview({ employeeId: course.employeeId, name: course.faculty })),
        );
      })
      .catch((error: unknown) => {
        console.error("Failed to load faculty metrics for weekly rhythm:", error);
      })
      .finally(() => {
        if (active) setFacultyLoading(false);
      });
    return () => {
      active = false;
    };
  }, [faculty]);

  const reviewedFaculty = faculty
    .map((course, index) => ({ course, review: facultyReviews[index] }))
    .filter(
      (entry): entry is { course: AddedCourse; review: NonNullable<typeof entry.review> } =>
        !!entry.review && entry.review.reviews > 0,
    );
  const averageWinRate = reviewedFaculty.length
    ? Math.round(reviewedFaculty.reduce((sum, entry) => sum + entry.review.wPct, 0) / reviewedFaculty.length)
    : null;
  const averageDaScore = reviewedFaculty.filter((entry) => typeof entry.review.metrics?.da === "number");
  const averageDa = averageDaScore.length
    ? averageDaScore.reduce((sum, entry) => sum + (entry.review.metrics?.da ?? 0), 0) / averageDaScore.length
    : null;
  const bestFaculty = [...reviewedFaculty].sort((a, b) => b.review.wPct - a.review.wPct)[0];
  const worstFaculty = [...reviewedFaculty].sort((a, b) => a.review.wPct - b.review.wPct)[0];
  const facultyQualitySummary = (entry: (typeof reviewedFaculty)[number] | undefined) => {
    if (!entry) return "No Vitfac reviews for this timetable";
    const { review } = entry;
    const qualities = [
      typeof review.metrics?.lecture === "number" ? `Lecture ${review.metrics.lecture.toFixed(1)}/5` : null,
      typeof review.metrics?.da === "number" ? `DA ${review.metrics.da.toFixed(1)}/5` : null,
      typeof review.metrics?.vibe === "number" ? `Vibe ${review.metrics.vibe.toFixed(1)}/5` : null,
    ].filter(Boolean);
    const lore = [
      ...(review.lore?.green?.slice(0, 2).map((item) => item.text) ?? []),
      ...(review.lore?.red?.slice(0, 2).map((item) => item.text) ?? []),
    ];
    return [qualities.length ? qualities.join(" · ") : "No quality breakdown", ...lore].join(" · ");
  };
  const stats = [
    { label: "Free half-days", value: `${free.size} / 10` },
    { label: "Class days", value: `${days.filter((day) => day.classes.length > 0).length} / 5` },
    { label: "Weekly class time", value: `${Number(totalClassHours.toFixed(1))} hours` },
    { label: "Gaps between classes", value: `${(metrics.gaps / 60).toFixed(1)} hours` },
    { label: "Building dashes", value: String(metrics.buildingDashes) },
    { label: "Long weekend", value: metrics.isLongWeekend ? "Yes" : "No" },
    { label: "Morning theory", value: hasMorningTheory ? "Yes" : "No" },
    { label: "Evening theory", value: hasEveningTheory ? "Yes" : "No" },
    // Faculty ratings are Vitfac data; off, they leave the stats board too.
    ...(vitfacEnabled
      ? [
          {
            label: "Faculty average win rate",
            value: facultyLoading ? "Loading…" : averageWinRate === null ? "No reviews" : `${averageWinRate}%`,
          },
          {
            label: "Faculty average DA marks",
            value: facultyLoading ? "Loading…" : averageDa === null ? "No reviews" : `${averageDa.toFixed(1)} / 5`,
          },
          {
            label: "Best faculty",
            value: facultyLoading
              ? "Loading…"
              : bestFaculty
                ? `${bestFaculty.course.faculty} · ${bestFaculty.review.wPct}% W`
                : "No reviews",
          },
          {
            label: "Worst faculty",
            value: facultyLoading
              ? "Loading…"
              : worstFaculty
                ? `${worstFaculty.course.faculty} · ${worstFaculty.review.wPct}% W`
                : "No reviews",
          },
        ]
      : []),
    { label: "Earliest class start", value: firstClass ? `${firstClass.start} · ${firstClass.day}` : "No classes" },
    { label: "Latest class end", value: lastClass ? `${lastClass.end} · ${lastClass.day}` : "No classes" },
    {
      label: "Most gap time",
      value: maxGapDay?.gapMinutes ? `${maxGapDay.label} · ${(maxGapDay.gapMinutes / 60).toFixed(1)} hours` : "No gaps",
    },
  ];

  return (
    <BottomSheet
      onClose={onClose}
      overlayId="ffcs-weekly-rhythm-details"
      maxWidth="max-w-2xl"
      title="Weekly Rhythm"
      subtitle="Schedule, gaps, half-days, and faculty signals"
      icon={<Clock3 className="w-5 h-5" />}
      accent="bg-emerald-500/10 text-emerald-600 border-emerald-500/20 dark:text-emerald-400"
    >
      <div className="space-y-4">
        {vitfacEnabled && (
          <section className="space-y-2">
            <h3 className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
              Faculty ratings in this timetable
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {[
                { label: "Best faculty", entry: bestFaculty, tone: "emerald" },
                { label: "Worst faculty", entry: worstFaculty, tone: "amber" },
              ].map(({ label, entry, tone }) => (
                <div
                  key={label}
                  className={`rounded-xl border p-3 ${tone === "emerald" ? "border-emerald-500/20 bg-emerald-500/5" : "border-amber-500/20 bg-amber-500/5"}`}
                >
                  <p className="text-[10px] uppercase font-bold tracking-wide text-muted-foreground">{label}</p>
                  {entry ? (
                    <>
                      <div className="mt-1 flex items-center gap-2">
                        <FacultyAvatar employeeId={entry.course.employeeId} name={entry.course.faculty} size="md" />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-extrabold text-text-heading">{entry.course.faculty}</p>
                          <span
                            className={`text-xs font-black ${tone === "emerald" ? "text-emerald-700 dark:text-emerald-400" : "text-amber-700 dark:text-amber-400"}`}
                          >
                            {entry.review.wPct}% W
                          </span>
                        </div>
                      </div>
                      <p className="text-[10px] leading-relaxed text-muted-foreground mt-1">
                        {facultyQualitySummary(entry)}
                      </p>
                      <p className="text-[10px] text-muted-foreground mt-1">
                        {entry.review.reviews} student review{entry.review.reviews === 1 ? "" : "s"}
                      </p>
                    </>
                  ) : (
                    <p className="text-xs text-muted-foreground mt-1">
                      {facultyLoading ? "Loading faculty reviews…" : "No reviewed faculty in this timetable."}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}

        <section className="space-y-2">
          <h3 className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Day-by-day schedule</h3>
          <div className="space-y-2">
            {days.map((day) => (
              <div key={day.id} className="rounded-xl border border-border-strong bg-surface p-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-bold text-text-heading">{day.label}</span>
                  <span className="text-[11px] text-muted-foreground">{(day.gapMinutes / 60).toFixed(1)}h gaps</span>
                </div>
                <div className="flex flex-wrap gap-1.5 mt-2 text-[10px]">
                  <span
                    className={`inline-flex items-center gap-1 rounded-lg px-2 py-1 ${day.morningOccupied ? "bg-amber-500/10 text-amber-700 dark:text-amber-400" : "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"}`}
                  >
                    <Sun className="w-3 h-3" /> {day.morningOccupied ? "Morning classes" : "Free morning"}
                  </span>
                  <span
                    className={`inline-flex items-center gap-1 rounded-lg px-2 py-1 ${day.eveningOccupied ? "bg-indigo-500/10 text-indigo-700 dark:text-indigo-400" : "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"}`}
                  >
                    <Moon className="w-3 h-3" /> {day.eveningOccupied ? "Evening classes" : "Free evening"}
                  </span>
                </div>
                {day.classes.length > 0 && (
                  <p className="text-[11px] text-muted-foreground mt-2">
                    {day.classes[0].start}–{day.classes[day.classes.length - 1].end} · {day.classes.length} class period
                    {day.classes.length === 1 ? "" : "s"}
                  </p>
                )}
              </div>
            ))}
          </div>
        </section>
        <section className="space-y-2">
          <h3 className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Free half-days</h3>
          {freeLabels.length ? (
            <div className="flex flex-wrap gap-1.5">
              {freeLabels.map((label) => (
                <span
                  key={label}
                  className="rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-1 text-xs font-semibold text-emerald-700 dark:text-emerald-400"
                >
                  {label}
                </span>
              ))}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">No free half-days this week.</p>
          )}
        </section>
        {metrics.gapDetails.length > 0 && (
          <section className="space-y-2">
            <h3 className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Largest class gaps</h3>
            {[...metrics.gapDetails]
              .sort((a, b) => b.durationMins - a.durationMins)
              .slice(0, 5)
              .map((gap, index) => (
                <div
                  key={`${gap.day}-${gap.startMin}-${index}`}
                  className="flex items-center justify-between gap-3 text-xs rounded-lg bg-surface-secondary/60 px-3 py-2"
                >
                  <span className="font-semibold text-text-heading">
                    {DAY_LABELS[gap.day] ?? gap.day}: {gap.fromTime}–{gap.toTime}
                  </span>
                  <span className="text-muted-foreground shrink-0">{gap.durationMins} min</span>
                </div>
              ))}
          </section>
        )}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {stats.map((stat) => (
            <div key={stat.label} className="rounded-xl border border-border-strong bg-surface p-3">
              <p className="text-[10px] uppercase font-bold tracking-wide text-muted-foreground">{stat.label}</p>
              <p className="text-sm font-extrabold text-text-heading mt-1">{stat.value}</p>
            </div>
          ))}
        </div>
      </div>
    </BottomSheet>
  );
}

export function CourseOptionQuality({
  courseCode,
  slots,
  faculty,
  employeeId,
  clashes,
  selected,
  onSelect,
}: {
  courseCode: string;
  slots: string;
  faculty: string;
  employeeId?: string;
  clashes: string[];
  selected: boolean;
  onSelect: () => void;
}) {
  const { review, loading } = useVitfacReview(employeeId, faculty);
  const vitfacEnabled = useVitfacEnabled();
  const lore = review?.lore?.green?.slice(0, 2) ?? [];
  const cautionLore = review?.lore?.red?.slice(0, 2) ?? [];
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onSelect}
      className={`w-full rounded-xl border bg-surface p-2.5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 ${
        selected
          ? "border-indigo-500/60 bg-indigo-500/5 ring-1 ring-indigo-500/20"
          : "border-border-strong/70 hover:border-indigo-500/40 hover:bg-surface-secondary/40"
      }`}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <FacultyAvatar employeeId={employeeId} name={faculty} size="xs" />
          <span className="text-xs font-semibold text-text-heading truncate">{faculty || "Faculty not listed"}</span>
        </div>
        <span className="flex items-center gap-2">
          <span className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400">{slots || "No slot"}</span>
          <span
            className={`text-[9px] font-bold uppercase tracking-wide ${selected ? "text-indigo-600 dark:text-indigo-400" : "text-muted-foreground"}`}
          >
            {selected ? "Selected" : "Select"}
          </span>
        </span>
      </div>
      <div className="flex flex-wrap items-center gap-1.5 mt-2">
        {!vitfacEnabled ? null : loading ? (
          <span className="text-[10px] text-muted-foreground">Loading Vitfac…</span>
        ) : review && review.reviews > 0 ? (
          <>
            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 dark:text-emerald-400">
              <Star className="w-3 h-3" />
              {review.wPct}% W · {review.reviews} reviews
            </span>
            {review.metrics && (
              <>
                {typeof review.metrics.lecture === "number" && (
                  <span className="text-[10px] text-muted-foreground">
                    <BookOpen className="w-3 h-3 inline" /> {review.metrics.lecture.toFixed(1)}/5
                  </span>
                )}
                {typeof review.metrics.da === "number" && (
                  <span className="text-[10px] text-muted-foreground">
                    <FileText className="w-3 h-3 inline" /> DA {review.metrics.da.toFixed(1)}/5
                  </span>
                )}
                {typeof review.metrics.vibe === "number" && (
                  <span className="text-[10px] text-muted-foreground">
                    <Smile className="w-3 h-3 inline" /> {review.metrics.vibe.toFixed(1)}/5
                  </span>
                )}
              </>
            )}
            {typeof review.metrics?.da === "number" && (
              <span className="text-[10px] font-semibold text-purple-700 dark:text-purple-400">
                DA marks {review.metrics.da.toFixed(1)}/5
              </span>
            )}
            {lore.map((item) => (
              <span key={item.text} className="text-[10px] text-emerald-700 dark:text-emerald-400">
                {item.text}
              </span>
            ))}
            {cautionLore.map((item) => (
              <span key={item.text} className="text-[10px] text-amber-700 dark:text-amber-400">
                {item.text}
              </span>
            ))}
          </>
        ) : (
          <span className="text-[10px] text-muted-foreground">No Vitfac review data</span>
        )}
        {clashes.length ? (
          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-red-600 dark:text-red-400">
            <AlertTriangle className="w-3 h-3" /> Clash with {clashes.join(", ")}
          </span>
        ) : (
          <span className="text-[10px] font-semibold text-emerald-700 dark:text-emerald-400">No timetable clashes</span>
        )}
      </div>
      <span className="sr-only">{courseCode}</span>
    </button>
  );
}
