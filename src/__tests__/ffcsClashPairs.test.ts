import { describe, expect, it } from "vitest";
import { courseClashPairs, courseClashPairCount, formatPeriodRange } from "../lib/ffcsClashPairs";
import { periodsForSlot, type CampusSchema } from "../lib/slots";
import type { AddedCourse } from "../components/custom/exams/FFCS/types";
import chennai from "../data/campus/chennai.json";

/**
 * The clash half of the detailed PDF report, pinned against the real Chennai
 * schema — same fixture policy as `ffcs-generate.test.ts`: every slot id below
 * was checked against `src/data/campus/chennai.json`, never assumed.
 *
 * The geometry the tests lean on:
 *
 * - `A1` is Monday 08:00-08:50 and Wednesday 08:55-09:45.
 * - `C1` is Wednesday 08:00-08:50 and Friday 08:55-09:45 — the same clock
 *   times as A1, never the same day, so the classic A1-vs-C1 pair does *not*
 *   clash and a test that assumes otherwise would be wrong.
 * - `L1` is Monday 08:00-08:50 (overlaps A1 on Monday), `L2` is Monday
 *   08:50-09:40 (does not — back-to-back is not overlap), and `L14` is
 *   Wednesday 08:50-09:40 (overlaps A1's Wednesday 08:55 start).
 */

const schema = chennai as unknown as CampusSchema;

let sequence = 0;
const course = (over: Partial<AddedCourse> & Pick<AddedCourse, "code" | "slots">): AddedCourse => ({
  id: over.id ?? `course-${++sequence}`,
  code: over.code,
  title: over.title ?? `${over.code} Course`,
  slots: over.slots,
  faculty: over.faculty ?? "Dr Someone",
  venue: over.venue ?? "AB1-101",
  credits: over.credits ?? "3",
  type: over.type ?? "TH",
  color: over.color ?? "bg-blue-600",
});

