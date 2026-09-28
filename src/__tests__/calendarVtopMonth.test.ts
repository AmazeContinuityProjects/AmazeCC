import { describe, expect, it } from "vitest";
import { buildEnrichedCalendars, hasClasses, isExamDay } from "../lib/calendarDay";

/**
 * A real VTOP academic-calendar month, transcribed.
 *
 * Every entry on this calendar is `text (category)`, and the split is
 * consistent: `text` is a type word — "Holiday", "No Instructional Day",
 * "Instructional Day" — while `category` carries the actual name. Every bug
 * this file pins came from reading that the other way round, or from reading
 * only one of the two fields:
 *
 *  - the milestone lives in `category`, not `text`, so matching `text` alone
 *    loses every LID date;
 *  - the type word is the weaker string and was sitting where the eye reads
 *    first, so "Holiday" was the title of the row called Gandhi Jayanthi;
 *  - taking `category` wholesale printed "Working day" twice on every single
 *    instructional day, and threw away the day order and the FAT;
 *  - "Working Day / LAB FAT" and "Working Day / LID for LAB classes" differ
 *    only in the tail after the slash, which is the part that means something.
 */
type Row = [day: number, text: string, category: string];

const AUGUST_2026: Row[] = [
  [1, "CAT - II", "CAT - II"],
  [2, "Holiday", "Gandhi Jayanthi"],
  [3, "No Instructional Day", ""],
  [4, "No Instructional Day", ""],
  [5, "Instructional Day", "Working Day"],
  [6, "Instructional Day", "Working Day"],
  [7, "Instructional Day", "Working Day"],
  [8, "Instructional Day", "Working Day"],
  [9, "Instructional Day", "Working Day"],
  [10, "Instructional Day", "Instructional Day Order - Friday Day Order"],
  [11, "No Instructional Day", ""],
  [12, "Instructional Day", "Working Day"],
  [13, "Instructional Day", "Working Day"],
  [14, "Instructional Day", "Working Day"],
  [15, "Instructional Day", "Working Day"],
  [16, "Instructional Day", "Working Day"],
  [17, "No Instructional Day", ""],
  [18, "No Instructional Day", ""],
  [19, "Holiday", "Ayutha Pooja"],
  [20, "Instructional Day", "Working Day"],
  [21, "Instructional Day", "Working Day"],
  [22, "Instructional Day", "Working Day"],
  [23, "Instructional Day", "Working Day / LID for LAB courses"],
  [24, "No Instructional Day", ""],
  [25, "No Instructional Day", ""],
  [26, "Instructional Day", "Working Day/ LAB FAT"],
  [27, "Instructional Day", "Working Day/ LAB FAT"],
  [28, "Instructional Day", "Working Day/ LAB FAT"],
  [29, "Instructional Day", "Working Day/ LAB FAT"],
  [30, "Instructional Day", "Working Day/ LAB FAT"],
  [31, "No Instructional Day", ""],
];

const calendar = [
  {
    month: "August 2026",
    year: 2026,
    days: AUGUST_2026.map(([date, text, category]) => ({
      date,
      events: [{ type: "Other", text, category }].filter((e) => e.text !== ""),
    })),
  },
];

const month = () => buildEnrichedCalendars({ calendars: calendar })[0];
const day = (d: number) => {
  const found = month().days.find((x) => x.date === d);
  if (!found) throw new Error(`no day ${d}`);
  return found;
};

