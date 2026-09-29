import { describe, expect, it } from "vitest";
import { calculateTimetableMetrics } from "../components/custom/exams/FFCS/logic/metrics";
import { getFreeHalfDaysList } from "../components/custom/exams/FFCS/logic/socialScoring";
import { expandSlotSpellings } from "../lib/slots";
import chennai from "../data/campus/chennai.json";
import type { AddedCourse } from "../components/custom/exams/FFCS/types";

const course = (slot: string): AddedCourse => ({
  id: "c1",
  code: "BCSE101",
  title: "Programming",
  faculty: "FAC",
  venue: "AB1-101",
  slots: slot.split("+"),
  credits: "3",
  type: "TH",
  color: "bg-blue-600",
});

/** Half-days (mornings and evenings, Mon–Fri) not occupied by these courses. */
const halfDays = (slot: string) =>
  calculateTimetableMetrics([course(slot)], chennai as never).halfDays;

/**
 * The generator's own scoring, as the web worker runs it.
 *
 * These are here because this function used to be completely inert: it kept a
 * private `DAYS` list of `{ id: "monday" }` while the schema keys its days
 * `"mon"`, so `p.days?.[day.id]` was always `undefined`, no period was ever
 * occupied, and every timetable scored the same perfect 10 half-days with no
 * gaps and no building dashes — whether it held three courses or none at all.
 * The worker then filtered on `metrics.halfDays >= generatorMinHalfDays` and
 * sorted by it, so the filter never rejected anything and the sort did nothing.
 *
 * ## Reading the numbers
 *
 * A slot id names one period on one day, and some ids recur across days: `A1`
 * is Monday 8:00 *and* Wednesday 8:55, so it costs two half-days, not one.
 * Everything below is written out from `chennai.json` rather than guessed, and
 * the "one slot, one morning" cases use ids that genuinely run on a single day
 * — `TA1` is Friday 9:50, and `S11`/`TEE` is Monday 12:35.
 */
describe("calculateTimetableMetrics", () => {
  it("is not a constant any more", () => {
    const empty = calculateTimetableMetrics([], chennai as never);
    expect(empty.halfDays).toBe(10);
    // TA1 (Friday 9:50) and S11 (Monday 12:35) are each one morning.
    expect(halfDays("TA1")).toBe(9);
  });

  it("charges a slot for every day it runs on", () => {
    // A1 is Monday 8:00 and Wednesday 8:55, so two mornings go.
    expect(halfDays("A1")).toBe(8);
  });

  it("charges an evening slot to the evening", () => {
    // A2 is Monday 2:00 and Wednesday 2:55 — the mirror of A1, and the reason
    // a law slot must not acquire an A2 partner.
    expect(halfDays("A2")).toBe(8);
  });

  it("finds the gap a class leaves behind", () => {
    // A1 is Monday 8:00–8:50 and D1 is Monday 9:50–10:40: an hour of nothing.
    // The old code never saw a single class, so gapDetails was always empty.
    const m = calculateTimetableMetrics([course("A1+D1")], chennai as never);
    expect(m.gapDetails.length).toBeGreaterThan(0);
    expect(m.gaps).toBe(60);
  });

  it("no longer calls every timetable a long weekend", () => {
    // TA1 puts a class on Friday and S11 one on Monday, so neither end of the
    // weekend is free.
    const m = calculateTimetableMetrics([course("TA1+S11")], chennai as never);
    expect(m.longWeekend).toBe(false);
  });

  it("scores a law course exactly as it scores the same course with a number", () => {
    // A law student books "A+TA" where everyone else books "A1+TA1". Same two
    // periods, so the same score — which it was not before: the law spelling
    // matched nothing and read as ten free half-days.
    expect(halfDays("A+TA")).toBe(halfDays("A1+TA1"));
  });

  it("keeps a law course out of the evening", () => {
    // "A" costs exactly what "A1" costs, and nothing more. If the alias leaked
    // onto A2 — Monday 2:00 and Wednesday 2:55 — the count would drop to 6.
    expect(halfDays("A")).toBe(halfDays("A1"));
    expect(halfDays("A")).not.toBe(halfDays("A1+A2"));
  });

  it("scores a law course that ends on TEE or TFF", () => {
    // E+TE+TEE is E1 (Tuesday 9:50 and Friday 8:00), TE1 (Thursday 10:45) and
    // S11 (Monday 12:35) — four mornings, and four of the ten gone. The S11
    // third of it is what the schema could not answer before S11 and S15 were
    // linked to TEE and TFF; without that link the answer was 10.
    expect(halfDays("E+TE+TEE")).toBe(6);
    // F+TF+TFF is F1 (Monday 8:55), TF1 and S15 (both Friday morning) — three
    // distinct mornings, Friday's two periods sharing one.
    expect(halfDays("F+TF+TFF")).toBe(7);
  });
});

describe("getFreeHalfDaysList", () => {
  it("counts a law slot as occupied, in the morning only", () => {
    const free = getFreeHalfDaysList(new Set(["TEE"]), chennai);
    // TEE is S11, Monday 12:35 — so Monday's morning is gone and nothing else.
    expect(free).not.toContain("mon_morning");
    expect(free).toContain("mon_evening");
    expect(free).toHaveLength(9);
  });

  it("agrees with the numbered spelling", () => {
    expect(getFreeHalfDaysList(new Set(["TEE"]), chennai)).toEqual(
      getFreeHalfDaysList(new Set(["S11"]), chennai)
    );
    expect(getFreeHalfDaysList(new Set(["A"]), chennai)).toEqual(
      getFreeHalfDaysList(new Set(["A1"]), chennai)
    );
  });

  it("agrees whichever way the caller's set was built", () => {
    expect(getFreeHalfDaysList(expandSlotSpellings(["TEE"]), chennai)).toEqual(
      getFreeHalfDaysList(new Set(["TEE"]), chennai)
    );
  });
});
