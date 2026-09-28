import { afterEach, describe, expect, it, vi } from "vitest";
import {
  activeMonthIndex,
  buildAttendanceByDate,
  buildAttendanceLog,
  buildEnrichedCalendars,
  dateKey,
  daysLeft,
  dayMarkers,
  examsOn,
  filterLog,
  hasClasses,
  holidaysOn,
  isCollegeOpen,
  isExamDay,
  leadingBlanks,
  milestonesOn,
  parseCalendarMonth,
  parseDayDate,
  relativeDayLabel,
  statusForClass,
  summariseOd,
  synthesiseDay,
} from "../lib/calendarDay";
import type { Task } from "../types/tasks";

/**
 * The calendar day model.
 *
 * This logic used to live inside the calendar page component, where it had no
 * test at all — the only way to find out whether the half-day rules were right
 * was to be enrolled in the semester they describe. The three things most
 * likely to be wrong, and least likely to be noticed, are here: which day type
 * a date gets, whether a day is a morning or an evening half-day, and whether
 * two sources of dates agree on what "the 12th" is.
 */

const iso = (d: number) => `2026-08-${String(d).padStart(2, "0")}`;

/**
 * A VTOP academic calendar for one month, every day marked instructional.
 *
 * `text` is the type word and `category` carries the name, as the real payload
 * does — so a holiday is `text: "Holiday", category: "Pongal"`. Fixtures that
 * put the name in `text` hid the fact that the day sheet was titling every
 * holiday "Holiday".
 */
function monthCalendar(month: string, days: number[] = []) {
  return [
    {
      month,
      year: 2026,
      days: Array.from({ length: 31 }, (_, i) => ({
        date: i + 1,
        events: [
          days.includes(i + 1)
            ? { type: "Other", text: "Holiday", category: "Pongal" }
            : { type: "Other", text: "Instructional Day", category: "Working day" },
        ],
      })),
    },
  ];
}

const viewLink = (courseCode: string, courseTitle: string, entries: [string, string][]) => ({
  courseCode,
  courseTitle,
  slotName: "A1",
  viewLink: entries.map(([date, status]) => ({ date, status })),
});

describe("parseDayDate", () => {
  it("reads a YYYY-MM-DD key as local midnight", () => {
    // `new Date("2026-08-12")` is UTC, which is the 11th west of Greenwich.
    const d = parseDayDate("2026-08-12");
    expect(d.getFullYear()).toBe(2026);
    expect(d.getMonth()).toBe(7);
    expect(d.getDate()).toBe(12);
    expect(d.getHours()).toBe(0);
  });

  it("round-trips through dateKey", () => {
    for (const d of [1, 9, 12, 28, 31]) {
      expect(dateKey(parseDayDate(iso(d)))).toBe(iso(d));
    }
  });

  it("falls back to the native parser for VTOP's textual dates", () => {
    const d = parseDayDate("Aug 12, 2026");
    expect(isNaN(d.getTime())).toBe(false);
    expect(d.getDate()).toBe(12);
  });

  it("returns an invalid date rather than throwing on junk", () => {
    expect(isNaN(parseDayDate("not a date").getTime())).toBe(true);
    expect(isNaN(parseDayDate(undefined).getTime())).toBe(true);
  });
});

describe("parseCalendarMonth", () => {
  it("reads VTOP's 'August 2026'", () => {
    expect(parseCalendarMonth({ month: "August 2026" })).toEqual({ monthIndex: 7, year: 2026 });
  });

  it("reads a bare month name using the calendar's own year", () => {
    expect(parseCalendarMonth({ month: "January", year: 2027 })).toEqual({ monthIndex: 0, year: 2027 });
  });

  it("falls back to today rather than producing NaN", () => {
    const now = new Date();
    const parsed = parseCalendarMonth({});
    expect(parsed.monthIndex).toBe(now.getMonth());
    expect(parsed.year).toBe(now.getFullYear());
  });
});

describe("leadingBlanks", () => {
  it("is Monday-first", () => {
    // 1 Aug 2026 is a Saturday: five Monday-first cells before it.
    expect(leadingBlanks(2026, 7)).toBe(5);
    // 1 Jun 2026 is a Monday: none.
    expect(leadingBlanks(2026, 5)).toBe(0);
    // 1 Nov 2026 is a Sunday: a full week of blanks.
    expect(leadingBlanks(2026, 10)).toBe(6);
  });
});

describe("daysLeft / relativeDayLabel", () => {
  const from = new Date(2026, 7, 12);

  it("counts whole days, forward and back", () => {
    expect(daysLeft(new Date(2026, 7, 12), from)).toBe(0);
    expect(daysLeft(new Date(2026, 7, 13), from)).toBe(1);
    expect(daysLeft(new Date(2026, 7, 11), from)).toBe(-1);
  });

  it("is not shifted by the time of day", () => {
    // 23:59 today and 00:01 today are the same calendar day.
    expect(daysLeft(new Date(2026, 7, 12, 23, 59), new Date(2026, 7, 12, 0, 1))).toBe(0);
  });

  it("names today and tomorrow, and otherwise formats", () => {
    expect(relativeDayLabel(new Date(2026, 7, 12), from)).toBe("Today");
    expect(relativeDayLabel(new Date(2026, 7, 13), from)).toBe("Tomorrow");
    expect(relativeDayLabel(new Date(2026, 7, 11), from)).toBe("Yesterday");
    expect(relativeDayLabel(new Date(2026, 7, 20), from)).toMatch(/20/);
  });

  it("has no opinion about a missing or unparseable date", () => {
    expect(daysLeft(null)).toBe(null);
    expect(daysLeft(new Date(NaN))).toBe(null);
  });
});

