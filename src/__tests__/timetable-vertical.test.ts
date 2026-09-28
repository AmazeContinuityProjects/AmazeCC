import { describe, expect, it } from "vitest";
import type { AddedCourse, TimetablePeriod } from "@amazecontinuityprojects/amazeui";
import chennai from "../data/campus/chennai.json";
import {
  buildVerticalGrid,
  describeCell,
  weekDateForDayId,
  RUN_MERGE_GAP_MIN,
  type Cell,
} from "../components/custom/timetable/buildBands";
import { DAYS, slotMap, toMinutes } from "../lib/social/schedule";

/**
 * The vertical grid's projection is asserted rather than trusted, for the same
 * reason `social-grid.test.ts` asserts the 7x12 one: the bands are re-derived
 * from the campus schema at render time, so a schema edit could silently move
 * every cell and merge the wrong runs.
 *
 * Fixtures come from the real chennai schema, so the slot ids and the times
 * under test are the ones students actually have. Two things in particular are
 * pinned here:
 *
 *   - `L1`/`L2`/`L3` are 08:00-08:50, 08:50-09:40, 09:50-10:40 — a three-hour
 *     lab with a **ten** minute break in the middle, which is the whole reason
 *     `RUN_MERGE_GAP_MIN` is 10 and not the 5 used by `attendanceTimetable.ts`.
 *   - Monday band 0 holds theory `A1` and lab `L1` at the *same* 08:00-08:50, so
 *     it is the collision that lab precedence has to resolve.
 */

const THEORY = chennai.theory as TimetablePeriod[];
const LAB = chennai.lab as TimetablePeriod[];
const ALL_DAYS = DAYS.map((id) => ({ id: id.toLowerCase(), name: id }));

function course(partial: Partial<AddedCourse> & Pick<AddedCourse, "id" | "slots">): AddedCourse {
  return {
    code: partial.id.toUpperCase(),
    title: `Course ${partial.id}`,
    faculty: "Dr Someone",
    venue: "AB1-101",
    credits: "3",
    type: "",
    color: "bg-blue-600",
    ...partial,
  } as AddedCourse;
}

const gridFor = (courses: AddedCourse[], days = ALL_DAYS) =>
  buildVerticalGrid({ courses, theoryPeriods: THEORY, labPeriods: LAB, days });

/** Every rendered cell for a day, skipping the `null`s a `rowSpan` leaves. */
const rendered = (g: ReturnType<typeof gridFor>, dayId: string): Cell[] =>
  (g.cells[dayId] ?? []).filter((c): c is Cell => c !== null);

const cellAt = (g: ReturnType<typeof gridFor>, dayId: string, band: number): Cell | null =>
  g.cells[dayId]?.[band] ?? null;

describe("bands mirror the campus schema", () => {
  const g = gridFor([]);

  it("emits one band per theory period, in order", () => {
    expect(g.bands).toHaveLength(THEORY.length);
    expect(g.bands.map((b) => b.index)).toEqual(THEORY.map((_, i) => i));
  });

  it("flags the lunch spacer and labels it, rather than treating it as a class", () => {
    const lunch = g.bands.filter((b) => b.isLunch);
    expect(lunch).toHaveLength(1);
    expect(lunch[0].label).toBe("Lunch");
    // A lunch band occupies no cell position at all.
    expect(g.cells.mon[lunch[0].index]).toBeNull();
  });

  it("labels every class band with a real clock range", () => {
    for (const band of g.bands) {
      if (band.isLunch) continue;
      expect(band.hasTime).toBe(true);
      expect(band.label).toMatch(/^\d{1,2}:\d{2} (AM|PM) – \d{1,2}:\d{2} (AM|PM)$/);
      expect(band.endMin).toBeGreaterThan(band.startMin);
    }
  });

  it("keeps days in the order given, with an entry for every day", () => {
    expect(g.days.map((d) => d.id)).toEqual(ALL_DAYS.map((d) => d.id));
    for (const day of ALL_DAYS) expect(g.cells[day.id]).toHaveLength(g.bands.length);
  });
});

