import { describe, expect, it } from "vitest";
import {
  buildExamRows,
  calculateSeatLocation,
  classifyExamState,
  clockMinutes,
  examStartMinutes,
  examWindow,
  formatClock,
  nextExamLabel,
  parseExamDate,
  slotMinutes,
} from "../lib/examSchedule";

const TODAY = new Date(2025, 10, 20); // 20-Nov-2025, midnight local

function subject(courseCode: string, examDate: string, examTime = "09:15 AM - 12:30 PM") {
  return { courseCode, courseTitle: `Course ${courseCode}`, examDate, examTime, examSession: "FN1", venue: "AB3-402", seatNo: "41", seatLocation: "-" };
}

describe("parseExamDate", () => {
  it("reads month-name dates like VTOP returns", () => {
    const d = parseExamDate("19-Nov-2025");
    expect(d).not.toBeNull();
    expect([d!.getFullYear(), d!.getMonth(), d!.getDate()]).toEqual([2025, 10, 19]);
  });

  it("reads numeric slash/dash dates", () => {
    const d = parseExamDate("07/01/2026");
    expect([d!.getFullYear(), d!.getMonth(), d!.getDate()]).toEqual([2026, 0, 7]);
    const dashed = parseExamDate("07-01-2026");
    expect([dashed!.getFullYear(), dashed!.getMonth(), dashed!.getDate()]).toEqual([2026, 0, 7]);
  });

  it("returns null for missing or unparseable input", () => {
    expect(parseExamDate(undefined)).toBeNull();
    expect(parseExamDate("")).toBeNull();
    expect(parseExamDate("TBA")).toBeNull();
  });
});

describe("clockMinutes", () => {
  it("reads a 12-hour clock into minutes since midnight", () => {
    expect(clockMinutes("09:15 AM")).toBe(9 * 60 + 15);
    expect(clockMinutes("02:00 PM")).toBe(14 * 60);
    expect(clockMinutes("12:00 PM")).toBe(12 * 60);
    expect(clockMinutes("12:30 AM")).toBe(30);
  });

  it("returns null for missing or unparseable values", () => {
    expect(clockMinutes(undefined)).toBeNull();
    expect(clockMinutes("TBA")).toBeNull();
  });
});

describe("slotMinutes", () => {
  it("splits an exam range into start and end", () => {
    expect(slotMinutes("09:15 AM - 12:30 PM")).toEqual([9 * 60 + 15, 12 * 60 + 30]);
    expect(slotMinutes("02:00 PM - 05:30 PM")).toEqual([14 * 60, 17 * 60 + 30]);
  });

  it("tolerates a range with no end", () => {
    expect(slotMinutes("09:15 AM")).toEqual([9 * 60 + 15, null]);
    expect(slotMinutes("TBA")).toEqual([null, null]);
  });
});

describe("examWindow", () => {
  it("uses the reported range for start and end", () => {
    const { startAt, endAt } = examWindow({ examTime: "09:15 AM - 12:30 PM" }, "FAT1", TODAY);
    expect(startAt?.getHours()).toBe(9);
    expect(startAt?.getMinutes()).toBe(15);
    expect(endAt?.getHours()).toBe(12);
    expect(endAt?.getMinutes()).toBe(30);
  });

  it("derives the end from reporting time plus the series duration", () => {
    const cat = examWindow({ examTime: "", reportingTime: "09:00 AM" }, "CAT1", TODAY);
    expect(cat.startAt?.getHours()).toBe(9);
    expect(cat.endAt?.getHours()).toBe(10);
    expect(cat.endAt?.getMinutes()).toBe(45);

    const fat = examWindow({ reportingTime: "09:00 AM" }, "FAT", TODAY);
    expect(fat.endAt?.getHours()).toBe(12);
    expect(fat.endAt?.getMinutes()).toBe(30);
  });

  it("has no window when the payload carries no usable time", () => {
    expect(examWindow({ examTime: "TBA" }, "FAT", TODAY)).toEqual({ startAt: null, endAt: null });
    expect(examWindow({ examTime: "09:00 AM" }, "LAB", TODAY).endAt).toBeNull();
  });

  it("has no window without a date", () => {
    expect(examWindow({ examTime: "09:00 AM" }, "FAT", null)).toEqual({ startAt: null, endAt: null });
  });
});