describe("buildAttendanceByDate", () => {
  it("buckets one day across every course", () => {
    const byDate = buildAttendanceByDate([
      viewLink("25BLC1081", "Biology", [
        ["2026-08-12", "Present"],
        ["2026-08-13", "Absent"],
      ]),
      viewLink("25BLC1081(L)", "Biology Lab", [["2026-08-12", "On Duty"]]),
    ]);

    const twelfth = byDate.get("2026-08-12")!;
    expect(twelfth.held).toBe(2);
    expect(twelfth.present).toBe(1);
    expect(twelfth.onDuty).toBe(1);
    expect(twelfth.absent).toBe(0);

    expect(byDate.get("2026-08-13")!.absent).toBe(1);
  });

  it("keeps the raw VTOP date so the notes tracker stays compatible", () => {
    // The Theory and Lab log pages key `uniCC_notes_tracker` on this string.
    const byDate = buildAttendanceByDate([
      viewLink("25BLC1081", "Biology", [["Aug 12, 2026", "Absent"]]),
    ]);
    expect(byDate.get("2026-08-12")!.courses[0].rawDate).toBe("Aug 12, 2026");
  });

  it("ignores a course with no history", () => {
    expect(buildAttendanceByDate([{ courseCode: "X", viewLink: null }]).size).toBe(0);
    expect(buildAttendanceByDate([]).size).toBe(0);
  });

  it("finds one course's status on a day", () => {
    const byDate = buildAttendanceByDate([
      viewLink("25BLC1081", "Biology", [["2026-08-12", "Absent"]]),
    ]);
    expect(statusForClass(byDate, "2026-08-12", "25BLC1081")).toBe("Absent");
    expect(statusForClass(byDate, "2026-08-12", "OTHER")).toBe(null);
    expect(statusForClass(byDate, "2026-08-20", "25BLC1081")).toBe(null);
  });
});

describe("buildAttendanceLog", () => {
  const at = (code: string, entries: [string, string][]) => viewLink(code, code, entries);
  /** 8am and 2pm, i.e. one class in each half of the day. */
  const startMinutes = (code: string) => (code.startsWith("AM") ? 8 * 60 : 14 * 60);

  it("calls an untouched day a full day", () => {
    const rows = buildAttendanceLog(
      buildAttendanceByDate([
        at("AM-1", [["2026-08-10", "Present"]]),
        at("PM-1", [["2026-08-10", "Present"]]),
      ]),
      startMinutes
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].status).toBe("present");
    expect(rows[0].isMissed).toBe(false);
    expect(rows[0].tone).toBe("emerald");
  });

  it("distinguishes a morning miss from an evening miss", () => {
    // This is the whole reason the log exists: "you missed a class" does not
    // tell you whether you lost the morning.
    const morningMiss = buildAttendanceLog(
      buildAttendanceByDate([
        at("AM-1", [["2026-08-10", "Absent"]]),
        at("PM-1", [["2026-08-10", "Present"]]),
      ]),
      startMinutes
    );
    expect(morningMiss[0].status).toBe("morning half-day");
    expect(morningMiss[0].tone).toBe("amber");

    const eveningMiss = buildAttendanceLog(
      buildAttendanceByDate([
        at("AM-1", [["2026-08-10", "Present"]]),
        at("PM-1", [["2026-08-10", "Absent"]]),
      ]),
      startMinutes
    );
    expect(eveningMiss[0].status).toBe("evening half-day");
  });

  it("calls a total miss an absent day", () => {
    const rows = buildAttendanceLog(
      buildAttendanceByDate([
        at("AM-1", [["2026-08-10", "Absent"]]),
        at("PM-1", [["2026-08-10", "Absent"]]),
      ]),
      startMinutes
    );
    expect(rows[0].status).toBe("absent");
    expect(rows[0].tone).toBe("red");
    expect(rows[0].missedClasses).toHaveLength(2);
  });

  it("does not let an on-duty read as a missed class in the verdict", () => {
    const rows = buildAttendanceLog(
      buildAttendanceByDate([
        at("AM-1", [["2026-08-10", "Absent"]]),
        at("PM-1", [["2026-08-10", "On Duty"]]),
      ]),
      startMinutes
    );
    // An approved absence is not a missed one, so the evening half is clean and
    // the day reads as a morning miss — not as wholly absent. It is still
    // "missed" for notes, because there are no notes for an OD either.
    expect(rows[0].status).toBe("morning half-day");
    expect(rows[0].isMissed).toBe(true);
    expect(rows[0].missedClasses).toHaveLength(2);
  });

  it("calls a day with only on-duty a partial OD", () => {
    const rows = buildAttendanceLog(
      buildAttendanceByDate([
        at("AM-1", [["2026-08-10", "Present"]]),
        at("PM-1", [["2026-08-10", "On Duty"]]),
      ]),
      startMinutes
    );
    expect(rows[0].status).toBe("partial od");
    expect(rows[0].tone).toBe("amber");
  });

  it("orders newest first and flags the future", () => {
    const rows = buildAttendanceLog(
      buildAttendanceByDate([
        at("AM-1", [
          ["2026-08-10", "Present"],
          ["2026-08-12", "Present"],
          ["2026-08-11", "Present"],
        ]),
      ]),
      startMinutes,
      new Date(2026, 7, 11)
    );
    expect(rows.map((r) => r.dateKey)).toEqual(["2026-08-12", "2026-08-11", "2026-08-10"]);
    expect(rows[0].isFuture).toBe(true);
    expect(rows[2].isFuture).toBe(false);
  });

  it("survives a course whose slot time is unknown", () => {
    // No slot match -> no start time -> treated as morning, never NaN.
    const rows = buildAttendanceLog(
      buildAttendanceByDate([at("AM-1", [["2026-08-10", "Absent"]]) ]),
      () => null
    );
    expect(rows[0].status).toBe("morning half-day");
  });
});