describe("courseClashPairs", () => {
  it("reports an overlapping pair in both directions, with the day and window", () => {
    const a = course({ code: "BCSE101", slots: ["A1"] });
    const b = course({ code: "BCSE102", slots: ["L1"] });

    const pairs = courseClashPairs([a, b], schema);

    expect(pairs.get(a.id)).toEqual([
      { code: "BCSE102", title: "BCSE102 Course", day: "Mon", timeRange: "08:00-08:50" },
    ]);
    expect(pairs.get(b.id)).toEqual([
      { code: "BCSE101", title: "BCSE101 Course", day: "Mon", timeRange: "08:00-08:50" },
    ]);
  });

  it("finds nothing between A1 and C1 — same clock times, never the same day", () => {
    const a = course({ code: "BCSE101", slots: ["A1"] });
    const c = course({ code: "BCSE103", slots: ["C1"] });

    const pairs = courseClashPairs([a, c], schema);

    expect(pairs.size).toBe(0);
    expect(courseClashPairCount([a, c], schema)).toBe(0);
  });

  it("never reports the theory and lab halves of one code against each other", () => {
    // L1 really does sit on top of A1 on Monday — the rows only escape the
    // clash report because they share a code, i.e. are one logical course.
    const theory = course({ code: "BCSE201", slots: ["A1"] });
    const lab = course({ code: "BCSE201", slots: ["L1"], type: "LO" });

    const pairs = courseClashPairs([theory, lab], schema);

    expect(pairs.size).toBe(0);
    expect(courseClashPairCount([theory, lab], schema)).toBe(0);
  });

  it("survives NIL, empty and unknown slots without crashing or counting them", () => {
    const nil = course({ code: "GENED01", slots: ["NIL"] });
    const empty = course({ code: "GENED02", slots: [] });
    const unknown = course({ code: "GENED03", slots: ["ZZ99"] });
    const real = course({ code: "BCSE101", slots: ["A1"] });

    const pairs = courseClashPairs([nil, empty, unknown, real], schema);

    expect(pairs.size).toBe(0);
    // The placeholder rows also do not mask a real clash elsewhere in the plan.
    const l1 = course({ code: "BCSE102", slots: ["L1"] });
    const mixed = courseClashPairs([nil, empty, unknown, real, l1], schema);
    expect(mixed.get(real.id)).toHaveLength(1);
    expect(mixed.get(l1.id)).toHaveLength(1);
  });

  it("collects every overlapping window across a course's slots, first-seen order", () => {
    const a = course({ code: "BCSE101", slots: ["A1"] });
    // L1 clashes Monday, L14 clashes Wednesday; L2 is back-to-back on Monday
    // and must not appear.
    const b = course({ code: "BCSE102", slots: ["L2", "L1", "L14"], type: "LO" });

    const pairs = courseClashPairs([a, b], schema);

    expect(pairs.get(a.id)).toEqual([
      { code: "BCSE102", title: "BCSE102 Course", day: "Mon", timeRange: "08:00-08:50" },
      { code: "BCSE102", title: "BCSE102 Course", day: "Wed", timeRange: "08:55-09:40" },
    ]);
    expect(pairs.get(b.id)).toEqual([
      { code: "BCSE101", title: "BCSE101 Course", day: "Mon", timeRange: "08:00-08:50" },
      { code: "BCSE101", title: "BCSE101 Course", day: "Wed", timeRange: "08:55-09:40" },
    ]);
  });

  it("reports two same-code offerings clashing with a third course once, keyed by code", () => {
    const offeringA = course({ code: "BCSE301", slots: ["A1"] });
    const offeringB = course({ code: "BCSE301", slots: ["A1"] });
    const victim = course({ code: "BCSE302", slots: ["L1"] });

    const pairs = courseClashPairs([offeringA, offeringB, victim], schema);

    // Each offering row learns about the victim on its own id…
    expect(pairs.get(offeringA.id)).toHaveLength(1);
    expect(pairs.get(offeringB.id)).toHaveLength(1);
    // …but the victim sees one clash with BCSE301, not one per offering.
    expect(pairs.get(victim.id)).toEqual([
      { code: "BCSE301", title: "BCSE301 Course", day: "Mon", timeRange: "08:00-08:50" },
    ]);
    expect(courseClashPairCount([offeringA, offeringB, victim], schema)).toBe(1);
  });

  it("is stable and dedupes repeated identical windows", () => {
    const a = course({ code: "BCSE101", slots: ["A1", "A1"] });
    const b = course({ code: "BCSE102", slots: ["L1", "L1"] });

    const first = courseClashPairs([a, b], schema);
    const second = courseClashPairs([a, b], schema);

    expect(first.get(a.id)).toHaveLength(1);
    expect(second.get(a.id)).toEqual(first.get(a.id));
  });

  it("counts clashing pairs, not overlap windows", () => {
    const a = course({ code: "BCSE101", slots: ["A1", "A2"] });
    const b = course({ code: "BCSE102", slots: ["L1", "L14"] });
    const c = course({ code: "BCSE103", slots: ["L31"] });

    // (a,b) clashes on two windows, (a,c) on one Monday-evening window,
    // (b,c) never — three windows, two pairs.
    expect(courseClashPairCount([a, b, c], schema)).toBe(2);
    expect(courseClashPairCount([], schema)).toBe(0);
    expect(courseClashPairs([], schema).size).toBe(0);
  });

  it("defaults to the app's pinned campus schema", () => {
    const a = course({ code: "BCSE101", slots: ["A1"] });
    const b = course({ code: "BCSE102", slots: ["L1"] });

    expect(courseClashPairs([a, b]).size).toBe(2);
  });
});

describe("formatPeriodRange", () => {
  it("prints a schema period as 'Mon 08:00-08:50'", () => {
    const [period] = periodsForSlot(schema, "A1");
    expect(formatPeriodRange(period)).toBe("Mon 08:00-08:50");
  });

  it("prints an afternoon period in 24-hour form", () => {
    // A2 is Monday 2:00 PM in the schema.
    const [period] = periodsForSlot(schema, "A2");
    expect(formatPeriodRange(period)).toBe("Mon 14:00-14:50");
  });
});
