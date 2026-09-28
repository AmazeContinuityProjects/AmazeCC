"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useAtom } from "jotai";
import {
  BookOpen,
  Calendar as CalendarIcon,
  ChevronRight,
  Clock,
  Download,
  FileText,
  RefreshCcw,
  Sparkles,
} from "lucide-react";
import {
  EmptyPanel,
  GhostButton,
  IconButton,
  InsightCarousel,
  ListRowText,
  ListShell,
  PageShell,
  SectionHeader,
  SegmentedControl,
  SelectField,
  ToneBadge,
  ToneDot,
  useCarousel,
  type InsightSlide,
} from "../shared/primitives";
import { TILE_CARD } from "@/lib/uiTokens";
import {
  buildAttendanceDayCardsMap,
  parseAttendanceTime,
  type AttendanceDayCardsMap,
} from "@/lib/attendanceTimetable";
import { summariseAttendance } from "@/lib/attendanceSummary";
import { dayKeyForDate } from "@/lib/social/schedule";
import {
  activeMonthIndex,
  buildAttendanceByDate,
  buildAttendanceLog,
  buildEnrichedCalendars,
  CALENDAR_TYPES,
  examsOn,
  filterLog,
  findDay,
  hasClasses,
  isExamDay,
  kindLabel,
  relativeDayLabel,
  synthesiseDay,
  todayKey,
  type AttendanceLogRow,
  type CalendarDayModel,
  type CalendarTypeKey,
  type EventKind,
  type LogFilter,
} from "@/lib/calendarDay";
import { cycleTaskStatus, createTask, migrateCustomHomework } from "@/lib/tasksStorage";
import { tasksAtom } from "@/store/dataAtoms";
import { formatSemesterName } from "../exams/courseHelpers";
import MonthGrid from "./MonthGrid";
import DayDetailSheet from "./DayDetailSheet";
import MoodleConnectSheet from "./MoodleConnectSheet";
import TaskEditSheet from "../tasks/TaskEditSheet";
import { downloadCalendar } from "./calendarIcs";

/**
 * The academic calendar.
 *
 * Structure, top to bottom, and each block is a reason to open the page:
 *
 *   1. back + actions      where reload / export / circulars live
 *   2. title block         which calendar, which semester
 *   3. stat cards          how the semester is going, and the way to the timeline
 *   4. month grid          the semester at a glance; a day is one tap away
 *   5. upcoming            the next thing that will cost you marks
 *   6. attendance log      every day that has a record, filterable
 *
 * Tapping a day — in the grid or in the log — opens the same bottom sheet, so
 * there is exactly one place where "what happened on the 12th" is answered.
 * The old page had two: the grid wrote to an inline "Day Details" card while
 * the log's own tooltip showed something else.
 */

const LOG_FILTERS: { value: LogFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "missed", label: "Missed" },
  { value: "present", label: "Full days" },
  { value: "upcoming", label: "Upcoming" },
];

const CALENDAR_OPTIONS = (Object.keys(CALENDAR_TYPES) as CalendarTypeKey[]).map((key) => ({
  value: key,
  label: CALENDAR_TYPES[key],
}));

/**
 * A lab's percentage in the course carousel, kept distinct from its theory
 * half's because the two are separate attendance records with separate
 * requirements — collapsing them into one number is the thing this carousel
 * exists to stop.
 */
const LAB_VALUE = "text-emerald-600 dark:text-emerald-400";