describe("filterLog", () => {
  const rows = buildAttendanceLog(
    buildAttendanceByDate([
      viewLink("A", "A", [
        ["2026-08-10", "Present"],
        ["2026-08-12", "Absent"],
      ]),
    ]),
    () => 8 * 60,
    new Date(2026, 7, 11)
  );

  it("keeps everything under 'all'", () => {
    expect(filterLog(rows, "all")).toHaveLength(2);
  });

  it("splits by whether a class was missed", () => {
    expect(filterLog(rows, "missed").map((r) => r.dateKey)).toEqual(["2026-08-12"]);
    expect(filterLog(rows, "present").map((r) => r.dateKey)).toEqual(["2026-08-10"]);
  });

  it("separates the future", () => {
    expect(filterLog(rows, "upcoming").map((r) => r.dateKey)).toEqual(["2026-08-12"]);
  });
});

describe("buildEnrichedCalendars", () => {
  it("marks a published holiday as a holiday and a teaching day as instructional", () => {
    const [august] = buildEnrichedCalendars({ calendars: monthCalendar("August 2026", [15]) });
    expect(august.days[14].dayType).toBe("holiday");
    expect(august.days[9].dayType).toBe("instructional");
    // `working` is now "has classes" — instructional plus shortened.
    expect(august.summary).toMatchObject({ total: 31, holiday: 1, working: 30 });
  });

  it("labels an unknown date as other, not as a holiday", () => {
    // The old grid classified anything it did not recognise as a holiday, which
    // turned a fetch gap into a red day.
    const [august] = buildEnrichedCalendars({
      calendars: [{ month: "August 2026", year: 2026, days: [] }],
    });
    expect(august.days[0].dayType).toBe("other");
  });

  it("calls a shortened class list a semi-holiday, not a working day", () => {
    const [august] = buildEnrichedCalendars({
      calendars: [
        {
          month: "August 2026",
          year: 2026,
          days: [
            {
              date: 20,
              events: [{ type: "Instructional Day", text: "Instructional Day", category: "Working day" }, { type: "Other", text: "CAT - I", category: "Continuous Assessment Test" }],
            },
          ],
        },
      ],
    });
    expect(august.days.find((d) => d.date === 20)!.dayType).toBe("semiholiday");
  });

  it("folds attendance, exams, moodle and tasks onto the right day", () => {
    const [august] = buildEnrichedCalendars({
      calendars: monthCalendar("August 2026"),
      attendance: [viewLink("25BLC1081", "Biology", [["2026-08-12", "Absent"]])],
      schedule: { Schedule: { CAT: [{ courseCode: "25BLC1081", courseTitle: "Biology", examDate: "2026-08-20", examTime: "10:00 AM", venue: "AB1-101" }] } },
      moodle: [{ name: "Course/Assignment 3", due: "2026-08-25T23:59:00", done: false, url: "https://moodle/3" }],
      tasks: [
        {
          id: "t1",
          title: "Read Chapter 5",
          kind: "homework",
          status: "pending",
          courseCode: "25BLC1081",
          component: "both",
          dueDate: new Date(2026, 7, 25, 18).toISOString(),
          reminders: [],
          schedule: [],
          createdAt: "",
          updatedAt: "",
        },
      ],
    });

    const twelfth = august.days.find((d) => d.date === 12)!;
    expect(twelfth.attendance.absent).toBe(1);
    expect(twelfth.events.find((e) => e.kind === "class")?.absent).toBe(true);

    const twentieth = august.days.find((d) => d.date === 20)!;
    expect(twentieth.events.find((e) => e.kind === "exam")?.title).toBe("Biology");
    expect(twentieth.dayType).toBe("semiholiday");

    const twentyfifth = august.days.find((d) => d.date === 25)!;
    const assignments = twentyfifth.events.filter((e) => e.kind === "assignment");
    expect(assignments.some((e) => e.title === "Assignment 3")).toBe(true);
    expect(assignments.some((e) => e.title === "Read Chapter 5")).toBe(true);
    expect(twentyfifth.taskCount).toBe(1);
  });

  it("skips a completed moodle submission", () => {
    const [august] = buildEnrichedCalendars({
      calendars: monthCalendar("August 2026"),
      moodle: [{ name: "Course/Done", due: "2026-08-25T23:59:00", done: true }],
    });
    const day = august.days.find((d) => d.date === 25)!;
    expect(day.events.filter((e) => e.kind === "assignment")).toHaveLength(0);
    expect(day.taskCount).toBe(0);
  });

  it("does not truncate a month whose payload lists only some days", () => {
    // The old page used `rawDays.length` as the day count, so a three-day
    // payload rendered a three-day month and the rest of the semester vanished.
    const [august] = buildEnrichedCalendars({
      calendars: [
        {
          month: "August 2026",
          year: 2026,
          days: [
            { date: 1, events: [{ type: "Instructional Day", text: "Instructional Day", category: "Working day" }] },
            { date: 2, events: [] },
            { date: 3, events: [] },
          ],
        },
      ],
    });
    expect(august.days).toHaveLength(31);
    expect(august.days[30].date).toBe(31);
  });

  it("orders a day's events so the important one is first", () => {
    const [august] = buildEnrichedCalendars({
      calendars: monthCalendar("August 2026"),
      schedule: { Schedule: { CAT: [{ courseCode: "X", courseTitle: "Exam", examDate: "2026-08-20" }] } },
      moodle: [{ name: "Course/DA", due: "2026-08-20T23:59:00", done: false }],
      attendance: [viewLink("Y", "Class", [["2026-08-20", "Present"]])],
    });
    const kinds = august.days.find((d) => d.date === 20)!.events.map((e) => e.kind);
    expect(kinds[0]).toBe("exam");
    expect(kinds.indexOf("class")).toBeGreaterThan(kinds.indexOf("assignment"));
  });

  it("takes the whole semester and sorts it chronologically", () => {
    const months = buildEnrichedCalendars({
      calendars: [
        { month: "September 2026", year: 2026, days: [] },
        { month: "August 2026", year: 2026, days: [] },
      ],
    });
    expect(months.map((m) => m.label)).toEqual(["August 2026", "September 2026"]);
  });

  it("puts a Moodle deadline and a task due the same day in one list", () => {
    // The day model is the sheet's only source for its Tasks section. If Moodle
    // deadlines were not in it, the grid would show a dot for a deadline and
    // the sheet would then say "Nothing due today".
    const [august] = buildEnrichedCalendars({
      calendars: monthCalendar("August 2026"),
      moodle: [{ name: "Course/DA 2", due: "2026-08-25T23:59:00", done: false, url: "https://moodle/2" }],
      tasks: [
        {
          id: "t1",
          title: "Read Chapter 5",
          kind: "homework",
          status: "pending",
          courseCode: "25BLC1081",
          component: "both",
          dueDate: new Date(2026, 7, 25, 18).toISOString(),
          reminders: [],
          schedule: [],
          createdAt: "",
          updatedAt: "",
        },
      ],
    });

    const assignments = august.days.find((d) => d.date === 25)!.events.filter((e) => e.kind === "assignment");
    expect(assignments).toHaveLength(2);
    // Only the task-store entry is cyclable; a Moodle one is marked in Moodle.
    expect(assignments.filter((e) => e.taskId)).toHaveLength(1);
    expect(assignments.every((e) => e.dueAt instanceof Date)).toBe(true);
  });

  it("does not let a completed or non-due task appear", () => {
    const task = (over: Partial<Task>): Task => ({
      id: "t",
      title: "Task",
      kind: "homework",
      status: "pending",
      courseCode: "25BLC1081",
      component: "both",
      reminders: [],
      schedule: [],
      createdAt: "",
      updatedAt: "",
      ...over,
    });

    const [august] = buildEnrichedCalendars({
      calendars: monthCalendar("August 2026"),
      tasks: [
        task({ id: "done", title: "Done", status: "done", dueDate: new Date(2026, 7, 25).toISOString() }),
        task({ id: "other-day", title: "Other", dueDate: new Date(2026, 7, 26).toISOString() }),
      ],
    });
    const assignmentsOn = (d: number) =>
      august.days.find((x) => x.date === d)!.events.filter((e) => e.kind === "assignment");
    expect(assignmentsOn(25)).toHaveLength(0);
    expect(assignmentsOn(26)).toHaveLength(1);
    expect(assignmentsOn(26)[0].title).toBe("Other");
  });

  it("returns nothing when there is nothing", () => {
    expect(buildEnrichedCalendars({ calendars: null })).toEqual([]);
    expect(buildEnrichedCalendars({})).toEqual([]);
  });
});