describe("classifyExamState", () => {
  const date = new Date(2025, 10, 20);
  const end = new Date(2025, 10, 20, 12, 30);

  it("marks a paper past as soon as its end time passes", () => {
    // The bug this guards: a CAT that ended at 12:30 PM used to stay "today"
    // until midnight, so a finished exam still looked pending.
    expect(classifyExamState(date, end, new Date(2025, 10, 20, 12, 29))).toBe("today");
    expect(classifyExamState(date, end, new Date(2025, 10, 20, 12, 30))).toBe("past");
    expect(classifyExamState(date, end, new Date(2025, 10, 20, 15, 0))).toBe("past");
  });

  it("still splits days when no end time is known", () => {
    expect(classifyExamState(new Date(2025, 10, 19), null, new Date(2025, 10, 20, 15, 0))).toBe("past");
    expect(classifyExamState(date, null, new Date(2025, 10, 20, 15, 0))).toBe("today");
    expect(classifyExamState(new Date(2025, 10, 21), null, new Date(2025, 10, 20, 15, 0))).toBe("upcoming");
  });

  it("treats an unparseable date as upcoming so it is never hidden", () => {
    expect(classifyExamState(null, null, TODAY)).toBe("upcoming");
  });
});

describe("buildExamRows", () => {
  it("flattens every series and sorts soonest-first", () => {
    const rows = buildExamRows(
      {
        FAT: [subject("B", "25-Nov-2025"), subject("A", "19-Nov-2025")],
        CAT1: [subject("C", "21-Nov-2025")],
      },
      TODAY
    );
    // 19-Nov (FAT) -> 21-Nov (CAT1) -> 25-Nov (FAT): date order across series.
    expect(rows.map((r) => r.raw.courseCode)).toEqual(["A", "C", "B"]);
    expect(rows.map((r) => r.examType)).toEqual(["FAT", "CAT1", "FAT"]);
  });

  it("classifies each row against the reference day", () => {
    const rows = buildExamRows(
      { FAT: [subject("U", "05-Dec-2025"), subject("P", "01-Oct-2025"), subject("T", "20-Nov-2025")] },
      TODAY
    );
    expect(rows.map((r) => r.state)).toEqual(["past", "today", "upcoming"]);
  });

  it("breaks same-day ties by slot time, not by string order", () => {
    const rows = buildExamRows(
      {
        FAT: [
          subject("Z", "20-Nov-2025", "02:00 PM - 05:30 PM"),
          subject("Y", "20-Nov-2025", "09:00 AM - 12:30 PM"),
        ],
      },
      TODAY
    );
    // Lexicographically "02:00 PM" sorts before "09:00 AM" — the morning exam
    // must still come first.
    expect(rows.map((r) => r.raw.courseCode)).toEqual(["Y", "Z"]);
  });

  it("breaks a same-time tie on course code", () => {
    const rows = buildExamRows(
      {
        FAT: [
          subject("M", "20-Nov-2025", "09:00 AM - 12:30 PM"),
          subject("A", "20-Nov-2025", "09:00 AM - 12:30 PM"),
        ],
      },
      TODAY
    );
    expect(rows.map((r) => r.raw.courseCode)).toEqual(["A", "M"]);
  });

  it("gives every row a unique key", () => {
    const rows = buildExamRows(
      { FAT: [subject("A", "19-Nov-2025"), subject("A", "19-Nov-2025")] },
      TODAY
    );
    expect(new Set(rows.map((r) => r.key)).size).toBe(rows.length);
  });

  it("carries the resolved start and end instants on each row", () => {
    const rows = buildExamRows({ FAT: [subject("A", "20-Nov-2025", "09:15 AM - 12:30 PM")] }, TODAY);
    expect(rows[0].startAt?.getHours()).toBe(9);
    expect(rows[0].endAt?.getHours()).toBe(12);
  });

  it("retires a paper once its end time is past, not at midnight", () => {
    const schedule = {
      FAT: [subject("MORNING", "20-Nov-2025", "09:15 AM - 12:30 PM")],
      CAT1: [subject("AFTERNOON", "20-Nov-2025", "02:00 PM - 03:45 PM")],
    };

    const duringMorning = buildExamRows(schedule, new Date(2025, 10, 20, 10, 0));
    expect(duringMorning.map((r) => r.state)).toEqual(["today", "today"]);

    // The reported bug: hours after the morning paper finished it still read
    // as pending, because state was judged at day granularity.
    const afterMorning = buildExamRows(schedule, new Date(2025, 10, 20, 15, 0));
    expect(afterMorning.find((r) => r.raw.courseCode === "MORNING")?.state).toBe("past");
    expect(afterMorning.find((r) => r.raw.courseCode === "AFTERNOON")?.state).toBe("today");

    const allOver = buildExamRows(schedule, new Date(2025, 10, 20, 18, 0));
    expect(allOver.every((r) => r.state === "past")).toBe(true);
  });

  it("ignores non-array values and empty payloads", () => {
    expect(buildExamRows({ FAT: "nope" }, TODAY)).toEqual([]);
    expect(buildExamRows(null, TODAY)).toEqual([]);
    expect(buildExamRows(undefined, TODAY)).toEqual([]);
    expect(buildExamRows({}, TODAY)).toEqual([]);
  });
});