describe("runs: adjacent slots of one course become one tall cell", () => {
  it("merges a three-hour lab into a single cell spanning three bands", () => {
    const ela = course({ id: "ela", code: "BCSE101L", slots: ["L1", "L2", "L3"] });
    const g = gridFor([ela]);

    const cell = cellAt(g, "mon", 0);
    expect(cell).not.toBeNull();
    expect(cell!.kind).toBe("course");
    expect(cell!.course!.id).toBe("ela");
    expect(cell!.bandCount).toBe(3);
    expect(cell!.label).toBe("L1+L2+L3");
    expect(cell!.slots).toEqual(["L1", "L2", "L3"]);
    expect(cell!.half).toBe("lab");
  });

  it("leaves the merged cell's trailing bands unrendered so the rowSpan works", () => {
    const g = gridFor([course({ id: "ela", slots: ["L1", "L2", "L3"] })]);
    expect(cellAt(g, "mon", 1)).toBeNull();
    expect(cellAt(g, "mon", 2)).toBeNull();
    // Band 3 is the next, unrelated band and must still render.
    expect(cellAt(g, "mon", 3)).not.toBeNull();
  });

  it("merges the same course across every day where it holds three labs", () => {
    // Slot ids are day-scoped — `L1` is Monday's first lab, Tuesday's is `L7` —
    // so a course that reads `["L1","L2","L3"]` only has anything to merge on
    // Monday. Asserting otherwise would be asserting that a bare slot id is
    // unambiguous, which it is not.
    expect(LAB.map((p) => p.days?.mon).filter(Boolean).slice(0, 3)).toEqual(["L1", "L2", "L3"]);
    expect(LAB.map((p) => p.days?.tue).filter(Boolean).slice(0, 3)).toEqual(["L7", "L8", "L9"]);

    const mon = gridFor([course({ id: "ela", slots: ["L1", "L2", "L3"] })]);
    expect(cellAt(mon, "mon", 0)!.bandCount).toBe(3);

    const tue = gridFor([course({ id: "ela", slots: ["L7", "L8", "L9"] })]);
    expect(cellAt(tue, "tue", 0)!.bandCount).toBe(3);
    expect(cellAt(tue, "tue", 0)!.label).toBe("L7+L8+L9");

    // A course holding only Monday's ids has nothing to merge on Tuesday.
    const misplaced = gridFor([course({ id: "ela", slots: ["L1", "L2", "L3"] })]);
    expect(rendered(misplaced, "tue").every((c) => c.kind === "empty")).toBe(true);
  });

  it("does not merge two different courses in adjacent bands", () => {
    const a = course({ id: "eth", slots: ["A1"] });
    const b = course({ id: "sth", slots: ["F1"] });
    const g = gridFor([a, b]);

    expect(cellAt(g, "mon", 0)!.course!.id).toBe("eth");
    expect(cellAt(g, "mon", 0)!.bandCount).toBe(1);
    expect(cellAt(g, "mon", 1)!.course!.id).toBe("sth");
    expect(cellAt(g, "mon", 1)!.bandCount).toBe(1);
  });

  it("does not bridge a run across the lunch spacer", () => {
    // S11 is 12:35-13:25 (band 5) and A2 is 14:00-14:50 (band 7): 35 minutes
    // apart, with the lunch band between them. Three independent reasons not to
    // merge, and it must not.
    const g = gridFor([course({ id: "soft", slots: ["S11", "A2"] })]);
    expect(cellAt(g, "mon", 5)!.course!.id).toBe("soft");
    expect(cellAt(g, "mon", 5)!.bandCount).toBe(1);
    expect(cellAt(g, "mon", 7)!.course!.id).toBe("soft");
    expect(cellAt(g, "mon", 7)!.bandCount).toBe(1);
  });

  it("splits a run when the break exceeds the tolerance", () => {
    // Same course, two bands, 40 minutes apart. Above RUN_MERGE_GAP_MIN, so
    // two cells rather than one.
    const periods: TimetablePeriod[] = [
      { start: "8:00 AM", end: "8:50 AM", days: { mon: "A1" } },
      { start: "9:30 AM", end: "10:20 AM", days: { mon: "F1" } },
    ];
    const g = buildVerticalGrid({
      courses: [course({ id: "wide", slots: ["A1", "F1"] })],
      theoryPeriods: periods,
      labPeriods: [],
      days: [{ id: "mon", name: "MON" }],
    });

    const gap = 570 - 530;
    expect(gap).toBeGreaterThan(RUN_MERGE_GAP_MIN);
    expect(cellAt(g, "mon", 0)!.bandCount).toBe(1);
    expect(cellAt(g, "mon", 1)!.bandCount).toBe(1);
  });

  it("never merges a free band, however long the stretch", () => {
    const g = gridFor([]);
    for (const dayId of ["mon", "fri"]) {
      for (const cell of rendered(g, dayId)) {
        expect(cell.kind).toBe("empty");
        expect(cell.bandCount).toBe(1);
        expect(cell.course).toBeNull();
      }
    }
  });
});

