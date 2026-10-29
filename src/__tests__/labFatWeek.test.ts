import { describe, expect, it } from "vitest";
import {
  isLabFatMarked,
  isLabSlotToken,
  labFatDateKeys,
  labFatPapers,
  labFatPapersByDate,
  labSlotTokens,
  paperForClassSlot,
} from "../lib/labFatWeek";

/** A months-array academic calendar with one LAB FAT day on Nov 19, 2025. */
const calendars = [
  {
    month: "November 2025",
    totalDays: 30,
    days: [
      {
        date: 18,
        events: [
          { text: "(Working Day)", type: "Instructional Day", category: "Working Day" },
        ],
      },
      {
        date: 19,
        events: [
          {
            text: "(Working Day / LAB FAT)",
            type: "Instructional Day",
            color: "#eb556e",
            category: "Working Day / LAB FAT",
          },
        ],
      },
    ],
  },
];

const schedule = {
  FAT: [
    {
      courseCode: "CSC201L",
      courseTitle: "Object Oriented Programming Lab",
      classId: "PROD123",
      slot: "L27+L28",
      examDate: "19-Nov-2025",
      examSession: "AN",
      reportingTime: "01:30 PM",
      examTime: "02:00 PM - 05:00 PM",
      venue: "AB3-402",
      seatLocation: "R5C3",
      seatNo: "41",
    },
    {
      // Theory paper on the same LAB FAT day — no lab slot, must not match.
      courseCode: "CSC201",
      courseTitle: "Object Oriented Programming",
      classId: "PROD124",
      slot: "A2+TA2+TAA2",
      examDate: "19-Nov-2025",
      examSession: "FN1",
      reportingTime: "09:00 AM",
      examTime: "09:15 AM - 12:30 PM",
      venue: "AB1-201",
      seatNo: "12",
    },
  ],
  CAT1: [
    {
      // Lab paper outside the LAB FAT days — a different week, must not match.
      courseCode: "CSC201L",
      courseTitle: "Object Oriented Programming Lab",
      classId: "PROD123",
      slot: "L27+L28",
      examDate: "05-Sep-2025",
      examSession: "FN",
      reportingTime: "09:00 AM",
      examTime: "09:15 AM - 11:00 AM",
      venue: "AB3-402",
      seatNo: "41",
    },
  ],
};

describe("isLabFatMarked", () => {
  it("recognises the calendar's LAB FAT spellings", () => {
    expect(isLabFatMarked("(Working Day / LAB FAT)", "Working Day / LAB FAT")).toBe(true);
    expect(isLabFatMarked("(LAB FAT /Instructional Day / Tuesday Day Order)")).toBe(true);
    expect(isLabFatMarked(undefined, "Working Day / LAB FAT / LID for theory classes")).toBe(true);
    // Hyphenated spelling from prose.
    expect(isLabFatMarked("Lab-FAT day")).toBe(true);
  });

  it("leaves ordinary days and other assessments alone", () => {
    expect(isLabFatMarked("(Working Day)", "Working Day")).toBe(false);
    expect(isLabFatMarked("(Mid Term Test / Holiday)")).toBe(false);
    expect(isLabFatMarked("LID for laboratory classes")).toBe(false);
    expect(isLabFatMarked()).toBe(false);
  });
});

describe("slot tokens", () => {
  it("classifies L-tokens as labs and theory/tutorial tokens as not", () => {
    expect(isLabSlotToken("L1")).toBe(true);
    expect(isLabSlotToken("l27")).toBe(true);
    expect(isLabSlotToken("A1")).toBe(false);
    expect(isLabSlotToken("TA2")).toBe(false);
    expect(isLabSlotToken("TAA2")).toBe(false);
  });

  it("extracts only the lab tokens from a joined slot", () => {
    expect(labSlotTokens("L27+L28")).toEqual(["L27", "L28"]);
    expect(labSlotTokens("A1+TA1+TAA1+L1+L2")).toEqual(["L1", "L2"]);
    expect(labSlotTokens("A2+TA2+TAA2")).toEqual([]);
    expect(labSlotTokens(undefined)).toEqual([]);
  });
});

describe("labFatDateKeys", () => {
  it("collects only the calendar-marked days, per shape", () => {
    const keys = labFatDateKeys(calendars);
    expect(keys).toEqual(new Set(["2025-11-19"]));
    // The wrapper shape stores the same months under `.calendars`.
    expect(labFatDateKeys({ calendars })).toEqual(keys);
  });

  it("is empty without a calendar", () => {
    expect(labFatDateKeys(undefined).size).toBe(0);
    expect(labFatDateKeys({ calendars: [] }).size).toBe(0);
  });
});

describe("labFatPapers", () => {
  it("keeps the lab papers on marked days and drops theory and other weeks", () => {
    const papers = labFatPapers(schedule, calendars, new Date(2025, 10, 1));
    expect(papers).toHaveLength(1);
    const [paper] = papers;
    expect(paper.courseCode).toBe("CSC201L");
    expect(paper.labTokens).toEqual(["L27", "L28"]);
    expect(paper.series).toBe("FAT");
    expect(paper.dateKey).toBe("2025-11-19");
    expect(paper.venue).toBe("AB3-402");
    expect(paper.examTime).toBe("02:00 PM - 05:00 PM");
  });

  it("is empty when either signal is missing", () => {
    expect(labFatPapers(schedule, [], new Date(2025, 10, 1))).toEqual([]);
    expect(labFatPapers({}, calendars, new Date(2025, 10, 1))).toEqual([]);
  });

  it("buckets by date for per-day lookup", () => {
    const byDate = labFatPapersByDate(schedule, calendars, new Date(2025, 10, 1));
    expect(byDate.get("2025-11-19")?.map((p) => p.courseCode)).toEqual(["CSC201L"]);
    expect(byDate.get("2025-11-18")).toBeUndefined();
  });
});

describe("paperForClassSlot", () => {
  const papers = labFatPapers(schedule, calendars, new Date(2025, 10, 1));

  it("matches a timetable row by shared lab token", () => {
    expect(paperForClassSlot(papers, "OTHER201L", "L27+L28")?.courseCode).toBe("CSC201L");
    // Attendance rows are single tokens after the split.
    expect(paperForClassSlot(papers, undefined, "L28")?.courseCode).toBe("CSC201L");
  });

  it("falls back to the course code when slots disagree in spelling", () => {
    expect(paperForClassSlot(papers, "CSC201L", "A1")?.courseCode).toBe("CSC201L");
  });

  it("stays undefined when nothing matches", () => {
    expect(paperForClassSlot(papers, "CHM101L", "L1+L2")).toBeUndefined();
    expect(paperForClassSlot([], "CSC201L", "L27")).toBeUndefined();
  });
});
