import { describe, expect, it } from "vitest";
import {
  SELECTED_RING,
  TODAY_INK,
  TODAY_RING,
  WEEK_STRIP_TINT,
  weekStripExamNote,
  weekStripFlavour,
  weekStripTitle,
  type WeekStripDay,
} from "../lib/weekStrip";

/**
 * The week strip's day-type encoding.
 *
 * The strip stopped printing what kind of day it is and started colouring it,
 * which moves the definition of "exam day" out of a ternary chain in a JSX
 * attribute and into a table — and a table is only an improvement if the
 * precedence is pinned. So these are the load-bearing assertions:
 *
 *  - the four kinds stay mutually exclusive and totally ordered, so no day can
 *    quietly grow a second fill;
 *  - the colour an exam and a holiday get is *not* the obvious one. Red is
 *    reserved for a lost teaching day across the app, and this test is what
 *    stops someone "fixing" amber back to red;
 *  - the words the fill replaced survive in the title, count included, because
 *    a tint you can only read on a 40px circle is not an accessible encoding.
 */

function day(over: Partial<WeekStripDay> = {}): WeekStripDay {
  return {
    dayCode: "TUE",
    dayNumber: 29,
    fullDate: new Date(2026, 8, 29),
    isToday: false,
    hasExam: false,
    holidayInfo: null,
    detectedDayOrder: null,
    ...over,
  };
}

describe("weekStripFlavour", () => {
  it("reads a plain teaching day as teaching", () => {
    expect(weekStripFlavour(day())).toBe("teaching");
  });

  it("reads an exam day as exam, holiday as holiday, a reorder as reordered", () => {
    expect(weekStripFlavour(day({ hasExam: true }))).toBe("exam");
    expect(weekStripFlavour(day({ holidayInfo: "Pongal holiday" }))).toBe("holiday");
    expect(weekStripFlavour(day({ detectedDayOrder: "MON" }))).toBe("reordered");
  });

  it("lets an exam outrank a holiday on the same day", () => {
    // The exam is the thing you have to act on. `today` land on a holiday is
    // rare and the sub-header still names the holiday, but two tints cannot be
    // drawn on one 40px circle and the exam is the one worth amber.
    expect(weekStripFlavour(day({ hasExam: true, holidayInfo: "Holiday" }))).toBe("exam");
  });

  it("lets a holiday outrank a reorder", () => {
    expect(weekStripFlavour(day({ holidayInfo: "Vacation", detectedDayOrder: "FRI" }))).toBe(
      "holiday"
    );
  });
});

describe("WEEK_STRIP_TINT", () => {
  it("covers every flavour, so a lookup can never return undefined", () => {
    expect(Object.keys(WEEK_STRIP_TINT).sort()).toEqual([
      "exam",
      "holiday",
      "reordered",
      "teaching",
    ]);
  });

  it("paints an exam amber and a holiday red", () => {
    // Not a typo. Red means "you lost a teaching day" everywhere else in the
    // app (`MonthGrid`'s holiday tint, the attendance shortfalls), and an exam
    // day is a normal working day that happens to be graded.
    expect(WEEK_STRIP_TINT.exam.fill).toContain("amber");
    expect(WEEK_STRIP_TINT.holiday.fill).toContain("red");
    expect(WEEK_STRIP_TINT.exam.fill).not.toContain("red");
    expect(WEEK_STRIP_TINT.holiday.fill).not.toContain("amber");
  });

  it("gives each kind its own fill, ink and edge", () => {
    const tints = Object.values(WEEK_STRIP_TINT);
    for (const key of ["fill", "ink", "edge"] as const) {
      expect(new Set(tints.map((t) => t[key])).size).toBe(tints.length);
    }
  });

  it("leaves a teaching day without a hue, so it can be looked straight past", () => {
    // The circles have no plate behind them any more, so a teaching day cannot
    // be "no background" — it has to be a visible white disc. What it must not
    // have is a colour, or every ordinary week fills the strip with hue and the
    // three days that matter stop standing out.
    const teaching = WEEK_STRIP_TINT.teaching;
    expect(teaching.fill).toContain("bg-white");
    expect(teaching.ink).not.toMatch(/amber|red|indigo|emerald|sky/);
    expect(teaching.edge).not.toMatch(/amber|red|indigo|emerald|sky/);
  });

  it("tints each edge to match its fill, so a circle reads as one object", () => {
    expect(WEEK_STRIP_TINT.exam.edge).toContain("amber");
    expect(WEEK_STRIP_TINT.holiday.edge).toContain("red");
    expect(WEEK_STRIP_TINT.reordered.edge).toContain("indigo");
  });
});

describe("weekStripTitle", () => {
  it("names the day and its kind", () => {
    expect(weekStripTitle(day({ hasExam: true }))).toBe("Tue 29 Sept · Exam day");
    expect(weekStripTitle(day({ holidayInfo: "Pongal" }))).toBe("Tue 29 Sept · Academic holiday");
  });

  it("keeps the session count that used to live in the pill", () => {
    expect(weekStripTitle(day(), 4)).toBe("Tue 29 Sept · 4 sessions");
    expect(weekStripTitle(day(), 1)).toBe("Tue 29 Sept · 1 session");
    expect(weekStripTitle(day(), 0)).toBe("Tue 29 Sept · No classes");
  });

  it("names which day the timetable was reordered onto", () => {
    expect(weekStripTitle(day({ detectedDayOrder: "FRI" }))).toBe(
      "Tue 29 Sept · Reordered timetable (FRI)"
    );
  });
});

describe("weekStripExamNote", () => {
  it("stays quiet on a day with no exam, and pluralises correctly", () => {
    expect(weekStripExamNote(0)).toBe("");
    expect(weekStripExamNote(1)).toBe(", 1 exam");
    expect(weekStripExamNote(3)).toBe(", 3 exams");
  });
});

describe("state rings", () => {
  it("marks selection deeper than today so one circle can be both", () => {
    // Land on the page and today is selected *and* today. If both used the
    // same ring there would be no way to see which half of "selected" is
    // showing, so selection is two rings and an extra ring's worth of weight.
    expect(SELECTED_RING).toContain("ring-2");
    expect(TODAY_RING).toContain("ring-1");
    expect(SELECTED_RING).toContain("indigo");
    expect(TODAY_RING).toContain("emerald");
  });

  it("gives today emerald ink, matching its ring", () => {
    expect(TODAY_INK).toContain("emerald");
  });
});
