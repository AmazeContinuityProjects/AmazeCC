import { describe, expect, it } from "vitest";
import { buildMilestoneDates } from "../lib/milestoneDates";

/**
 * Milestone lookup for the attendance predictor.
 *
 * The predictor used to read the calendar's `importantEvents` map three separate
 * ways. Two did a substring match on the display string, which meant `"cat i"`
 * also matched `"CAT II"` — so which exam a date belonged to depended on the
 * order the months happened to arrive in. The third exact-matched against
 * literals of mixed casing. All three now read by canonical key; these cases
 * pin the behaviour that fixes them.
 */

/** The day-type and milestone entries, in the shape `/api/calendar` sends. */
const month = (label: string, days: Array<{ date: number; events: Array<Record<string, string>> }>) => ({
  month: label,
  days: days.map((d) => ({ date: d.date, weekday: "", type: "Other", events: d.events })),
});

const ev = (text: string, category = "General") => ({ text, category, type: "Other" });

const REAL_2026 = {
  calendars: [
    month("AUGUST 2026", [
      { date: 8, events: [ev("CAT - I")] },
      { date: 14, events: [ev("CAT - I")] },
    ]),
    month("SEPTEMBER 2026", [{ date: 25, events: [ev("(CAT - II)", "CAT - II")] }]),
    month("OCTOBER 2026", [
      { date: 23, events: [ev("(Working Day / LID for LAB courses)", "Working Day / LID for LAB classes")] },
    ]),
    month("NOVEMBER 2026", [
      { date: 3, events: [ev("(Working Day/ LID for Theory Classes)", "Working Day/ LID for Theory Classes")] },
    ]),
  ],
};

describe("buildMilestoneDates", () => {
  it("resolves all four dates from the real payload", () => {
    const { impDates } = buildMilestoneDates(REAL_2026);
    expect(impDates.cat1Date).toEqual(new Date(2026, 7, 8));
    expect(impDates.cat2Date).toEqual(new Date(2026, 8, 25));
    expect(impDates.lidLabDate).toEqual(new Date(2026, 9, 23));
    expect(impDates.lidTheoryDate).toEqual(new Date(2026, 10, 3));
  });

  it("does not confuse CAT I with CAT II", () => {
    // The regression: matching "cat i" as a substring of "CAT II" meant the
    // answer depended on which month was scanned first.
    const { impDates } = buildMilestoneDates(REAL_2026);
    expect(impDates.cat1Date!.getDate()).toBe(8);
    expect(impDates.cat2Date!.getDate()).toBe(25);

    // And with the months reversed, the answer must not change.
    const reversed = { calendars: [...REAL_2026.calendars].reverse() };
    const back = buildMilestoneDates(reversed).impDates;
    expect(back.cat1Date).toEqual(impDates.cat1Date);
    expect(back.cat2Date).toEqual(impDates.cat2Date);
  });

  it("takes the first day of a multi-day CAT window", () => {
    const { impDates } = buildMilestoneDates(REAL_2026);
    expect(impDates.cat1Date!.getDate()).toBe(8); // not the 14th
  });

  it("does not depend on the display string's casing", () => {
    const shouted = {
      calendars: [
        month("OCTOBER 2026", [
          { date: 23, events: [ev("(Working Day / LID for LAB COURSES)", "Working Day / LID for LAB classes")] },
        ]),
        month("NOVEMBER 2026", [
          { date: 3, events: [ev("(Working Day/ LID for Theory Classes)", "Working Day/ LID for Theory Classes")] },
        ]),
      ],
    };
    const { impDates } = buildMilestoneDates(shouted);
    expect(impDates.lidLabDate).toEqual(new Date(2026, 9, 23));
    expect(impDates.lidTheoryDate).toEqual(new Date(2026, 10, 3));
  });

  it("finds a milestone that only appears in category", () => {
    const onlyCategory = {
      calendars: [
        month("OCTOBER 2026", [
          { date: 23, events: [ev("Instructional Day", "Working Day / LID for LAB classes")] },
        ]),
      ],
    };
    expect(buildMilestoneDates(onlyCategory).impDates.lidLabDate).toEqual(new Date(2026, 9, 23));
  });

  it("returns analysed results the predictor can read working days from", () => {
    const { results } = buildMilestoneDates(REAL_2026);
    expect(results.length).toBe(4);
    expect(results[0].year).toBe(2026);
    expect(Array.isArray(results[0].days)).toBe(true);
  });

  it("passes through the raw importantEvents map", () => {
    const { importantEvents } = buildMilestoneDates(REAL_2026);
    expect(importantEvents.has("cat i")).toBe(true);
    expect(importantEvents.get("cat i")!.event).toBe("CAT I");
  });

  it("is empty rather than throwing on nothing", () => {
    for (const input of [null, undefined, {}, { calendars: [] }, { calendars: null }]) {
      const { results, impDates, importantEvents } = buildMilestoneDates(input);
      expect(results).toEqual([]);
      expect(importantEvents.size).toBe(0);
      expect(impDates).toEqual({
        cat1Date: null,
        cat2Date: null,
        lidLabDate: null,
        lidTheoryDate: null,
      });
    }
  });

  it("gives nulls for a calendar with no milestones at all", () => {
    const plain = { calendars: [month("JULY 2026", [{ date: 6, events: [ev("Instructional Day")] }])] };
    expect(buildMilestoneDates(plain).impDates.cat1Date).toBeNull();
    // ...but still returns the results, so the day grid works.
    expect(buildMilestoneDates(plain).results.length).toBe(1);
  });

  it("hands back a fresh object, so a caller cannot poison the next caller", () => {
    const a = buildMilestoneDates(REAL_2026);
    a.impDates.cat1Date = null;
    const b = buildMilestoneDates(REAL_2026);
    expect(b.impDates.cat1Date).toEqual(new Date(2026, 7, 8));
  });
});