describe("lab precedence", () => {
  it("gives a Monday 08:00 collision to the lab", () => {
    // A1 and L1 both run 08:00-08:50 on Monday. The horizontal grid stacks them
    // in one cell; the vertical grid shows one cell, and the lab wins. The two
    // halves spell the time differently ("8:00 AM" vs "08:00 AM"), which is
    // exactly why the collision is resolved on minutes and never on strings.
    expect(THEORY[0].days!.mon).toBe("A1");
    expect(LAB[0].days!.mon).toBe("L1");
    expect(toMinutes(THEORY[0].start!)).toBe(toMinutes(LAB[0].start!));

    const g = gridFor([
      course({ id: "eth", code: "BCSE101", slots: ["A1"] }),
      course({ id: "ela", code: "BCSE101L", slots: ["L1"] }),
    ]);

    const cell = cellAt(g, "mon", 0)!;
    expect(cell.half).toBe("lab");
    expect(cell.course!.id).toBe("ela");
    expect(cell.label).toBe("L1");
  });

  it("reports the displaced theory run instead of dropping it", () => {
    const g = gridFor([
      course({ id: "eth", slots: ["A1"] }),
      course({ id: "ela", slots: ["L1"] }),
    ]);

    const cell = cellAt(g, "mon", 0)!;
    expect(cell.shadowed).toHaveLength(1);
    expect(cell.shadowed[0].course.id).toBe("eth");
    expect(cell.shadowed[0].label).toBe("A1");
  });

  it("folds a shadowed run in even when the winning run starts earlier and is longer", () => {
    // The lab spans bands 0-2; the theory run also spans 0-2. Bands 1 and 2 are
    // covered by the rowSpan and render nothing, so the theory has to reach the
    // sheet through the band-0 cell's own span.
    const g = gridFor([
      course({ id: "eth", slots: ["A1", "F1", "D1"] }),
      course({ id: "ela", slots: ["L1", "L2", "L3"] }),
    ]);

    const cell = cellAt(g, "mon", 0)!;
    expect(cell.bandCount).toBe(3);
    expect(cell.course!.id).toBe("ela");
    expect(cell.shadowed.map((s) => s.course.id)).toEqual(["eth"]);
  });

  it("does not shadow a theory run that stands clear of the lab", () => {
    const g = gridFor([
      course({ id: "ela", slots: ["L1"] }),
      course({ id: "eth2", slots: ["A2"] }),
    ]);
    expect(cellAt(g, "mon", 7)!.course!.id).toBe("eth2");
    expect(cellAt(g, "mon", 7)!.shadowed).toHaveLength(0);
  });
});

