import { describe, expect, it } from "vitest";
import {
  IMPORTANT_EVENTS,
  analyzeCalendar,
  isHolidayEvent,
  isInstructionalEvent,
  isNonInstructionalEvent,
  matchImportantEvent,
  normalize,
} from "../lib/analyzeCalendar";

/**
 * The calendar vocabulary itself.
 *
 * These are the rules every other calendar surface inherits — the grid, the day
 * sheet and the per-course predictors all classify through this module. The
 * three regressions below are not hypothetical: each of them shipped, and each
 * one made a real thing invisible rather than merely ugly.
 */

describe("normalize", () => {
  it("collapses the whitespace that punctuation leaves behind", () => {
    // The bug: "CAT - I" became "cat   i", which no single-spaced keyword
    // could match, so CAT I and CAT II were never detected anywhere.
    expect(normalize("CAT - I")).toBe("cat i");
    expect(normalize("CAT   II")).toBe("cat ii");
    expect(normalize("No  Instructional  Day")).toBe("no instructional day");
    expect(normalize("LID FOR THEORY CLASSES")).toBe("lid for theory classes");
  });

  it("is empty for empty input", () => {
    expect(normalize("")).toBe("");
    expect(normalize(undefined)).toBe("");
  });
});

describe("matchImportantEvent", () => {
  it("matches the written form of every milestone", () => {
    expect(matchImportantEvent({ text: "CAT - I" })?.key).toBe("cat i");
    expect(matchImportantEvent({ text: "CAT-II" })?.key).toBe("cat ii");
    expect(matchImportantEvent({ text: "LID FOR THEORY CLASSES" })?.key).toBe("lid for theory classes");
    expect(matchImportantEvent({ text: "LID FOR LABORATORY CLASSES" })?.key).toBe(
      "lid for laboratory classes"
    );
    expect(matchImportantEvent({ text: "LID for lab" })?.key).toBe("lid for laboratory classes");
    expect(matchImportantEvent({ text: "Mid Term Test" })?.key).toBe("mid term test");
  });

  it("prefers the longest match, so CAT II is not filed as CAT I", () => {
    // "cat i" is a substring of "cat ii". A first-match scan returned CAT I for
    // every CAT II, which handed the predictor the wrong date.
    expect(matchImportantEvent({ text: "CAT II" })?.key).toBe("cat ii");
    expect(matchImportantEvent({ text: "CAT - II" })?.display).toBe("CAT II");
  });

  it("prefers the full laboratory name over its alias", () => {
    expect(matchImportantEvent({ text: "LID FOR LABORATORY CLASSES" })?.key).toBe(
      "lid for laboratory classes"
    );
  });

  it("has a readable short name and a blurb for every entry", () => {
    for (const entry of IMPORTANT_EVENTS) {
      expect(entry.short.length).toBeGreaterThan(0);
      expect(entry.blurb.length).toBeGreaterThan(0);
    }
  });

  it("keeps `display` in the exact form the predictor pages match on", () => {
    // `CourseDetailSubpage` and `Dashboard` look these up by exact lowercase
    // string, so reworded here and they silently return null.
    const displays = IMPORTANT_EVENTS.map((e) => e.display);
    expect(displays).toEqual([
      "CAT I",
      "CAT II",
      "LID FOR LABORATORY CLASSES",
      "LID FOR THEORY CLASSES",
      "MID TERM TEST",
    ]);
  });

  it("returns null for an ordinary entry", () => {
    expect(matchImportantEvent({ text: "Vibrance 2026" })).toBe(null);
    expect(matchImportantEvent({ text: "" })).toBe(null);
    expect(matchImportantEvent(undefined)).toBe(null);
  });
});

describe("day-type classifiers", () => {
  it("separates a holiday from a non-instructional day", () => {
    // Both used to be holidays, which is how a working day at an open college
    // came back as a day off.
    const holiday = { type: "Other", text: "Pongal", category: "Festival" };
    const quiet = { type: "Other", text: "Non Instructional Day", category: "Working day" };

    expect(isHolidayEvent(holiday)).toBe(true);
    expect(isNonInstructionalEvent(holiday)).toBe(false);

    expect(isHolidayEvent(quiet)).toBe(false);
    expect(isNonInstructionalEvent(quiet)).toBe(true);
  });

  it("does not call a non-instructional day instructional", () => {
    // Its category is "Working day", which the instructional test also matches.
    // Whichever runs first wins, so the order is load-bearing.
    const quiet = { type: "Other", text: "Non Instructional Day", category: "Working day" };
    expect(isInstructionalEvent(quiet)).toBe(false);
  });

  it("still recognises a real instructional day", () => {
    expect(
      isInstructionalEvent({ type: "Instructional Day", text: "Instructional Day", category: "Working day" })
    ).toBe(true);
    // Category alone is enough when the type is not the marker.
    expect(isInstructionalEvent({ type: "Other", text: "Classes as usual", category: "Working day" })).toBe(
      true
    );
  });

  it("does not call a holiday instructional", () => {
    expect(isInstructionalEvent({ type: "Holiday", text: "Christmas", category: "Festival" })).toBe(false);
  });
});

describe("analyzeCalendar milestones", () => {
  const calendar = (days: { date: number; events: any[] }[]) => ({
    month: "August 2026",
    year: 2026,
    days,
  });

  it("indexes each milestone under its own key", () => {
    const { importantEvents } = analyzeCalendar(
      calendar([
        { date: 1, events: [{ type: "Other", text: "CAT - I", category: "Working day" }] },
        { date: 2, events: [{ type: "Other", text: "CAT - II", category: "Working day" }] },
      ])
    );

    // The regression: CAT II matched the CAT I key first, so both days were
    // written to "cat i" and only one survived.
    expect(importantEvents.get("cat i")?.date).toBe(1);
    expect(importantEvents.get("cat ii")?.date).toBe(2);
  });

  it("builds a real date for a milestone", () => {
    const { importantEvents } = analyzeCalendar(
      calendar([
        { date: 10, events: [{ type: "Other", text: "LID FOR THEORY CLASSES", category: "Working day" }] },
      ])
    );
    const lid = importantEvents.get("lid for theory classes");
    expect(lid?.event).toBe("LID FOR THEORY CLASSES");
    expect(lid?.date).toBe(10);
    expect(lid?.formattedDate.getMonth()).toBe(7);
    expect(lid?.formattedDate.getDate()).toBe(10);
  });

  it("keeps the first occurrence when a milestone is listed twice", () => {
    const { importantEvents } = analyzeCalendar(
      calendar([
        { date: 10, events: [{ type: "Other", text: "LID FOR THEORY CLASSES" }] },
        { date: 11, events: [{ type: "Other", text: "LID FOR THEORY CLASSES" }] },
      ])
    );
    expect(importantEvents.get("lid for theory classes")?.date).toBe(10);
  });
});
