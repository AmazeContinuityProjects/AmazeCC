"use client";

import { useMemo } from "react";
import {
  BookOpen,
  CalendarOff,
  CheckCircle2,
  ChevronRight,
  Clock,
  Download,
  ExternalLink,
  FileText,
  Flag,
  GraduationCap,
  ListChecks,
  Plus,
  Sparkles,
  StickyNote,
} from "lucide-react";
import { cn } from "@amazecontinuityprojects/amazeui";
import BottomSheet from "../shared/BottomSheet";
import { AvatarDot, DotPill, EmptyPanel, GhostButton, IconButton, IconLink, ListRowText, ListShell, SectionHeader, ToneBadge, ToneDot } from "../shared/primitives";
import { dayKeyForDate, minutesToTimeStr, slotRange } from "@/lib/social/schedule";
import type { AttendanceDayCardsMap } from "@/lib/attendanceTimetable";
import {
  dayHeadline,
  assessmentsOn,
  examsOn,
  formatDayHeading,
  hasClasses,
  kindLabel,
  statusForClass,
  todayKey,
  type CalendarDayModel,
  type CalendarDayEvent,
  type DayAttendance,
  type DayType,
} from "@/lib/calendarDay";
import { downloadDay } from "./calendarIcs";

/**
 * One day, in full.
 *
 * The old page showed a "Day Details" card inline in the page body, beside a
 * permanent "Upcoming Tasks" card — so a phone had to scroll past a month grid,
 * a 5-column stat block and a heatmap tile to find out what Thursday looked
 * like. The day is the thing you tap, so it gets the whole screen, and the
 * page behind it stops growing.
 *
 * "Schedule" deliberately shows the **live weekly timetable** for that weekday,
 * not only the classes already recorded. A future Tuesday has no `viewLink`
 * entry, and a day view that is empty for every date you actually care about is
 * useless; showing the real slots with a recorded status overlaid where one
 * exists makes the sheet useful in both directions.
 */

/**
 * The day-type pill.
 *
 * "No classes" and "Holiday" are different claims and must not read the same:
 * a non-instructional day is a working day at a college that is open, and
 * calling it a holiday is the error the old page made. `null` means the day is
 * outside the published calendar, which deserves no badge at all.
 */
const DAY_TYPE_META: Record<DayType, { label: string; tone: string } | null> = {
  instructional: { label: "Instructional day", tone: "emerald" },
  semiholiday: { label: "Shortened day", tone: "amber" },
  nonInstructional: { label: "No classes", tone: "sky" },
  holiday: { label: "Holiday", tone: "red" },
  other: null,
};

const STATUS_TONE: Record<string, string> = {
  present: "emerald",
  absent: "red",
  "on duty": "amber",
  "partial od": "amber",
};

const STATUS_LABEL: Record<string, string> = {
  present: "Present",
  absent: "Absent",
  "on duty": "On Duty",
  "partial od": "Partial OD",
};

export type DaySheetNotes = {
  /** `rawDate` is the date string exactly as VTOP wrote it — see `DayClassRecord`. */
  hasNotes: (courseCode: string, rawDate: string) => boolean;
  onToggleNotes: (courseCode: string, rawDate: string) => void;
};

