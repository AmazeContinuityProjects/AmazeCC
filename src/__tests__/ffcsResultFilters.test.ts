import { describe, expect, it } from "vitest";
import {
  applyResultFilters,
  buildingOf,
  DEFAULT_RESULT_FILTERS,
  filtersActive,
  isSameBuildingPlan,
  planBuildings,
  planHasFaculty,
  slotSignature,
  theorySessionOf,
  uniqueSlotLayouts,
} from "../lib/ffcsResultFilters";
import type { TimetableState } from "../components/custom/exams/FFCS/types";
import chennai from "../data/campus/chennai.json";

/**
 * Result-view filters, pinned to the semantics their source was unit-tested
 * against (`codechefvit/ffcs` → `tests/building-filter.test.cjs`) plus the
 * two honesties this port adds: a roomless plan is never "same building",
 * and a lab-only plan is never "evening".
 */

const plan = (
  courses: { code: string; slots: string[]; venue?: string; faculty?: string }[],
  id = "p1",
): TimetableState =>
  ({
    id,
    name: id,
    courses: courses.map((c, i) => ({
      id: `${id}-${i}`,
      code: c.code,
      title: c.code,
      slots: c.slots,
      faculty: c.faculty ?? "FACULTY",
      venue: c.venue ?? "AB1-101",
      credits: "3",
      type: "TH",
      color: "#fff",
    })),
  }) as TimetableState;

describe("buildingOf", () => {
  it("reads the letters before the first digit, uppercased", () => {
    expect(buildingOf("AB3-509")).toBe("AB");
    expect(buildingOf("PRP230")).toBe("PRP");
    expect(buildingOf("mab301")).toBe("MAB");
  });

  it("is null for roomless and digit-led venues — unknown, not shared", () => {
    expect(buildingOf("NIL")).toBeNull();
    expect(buildingOf("")).toBeNull();
    expect(buildingOf(undefined)).toBeNull();
    expect(buildingOf("101")).toBeNull();
  });
});

describe("isSameBuildingPlan", () => {
  it("is true when every roomed course is in one building", () => {
    const p = plan([
      { code: "A", slots: ["A1"], venue: "AB1-101" },
      { code: "B", slots: ["C1"], venue: "AB3-509" },
    ]);
    expect(isSameBuildingPlan(p)).toBe(true);
    expect(planBuildings(p)).toEqual(["AB"]);
  });

  it("is false across buildings", () => {
    const p = plan([
      { code: "A", slots: ["A1"], venue: "AB1-101" },
      { code: "B", slots: ["C1"], venue: "PRP230" },
    ]);
    expect(isSameBuildingPlan(p)).toBe(false);
  });

  it("is false when the plan has no venues at all — unknowable, not shared", () => {
    const p = plan([{ code: "A", slots: ["A1"], venue: "NIL" }]);
    expect(isSameBuildingPlan(p)).toBe(false);
    expect(planBuildings(p)).toEqual([]);
  });
});

describe("theorySessionOf", () => {
  it("classifies an all-morning plan (A1 ends before lunch)", () => {
    expect(theorySessionOf(plan([{ code: "A", slots: ["A1"] }]), chennai as never)).toBe("morning");
  });

  it("classifies an all-evening plan", () => {
    expect(theorySessionOf(plan([{ code: "A", slots: ["A2"] }]), chennai as never)).toBe("evening");
  });

  it("classifies a straddling plan as mixed", () => {
    const p = plan([
      { code: "A", slots: ["A1"] },
      { code: "B", slots: ["A2"] },
    ]);
    expect(theorySessionOf(p, chennai as never)).toBe("mixed");
  });

  it("ignores labs: a lab-only week is neither session", () => {
    // L31+L32 is an afternoon lab under the lab numbering — counting it
    // would tag a fully-morning-theory week as "evening".
    expect(
      theorySessionOf(
        plan([
          { code: "A", slots: ["A1"], venue: "AB1" },
          { code: "L", slots: ["L31+L32"], venue: "AB1" },
        ]),
        chennai as never,
      ),
    ).toBe("morning");
    expect(theorySessionOf(plan([{ code: "L", slots: ["L31+L32"] }]), chennai as never)).toBe("mixed");
  });
});

