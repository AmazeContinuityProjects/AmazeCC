import { describe, expect, it } from "vitest";
import { toSolverCourses, type SolverCourse } from "@/lib/ffcsGenerate";
import { applyResultFilters, DEFAULT_RESULT_FILTERS } from "@/lib/ffcsResultFilters";
import type { ParsedCourse, TimetableState } from "@/lib/ffcsTypes";
import chennai from "../data/campus/chennai.json";

/**
 * The worker payload is a compact, frozen snapshot of only the fields the
 * solver reads. These tests pin that contract: a field added to the solve path
 * must be added to the serializer too, and bookkeeping fields must stay off
 * the wire.
 */

const fullRow = (): ParsedCourse => ({
  CODE: "BCSE101",
  TITLE: "Problem Solving",
  TYPE: "ETH",
  CREDITS: "4",
  ROOM: "AB3-201",
  SLOT: "A1+TA1+L31",
  FACULTY: "Dr Someone",
  BATCH: "B1",
  CLASS_ID: "1234",
  ERP_ID: "ERP-1",
  ORIGINAL_CODE: "BCSE101L",
  LINK_ID: "link-1",
  CLASS_IDS: ["1234", "5678"],
  EMPLOYEE_SCHOOL: "SCOPE",
});

/** Every field the solve path reads from a report row. */
const SOLVER_FIELDS: readonly (keyof SolverCourse)[] = [
  "CODE",
  "TITLE",
  "TYPE",
  "CREDITS",
  "ROOM",
  "SLOT",
  "FACULTY",
  "BATCH",
  "CLASS_ID",
  "ERP_ID",
];

/** Fields that are real on `ParsedCourse` but never read by the solver. */
const NON_SOLVER_FIELDS = ["ORIGINAL_CODE", "LINK_ID", "CLASS_IDS", "EMPLOYEE_SCHOOL"] as const;

describe("toSolverCourses", () => {
  it("has field parity with the solve path's inputs", () => {
    const row = fullRow();
    const snapshot = toSolverCourses([row])[0];

    for (const field of SOLVER_FIELDS) {
      expect(snapshot[field]).toEqual(row[field]);
    }
    expect(Object.keys(snapshot).sort()).toEqual([...SOLVER_FIELDS].sort());
  });

  it("leaves bookkeeping fields off the wire", () => {
    const snapshot = toSolverCourses([fullRow()])[0] as Record<string, unknown>;
    for (const field of NON_SOLVER_FIELDS) {
      expect(field in snapshot).toBe(false);
    }
  });

  it("omits absent optional fields and produces a frozen snapshot", () => {
    const minimal: ParsedCourse = {
      CODE: "BCSE101",
      TITLE: "Problem Solving",
      TYPE: "TH",
      CREDITS: "4",
      ROOM: "AB3-201",
      SLOT: "A1",
      FACULTY: "Dr Someone",
    };
    const rows = toSolverCourses([minimal]);
    expect(Object.keys(rows[0]).sort()).toEqual(["CODE", "TITLE", "TYPE", "CREDITS", "ROOM", "SLOT", "FACULTY"].sort());
    expect(Object.isFrozen(rows)).toBe(true);
    expect(Object.isFrozen(rows[0])).toBe(true);
  });
});

describe("incremental applyResultFilters", () => {
  const plan = (id: string, slots: string[]): TimetableState =>
    ({
      id,
      name: id,
      courses: [
        {
          id: `${id}-0`,
          code: id,
          title: id,
          slots,
          faculty: "ALPHA",
          venue: "AB1-101",
          credits: "3",
          type: "TH",
          color: "#fff",
        },
      ],
    }) as TimetableState;

  it("matches a full recompute when a streamed batch is appended", () => {
    const schema = chennai as never;
    const a = plan("a", ["A1"]);
    const b = plan("b", ["A2"]);
    const c = plan("c", ["A1"]);
    const filters = { ...DEFAULT_RESULT_FILTERS, facultyQuery: "alpha" };

    // Force a full pass, then simulate two streamed appends with the same
    // filters, then force a fresh full pass to compare the answer.
    applyResultFilters([a], filters, schema);
    const streamed = applyResultFilters([a, b], filters, schema);
    const extended = applyResultFilters([a, b, c], filters, schema);

    // A non-extension array forces a fresh full pass with the same filters.
    const fresh = applyResultFilters([c, b, a], filters, schema);
    expect(streamed.map((p) => p.id)).toEqual(["a", "b"]);
    expect(extended.map((p) => p.id)).toEqual(["a", "b", "c"]);
    expect([...fresh.map((p) => p.id)].sort()).toEqual(["a", "b", "c"]);
  });
});