describe("nothing is dropped or double-counted", () => {
  const courses = [
    course({ id: "ela", code: "BCSE101L", slots: ["L1", "L2", "L3"] }),
    course({ id: "eth", code: "BCSE101", slots: ["A1", "F1", "D1"] }),
    course({ id: "sst", code: "BCSE105", slots: ["L31", "L32"] }),
  ];
  const g = gridFor(courses);

  it("renders every non-lunch band exactly once, per day", () => {
    const classBands = g.bands.filter((b) => !b.isLunch).length;
    for (const dayId of ALL_DAYS.map((d) => d.id)) {
      const cells = rendered(g, dayId);
      const covered = cells.reduce((n, c) => n + c.bandCount, 0);
      // Every non-lunch band is covered by exactly one cell's span...
      expect(`${dayId}:${covered}`).toBe(`${dayId}:${classBands}`);
      // ...and no band is claimed twice.
      const starts = cells.map((c) => c.bandIndex).sort((a, b) => a - b);
      expect(new Set(starts).size).toBe(starts.length);
    }
  });

  it("surfaces every slot of every course, on the cell or in its shadow list", () => {
    for (const dayId of ["mon", "tue", "wed", "thu", "fri"]) {
      // Scoped to the slots that are *valid on this day*: a bare slot id is not
      // a schedule entry, and `L1` means nothing on a Tuesday.
      const valid = new Set(Object.keys(slotMap[dayId.toUpperCase()]));
      const seen: string[] = [];
      for (const cell of rendered(g, dayId)) {
        seen.push(...cell.slots);
        for (const s of cell.shadowed) seen.push(...s.slots);
      }

      for (const c of courses) {
        for (const slot of c.slots.filter((s) => valid.has(s))) {
          const hits = seen.filter((s) => s === slot).length;
          if (hits !== 1) {
            throw new Error(`${slot} appears ${hits} times on ${dayId}`);
          }
        }
      }
    }
  });

  it("never claims a slot the schema does not have", () => {
    const known = new Set(ALL_DAYS.flatMap((d) => Object.keys(slotMap[d.id.toUpperCase()])));
    for (const dayId of ALL_DAYS.map((d) => d.id)) {
      for (const cell of rendered(g, dayId)) {
        for (const slot of cell.slots) {
          expect(`${dayId}:${known.has(slot)}`).toBe(`${dayId}:true`);
        }
      }
    }
  });
});

describe("blocked and gap states", () => {
  it("hatches a band when any of its slots is ruled out", () => {
    const blocked = new Set(["A1"]);
    const g = buildVerticalGrid({
      courses: [course({ id: "eth", slots: ["A1"] })],
      theoryPeriods: THEORY,
      labPeriods: LAB,
      days: [{ id: "mon", name: "MON" }],
      blockedSlots: blocked,
    });
    const cell = cellAt(g, "mon", 0)!;
    expect(cell.kind).toBe("blocked");
    expect(cell.blocked).toBe(true);
    // The course is still known, so the sheet can name it.
    expect(cell.course!.id).toBe("eth");
  });

  it("hatches a merged run only when every one of its slots is ruled out", () => {
    // A run is a display merge of one course's slots, so a partially blocked
    // course is still a real class and must not read as unavailable.
    const partial = buildVerticalGrid({
      courses: [course({ id: "ela", slots: ["L1", "L2", "L3"] })],
      theoryPeriods: THEORY,
      labPeriods: LAB,
      days: [{ id: "mon", name: "MON" }],
      blockedSlots: new Set(["L1"]),
    });
    const partialCell = cellAt(partial, "mon", 0)!;
    expect(partialCell.blocked).toBe(false);
    expect(partialCell.partiallyBlocked).toBe(true);
    expect(partialCell.kind).toBe("course");

    const all = buildVerticalGrid({
      courses: [course({ id: "ela", slots: ["L1", "L2", "L3"] })],
      theoryPeriods: THEORY,
      labPeriods: LAB,
      days: [{ id: "mon", name: "MON" }],
      blockedSlots: new Set(["L1", "L2", "L3"]),
    });
    expect(cellAt(all, "mon", 0)!.blocked).toBe(true);
  });

  it("marks a free band that falls inside a selected gap", () => {
    const g = buildVerticalGrid({
      courses: [],
      theoryPeriods: THEORY,
      labPeriods: LAB,
      days: [{ id: "mon", name: "MON" }],
      selectedGapDetails: [{ day: "mon", startMin: 840, endMin: 890, durationMins: 50 }],
    });
    // A2 is 14:00-14:50 = 840-890 on band 7.
    expect(cellAt(g, "mon", 7)!.kind).toBe("gap");
    expect(cellAt(g, "mon", 7)!.inGap).toBe(true);
    // And a band outside the window is untouched.
    expect(cellAt(g, "mon", 0)!.kind).toBe("empty");
  });

  it("labels a free band with both of its slot ids", () => {
    const g = gridFor([]);
    // Monday band 0 has A1 (theory) and L1 (lab), both free.
    expect(cellAt(g, "mon", 0)!.label).toBe("L1 / A1");
  });
});

