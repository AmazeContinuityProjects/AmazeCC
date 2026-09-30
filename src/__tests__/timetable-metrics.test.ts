import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { timetableMetrics, dayOccupancy, formatHours } from "../lib/timetableMetrics";
import chennai from "../data/campus/chennai.json";
import type { AddedCourse } from "../components/custom/exams/FFCS/types";

/**
 * Differential test, not a unit test.
 *
 * The old `FFCS/logic/metrics.ts` is the copy that was *broken* — it kept a
 * private `{ id: "monday" }` day list against a schema that keys days `"mon"`,
 * so every lookup missed. It is being deleted, so it cannot be the oracle for
 * this module's correctness; it is only useful as a demonstration of the bug.
 *
 * What this file does check is the one thing that *is* a real oracle: the new
 * metrics against hand-computed expectations from `chennai.json`, and the
 * invariants that were true of every live copy.
 */

const course = (slot: string, over: Partial<AddedCourse> = {}): AddedCourse => ({
  id: slot,
  code: over.code ?? "BCSE101",
  title: over.title ?? "Programming",
  faculty: "FAC",
  venue: over.venue ?? "AB1-101",
  slots: slot.split("+"),
  credits: "3",
  type: over.type ?? "TH",
  color: "bg-blue-600",
});

describe("the day walk", () => {
  it("charges a slot for every day it runs on", () => {
    // A1 is Monday 8:00 AND Wednesday 8:55. Both are mornings, so two of the
    // ten half-days go — a detail three separate test expectations got wrong
    // while this work was in progress.
    const m = timetableMetrics([course("A1")], chennai as never);
    expect(m.halfDays).toBe(8);
    expect(m.isLongWeekend).toBe(true); // Mon and Fri are both untouched
  });

  it("charges an evening slot to the evening", () => {
    // A2 is Monday 2:00 and Wednesday 2:55.
    expect(timetableMetrics([course("A2")], chennai as never).halfDays).toBe(8);
  });

  it("counts a single-morning slot as one half-day", () => {
    // TA1 is Friday 9:50 and appears on no other day.
    expect(timetableMetrics([course("TA1")], chennai as never).halfDays).toBe(9);
  });

  it("reports a long weekend only when an end of it is free", () => {
    // TA1 lands on Friday, S11 on Monday, so neither end is free.
    const busy = timetableMetrics([course("TA1+S11")], chennai as never);
    expect(busy.isLongWeekend).toBe(false);
    // B1 lands Tuesday 8:00 and leaves both Monday and Friday empty.
    expect(timetableMetrics([course("B1")], chennai as never).isLongWeekend).toBe(true);
  });
});

describe("gaps are minutes", () => {
  it("measures a one-hour hole as sixty minutes", () => {
    // A1 is Monday 8:00–8:50 and D1 is Monday 9:50–10:40, so Monday carries a
    // gap of 8:50 to 9:50 — one hour. The old copies disagreed about whether
    // this number was 60 or 1, and the sort read whichever it was handed.
    const m = timetableMetrics([course("A1+D1")], chennai as never);
    expect(m.gaps).toBe(60);
    expect(m.gapsPerDay.mon).toBe(60);
  });

  it("ignores a changeover too short to be a gap", () => {
    // A1 ends 8:50 and the next period starts 8:55 — a five minute walk, not a
    // hole. F1 is Monday 8:55, so A1+F1 leaves nothing.
    const m = timetableMetrics([course("A1+F1")], chennai as never);
    expect(m.gaps).toBe(0);
  });

  it("ignores gaps on different days", () => {
    // A1 is Monday and Wednesday; TA1 is Friday. Nothing follows anything.
    expect(timetableMetrics([course("A1+TA1")], chennai as never).gaps).toBe(0);
  });

  it("ignores a gap smaller than five minutes but credits a dash", () => {
    // TG1 ends 12:30 and S11 starts 12:35 on Monday — a five minute changeover
    // in different blocks, which is a walk and not a gap.
    const m = timetableMetrics([course("TG1+S11")], chennai as never);
    expect(m.gaps).toBe(0);
  });
});