export default function DayDetailSheet({
  day,
  onClose,
  dayCardsMap,
  attendanceByDate,
  onCycleTask,
  onAddTask,
  notes,
  isMoodleConnected,
  onConnectMoodle,
  onOpenCourse,
}: {
  day: CalendarDayModel | null;
  onClose: () => void;
  dayCardsMap: AttendanceDayCardsMap;
  attendanceByDate: Map<string, DayAttendance>;
  /** pending -> in_progress -> done, via the task store's own cycle. */
  onCycleTask: (id: string) => void;
  onAddTask: () => void;
  notes: DaySheetNotes;
  isMoodleConnected: boolean;
  onConnectMoodle: () => void;
  /**
   * Open a course's own page. Optional, because the sheet is also mounted where
   * no navigation is wired up, and a row that looks tappable but does nothing
   * is worse than a row that does not.
   */
  onOpenCourse?: (courseCode: string) => void;
}) {
  const isToday = day ? day.dateKey === todayKey() : false;

  /**
   * The live timetable for this weekday. `buildAttendanceDayCardsMap` already
   * merged back-to-back slots of the same course, so a two-hour block is one
   * row here, not two.
   */
  const schedule = useMemo(() => {
    if (!day) return [];
    const key = dayKeyForDate(day.fullDate);
    return (dayCardsMap?.[key] ?? []) as any[];
  }, [day, dayCardsMap]);

  /**
   * What occupies this day, in one place, because the schedule slot below is
   * not always a schedule.
   *
   * Four cases, and the copy differs for all of them because the claims do:
   *  - a milestone that owns papers: one event, papers nested. This is the
   *    "CAT - II" from the calendar and the "CAT2" papers from the schedule —
   *    one exam, so it gets one row, and the schedule's other spelling must not
   *    be what decides it.
   *  - an exam day with no milestone to nest under: the papers, on their own.
   *  - a non-instructional day: no classes, but the college is open. Naming it
   *    is the point — "nothing scheduled" and "you are expected in" are
   *    different days and the sheet should not blur them.
   *  - a holiday: the college is shut.
   *
   * Anything not shown in that slot falls through to the sections below, so a
   * holiday that also carries an exam is not dropped.
   */
  const occupying = useMemo(() => {
    if (!day) return { kind: "schedule" as const, events: [] as CalendarDayEvent[], note: "" };

    // The precedence is `dayHeadline`'s, shared with the Upcoming list so the
    // two can never name different headline events for the same date. Only the
    // note is this sheet's, because it is a sentence about the day and not
    // about the rule.
    const { kind } = dayHeadline(day);

    // On an assessment day the whole assessment is one section. `dayHeadline`
    // names the leader; `assessmentsOn` collects the rest, so a paper whose
    // series did not match the milestone — a FAT on the same day, or a schedule
    // key spelled nothing like the calendar's — lands beside it instead of
    // opening a second "Exams" heading further down.
    const events =
      kind === "exam" || kind === "milestone" ? assessmentsOn(day) : dayHeadline(day).events;

    if (kind === "milestone") {
      const papers = events[0]?.papers?.length ?? 0;
      return {
        kind,
        events,
        note: `${papers} paper${papers === 1 ? "" : "s"} · no regular classes on an exam day.`,
      };
    }
    if (kind === "exam") {
      return { kind, events, note: "No regular classes on an exam day." };
    }
    if (kind === "nonInstructional") {
      return { kind, events, note: "No classes today — the college is open." };
    }
    if (kind === "holiday") {
      return { kind, events, note: "No classes — the college is closed." };
    }
    return { kind, events, note: "" };
  }, [day]);

  const grouped = useMemo(() => {
    if (!day) return null;
    const rest = day.events.filter(
      (e) => e.kind !== "class" && e.kind !== "working" && !occupying.events.includes(e)
    );
    return {
      // Milestones get their own heading. CAT, LID and Mid Term Test are the
      // dates a term is planned around, and filing them under "College events"
      // alongside a canteen notice is how they went missing in the first place.
      milestones: rest.filter((e) => e.kind === "milestone"),
      events: rest.filter((e) => e.kind !== "milestone"),
      od: day.events.filter((e) => e.kind === "od"),
    };
  }, [day, occupying]);

  if (!day) return null;

  const dayType = DAY_TYPE_META[day.dayType];
  const { attendance, events } = day;
  const classesToday = hasClasses(day);
  const papers = examsOn(day).length;
  const assignments = events.filter((e) => e.kind === "assignment");
  const overdue = assignments.filter((e) => e.dueAt && e.dueAt.getTime() < Date.now());
  const missed = attendance.courses.filter((c) => c.status.toLowerCase() !== "present");

  const summary = !classesToday
    ? papers > 0
      ? `Exam day · no classes · ${papers} paper${papers === 1 ? "" : "s"}`
      : day.dayType === "holiday"
        ? "Holiday · college closed"
        : day.dayType === "nonInstructional"
          ? "No classes · college open"
          : "No classes"
    : attendance.held > 0
      ? `${attendance.held} class${attendance.held === 1 ? "" : "es"} · ${attendance.present} present${
          attendance.absent ? ` · ${attendance.absent} absent` : ""
        }${attendance.onDuty ? ` · ${attendance.onDuty} on duty` : ""}`
      : schedule.length > 0
        ? `${schedule.length} class${schedule.length === 1 ? "" : "es"} scheduled`
        : "No classes scheduled";

  return (
    <BottomSheet onClose={onClose} overlayId="calendar-day-detail" maxWidth="max-w-xl">
      <div className="space-y-6">
        {/* ── Header ── */}
        <div className="space-y-2">
          <div className="flex items-center gap-2 flex-wrap">
            {dayType ? <DotPill tone={dayType.tone}>{dayType.label}</DotPill> : null}
            {papers > 0 ? <ToneBadge tone="amber">Exam day</ToneBadge> : null}
            {day.dayType === "nonInstructional" ? (
              <ToneBadge tone="sky">College open</ToneBadge>
            ) : null}
            {isToday ? <ToneBadge tone="indigo">Today</ToneBadge> : null}
            {day.taskCount > 0 ? (
              <ToneBadge tone="violet">
                {day.taskCount} task{day.taskCount === 1 ? "" : "s"}
              </ToneBadge>
            ) : null}
          </div>
          <h2 className="text-lg font-black text-zinc-900 dark:text-white font-outfit tracking-tight">
            {formatDayHeading(day.fullDate)}
          </h2>
          <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400 -mt-1">{summary}</p>
        </div>

        {/*
          * The timetable's slot in the sheet. The live weekly timetable is only
          * shown when classes actually run — see `hasClasses`.
          */}
        {occupying.kind === "schedule" ? (
          <section className="space-y-2.5">
            <SectionHeader icon={Clock} title="Schedule" count={schedule.length} />
            {schedule.length === 0 ? (
              <EmptyPanel variant="dashed" title="No classes on this weekday." />
            ) : (
              <ListShell>
                {schedule.map((cls) => {
                  const { start, end } = slotRange(cls.time);
                  const status = statusForClass(attendanceByDate, day.dateKey, cls.courseCode);
                  const isLab = String(cls.slotName ?? "").startsWith("L");
                  // A course with no code has no page to open, so it stays a
                  // plain row rather than a button that does nothing.
                  const canOpen = Boolean(onOpenCourse && cls.courseCode);

                  return (
                    <button
                      key={`${cls.slotName}-${cls.courseCode}`}
                      type="button"
                      disabled={!canOpen}
                      onClick={() => onOpenCourse?.(cls.courseCode)}
                      className={`flex w-full items-center gap-3 py-3 px-4 text-left ${
                        canOpen
                          ? "transition-colors hover:bg-zinc-50/70 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-emerald-500/50 dark:hover:bg-white/[0.03]"
                          : "cursor-default"
                      }`}
                    >
                      <span
                        className={cn(
                          "w-1.5 h-1.5 rounded-full shrink-0",
                          isLab ? "bg-emerald-500" : "bg-indigo-500"
                        )}
                      />
                      <div className="min-w-0 flex-1">
                        <ListRowText
                          title={cls.courseTitle || cls.courseCode}
                          subtitle={[
                            `${cls.slotName} · ${minutesToTimeStr(start)}–${minutesToTimeStr(end)}`,
                            cls.slotVenue,
                            cls.faculty,
                          ]
                            .filter(Boolean)
                            .join(" · ")}
                          titleTag="h4"
                        />
                      </div>
                      {status ? (
                        <ToneBadge tone={STATUS_TONE[status.toLowerCase()] ?? "zinc"}>
                          {STATUS_LABEL[status.toLowerCase()] ?? status}
                        </ToneBadge>
                      ) : (
                        <ToneBadge tone="zinc">Scheduled</ToneBadge>
                      )}
                      {/* The same affordance the Upcoming rows use, so a
                          tappable row looks the same wherever it appears. */}
                      {canOpen ? (
                        <ChevronRight className="w-4 h-4 shrink-0 text-zinc-300 dark:text-zinc-600" />
                      ) : null}
                    </button>
                  );
                })}
              </ListShell>
            )}
          </section>
        ) : (
          <EventSection
            title={
              /*
               * A section heading names the *category*, never the event. The row
               * below already says "CAT II" under a "Milestone" pill, so a
               * heading repeating it printed the same name twice and read as two
               * tests where there was one — the single most-repeated bug on this
               * sheet. The pill carries the kind; the heading carries the group.
               */
              occupying.kind === "milestone" || occupying.kind === "exam"
                ? occupying.events.length === 1
                  ? "Exam"
                  : "Exams"
                : occupying.kind === "holiday"
                  ? "Holiday"
                  : "College"
            }
            icon={
              occupying.kind === "holiday" || occupying.kind === "nonInstructional"
                ? CalendarOff
                : occupying.kind === "milestone"
                  ? Flag
                  : GraduationCap
            }
            events={occupying.events}
            note={occupying.note}
          />
        )}

        {/* ── Tasks ── */}
        {/*
          * Read from the day model, not from the task store. The model merges
          * task-store tasks and Moodle deadlines into one `assignment` list, so
          * this section cannot disagree with the grid — which is how a Moodle
          * deadline came to show as a dot on the cell and then "Nothing due
          * today" in the sheet.
          */}
        <section className="space-y-2.5">
          <SectionHeader icon={ListChecks} title="Tasks" count={assignments.length} />
          {assignments.length === 0 ? (
            <EmptyPanel
              variant="dashed"
              title={isToday ? "Nothing due today." : "Nothing due on this day."}
            />
          ) : (
            <ListShell>
              {assignments.map((event, i) => {
                const isOverdue = Boolean(event.dueAt && event.dueAt.getTime() < Date.now());
                const when = event.dueAt
                  ? event.dueAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
                  : null;

                return (
                  <div key={`${event.taskId ?? event.url ?? event.title}-${i}`} className="flex items-center gap-3 py-3 px-4">
                    <div className="min-w-0 flex-1">
                      <ListRowText
                        title={event.title}
                        titleTag="h4"
                        subtitle={[event.detail, isOverdue ? `overdue · ${when}` : when].filter(Boolean).join(" · ")}
                        right={
                          <span className="flex items-center gap-1.5">
                            {event.url ? (
                              <IconLink
                                href={event.url}
                                title="Open in Moodle"
                                ariaLabel={`Open ${event.title} in Moodle`}
                                className="p-2"
                              >
                                <ExternalLink className="w-3.5 h-3.5" />
                              </IconLink>
                            ) : null}
                            {event.taskId ? (
                              // Only a task-store entry can be cycled; a Moodle
                              // deadline is marked done in Moodle, not here.
                              <IconButton
                                onClick={() => onCycleTask(event.taskId!)}
                                title="Cycle status"
                                className="p-2"
                              >
                                <CheckCircle2 className="w-3.5 h-3.5" />
                              </IconButton>
                            ) : null}
                          </span>
                        }
                      />
                    </div>
                    <DotPill tone={isOverdue ? "red" : event.tone}>
                      {event.detail && event.taskId ? "Task" : kindLabel(event.kind)}
                    </DotPill>
                  </div>
                );
              })}
            </ListShell>
          )}

          <div className="flex flex-wrap items-center gap-2">
            <GhostButton onClick={onAddTask} title="Add a task due on this day">
              <Plus className="w-3.5 h-3.5" />
              Add task
            </GhostButton>
            {!isMoodleConnected ? (
              <GhostButton onClick={onConnectMoodle} title="Connect Moodle to sync assignments">
                <BookOpen className="w-3.5 h-3.5" />
                Connect Moodle
              </GhostButton>
            ) : null}
            {overdue.length > 0 ? (
              <span className="text-[11px] font-bold text-red-600 dark:text-red-400">
                {overdue.length} overdue
              </span>
            ) : null}
          </div>
        </section>

        {/* ── Milestones ── */}
        {grouped && grouped.milestones.length > 0 ? (
          <EventSection
            title={grouped.milestones.length === 1 ? "Milestone" : "Milestones"}
            icon={Flag}
            events={grouped.milestones}
          />
        ) : null}

        {/* ── On-Duty ── */}
        {grouped && grouped.od.length > 0 ? (
          <EventSection title="On-Duty" icon={Clock} events={grouped.od} />
        ) : null}

        {/* ── Everything else the college published ──
            The catch-all, and it is a catch-all on purpose: a college calendar
            carries notices this app has no category for, and an unrecognised
            entry is still information. It is shown under its own text rather
            than dropped, which is what the old filters did. */}
        {grouped && grouped.events.length > 0 ? (
          <EventSection title="College events" icon={Sparkles} events={grouped.events} />
        ) : null}

        {/* ── Notes ── */}
        {missed.length > 0 ? (
          <section className="space-y-2.5">
            <SectionHeader
              icon={StickyNote}
              title="Get notes"
              count={missed.filter((c) => notes.hasNotes(c.courseCode, c.rawDate)).length}
              right={
                <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-md bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20">
                  {missed.length} missed
                </span>
              }
            />
            <ListShell>
              {missed.map((c) => {
                const secured = notes.hasNotes(c.courseCode, c.rawDate);
                return (
                  <div key={c.courseCode} className="flex items-center gap-3 py-3 px-4">
                    <div className="min-w-0 flex-1">
                      <ListRowText
                        title={c.courseTitle || c.courseCode}
                        titleTag="h4"
                        subtitle={`${c.courseCode} · ${c.status}`}
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => notes.onToggleNotes(c.courseCode, c.rawDate)}
                      className={cn(
                        "shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-semibold transition-all cursor-pointer",
                        secured
                          ? "bg-emerald-50 border-emerald-200 text-emerald-700 dark:bg-emerald-900/20 dark:border-emerald-800/50 dark:text-emerald-400"
                          : "bg-white border-zinc-200 text-zinc-600 hover:bg-zinc-50 dark:bg-zinc-900 dark:border-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-800"
                      )}
                    >
                      {secured ? <CheckCircle2 size={14} /> : <FileText size={14} />}
                      <span className="hidden sm:inline">{secured ? "Secured" : "Get Notes"}</span>
                    </button>
                  </div>
                );
              })}
            </ListShell>
          </section>
        ) : null}

        {/* ── Footer ── */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
          <GhostButton onClick={() => downloadDay(day)} title="Download this day as .ics">
            <Download className="w-3.5 h-3.5" />
            Add to calendar
          </GhostButton>
          <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
            {day.dateKey}
          </span>
        </div>
      </div>
    </BottomSheet>
  );
}