describe("planHasFaculty", () => {
  const p = plan([
    { code: "CSE1001", slots: ["A1"], faculty: "SATHISH KUMAR P" },
    { code: "MAT2005", slots: ["C1"], faculty: "PARTHIBAN V" },
  ]);

  it("matches faculty and code, case-insensitively", () => {
    expect(planHasFaculty(p, "sathish")).toBe(true);
    expect(planHasFaculty(p, "MAT2")).toBe(true);
  });

  it("is true for an empty query — empty means off", () => {
    expect(planHasFaculty(p, "   ")).toBe(true);
  });

  it("is false when nothing matches", () => {
    expect(planHasFaculty(p, "NOBODY")).toBe(false);
  });
});

describe("slotSignature and uniqueSlotLayouts", () => {
  it("collapses options differing only in faculty", () => {
    const a = plan([{ code: "X", slots: ["A1+TA1"], faculty: "F1" }], "a");
    const b = plan([{ code: "X", slots: ["TA1+A1"], faculty: "F2" }], "b");
    // Same signature (order-insensitive, compound slots split) → one survivor.
    expect(slotSignature(a)).toBe(slotSignature(b));
    expect(uniqueSlotLayouts([a, b]).map((p) => p.id)).toEqual(["a"]);
  });

  it("keeps genuinely different layouts apart, first-seen", () => {
    const a = plan([{ code: "X", slots: ["A1"] }], "a");
    const b = plan([{ code: "X", slots: ["C1"] }], "b");
    const c = plan([{ code: "X", slots: ["A1"] }], "c");
    expect(uniqueSlotLayouts([a, b, c]).map((p) => p.id)).toEqual(["a", "b"]);
  });
});

describe("applyResultFilters", () => {
  const schema = chennai as never;
  const morning = plan([{ code: "A", slots: ["A1"], venue: "AB1-101", faculty: "ALPHA" }], "morning");
  const evening = plan([{ code: "B", slots: ["A2"], venue: "PRP230", faculty: "BETA" }], "evening");

  it("returns everything with the default filters", () => {
    expect(applyResultFilters([morning, evening], DEFAULT_RESULT_FILTERS, schema)).toHaveLength(2);
    expect(filtersActive(DEFAULT_RESULT_FILTERS)).toBe(false);
  });

  it("cuts by session", () => {
    const out = applyResultFilters([morning, evening], { ...DEFAULT_RESULT_FILTERS, session: "morning" }, schema);
    expect(out.map((p) => p.id)).toEqual(["morning"]);
  });

  it("cuts by building and by faculty together", () => {
    const out = applyResultFilters(
      [morning, evening],
      { ...DEFAULT_RESULT_FILTERS, sameBuilding: true, facultyQuery: "alpha" },
      schema,
    );
    expect(out.map((p) => p.id)).toEqual(["morning"]);
    expect(filtersActive({ ...DEFAULT_RESULT_FILTERS, sameBuilding: true })).toBe(true);
  });

  it("groups by slot layout last, after the other cuts", () => {
    const twin = plan([{ code: "A", slots: ["A1"], venue: "AB1-102", faculty: "GAMMA" }], "twin");
    // Without grouping: 2 morning plans. With grouping: the twins share a
    // layout, so only the first-seen survives — and the evening plan was
    // already gone before grouping ran.
    const out = applyResultFilters(
      [morning, twin, evening],
      { ...DEFAULT_RESULT_FILTERS, session: "morning", groupBySlot: true },
      schema,
    );
    expect(out.map((p) => p.id)).toEqual(["morning"]);
  });
});