describe("exam days", () => {
  const withExam = buildEnrichedCalendars({
    calendars: monthCalendar("August 2026"),
    schedule: {
      Schedule: {
        CAT: [
          { courseCode: "25BLC1081", courseTitle: "Biology", examDate: "2026-08-20", examTime: "10:00 AM", venue: "AB1-101" },
          { courseCode: "25BLC1082", courseTitle: "Physics", examDate: "2026-08-20", examTime: "02:00 PM", venue: "AB1-102" },
        ],
      },
    },
  });

  it("recognises a day that carries an exam", () => {
    const examDay = withExam[0].days.find((d) => d.date === 20)!;
    expect(isExamDay(examDay)).toBe(true);
    expect(examsOn(examDay)).toHaveLength(2);
    expect(examsOn(examDay).map((e) => e.title).sort()).toEqual(["Biology", "Physics"]);
  });

  it("does not call an ordinary working day an exam day", () => {
    const ordinary = withExam[0].days.find((d) => d.date === 11)!;
    expect(isExamDay(ordinary)).toBe(false);
    expect(examsOn(ordinary)).toHaveLength(0);
  });

  it("does not call a working day with a Moodle deadline an exam day", () => {
    // A submission deadline is not a paper. Treating the two alike would blank
    // the timetable on ordinary days whenever an assignment happened to land.
    const [august] = buildEnrichedCalendars({
      calendars: monthCalendar("August 2026"),
      moodle: [{ name: "Course/DA", due: "2026-08-15T23:59:00", done: false }],
    });
    const day = august.days.find((d) => d.date === 15)!;
    expect(day.dayType).toBe("semiholiday");
    expect(isExamDay(day)).toBe(false);
  });

  it("lets a real holiday stay a holiday, deadline or not", () => {
    const [august] = buildEnrichedCalendars({
      calendars: monthCalendar("August 2026", [15]),
      moodle: [{ name: "Course/DA", due: "2026-08-15T23:59:00", done: false }],
    });
    expect(august.days.find((d) => d.date === 15)!.dayType).toBe("holiday");
  });

  it("classifies a working day carrying an exam as a semi-holiday", () => {
    const examDay = withExam[0].days.find((d) => d.date === 20)!;
    expect(examDay.dayType).toBe("semiholiday");
  });
});