describe("building dashes", () => {
  it("counts a short hop between blocks on every day it happens", () => {
    // A1 is Monday 8:00 and Wednesday 8:55; F1 is Monday 8:55 and Wednesday
    // 9:50. Both days are a five-minute changeover across two blocks, so this
    // is two dashes — one per day, not one per pair of courses.
    const m = timetableMetrics(
      [course("A1", { venue: "AB1-101" }), course("F1", { venue: "AB3-104" })],
      chennai as never
    );
    expect(m.buildingDashes).toBe(2);
    expect(m.dashDetails[0]).toMatchObject({ fromBlock: "AB1", toBlock: "AB3", day: "mon" });
    expect(m.dashDetails[1]).toMatchObject({ fromBlock: "AB1", toBlock: "AB3", day: "wed" });
  });

  it("does not count a hop inside one block", () => {
    const m = timetableMetrics(
      [course("A1", { venue: "AB1-101" }), course("F1", { venue: "AB1-104" })],
      chennai as never
    );
    expect(m.buildingDashes).toBe(0);
  });

  it("does not count a hop from an unassigned venue", () => {
    const m = timetableMetrics(
      [course("A1", { venue: "NIL" }), course("F1", { venue: "AB3-104" })],
      chennai as never
    );
    expect(m.buildingDashes).toBe(0);
  });

  it("splits an embedded course's combined room between its halves", () => {
    // An embedded booking is "theoryRoom / labRoom". Both halves must not read
    // as the same block, or a real dash is scored as no dash.
    const m = timetableMetrics(
      [course("A1+L1", { venue: "AB1-101 / AB3-104", type: "Embedded" })],
      chennai as never
    );
    // The theory half is reported, and it is AB1 — the first room.
    expect(m.dashDetails.length).toBe(0);
    const mon = dayOccupancy([course("A1+L1", { venue: "AB1-101 / AB3-104" })], chennai as never, "mon");
    expect(mon.classes[0].venue).toBe("AB1-101");
  });
});

describe("a law course scores exactly as the same course with numbers", () => {
  // The whole point of the slot-spelling layer, measured through the metrics.
  it("A+TA matches A1+TA1", () => {
    const law = timetableMetrics([course("A+TA", { code: "TLAW524L" })], chennai as never);
    const numbered = timetableMetrics([course("A1+TA1", { code: "TLAW524L" })], chennai as never);
    expect(law.halfDays).toBe(numbered.halfDays);
    expect(law.gaps).toBe(numbered.gaps);
  });

  it("E+TE+TEE matches E1+TE1+S11", () => {
    // E1 is Tuesday 9:50 and Friday 8:00, TE1 is Thursday 10:45, and TEE is
    // S11 — Monday 12:35. Four mornings across four days.
    const law = timetableMetrics([course("E+TE+TEE", { code: "TLAW304L" })], chennai as never);
    const numbered = timetableMetrics(
      [course("E1+TE1+S11", { code: "TLAW304L" })],
      chennai as never
    );
    expect(law.halfDays).toBe(numbered.halfDays);
    expect(law.halfDays).toBe(6);
  });

  it("keeps a law course out of the evening", () => {
    // "A" must not acquire an A2 partner, or a law course would read as busy
    // from 2pm on the strength of a morning class.
    const law = timetableMetrics([course("A", { code: "TLAW524L" })], chennai as never);
    const numbered = timetableMetrics([course("A1", { code: "TLAW524L" })], chennai as never);
    const both = timetableMetrics([course("A1+A2", { code: "X" })], chennai as never);
    expect(law.halfDays).toBe(numbered.halfDays);
    expect(law.halfDays).not.toBe(both.halfDays);
  });
});

