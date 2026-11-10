import { beforeEach, describe, expect, it } from "vitest";
import {
  applyTaskCleanup,
  archiveSemester,
  courseCodesFrom,
  currentTermOf,
  dismiss,
  isDismissed,
  newerSemester,
  planTaskCleanup,
} from "../lib/semesterRollover";
import type { Task } from "../types/tasks";

const KNOWN = ["CH20252605", "CH20252607", "CH20262701", "CH20262705"];

describe("which semester to move to", () => {
  it("targets the app's current term (second to last), not the upcoming one", () => {
    expect(currentTermOf(KNOWN)).toBe("CH20262701");
    expect(newerSemester("CH20252605", KNOWN)).toBe("CH20262701");
    expect(newerSemester("CH20252607", KNOWN)).toBe("CH20262701");
  });

  it("does nothing when already on or past the current term", () => {
    expect(newerSemester("CH20262701", KNOWN)).toBeNull();
    expect(newerSemester("CH20262705", KNOWN)).toBeNull();
  });

  it("does nothing without a known baseline", () => {
    expect(newerSemester("", KNOWN)).toBeNull();
    expect(newerSemester("CH19990101", KNOWN)).toBeNull();
    expect(newerSemester("CH20252605", [])).toBeNull();
  });
});

describe("dismissal", () => {
  beforeEach(() => localStorage.clear());
  it("is remembered per target semester", () => {
    dismiss("CH20262701");
    expect(isDismissed("CH20262701")).toBe(true);
    expect(isDismissed("CH20262705")).toBe(false);
  });
});

describe("archiveSemester", () => {
  beforeEach(() => localStorage.clear());

  it("copies attendance and marks into the frozen keys", () => {
    localStorage.setItem("attendance", JSON.stringify({ attendance: [{ courseCode: "BCSE101E" }] }));
    localStorage.setItem("marks", JSON.stringify({ courses: [{ courseCode: "BCSE101E" }] }));
    expect(archiveSemester("CH20252607")).toEqual({ attendance: true, marks: true });
    expect(localStorage.getItem("frozen_att_CH20252607")).toContain("BCSE101E");
    expect(localStorage.getItem("frozen_marks_CH20252607")).toContain("BCSE101E");
  });

  it("never overwrites an existing snapshot or saves empty data", () => {
    localStorage.setItem("frozen_att_CH20252607", "KEEP");
    localStorage.setItem("attendance", JSON.stringify({ attendance: [{ courseCode: "X" }] }));
    localStorage.setItem("marks", JSON.stringify({ courses: [] }));
    expect(archiveSemester("CH20252607")).toEqual({ attendance: false, marks: false });
    expect(localStorage.getItem("frozen_att_CH20252607")).toBe("KEEP");
    expect(localStorage.getItem("frozen_marks_CH20252607")).toBeNull();
  });
});

describe("task cleanup", () => {
  const t = (id: string, status: Task["status"], courseCode: string) => ({ id, status, courseCode }) as Task;
  const tasks = [
    t("1", "done", "BCSE101E"),
    t("2", "pending", "BCSE101E"),
    t("3", "pending", "BMAT201L"),
    t("4", "done", ""),
  ];
  const old = courseCodesFrom({ attendance: [{ courseCode: "BCSE101E" }] });

  it("finds finished tasks and open tasks for last term's courses", () => {
    const plan = planTaskCleanup(tasks, old);
    expect(plan.done.map((x) => x.id)).toEqual(["1", "4"]);
    expect(plan.oldCourse.map((x) => x.id)).toEqual(["2"]);
  });

  it("removes only what was chosen", () => {
    const plan = planTaskCleanup(tasks, old);
    expect(applyTaskCleanup(tasks, plan, { removeDone: true, removeOldCourse: false }).map((x) => x.id)).toEqual([
      "2",
      "3",
    ]);
    expect(applyTaskCleanup(tasks, plan, { removeDone: true, removeOldCourse: true }).map((x) => x.id)).toEqual(["3"]);
    expect(applyTaskCleanup(tasks, plan, { removeDone: false, removeOldCourse: false })).toHaveLength(4);
  });
});