describe("milestones", () => {
  /** A teaching month with one milestone on the given date. */
  const withMilestone = (date: number, text: string) =>
    buildEnrichedCalendars({
      calendars: [
        {
          month: "August 2026",
          year: 2026,
          days: [
            {
              date,
              events: [
                { type: "Instructional Day", text: "Instructional Day", category: "Working day" },
                // The category is "Working day" on the real payload too, which
                // is why the ordering inside `classify` matters.
                { type: "Other", text, category: "Working day" },
              ],
            },
          ],
        },
      ],
    });

  it("recognises LID for theory classes and keeps its blurb", () => {
    const [august] = withMilestone(10, "LID FOR THEORY CLASSES");
    const day = august.days.find((d) => d.date === 10)!;
    const milestone = day.events.find((e) => e.kind === "milestone")!;
    expect(milestone.title).toBe("LID — Theory");
    expect(milestone.detail).toBe("Last instructional day for theory classes");
    expect(milestone.tone).toBe("indigo");
  });

  it("recognises LID for laboratory classes through its alias", () => {
    const [august] = withMilestone(11, "LID FOR LAB");
    const day = august.days.find((d) => d.date === 11)!;
    expect(day.events.find((e) => e.kind === "milestone")?.title).toBe("LID — Lab");
  });

  it("recognises the CATs and the mid term test", () => {
    const [august] = buildEnrichedCalendars({
      calendars: [
        {
          month: "August 2026",
          year: 2026,
          days: [
            { date: 1, events: [{ type: "Other", text: "CAT - I", category: "Working day" }] },
            { date: 2, events: [{ type: "Other", text: "CAT - II", category: "Working day" }] },
            { date: 3, events: [{ type: "Other", text: "Mid Term Test", category: "Working day" }] },
          ],
        },
      ],
    });
    const titles = (d: number) =>
      august.days.find((x) => x.date === d)!.events.map((e) => e.title);
    expect(titles(1)).toContain("CAT I");
    expect(titles(2)).toContain("CAT II");
    expect(titles(3)).toContain("Mid Term Test");
  });

  it("does not let a milestone be mistaken for the working-day marker", () => {
    // Both entries on this day carry category "Working day". The milestone
    // check has to win, or LID renders as an anonymous "Working Day" and the
    // semester's boundary date is invisible.
    const [august] = withMilestone(10, "LID FOR THEORY CLASSES");
    const day = august.days.find((d) => d.date === 10)!;
    expect(day.events.filter((e) => e.kind === "working")).toHaveLength(1);
    expect(day.events.filter((e) => e.kind === "milestone")).toHaveLength(1);
  });

  it("marks a LID day as still a teaching day", () => {
    // The last day of instruction is a day you are in class.
    const [august] = withMilestone(10, "LID FOR THEORY CLASSES");
    const day = august.days.find((d) => d.date === 10)!;
    expect(day.dayType).toBe("instructional");
    expect(hasClasses(day)).toBe(true);
  });

  it("still renders an unrecognised college entry rather than dropping it", () => {
    const [august] = buildEnrichedCalendars({
      calendars: [
        {
          month: "August 2026",
          year: 2026,
          days: [
            { date: 6, events: [{ type: "Other", text: "Vibrance 2026", category: "College event" }] },
          ],
        },
      ],
    });
    const day = august.days.find((d) => d.date === 6)!;
    expect(day.events).toHaveLength(1);
    expect(day.events[0].kind).toBe("event");
    // Catch-all only: `category` is the name worth heading the row with.
    expect(day.events[0].title).toBe("College event");
    expect(day.events[0].detail).toBe("Vibrance 2026");
  });

  it("does not repeat a catch-all's title as its own subtitle", () => {
    const [august] = buildEnrichedCalendars({
      calendars: [
        {
          month: "August 2026",
          year: 2026,
          days: [{ date: 6, events: [{ type: "Other", text: "Sports Day", category: "Sports Day" }] }],
        },
      ],
    });
    expect(august.days.find((d) => d.date === 6)!.events[0].detail).toBeUndefined();
  });

  it("falls back to `text` when a catch-all has no category", () => {
    const [august] = buildEnrichedCalendars({
      calendars: [
        {
          month: "August 2026",
          year: 2026,
          days: [{ date: 6, events: [{ type: "Other", text: "Freshers Orientation" }] }],
        },
      ],
    });
    const event = august.days.find((d) => d.date === 6)!.events[0];
    expect(event.title).toBe("Freshers Orientation");
    expect(event.detail).toBeUndefined();
  });

  it("leaves a curated title alone", () => {
    // The catch-all inversion must not reach the classified kinds: here the
    // category is "Working day", and the branch owns its own wording.
    const [august] = buildEnrichedCalendars({ calendars: monthCalendar("August 2026") });
    const working = august.days.find((d) => d.date === 5)!.events.find((e) => e.kind === "working")!;
    expect(working.title).toBe("Working day");
    expect(working.detail).toBeUndefined();
  });

  it("puts a milestone on the grid marker row", () => {
    const [august] = withMilestone(10, "LID FOR THEORY CLASSES");
    const day = august.days.find((d) => d.date === 10)!;
    expect(dayMarkers(day)).toContain("indigo");
  });

  it("sorts a milestone above an assignment on the same day", () => {
    const [august] = buildEnrichedCalendars({
      calendars: [
        {
          month: "August 2026",
          year: 2026,
          days: [
            { date: 10, events: [{ type: "Other", text: "LID FOR THEORY CLASSES", category: "Working day" }] },
          ],
        },
      ],
      moodle: [{ name: "Course/DA", due: "2026-08-10T23:59:00", done: false }],
    });
    const day = august.days.find((d) => d.date === 10)!;
    expect(day.events[0].kind).toBe("milestone");
  });
});

