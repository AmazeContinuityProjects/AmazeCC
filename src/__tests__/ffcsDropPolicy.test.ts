import { describe, expect, it } from "vitest";
import {
  DEFAULT_MAX_DROPS,
  droppableTail,
  isRetryableFailure,
  nextDrop,
} from "../components/custom/exams/FFCS/logic/dropPolicy";

/**
 * The "All Subjects Mode: OFF" ladder, pinned.
 *
 * These are the promises the retry loop makes to a student: the tail of their
 * own course order goes first, targeted courses never go at all, and a crash
 * is never mistaken for "nothing matched".
 */

const policy = (over: Partial<Parameters<typeof droppableTail>[0]> = {}) => ({
  courseOrder: ["MAT2005", "PHY1020", "CSE2001", "ENG1010"],
  ...over,
});

describe("droppableTail", () => {
  it("returns the course order reversed — lowest priority first", () => {
    expect(droppableTail(policy())).toEqual(["ENG1010", "CSE2001", "PHY1020", "MAT2005"]);
  });

  it("never offers a protected (targeted) course, whatever its position", () => {
    const tail = droppableTail(policy({ protectedCodes: ["ENG1010", "PHY1020"] }));
    expect(tail).toEqual(["CSE2001", "MAT2005"]);
    expect(tail).not.toContain("ENG1010");
    expect(tail).not.toContain("PHY1020");
  });

  it("dedupes repeated codes", () => {
    expect(droppableTail(policy({ courseOrder: ["A", "B", "A"] }))).toEqual(["B", "A"]);
  });
});

describe("isRetryableFailure", () => {
  it("retries the empty-outcome codes", () => {
    expect(isRetryableFailure({ kind: "error", code: "no_conflict_free" })).toBe(true);
    expect(isRetryableFailure({ kind: "error", code: "no_valid_slots" })).toBe(true);
    expect(isRetryableFailure({ kind: "error", code: "below_min_half_days" })).toBe(true);
  });

  it("never retries a solver crash or an empty selection", () => {
    expect(isRetryableFailure({ kind: "error", code: "error" })).toBe(false);
    expect(isRetryableFailure({ kind: "error", code: "no_courses_selected" })).toBe(false);
  });

  it("never retries success or a cancel — a cancel is an answer", () => {
    expect(isRetryableFailure({ kind: "ok" })).toBe(false);
    expect(isRetryableFailure({ kind: "cancelled" })).toBe(false);
    expect(isRetryableFailure(null)).toBe(false);
  });
});

describe("nextDrop", () => {
  it("drops the tail cumulatively: one, then two, then three", () => {
    const tail = droppableTail(policy());
    const dropped: string[] = [];
    // Three ladder steps, mirroring the hook: each failure appends the next.
    for (let attempt = 0; attempt < DEFAULT_MAX_DROPS; attempt++) {
      const next = nextDrop(tail, dropped, { kind: "error", code: "no_conflict_free" });
      if (next) dropped.push(next);
    }
    expect(dropped).toEqual(["ENG1010", "CSE2001", "PHY1020"]);
  });

  it("jumps the queue for a course the solver named as having no valid slots", () => {
    const tail = droppableTail(policy());
    const next = nextDrop(tail, [], { kind: "error", code: "no_valid_slots", subjectCode: "CSE2001" });
    expect(next).toBe("CSE2001");
  });

  it("ignores a named course that was already dropped or is protected", () => {
    const tail = droppableTail(policy({ protectedCodes: ["PHY1020"] }));
    // PHY1020 is protected: naming it must not smuggle it into the ladder.
    expect(nextDrop(tail, [], { kind: "error", code: "no_valid_slots", subjectCode: "PHY1020" })).toBe("ENG1010");
    expect(nextDrop(tail, ["ENG1010"], { kind: "error", code: "no_valid_slots", subjectCode: "ENG1010" })).toBe(
      "CSE2001",
    );
  });

  it("returns null once everything droppable is dropped", () => {
    const tail = droppableTail(policy({ courseOrder: ["A", "B"] }));
    expect(nextDrop(tail, ["B", "A"])).toBeNull();
    expect(nextDrop([], [])).toBeNull();
  });
});