/**
 * The generic event list, used for milestones, exams, OD and holidays.
 *
 * These are all the same shape — a kind, a title, a detail line — so they share
 * one renderer instead of the three near-identical blocks the old page had.
 * `note` carries the one thing the row cannot say for itself, which is why the
 * schedule is missing.
 *
 * An event with `papers` renders them as indented children. That is the whole
 * point of folding them: "CAT II" and its three papers are one exam, and a
 * parent row with children says that, where two sibling sections would say the
 * opposite.
 */
function EventSection({
  title,
  icon,
  events,
  note,
}: {
  title: string;
  icon: any;
  events: CalendarDayEvent[];
  /** Line under the header — e.g. why the timetable is absent. */
  note?: string;
}) {
  return (
    <section className="space-y-2.5">
      <SectionHeader icon={icon} title={title} count={events.length} />
      {note ? (
        <p className="px-1 -mt-1 text-[11px] font-medium text-zinc-500 dark:text-zinc-400">{note}</p>
      ) : null}
      <ListShell>
        {events.map((event, i) => (
          <div key={`${event.kind}-${event.title}-${i}`}>
            <EventRow event={event} />
            {event.papers?.length ? (
              <div className="border-t border-zinc-100 dark:border-zinc-800/80 bg-zinc-50/50 dark:bg-zinc-900/30">
                {event.papers.map((paper, j) => (
                  <div
                    key={`${paper.title}-${j}`}
                    className="flex items-center gap-3 py-2.5 pl-8 pr-4"
                  >
                    <ToneDot tone="amber" />
                    <div className="min-w-0 flex-1">
                      <ListRowText
                        title={paper.title}
                        titleTag="h4"
                        subtitle={paper.detail}
                        className="[&_p:first-child]:text-[13px]"
                      />
                    </div>
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        ))}
      </ListShell>
    </section>
  );
}

/** One event: its kind pill, its title, and an optional external link. */
function EventRow({ event }: { event: CalendarDayEvent }) {
  return (
    <div className="flex items-center gap-3 py-3 px-4">
      <DotPill tone={event.tone}>{kindLabel(event.kind)}</DotPill>
      {/* Only events the user registered for carry a photo, and only when their
          photo-visibility setting allows it — both decided before the event was
          built, so there is nothing to check here. */}
      <AvatarDot src={event.avatarUrl} />
      <div className="min-w-0 flex-1">
        <ListRowText
          title={event.title}
          titleTag="h4"
          subtitle={event.detail}
          right={
            event.url ? (
              <IconLink
                href={event.url}
                title="Open in Moodle"
                ariaLabel={`Open ${event.title} in Moodle`}
                className="p-2"
              >
                <ExternalLink className="w-3.5 h-3.5" />
              </IconLink>
            ) : null
          }
        />
      </div>
    </div>
  );
}