describe("exam series naming", () => {
  /** A CAT II day, in whatever spellings each source happens to use. */
  const catDay = (milestoneText: string, seriesKeys: string[]) =>
    buildEnrichedCalendars({
      calendars: [
        {
          month: "August 2026",
          year: 2026,
          days: [
            {
              date: 20,
              events: [
                { type: "Other", text: "Instructional Day", category: "Working day" },
                { type: "Other", text: milestoneText, category: "Working day" },
              ],
            },
          ],
        },
      ],
      schedule: {
        Schedule: Object.fromEntries(
          seriesKeys.map((k) => [
            k,
            [
              { courseCode: "25BLC1081", courseTitle: "Biology", examDate: "2026-08-20", examTime: "10:00 AM", venue: "AB1-101" },
              { courseCode: "25BLC1082", courseTitle: "Physics", examDate: "2026-08-20", examTime: "02:00 PM", venue: "AB1-102" },
            ],
          ])
        ),
      },
    });

  it("folds the papers into the milestone as one event", () => {
    const [august] = catDay("CAT - II", ["CAT2"]);
    const day = august.days.find((d) => d.date === 20)!;

    // One top-level milestone, no loose exam rows beside it.
    expect(day.events.filter((e) => e.kind === "milestone")).toHaveLength(1);
    expect(day.events.filter((e) => e.kind === "exam")).toHaveLength(0);

    const milestone = day.events.find((e) => e.kind === "milestone")!;
    expect(milestone.title).toBe("CAT II");
    expect(milestone.papers?.map((p) => p.title).sort()).toEqual(["Biology", "Physics"]);
  });

  it("folds whichever spelling each source used", () => {
    for (const [milestone, series] of [
      ["CAT - II", "CAT2"],
      ["CAT-II", "CAT II"],
      ["CAT 2", "CAT-2"],
      ["CATII", "cat 2"],
    ]) {
      const [august] = catDay(milestone as string, [series as string]);
      const day = august.days.find((d) => d.date === 20)!;
      const owner = day.events.find((e) => e.kind === "milestone")!;
      expect(owner.title, `${milestone} + ${series}`).toBe("CAT II");
      expect(owner.papers, `${milestone} + ${series}`).toHaveLength(2);
      expect(day.events.filter((e) => e.kind === "exam").length, `${milestone} + ${series}`).toBe(0);
    }
  });

  it("merges two series keys that name the same exam", () => {
    // The schedule has been seen carrying both "CAT II" and "CAT2". Without a
    // canonical name each paper is emitted twice, so the day lists four papers.
    const [august] = catDay("CAT - II", ["CAT II", "CAT2"]);
    const day = august.days.find((d) => d.date === 20)!;
    const owner = day.events.find((e) => e.kind === "milestone")!;
    expect(owner.papers).toHaveLength(2);
    expect(new Set(owner.papers!.map((p) => p.courseCode)).size).toBe(2);
  });

  it("labels every paper with one spelling of the series", () => {
    const [august] = catDay("CAT - II", ["CAT2"]);
    const owner = august.days.find((d) => d.date === 20)!.events.find((e) => e.kind === "milestone")!;
    // Not "CAT2" beside a "CAT II" milestone.
    expect(owner.papers!.every((p) => (p.detail ?? "").startsWith("CAT II"))).toBe(true);
  });

  it("still counts as an exam day after the fold", () => {
    // The papers are no longer top-level, so anything that asks "is this an
    // exam day" has to look inside the milestone or it will answer wrong and
    // show a timetable on a CAT day.
    const [august] = catDay("CAT - II", ["CAT2"]);
    const day = august.days.find((d) => d.date === 20)!;
    expect(isExamDay(day)).toBe(true);
    expect(hasClasses(day)).toBe(false);
    expect(examsOn(day)).toHaveLength(2);
  });

  it("leaves a paper alone when no milestone claims it", () => {
    const [august] = buildEnrichedCalendars({
      calendars: monthCalendar("August 2026"),
      schedule: { Schedule: { FAT: [{ courseCode: "X", courseTitle: "Biology", examDate: "2026-08-30" }] } },
    });
    const day = august.days.find((d) => d.date === 30)!;
    expect(day.events.filter((e) => e.kind === "exam")).toHaveLength(1);
    expect(milestonesOn(day)).toHaveLength(0);
  });

  it("does not fold a CAT I paper into the CAT II milestone", () => {
    const [august] = buildEnrichedCalendars({
      calendars: [
        {
          month: "August 2026",
          year: 2026,
          days: [{ date: 20, events: [{ type: "Other", text: "CAT - II", category: "Working day" }] }],
        },
      ],
      schedule: {
        Schedule: { CAT1: [{ courseCode: "X", courseTitle: "Biology", examDate: "2026-08-20" }] },
      },
    });
    const day = august.days.find((d) => d.date === 20)!;
    const owner = day.events.find((e) => e.kind === "milestone")!;
    expect(owner.papers ?? []).toHaveLength(0);
    expect(day.events.filter((e) => e.kind === "exam")).toHaveLength(1);
  });
});