describe("a real VTOP academic calendar", () => {
  it("covers every day of the month", () => {
    expect(month().days).toHaveLength(31);
  });

  it("puts the milestone from `category`, not from `text`", () => {
    // Day 23's `text` is "Instructional Day" and only its category mentions
    // the LID. Matching `text` alone is how this date disappeared.
    const labLid = day(23);
    const milestone = labLid.events.find((e) => e.kind === "milestone")!;
    expect(milestone.title).toBe("LID — Lab");
    expect(milestone.detail).toBe("Last instructional day for laboratory classes");
  });

  it("recognises a CAT written in the text", () => {
    expect(day(1).events.find((e) => e.kind === "milestone")?.title).toBe("CAT II");
  });

  it("names a holiday after the holiday, not after the type", () => {
    // Was: title "Holiday", subtitle "Gandhi Jayanthi".
    const janthi = day(2);
    expect(janthi.dayType).toBe("holiday");
    const holiday = janthi.events.find((e) => e.kind === "holiday")!;
    expect(holiday.title).toBe("Gandhi Jayanthi");
    expect(holiday.detail).toBeUndefined();
    expect(day(19).events.find((e) => e.kind === "holiday")!.title).toBe("Ayutha Pooja");
  });

  it("does not print a non-instructional day twice", () => {
    const quiet = day(3);
    expect(quiet.dayType).toBe("nonInstructional");
    const event = quiet.events[0];
    expect(event.title).not.toBe(event.detail);
    expect(event.title.toLowerCase()).toContain("no instructional");
  });

  it("does not print a plain instructional day twice", () => {
    // Was: title "Working day" and subtitle "Working day", on 14 of 31 days.
    const plain = day(5);
    const working = plain.events.find((e) => e.kind === "working")!;
    expect(working.title).toBe("Working day");
    expect(working.detail).toBeUndefined();
  });

  it("keeps the informative half of the category", () => {
    // "Working Day / LAB FAT" -> "LAB FAT". The tail is the part that means
    // something; taking the category wholesale threw it away.
    expect(day(26).events.find((e) => e.kind === "working")!.title).toBe("LAB FAT");
    // "Instructional Day Order - Friday Day Order" is informative too, and the
    // `-` there is part of the name rather than a separator.
    expect(day(10).events.find((e) => e.kind === "working")!.title).toBe("Friday Day Order");
  });

  it("has no day that prints the same string twice", () => {
    for (const d of month().days) {
      for (const e of d.events) {
        if (e.detail === undefined) continue;
        expect(
          e.detail.toLowerCase(),
          `day ${d.date} (${e.kind}) repeats its detail as a title`
        ).not.toBe(e.title.toLowerCase());
      }
    }
  });

  it("classifies every day of the month the way the calendar reads", () => {
    const byDate = new Map(month().days.map((d) => [d.date, d.dayType]));
    expect(byDate.get(1)).toBe("semiholiday"); // CAT II
    expect(byDate.get(2)).toBe("holiday");
    expect(byDate.get(3)).toBe("nonInstructional");
    expect(byDate.get(5)).toBe("instructional");
    expect(byDate.get(10)).toBe("instructional");
    expect(byDate.get(19)).toBe("holiday");
    expect(byDate.get(23)).toBe("instructional");
    expect(byDate.get(26)).toBe("instructional");
    expect(byDate.get(31)).toBe("nonInstructional");
  });

  it("has classes on an instructional day and on an LID", () => {
    expect(hasClasses(day(5))).toBe(true);
    expect(hasClasses(day(10))).toBe(true);
    // The last day of lab instruction is a day you attend.
    expect(hasClasses(day(23))).toBe(true);
    // So is a day inside the lab FAT run, which is still a teaching day.
    expect(hasClasses(day(26))).toBe(true);
  });

  it("has no classes on the CAT, a holiday, or a non-instructional day", () => {
    // A CAT is an exam whether or not a schedule row came through with it.
    expect(hasClasses(day(1))).toBe(false);
    expect(isExamDay(day(1))).toBe(true);
    expect(hasClasses(day(2))).toBe(false);
    expect(hasClasses(day(3))).toBe(false);
  });

  it("counts the month's days by kind", () => {
    // 20 teaching days, 1 CAT, 8 non-instructional, 2 holidays.
    expect(month().summary).toEqual({ total: 31, working: 20, holiday: 2, other: 9 });
  });
});