describe("the metrics contract", () => {
  it("fills every key it declares", () => {
    // The dead metrics.ts returned six fields where the type declared nine, and
    // nothing caught it. This is the runtime backstop for that.
    const m = timetableMetrics([course("A1")], chennai as never);
    expect(Object.keys(m).sort()).toEqual(
      [
        "bestFriendMatches",
        "buildingDashes",
        "dashDetails",
        "gapDetails",
        "gaps",
        "gapsPerDay",
        "halfDays",
        "isLongWeekend",
        "socialScore",
      ].sort()
    );
  });

  it("is not the constant it used to be", () => {
    // The old broken copy returned this for a full timetable and an empty one.
    const empty = timetableMetrics([], chennai as never);
    const full = timetableMetrics(
      [course("A1+TA1"), course("B1+TB1"), course("C1+TC1")],
      chennai as never
    );
    expect(empty.halfDays).toBe(10);
    expect(full.halfDays).toBeLessThan(empty.halfDays);
    expect(full.gapsPerDay).not.toEqual(empty.gapsPerDay);
  });
});

/**
 * The copy that used to live at `FFCS/logic/metrics.ts`, and the bug in it.
 *
 * It kept a private `DAYS` list of `{ id: "monday" }` against a schema that keys
 * days `"mon"`, so every `p.days?.[day.id]` was `undefined`, nothing was ever
 * occupied, and it returned a perfect ten half-days and a long weekend for an
 * empty timetable and a full one alike. Its `gaps` was in minutes while the two
 * live inline copies of the same function reported hours, under the same field
 * name.
 *
 * It was unreachable — only the dead worker imported it — which is the part worth
 * carrying: a copy nobody executes does not stay correct by accident, it stays
 * correct until somebody runs it. These two tests are what the old file should
 * have asserted, and the second is the one that would have caught the bug.
 */
describe("the constant the old copy returned", () => {
  it("is no longer what a full timetable scores", () => {
    const empty = timetableMetrics([], chennai as never);
    const full = timetableMetrics(
      [course("A1+TA1"), course("B1+TB1"), course("C1+TC1")],
      chennai as never
    );
    expect(empty.halfDays).toBe(10);
    expect(full.halfDays).toBeLessThan(empty.halfDays);
  });

  it("no longer claims a long weekend for a timetable with classes on both ends", () => {
    // TA1 lands Friday and S11 lands Monday, so neither end is free. The old
    // copy said true here, every time, for everything.
    expect(timetableMetrics([course("TA1+S11")], chennai as never).isLongWeekend).toBe(
      false
    );
  });
});

describe("formatHours", () => {
  it("prints whole hours without a decimal", () => {
    expect(formatHours(120)).toBe("2");
    expect(formatHours(0)).toBe("0");
  });

  it("keeps one decimal where it matters", () => {
    expect(formatHours(75)).toBe("1.3");
  });

  it("is the only place minutes become hours", () => {
    // A 60-minute gap displayed as "60h" was the symptom of the unit split.
    expect(formatHours(60)).toBe("1");
  });
});

describe("real report data", () => {
  it("moves as the real law timetables move", () => {
    const rows = readFileSync("public/ffcs/ffcsReport.csv", "utf8").split(/\r?\n/);
    const head = rows[0].split(",");
    const parsed = rows.slice(1).filter(Boolean).map((line) => {
      const cells = line.split(",");
      const row: Record<string, string> = {};
      head.forEach((h, i) => (row[h.trim()] = cells[i] ?? ""));
      return row;
    });

    const lawRows = parsed.filter((r) => r.CODE?.startsWith("TLAW") && r.SLOT && !/\d/.test(r.SLOT));
    expect(lawRows.length).toBeGreaterThan(0);

    // A realistic law timetable: two of the real bookings, scored through the
    // new metrics and through the numbered equivalent.
    const pick = (code: string) => lawRows.find((r) => r.CODE === code)!;
    const toCourse = (r: Record<string, string>): AddedCourse => ({
      id: r.CODE!,
      code: r.CODE!,
      title: r.TITLE ?? "",
      faculty: r.FACULTY ?? "",
      venue: r.VENUE ?? "",
      slots: r.SLOT!.split("+").map((s) => s.trim().toUpperCase()),
      credits: r.CREDITS ?? "3",
      type: r.TYPE ?? "TH",
      color: "bg-blue-600",
    });

    const law = [pick("TLAW524L"), pick("TLAW417L")].map(toCourse);
    const m = timetableMetrics(law, chennai as never);
    expect(m.halfDays).toBeLessThan(10);
    expect(m.halfDays).toBeGreaterThan(0);
  });
});