describe("class-free days", () => {
  it("treats a holiday as class-free and the college as shut", () => {
    const [august] = buildEnrichedCalendars({ calendars: monthCalendar("August 2026", [15]) });
    const holiday = august.days.find((d) => d.date === 15)!;
    expect(holiday.dayType).toBe("holiday");
    expect(hasClasses(holiday)).toBe(false);
    expect(isCollegeOpen(holiday)).toBe(false);
    expect(holidaysOn(holiday).map((e) => e.title)).toContain("Pongal");
    expect(isExamDay(holiday)).toBe(false);
  });

  it("treats a non-instructional day as class-free but the college as open", () => {
    // The distinction the old page got wrong: a published day with nothing on
    // it is a working day at an open college, not a day off.
    const [august] = buildEnrichedCalendars({
      calendars: [
        {
          month: "August 2026",
          year: 2026,
          days: [
            { date: 3, events: [] },
            {
              date: 4,
              events: [{ type: "Instructional Day", text: "Instructional Day", category: "Working day" }],
            },
          ],
        },
      ],
    });
    const quiet = august.days.find((d) => d.date === 3)!;
    expect(quiet.dayType).toBe("nonInstructional");
    expect(hasClasses(quiet)).toBe(false);
    expect(isCollegeOpen(quiet)).toBe(true);
    // Its neighbour is an ordinary teaching day, so the split is doing work.
    expect(august.days.find((d) => d.date === 4)!.dayType).toBe("instructional");
  });

  it("reads VTOP's 'Non Instructional Day' as open, not as a holiday", () => {
    const [august] = buildEnrichedCalendars({
      calendars: [
        {
          month: "August 2026",
          year: 2026,
          days: [
            {
              date: 4,
              // The category says "Working day", which is also what the
              // instructional test looks for — so order matters here.
              events: [{ type: "Other", text: "Non Instructional Day", category: "Working day" }],
            },
          ],
        },
      ],
    });
    const day = august.days.find((d) => d.date === 4)!;
    expect(day.dayType).toBe("nonInstructional");
    expect(hasClasses(day)).toBe(false);
    expect(isCollegeOpen(day)).toBe(true);
  });

  it("treats an exam day as class-free", () => {
    const [august] = buildEnrichedCalendars({
      calendars: monthCalendar("August 2026"),
      schedule: { Schedule: { CAT: [{ courseCode: "X", courseTitle: "Bio", examDate: "2026-08-20" }] } },
    });
    const examDay = august.days.find((d) => d.date === 20)!;
    expect(hasClasses(examDay)).toBe(false);
    expect(isCollegeOpen(examDay)).toBe(true);
  });

  it("treats an instructional day as having classes", () => {
    const [august] = buildEnrichedCalendars({ calendars: monthCalendar("August 2026") });
    const teaching = august.days.find((d) => d.date === 11)!;
    expect(teaching.dayType).toBe("instructional");
    expect(hasClasses(teaching)).toBe(true);
    expect(isCollegeOpen(teaching)).toBe(true);
  });

  it("keeps the timetable on a semi-holiday, because the list is only shortened", () => {
    const [august] = buildEnrichedCalendars({
      calendars: [
        {
          month: "August 2026",
          year: 2026,
          days: [
            {
              date: 20,
              events: [
                { type: "Instructional Day", text: "Instructional Day", category: "Working day" },
                { type: "Other", text: "Vibrance", category: "Club event" },
              ],
            },
          ],
        },
      ],
    });
    const day = august.days.find((d) => d.date === 20)!;
    expect(day.dayType).toBe("semiholiday");
    expect(hasClasses(day)).toBe(true);
  });

  it("does not invent a holiday for a date outside the published calendar", () => {
    const [august] = buildEnrichedCalendars({
      calendars: [{ month: "August 2026", year: 2026, days: [] }],
    });
    const unknown = august.days.find((d) => d.date === 11)!;
    expect(unknown.dayType).toBe("other");
    expect(hasClasses(unknown)).toBe(false);
  });

  it("trusts a recorded class over a missing calendar entry", () => {
    const [august] = buildEnrichedCalendars({
      calendars: [{ month: "August 2026", year: 2026, days: [] }],
      attendance: [viewLink("25BLC1081", "Biology", [["2026-08-11", "Present"]])],
    });
    const taught = august.days.find((d) => d.date === 11)!;
    expect(taught.dayType).toBe("instructional");
    expect(hasClasses(taught)).toBe(true);
  });
});
describe("activeMonthIndex", () => {
  const months = buildEnrichedCalendars({
    calendars: [
      { month: "August 2026", year: 2026, days: [] },
      { month: "September 2026", year: 2026, days: [] },
      { month: "October 2026", year: 2026, days: [] },
    ],
  });

  /**
   * `activeMonthIndex` calls `new Date()` itself rather than taking a `now`,
   * so the clock has to be stubbed. Pinned to fixed dates, never `Date.now()`.
   */
  const freeze = (y: number, m: number, d: number) => {
    const RealDate = Date;
    class FrozenDate extends RealDate {
      constructor(...args: any[]) {
        super(...((args.length ? args : [y, m, d]) as [any]));
      }
      static now() {
        return new RealDate(y, m, d).getTime();
      }
    }
    vi.stubGlobal("Date", FrozenDate);
  };

  afterEach(() => vi.unstubAllGlobals());

  it("opens on the month containing today", () => {
    freeze(2026, 8, 15);
    expect(activeMonthIndex(months)).toBe(1);
  });

  it("opens on the next month to start when today precedes the calendar", () => {
    freeze(2026, 5, 15);
    expect(activeMonthIndex(months)).toBe(0);
  });

  it("falls back to the last month when the whole calendar is past", () => {
    freeze(2027, 0, 10);
    expect(activeMonthIndex(months)).toBe(2);
  });

  it("does not divide by zero on an empty calendar", () => {
    expect(activeMonthIndex([])).toBe(0);
  });
});