export default function CalendarSubpage({
  calendars,
  calendarType = "ALL",
  handleCalendarFetch,
  moodleData,
  scheduleData,
  attendanceData,
  ODhoursData,
  handleFetchMoodle,
  IDs,
  currSemesterID,
  targetAttendance = 75,
  onBack,
  onOpenCirculars,
}: {
  calendars?: any;
  calendarType?: CalendarTypeKey;
  handleCalendarFetch: (type: string) => void;
  moodleData?: any[];
  scheduleData?: any;
  attendanceData?: any;
  ODhoursData?: any;
  handleFetchMoodle: (username: string, password: string) => void;
  IDs?: any;
  currSemesterID?: string;
  targetAttendance?: number;
  onBack: () => void;
  onOpenCirculars: () => void;
}) {
  const [tasks, setTasks] = useAtom(tasksAtom);
  const [type, setType] = useState<CalendarTypeKey>(calendarType);

  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const [filter, setFilter] = useState<LogFilter>("all");
  const [selected, setSelected] = useState<CalendarDayModel | null>(null);
  const [notes, setNotes] = useState<Record<string, Record<string, boolean>>>({});
  const [isMoodleOpen, setMoodleOpen] = useState(false);
  const [isTaskSheetOpen, setTaskSheetOpen] = useState(false);

  // Legacy `customHomework` entries become real tasks once, then live in the
  // task store forever. The old page kept re-reading localStorage on every
  // render and prompting with `window.prompt` to add more.
  useEffect(() => {
    setTasks(migrateCustomHomework());
  }, [setTasks]);

  useEffect(() => {
    try {
      const saved = localStorage.getItem("uniCC_notes_tracker");
      if (saved) setNotes(JSON.parse(saved));
    } catch {}
  }, []);

  // ---- Derived data ------------------------------------------------------

  const attendanceList = useMemo(
    () => (Array.isArray(attendanceData?.attendance) ? attendanceData.attendance : []),
    [attendanceData]
  );

  const dayCardsMap: AttendanceDayCardsMap = useMemo(
    () => buildAttendanceDayCardsMap(attendanceList),
    [attendanceList]
  );

  const months = useMemo(
    () =>
      buildEnrichedCalendars({
        calendars,
        moodle: moodleData,
        schedule: scheduleData,
        attendance: attendanceList,
        od: ODhoursData,
        tasks,
      }),
    [calendars, moodleData, scheduleData, attendanceList, ODhoursData, tasks]
  );

  // Open on the month you are in, or the next one to start. `null` means the
  // user has not chosen, so the month is derived — no effect, no stale state.
  // The old page persisted this to localStorage and reopened the tab months
  // later on a month with nothing in it.
  const effectiveIndex =
    activeIndex === null
      ? activeMonthIndex(months)
      : Math.min(activeIndex, Math.max(0, months.length - 1));

  const activeMonth = months[effectiveIndex];

  const attendanceByDate = useMemo(() => buildAttendanceByDate(attendanceList), [attendanceList]);

  /**
   * The morning/evening split in the day log needs to know when each course
   * starts, and a course can hold several slots. The earliest of them is the
   * one that decides which half of the day it sits in.
   */
  const startMinutesByCourse = useCallback(
    (courseCode: string): number | null => {
      let earliest: number | null = null;
      (Object.keys(dayCardsMap) as (keyof AttendanceDayCardsMap)[]).forEach((day) => {
        dayCardsMap[day]?.forEach((cls: any) => {
          if (cls.courseCode !== courseCode) return;
          const start = parseAttendanceTime(String(cls.time).split("-")[0]);
          if (earliest === null || start < earliest) earliest = start;
        });
      });
      return earliest;
    },
    [dayCardsMap]
  );

  const logRows = useMemo(
    () => buildAttendanceLog(attendanceByDate, startMinutesByCourse),
    [attendanceByDate, startMinutesByCourse]
  );

  const visibleRows = useMemo(() => filterLog(logRows, filter), [logRows, filter]);
  const missedCount = useMemo(() => logRows.filter((r) => r.isMissed).length, [logRows]);

  /**
   * The headline, from the app's one formula.
   *
   * Was counted from the `viewLink` records on this page, which is a different
   * figure from the one every other page shows — so the calendar could display
   * 91% on a day the home screen displayed 87% for the same student. Now both
   * read `summariseAttendance`, which is the sum of VTOP's own per-course
   * totals, so they cannot disagree.
   */
  const overall = useMemo(
    () => summariseAttendance(attendanceList, targetAttendance),
    [attendanceList, targetAttendance]
  );

  /**
   * Per-course attendance, one slide each.
   *
   * This is the "other attendance percentage": the overall tile averages every
   * course together, which hides a 40% theory behind a 95% lab, so the two
   * numbers a user needs are the overall one and each course's own. Every
   * slide names its denominator — the classes *that course* actually held —
   * because a percentage of nothing is not a percentage.
   */
  const courseRows = useMemo(() => {
    return attendanceList
      .map((course: any) => {
        const attended = Number(course?.attendedClasses) || 0;
        const total = Number(course?.totalClasses) || 0;
        if (total <= 0) return null;
        const pct = (attended / total) * 100;
        const isLab = /(\((L|P)\))$/.test(String(course?.courseCode ?? ""));
        return {
          id: String(course?.courseCode ?? course?.courseTitle ?? Math.random()),
          code: String(course?.courseCode ?? ""),
          title: String(course?.courseTitle ?? course?.courseCode ?? "Course"),
          slot: String(course?.slotName ?? ""),
          venue: String(course?.slotVenue ?? ""),
          attended,
          total,
          pct,
          isLab,
          status: pct >= targetAttendance + 5 ? "Safe" : pct >= targetAttendance ? "Warning" : "Critical",
        };
      })
      .filter((c): c is NonNullable<typeof c> => c !== null)
      .sort((a, b) => a.pct - b.pct);
  }, [attendanceList, targetAttendance]);

  const courseSlides = useMemo<InsightSlide[]>(
    () =>
      courseRows.map((c) => ({
        id: c.id,
        label: c.code || c.title,
        // A theory/lab pair share a base code, so the title is the only thing
        // that tells them apart once the code is in the kicker.
        value: `${Number(c.pct.toFixed(1))}%`,
        sub: `${c.attended} of ${c.total} held${c.slot ? ` · ${c.slot}` : ""}`,
        badge: c.status,
        dotLabel: `${c.isLab ? "Lab" : "Theory"} ${c.title}`,
        tone: c.status === "Safe" ? "emerald" : c.status === "Warning" ? "amber" : "red",
        valueClassName: c.isLab ? LAB_VALUE : undefined,
      })),
    [courseRows]
  );

  const courseCarousel = useCarousel(courseSlides.length);

  /**
   * The left card: the semester at a glance, rotating.
   *
   * The percentage leads. The two day counts behind it are what the old
   * full-screen timeline existed to show and what a percentage cannot express:
   * a single number cannot say that 61 of 62 days were fine but 9 of them cost
   * you a class. So they get slides rather than a second screen, which is also
   * why the timeline button and the timeline page are gone — nothing was lost
   * with them, only relocated.
   *
   * "Classes done" counts days that carry a record, and "Days missed" counts
   * the subset where something was not present. Both come off the same log the
   * section below renders, so the card and the list can never disagree.
   */
  const summarySlides = useMemo<InsightSlide[]>(() => {
    const statusTone =
      overall.status === "Safe" ? "emerald" : overall.status === "Warning" ? "amber" : overall.status === "Critical" ? "red" : "neutral";

    return [
      {
        id: "attendance",
        label: "Attendance",
        value: overall.total > 0 ? `${Number(overall.percentage.toFixed(1))}%` : "—",
        sub: overall.total > 0 ? `${overall.attended} of ${overall.total} classes` : "No records yet",
        badge: overall.total > 0 ? overall.status : undefined,
        tone: statusTone,
      },
      {
        id: "days-done",
        label: "Classes done",
        value: logRows.length,
        sub: logRows.length === 1 ? "day with a record" : "days with a record",
        tone: "emerald",
      },
      {
        id: "days-missed",
        label: "Days missed",
        value: missedCount,
        sub: missedCount === 1 ? "day with a miss" : "days with a miss",
        tone: missedCount > 0 ? "red" : "emerald",
      },
    ];
  }, [overall, logRows.length, missedCount]);

  const summaryCarousel = useCarousel(summarySlides.length);

  const belowTarget = useMemo(
    () => courseRows.filter((c) => c.status === "Critical").length,
    [courseRows]
  );

  const today = useMemo(() => {
    const key = todayKey();
    return findDay(months, key)?.day ?? null;
  }, [months]);

  /**
   * Everything still to come, in one chronological list.
   *
   * Deliberately not just exams and assignments. The old version of this page
   * had separate cards for "Upcoming Exams" and "Upcoming Tasks" and no place at
   * all for the college's own milestones — CAT, LID, Mid Term Test — so the dates
   * a student plans the whole term around were the only ones the app would not
   * show. Milestones, holidays, on-duty and the unclassified leftovers all land
   * in this one list, each carrying its own tone, and one date-order answers
   * "what is coming" without the user checking four places.
   */
  const upcoming = useMemo(() => {
    const now = new Date();
    const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const items: Array<{
      id: string;
      kind: EventKind;
      title: string;
      detail: string;
      tone: string;
      when: Date;
    }> = [];

    months.forEach((month) => {
      month.days.forEach((day) => {
        if (day.fullDate.getTime() < midnight.getTime()) return;
        day.events.forEach((event) => {
          // `class` and `working` are the grid's background state, not news.
          if (event.kind === "class" || event.kind === "working") return;
          items.push({
            id: `${day.dateKey}-${event.kind}-${event.title}`,
            kind: event.kind,
            title: event.title,
            detail: [event.detail, event.courseCode].filter(Boolean).join(" · "),
            tone: event.tone,
            // An exam or a milestone is on the day itself; a deadline can be
            // later in it.
            when: event.dueAt ?? day.fullDate,
          });
        });
      });
    });

    return items.sort((a, b) => a.when.getTime() - b.when.getTime()).slice(0, 6);
  }, [months]);

  const isMoodleConnected = Boolean(moodleData?.length || IDs?.MoodleUsername || IDs?.MoodlePassword);

  // ---- Actions -----------------------------------------------------------

  const openDay = useCallback((day: CalendarDayModel) => setSelected(day), []);

  /**
   * Open a log row.
   *
   * `viewLink` holds dates the published calendar does not cover, so a row can
   * fall outside every month. Those still open: a dead row reads as broken
   * data, and the user cannot tell it apart from "no data here".
   */
  const openLogRow = useCallback(
    (row: AttendanceLogRow) => {
      const found = findDay(months, row.dateKey);
      setSelected(found?.day ?? synthesiseDay(row.attendance));
    },
    [months]
  );

  const toggleNotes = useCallback(
    (courseCode: string, rawDate: string) => {
      setNotes((prev) => {
        const next = {
          ...prev,
          [courseCode]: { ...(prev[courseCode] || {}), [rawDate]: !(prev[courseCode]?.[rawDate]) },
        };
        try {
          localStorage.setItem("uniCC_notes_tracker", JSON.stringify(next));
        } catch {}
        return next;
      });
    },
    []
  );

  const handleMonthChange = useCallback((index: number) => setActiveIndex(index), []);

  /**
   * Switching programme loads that calendar.
   *
   * A picker that changes a label and nothing else is worse than no picker: the
   * old page had exactly that, and the only way to make the new type take effect
   * was to remember to press the reload button afterwards. This only fires from
   * a real `onChange`, never on mount, so it cannot duplicate the sync the app
   * already does on startup.
   */
  const handleTypeChange = useCallback(
    (next: CalendarTypeKey) => {
      setType(next);
      handleCalendarFetch(next);
    },
    [handleCalendarFetch]
  );

  // ---- Chrome ------------------------------------------------------------

  const actions = (
    <>
      <IconButton onClick={() => handleCalendarFetch(type)} title="Reload academic calendar">
        <RefreshCcw className="w-4 h-4" />
      </IconButton>
      <IconButton
        onClick={() => downloadCalendar(months)}
        title="Sync the semester to your calendar (.ics)"
        disabled={months.length === 0}
      >
        <Download className="w-4 h-4" />
      </IconButton>
      {!isMoodleConnected ? (
        <IconButton onClick={() => setMoodleOpen(true)} title="Connect Moodle">
          <BookOpen className="w-4 h-4" />
        </IconButton>
      ) : null}
      <IconButton onClick={onOpenCirculars} title="Academic circulars">
        <FileText className="w-4 h-4" />
      </IconButton>
    </>
  );

  const shellProps = {
    eyebrow: "Attendance · Calendar",
    title: "Super Calendar",
    subtitle: [
      CALENDAR_TYPES[type],
      currSemesterID ? formatSemesterName(currSemesterID) : null,
    ]
      .filter(Boolean)
      .join(" · "),
    actions,
    onBack,
  };

  // ---- Empty state -------------------------------------------------------

  if (months.length === 0) {
    return (
      <PageShell {...shellProps}>
        <EmptyPanel
          icon={<CalendarIcon className="w-7 h-7" />}
          title="No calendar synced yet"
          description="Pick the calendar that matches your programme and load it from VTOP. It syncs alongside your attendance data."
          action={
            <div className="flex flex-wrap items-center justify-center gap-2">
              <SelectField
                value={type}
                onChange={handleTypeChange}
                options={CALENDAR_OPTIONS}
              />
              <GhostButton onClick={() => handleCalendarFetch(type)}>
                <RefreshCcw className="w-3.5 h-3.5" />
                Load calendar
              </GhostButton>
            </div>
          }
        />

        <MoodleConnectSheet
          open={isMoodleOpen}
          onClose={() => setMoodleOpen(false)}
          handleFetchMoodle={handleFetchMoodle}
          IDs={IDs}
        />
      </PageShell>
    );
  }

  // ---- Month screen ------------------------------------------------------

  return (
    <PageShell {...shellProps}>
      {/*
        * Two stat cards, side by side, and both are carousels.
        *
        * Left: the semester at a glance — the percentage, then the two day
        * counts the old full-screen timeline existed to show. Right: the same
        * measure one course at a time, worst first.
        *
        * Every card says what its number is *of*. A bare "87%" beside another
        * "87%" is not information, and this is the page people screenshot.
        */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4">
        <InsightCarousel
          slides={summarySlides}
          carousel={summaryCarousel}
          interactiveDots
          ariaLabel="Attendance summary"
        />

        {/* One slide per enrolled course, each a percentage of that course's own
            held classes — the "other attendance percentage", and the one that
            actually differs between courses. An average hides a 40% theory
            behind a 95% lab, so this is where the number to act on lives. Worst
            first, because the courses needing attention are the reason to look. */}
        {courseSlides.length > 0 ? (
          <InsightCarousel
            slides={courseSlides}
            carousel={courseCarousel}
            interactiveDots
            ariaLabel="Attendance by course"
            footerRight={
              belowTarget > 0 ? (
                // The footer row is subline + this + the dots, and at half
                // width on a phone the three together leave the subline
                // nothing. The slides are sorted worst-first, so the count is
                // a convenience rather than the information.
                <span className="hidden sm:inline-flex">
                  <ToneBadge tone="zinc">
                    {belowTarget} below {targetAttendance}%
                  </ToneBadge>
                </span>
              ) : null
            }
          />
        ) : null}
      </div>


      {/* ── Month grid ──
          "Today" lives in this header as an action, not as a third stat card.
          It was a tile, and two tiles plus a carousel is three cards competing
          over the same reading time; today is also the one thing on this page
          that is a link rather than a measurement, so it belongs with the grid
          it jumps into. */}
      <div className={TILE_CARD}>
        <SectionHeader
          icon={CalendarIcon}
          title={activeMonth.label}
          count={activeMonth.summary.total}
          right={
            today ? (
              <button
                type="button"
                onClick={() => openDay(today)}
                title="Open today"
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors cursor-pointer shrink-0"
              >
                <ToneDot tone={todayTone(today)} size="md" />
                <span className="text-[11px] font-bold">{todaySummary(today, dayCardsMap)}</span>
                <ChevronRight className="w-3 h-3" />
              </button>
            ) : null
          }
        />

        {/* Its own row, not the section header's `right` slot: that slot is
            shrink-0, and a native select is ~256px, which on a 360px phone
            leaves the month name about sixty pixels. */}
        <div className="mt-3 flex items-center gap-2">
          <span className="shrink-0 text-[10px] font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
            Programme
          </span>
          <div className="min-w-0 flex-1">
            <SelectField value={type} onChange={handleTypeChange} options={CALENDAR_OPTIONS} />
          </div>
        </div>

        <div className="mt-3">
          <MonthGrid
            months={months}
            activeIndex={effectiveIndex}
            onMonthChange={handleMonthChange}
            onSelectDay={openDay}
            selectedDateKey={selected?.dateKey ?? null}
          />
        </div>
      </div>

      {/* ── Upcoming ──
          One date-ordered list of everything still to come — exams, deadlines,
          milestones (CAT, LID, Mid Term Test), holidays, on-duty and whatever
          else the college published that this app has no category for. Each row
          keeps its own tone, so the kind reads without reading the title. */}
      <section className="space-y-2.5">
        <SectionHeader icon={Sparkles} title="Upcoming" count={upcoming.length} />
        {upcoming.length === 0 ? (
          <EmptyPanel variant="dashed" title="Nothing scheduled ahead." />
        ) : (
          <ListShell>
            {upcoming.map((item) => (
              <div key={item.id} className="flex items-start gap-3 py-3 px-4">
                {/* A dot, not a pill, and on the title's line rather than the
                    row's centre. The pill was the widest thing on the row and
                    it said something the dot already says in colour, so it
                    pushed the title — the part worth reading — off the line. */}
                <ToneDot tone={item.tone} size="md" className="mt-[7px]" />
                <div className="min-w-0 flex-1">
                  <ListRowText
                    title={item.title}
                    titleTag="h4"
                    subtitle={item.detail}
                    right={
                      <span className="flex items-center gap-2">
                        {/* The kind moves to the right in small type rather than
                            disappearing: the dot carries it at a glance, the
                            word makes it unambiguous. */}
                        <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
                          {kindLabel(item.kind)}
                        </span>
                        <ToneBadge tone={item.tone}>{relativeDayLabel(item.when)}</ToneBadge>
                      </span>
                    }
                  />
                </div>
              </div>
            ))}
          </ListShell>
        )}
      </section>

      {/* ── Attendance log ──
          The timeline is gone, and so is its button. It used to be a
          full-screen subpage for the same two numbers the left carousel now
          carries, so it was a second place to look and a second way to get
          back; this list is the per-day detail behind them. */}
      <section className="space-y-2.5">
        <SectionHeader
          icon={Clock}
          title="Attendance log"
          count={visibleRows.length}
          right={
            missedCount > 0 ? (
              <ToneBadge tone="red">
                {missedCount} with a miss
              </ToneBadge>
            ) : null
          }
        />

        <SegmentedControl
          options={LOG_FILTERS}
          value={filter}
          onChange={setFilter}
          grow
          scroll
        />

        {visibleRows.length === 0 ? (
          <EmptyPanel variant="dashed" title="No records under this filter." />
        ) : (
          <ListShell>
            {visibleRows.map((row) => (
              <LogRow key={row.dateKey} row={row} onClick={() => openLogRow(row)} />
            ))}
          </ListShell>
        )}
      </section>

      {/* ── Overlays ── */}
      {selected ? (
        <DayDetailSheet
          day={selected}
          onClose={() => setSelected(null)}
          dayCardsMap={dayCardsMap}
          attendanceByDate={attendanceByDate}
          onCycleTask={(id) => setTasks(cycleTaskStatus(id))}
          onAddTask={() => setTaskSheetOpen(true)}
          notes={{
            hasNotes: (courseCode, rawDate) => notes[courseCode]?.[rawDate] === true,
            onToggleNotes: toggleNotes,
          }}
          isMoodleConnected={isMoodleConnected}
          onConnectMoodle={() => setMoodleOpen(true)}
        />
      ) : null}

      <MoodleConnectSheet
        open={isMoodleOpen}
        onClose={() => setMoodleOpen(false)}
        handleFetchMoodle={handleFetchMoodle}
        IDs={IDs}
      />

      <TaskEditSheet
        isOpen={isTaskSheetOpen}
        onClose={() => setTaskSheetOpen(false)}
        onSave={(draft) => {
          // The day the user tapped is a *default*, not a decision: if they set
          // a deadline in the form, that wins.
          setTasks(
            createTask({
              ...draft,
              dueDate: draft.dueDate ?? (selected ? selected.fullDate.toISOString() : undefined),
            })
          );
          setTaskSheetOpen(false);
        }}
      />
    </PageShell>
  );
}

/**
 * One day in the log.
 *
 * The whole row is the hit target: a log is scanned, not pointed at, and the
 * old page made the user hit a chevron to get to a day that had exactly one
 * destination.
 */
function LogRow({ row, onClick }: { row: AttendanceLogRow; onClick: () => void }) {
  const { attendance } = row;
  const sub =
    attendance.held > 0
      ? [
          `${attendance.present}/${attendance.held} present`,
          attendance.absent > 0 ? `${attendance.absent} missed` : null,
          attendance.onDuty > 0 ? `${attendance.onDuty} on duty` : null,
        ]
          .filter(Boolean)
          .join(" · ")
      : "No classes recorded";

  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full flex items-start gap-3 py-3 px-4 text-left transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800/40 active:bg-zinc-100/70 dark:active:bg-zinc-800/60 cursor-pointer"
    >
      <ToneDot tone={row.tone} size="md" className="mt-[7px]" />
      <div className="min-w-0 flex-1">
        <ListRowText
          title={row.dateObj.toLocaleDateString("en-GB", { day: "2-digit", month: "short" })}
          titleTag="h4"
          subtitle={`${row.weekday} · ${sub}`}
          right={
            // Same treatment as the Upcoming rows: the dot carries the status in
            // colour and the word confirms it, so the date — the thing you are
            // scanning for — keeps the width.
            <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
              {row.label}
            </span>
          }
        />
      </div>
      <ChevronRight className="w-4 h-4 shrink-0 text-zinc-400 mt-0.5" />
    </button>
  );
}