describe("next unfinished paper", () => {
  // Both mobile homes pick their "Next exam" card with
  // `buildExamRows(...).find((r) => r.state !== "past")`.
  const schedule = {
    CAT1: [subject("MORNING", "20-Nov-2025", "09:15 AM - 12:30 PM")],
    CAT2: [subject("EVENING", "20-Nov-2025", "06:00 PM - 07:45 PM")],
  };

  it("skips a paper that finished earlier today", () => {
    const at3pm = buildExamRows(schedule, new Date(2025, 10, 20, 15, 0));
    expect(at3pm.find((r) => r.state !== "past")?.raw.courseCode).toBe("EVENING");
  });

  it("picks the morning paper while it is still running", () => {
    const at10am = buildExamRows(schedule, new Date(2025, 10, 20, 10, 0));
    expect(at10am.find((r) => r.state !== "past")?.raw.courseCode).toBe("MORNING");
  });

  it("is empty once every paper is done", () => {
    const at9pm = buildExamRows(schedule, new Date(2025, 10, 20, 21, 0));
    expect(at9pm.find((r) => r.state !== "past")).toBeUndefined();
  });
});

describe("formatClock", () => {
  it("renders minutes back as a 12-hour clock", () => {
    expect(formatClock(9 * 60 + 15)).toBe("9:15 AM");
    expect(formatClock(14 * 60)).toBe("2:00 PM");
    expect(formatClock(12 * 60 + 30)).toBe("12:30 PM");
    expect(formatClock(0)).toBe("12:00 AM");
  });

  it("falls back when there is no time", () => {
    expect(formatClock(null)).toBe("Time TBA");
  });
});

describe("nextExamLabel", () => {
  const row = buildExamRows(
    { FAT: [subject("A", "20-Nov-2025", "09:15 AM - 12:30 PM")] },
    TODAY
  )[0];

  it("counts down by day for anything not today", () => {
    const tomorrow = buildExamRows({ FAT: [subject("A", "21-Nov-2025")] }, TODAY)[0];
    expect(nextExamLabel(tomorrow, new Date(2025, 10, 20, 15, 0))).toBe("Tomorrow");
  });

  it("shows the clock for today's paper, and 'Now' once it has started", () => {
    expect(nextExamLabel(row, new Date(2025, 10, 20, 7, 0))).toBe("Today · 9:15 AM");
    expect(nextExamLabel(row, new Date(2025, 10, 20, 10, 0))).toBe("Now · 9:15 AM");
  });

  it("says All done when nothing is left", () => {
    expect(nextExamLabel(null, TODAY)).toBe("All done");
  });
});

describe("examStartMinutes", () => {
  it("reads a 12-hour slot into minutes since midnight", () => {
    expect(examStartMinutes({ examTime: "09:15 AM - 12:30 PM" })).toBe(9 * 60 + 15);
    expect(examStartMinutes({ examTime: "02:00 PM - 05:30 PM" })).toBe(14 * 60);
    expect(examStartMinutes({ examTime: "12:00 PM - 03:30 PM" })).toBe(12 * 60);
    expect(examStartMinutes({ examTime: "12:30 AM" })).toBe(30);
  });

  it("falls back to reporting time, then to null", () => {
    expect(examStartMinutes({ reportingTime: "08:45 AM" })).toBe(8 * 60 + 45);
    expect(examStartMinutes({})).toBeNull();
    expect(examStartMinutes({ examTime: "TBA" })).toBeNull();
  });
});

describe("calculateSeatLocation", () => {
  it("maps a seat number to a row/column pair", () => {
    // 18 seats per group, two columns per group: seats 1-18 -> columns 1/2,
    // seats 19-36 -> columns 3/4, and so on.
    expect(calculateSeatLocation("1", "Mathematics")).toBe("R1C1");
    expect(calculateSeatLocation("2", "Mathematics")).toBe("R1C2");
    expect(calculateSeatLocation("3", "Mathematics")).toBe("R2C1");
    expect(calculateSeatLocation("19", "Mathematics")).toBe("R1C3");
    expect(calculateSeatLocation("36", "Mathematics")).toBe("R9C4");
    expect(calculateSeatLocation("37", "Mathematics")).toBe("R1C5");
  });

  it("has no seat for language papers", () => {
    expect(calculateSeatLocation("12", "German")).toBe("-");
    expect(calculateSeatLocation("12", "French")).toBe("-");
  });

  it("degrades gracefully on junk input", () => {
    expect(calculateSeatLocation("-", "Mathematics")).toBe("-");
    expect(calculateSeatLocation("0", "Mathematics")).toBe("-");
  });
});