describe("synthesiseDay", () => {
  it("rebuilds a day the published calendar does not cover", () => {
    const byDate = buildAttendanceByDate([
      viewLink("A", "Biology", [["2026-06-30", "Absent"]]),
    ]);
    const day = synthesiseDay(byDate.get("2026-06-30")!);
    expect(day.dateKey).toBe("2026-06-30");
    expect(day.date).toBe(30);
    expect(day.attendance.absent).toBe(1);
    expect(day.events.some((e) => e.kind === "class")).toBe(true);
  });

  it("does not produce an invalid date from an empty record", () => {
    const day = synthesiseDay({ held: 0, present: 0, absent: 0, onDuty: 0, courses: [] });
    expect(isNaN(day.fullDate.getTime())).toBe(false);
  });
});

describe("summariseOd", () => {
  const od = [
    {
      date: "2026-08-12",
      total: 3,
      courses: [
        { title: "Biology", type: "TH", hours: 1 },
        { title: "Biology Lab", type: "LAB", hours: 2 },
      ],
    },
  ];

  it("counts a lab as two hours", () => {
    const s = summariseOd(od, {});
    expect(s.totalHours).toBe(3);
    expect(s.validHours).toBe(3);
    expect(s.wastedHours).toBe(0);
  });

  it("moves a tracked-wasted OD out of the valid total", () => {
    const s = summariseOd(od, { "2026-08-12": { A: { courseTitle: "Biology", status: "wasted" } } });
    expect(s.wastedHours).toBe(1);
    expect(s.wastedCount).toBe(1);
    expect(s.validHours).toBe(2);
  });

  it("still counts a recovered OD as valid, because it was earned", () => {
    const s = summariseOd(od, { "2026-08-12": { A: { courseTitle: "Biology", status: "recovered" } } });
    expect(s.recoveredHours).toBe(1);
    expect(s.validHours).toBe(3);
  });

  it("matches a tracked course on containment, either way round", () => {
    const s = summariseOd(od, { "2026-08-12": { A: { courseTitle: "biology lab", status: "wasted" } } });
    expect(s.wastedHours).toBe(2);
  });

  it("does not let a theory course's status leak onto its own lab", () => {
    // "Biology" is a substring of "Biology Lab". Matching on containment alone
    // marked both wasted and double-counted the hours — a bug the old
    // summarise carried verbatim.
    const s = summariseOd(od, { "2026-08-12": { A: { courseTitle: "Biology", status: "wasted" } } });
    expect(s.wastedHours).toBe(1);
    expect(s.validHours).toBe(2);
  });

  it("prefers an exact match when one exists", () => {
    const s = summariseOd(od, {
      "2026-08-12": {
        THEORY: { courseTitle: "Biology", status: "wasted" },
        LAB: { courseTitle: "Biology Lab", status: "recovered" },
      },
    });
    // The theory hour is wasted and drops out of the valid total; the lab is
    // recovered, which means it was earned, so it stays in.
    expect(s.wastedHours).toBe(1);
    expect(s.recoveredHours).toBe(2);
    expect(s.validHours).toBe(2);
  });

  it("does not let one tracked entry claim two records", () => {
    // Two tracked entries, neither an exact match for either record. The first
    // claims the closer substring; the second takes what is left. Each record
    // is claimed once, so hours are never counted twice.
    const s = summariseOd(od, {
      "2026-08-12": {
        A: { courseTitle: "Biolo", status: "wasted" },
        B: { courseTitle: "logy Lab", status: "wasted" },
      },
    });
    expect(s.wastedHours).toBe(3);
    expect(s.wastedCount).toBe(2);
  });

  it("claims nothing for an unrelated course title", () => {
    const s = summariseOd(od, { "2026-08-12": { A: { courseTitle: "Chemistry", status: "wasted" } } });
    expect(s.wastedHours).toBe(0);
    expect(s.validHours).toBe(3);
  });

  it("is all zeroes for no data", () => {
    expect(summariseOd(null)).toMatchObject({ totalHours: 0, validHours: 0, wastedHours: 0 });
    expect(summariseOd([])).toMatchObject({ totalHours: 0 });
  });
});