/** How many classes the live timetable puts on this date's weekday. */
function countClasses(dayCardsMap: AttendanceDayCardsMap, date: Date): number {
  const key = dayKeyForDate(date);
  return (dayCardsMap?.[key] ?? []).length;
}

/**
 * Today's status dot for the month header.
 *
 * Mirrors what the day sheet's own pill says, so the two never disagree about
 * whether today is a teaching day.
 */
function todayTone(day: CalendarDayModel): string {
  if (day.dayType === "holiday") return "red";
  if (isExamDay(day)) return "amber";
  if (!hasClasses(day)) return "sky";
  return day.attendance.absent > 0 ? "red" : "emerald";
}

function todaySummary(day: CalendarDayModel | null, dayCardsMap: AttendanceDayCardsMap): string {
  if (!day) return "Not in the calendar";
  if (day.dayType === "holiday") return "Holiday · college closed";
  if (isExamDay(day)) {
    const papers = examsOn(day).length;
    return `Today · ${papers} paper${papers === 1 ? "" : "s"}`;
  }
  if (!hasClasses(day)) return "Today · no classes";
  if (day.attendance.held > 0) {
    return `Today · ${day.attendance.present}/${day.attendance.held} present${
      day.attendance.absent ? ` · ${day.attendance.absent} missed` : ""
    }`;
  }
  if (day.dayType === "other") return "Today · not in the calendar";
  const live = countClasses(dayCardsMap, day.fullDate);
  return live > 0 ? `Today · ${live} class${live === 1 ? "" : "es"}` : "Today · no classes";
}