describe("short labels for the compact density", () => {
  it("keeps the gutter's meridiem off the short form but on the long one", () => {
    const g = gridFor([]);
    const band = g.bands[0];
    expect(band.label).toBe("8:00 AM – 8:50 AM");
    expect(band.startLabel).toBe("8:00 AM");
    expect(band.endLabel).toBe("8:50 AM");
    expect(band.shortLabel).toBe("8:00");
  });

  it("drops the meridiem for a PM start too", () => {
    const g = gridFor([]);
    // Band 7 is A2, 14:00-14:50.
    const band = g.bands.find((b) => b.startLabel === "2:00 PM")!;
    expect(band.shortLabel).toBe("2:00");
  });

  it("leaves the lunch band's labels blank", () => {
    const lunch = gridFor([]).bands.find((b) => b.isLunch)!;
    expect(lunch.label).toBe("Lunch");
    expect(lunch.startLabel).toBe("");
    expect(lunch.endLabel).toBe("");
    expect(lunch.shortLabel).toBe("—");
  });

  it("counts a merged run rather than trying to fit every slot id", () => {
    const g = gridFor([course({ id: "ela", slots: ["L1", "L2", "L3"] })]);
    const cell = cellAt(g, "mon", 0)!;
    // "L1+L2+L3" has to break mid-token in a 36px column; this does not.
    expect(cell.label).toBe("L1+L2+L3");
    expect(cell.shortLabel).toBe("L1 +2");
  });

  it("leaves a single-slot cell's short label identical to its long one", () => {
    const g = gridFor([course({ id: "eth", slots: ["A1"] })]);
    const cell = cellAt(g, "mon", 0)!;
    expect(cell.shortLabel).toBe(cell.label);
  });

  it("still hands the full slot list to the free cell's short label", () => {
    // A free band has two slots and no course, so the compact density renders
    // no text at all — the projection must not silently pick one of them.
    const g = gridFor([]);
    const cell = cellAt(g, "mon", 0)!;
    expect(cell.shortLabel).toBe("L1 / A1");
    expect(cell.course).toBeNull();
  });
});

describe("weekDateForDayId", () => {
  // 28 Sep 2026 is a Monday, so the week runs Mon 28th to Sun 4 Oct.
  const monday = new Date(2026, 8, 28);

  it("resolves each day id to its date in the containing week", () => {
    expect(weekDateForDayId("mon", monday)!.getDate()).toBe(28);
    expect(weekDateForDayId("wed", monday)!.getDate()).toBe(30);
    expect(weekDateForDayId("fri", monday)!.getDate()).toBe(2);
  });

  it("rolls into the next month for Sunday", () => {
    const sunday = weekDateForDayId("sun", monday)!;
    expect(sunday.getMonth()).toBe(9);
    expect(sunday.getDate()).toBe(4);
  });

  it("walks backwards from a mid-week day", () => {
    const thursday = new Date(2026, 8, 24);
    expect(weekDateForDayId("mon", thursday)!.getDate()).toBe(21);
    expect(weekDateForDayId("thu", thursday)!.getDate()).toBe(24);
  });

  it("returns null for an id outside the week", () => {
    expect(weekDateForDayId("", monday)).toBeNull();
    expect(weekDateForDayId("funday", monday)).toBeNull();
  });
});

describe("describeCell", () => {
  it("names the course, and says so when the slot is blocked or free", () => {
    const g = buildVerticalGrid({
      courses: [course({ id: "eth", code: "BCSE101", slots: ["A1"] })],
      theoryPeriods: THEORY,
      labPeriods: LAB,
      days: [{ id: "mon", name: "MON" }],
      blockedSlots: new Set(["A1"]),
    });
    const text = describeCell(cellAt(g, "mon", 0)!, "MON");
    expect(text).toContain("MON");
    expect(text).toContain("A1");
    expect(text).toContain("BCSE101");
    expect(text).toContain("blocked");
  });
});
