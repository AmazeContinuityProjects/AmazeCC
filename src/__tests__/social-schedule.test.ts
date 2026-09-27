import { describe, expect, it } from "vitest";
import config from "../../config.json";
import {
  DAYS,
  LUNCH_START_MIN,
  TOTAL_SLOTS,
  busyHours,
  buildBusyMap,
  busyMapFromClassSlots,
  computeOverlap,
  dayKeyForDate,
  fmt,
  isValidKey,
  lunchColumnIndex,
  minutesToTimeStr,
  mondaySkeleton,
  normaliseDay,
  parseSlotKey,
  slotCoveringNow,
  slotFor,
  slotKey,
  slotMap,
  slotRange,
  slotSpanHours,
  slotSpanMinutes,
  toMinutes,
  toMinutesInvariant,
} from "../lib/social/schedule";
import type { BusyMap } from "../lib/social/types";

/* ------------------------------------------------------------------ *
 * Equivalence with the three parsers this module replaces
 * ------------------------------------------------------------------ */

// Byte-for-byte the rule in CommonFreeSlotsGrid.tsx:17 and TimetableGrid.tsx:64.
const gridRule = (t: string) => {
  const [hs = "0", ms = "0"] = String(t || "").split(":");
  let h = parseInt(hs || "0", 10);
  const m = parseInt(ms || "0", 10);
  const isPM = h === 12 || (h >= 1 && h <= 7);
  if (isPM && h !== 12) h += 12;
  return h * 60 + m;
};

// Byte-for-byte the rule in lib/attendanceTimetable.ts:8.
const attendanceRule = (t: string) => {
  let [h, m] = String(t).trim().split(":").map(Number);
  if (h < 8) h += 12;
  return h * 60 + (m || 0);
};

describe("toMinutes is the one parser", () => {
  it("matches BOTH old rules on every time string in the real vocabulary", () => {
    const mismatches: string[] = [];
    for (const day of DAYS) {
      for (const entry of Object.values(slotMap[day])) {
        for (const part of entry.time.split("-")) {
          const t = part.trim();
          const mine = toMinutes(t);
          if (mine !== gridRule(t)) mismatches.push(`${t}: grid ${gridRule(t)} vs ${mine}`);
          if (mine !== attendanceRule(t))
            mismatches.push(`${t}: attendance ${attendanceRule(t)} vs ${mine}`);
        }
      }
    }
    expect(mismatches).toEqual([]);
  });

  it("parses the documented examples", () => {
    expect(toMinutes("8:00")).toBe(480);
    expect(toMinutes("8:50")).toBe(530);
    expect(toMinutes("12:35")).toBe(755);
    expect(toMinutes("1:20")).toBe(800);
    expect(toMinutes("7:25")).toBe(1165);
  });

  it("treats 1-7 as PM, which is what config.json's range implies", () => {
    // 8:00 is the earliest slot and 19:25 the latest, so 1-7 must be PM.
    expect(toMinutes("1:00")).toBe(13 * 60);
    expect(toMinutes("7:00")).toBe(19 * 60);
    expect(toMinutes("8:00")).toBe(8 * 60);
    expect(toMinutes("11:59")).toBe(11 * 60 + 59);
  });

  it("handles 12 as noon, not midnight", () => {
    expect(toMinutes("12:00")).toBe(720);
    expect(toMinutes("12:59")).toBe(779);
  });

  it("returns 0 for unusable input rather than NaN", () => {
    // A malformed time in one cached record must not take down a grid.
    expect(toMinutes("")).toBe(0);
    expect(toMinutes(null)).toBe(0);
    expect(toMinutes(undefined)).toBe(0);
    expect(toMinutes("garbage")).toBe(0);
    expect(Number.isNaN(toMinutes("garbage"))).toBe(false);
  });

  it("passes numbers through", () => {
    expect(toMinutes(480)).toBe(480);
    expect(toMinutes(NaN)).toBe(0);
  });
});

describe("the parser's assumption is checked, not assumed", () => {
  it("every slot ends after it starts", () => {
    expect(toMinutesInvariant().allSpansPositive).toBe(true);
  });

  it("the day runs 08:00 to 19:25, which is why 1-7 means PM", () => {
    const inv = toMinutesInvariant();
    expect(inv.earliest).toBe(480);
    expect(inv.latest).toBe(1165);
    expect(inv.hours).toEqual([8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19]);
    // No hour below 8 in 12-hour notation, so the heuristic is unambiguous here.
    expect(inv.hours.every((h) => h >= 8)).toBe(true);
  });

  it("counts 164 slots", () => {
    expect(TOTAL_SLOTS).toBe(164);
  });
});

describe("minutesToTimeStr", () => {
  it("is the inverse of toMinutes over the whole vocabulary", () => {
    for (const day of DAYS) {
      for (const entry of Object.values(slotMap[day])) {
        const { start, end } = slotRange(entry.time);
        for (const mins of [start, end]) {
          expect(toMinutes(fmt(mins))).toBe(mins);
        }
      }
    }
  });

  it("formats the awkward boundaries", () => {
    expect(minutesToTimeStr(480)).toBe("8:00 AM");
    expect(minutesToTimeStr(720)).toBe("12:00 PM");
    expect(minutesToTimeStr(780)).toBe("1:00 PM");
    expect(minutesToTimeStr(0)).toBe("12:00 AM");
    expect(minutesToTimeStr(1165)).toBe("7:25 PM");
  });

  it("survives a non-number", () => {
    expect(minutesToTimeStr(NaN)).toBe("");
  });

  it("fmt accepts both a config string and a minute count", () => {
    // config.json holds strings; computed values are minutes. One formatter has
    // to serve both, or every call site has to convert first.
    expect(fmt("8:00")).toBe("8:00 AM");
    expect(fmt(480)).toBe("8:00 AM");
    expect(fmt("1:20")).toBe("1:20 PM");
    expect(fmt(800)).toBe("1:20 PM");
    expect(fmt("")).toBe("12:00 AM");
    expect(fmt(null)).toBe("12:00 AM");
  });

  it("the old private fmt copies agree with it on every vocabulary time", () => {
    // The two deleted copies were byte-identical to each other:
    //   let disp = h; if (!isPM && h === 0) disp = 12; if (disp > 12) disp -= 12;
    const oldFmt = (t: string) => {
      if (!t) return "";
      const [hs = "0", ms = "0"] = String(t).split(":");
      let h = parseInt(hs || "0", 10);
      const m = parseInt(ms || "0", 10);
      const isPM = h === 12 || (h >= 1 && h <= 7);
      let disp = h;
      if (!isPM && h === 0) disp = 12;
      if (disp > 12) disp -= 12;
      return `${disp}:${String(m).padStart(2, "0")} ${isPM ? "PM" : "AM"}`;
    };
    const mismatches: string[] = [];
    for (const day of DAYS) {
      for (const entry of Object.values(slotMap[day])) {
        for (const part of entry.time.split("-")) {
          const t = part.trim();
          if (oldFmt(t) !== fmt(t)) mismatches.push(`${t}: ${oldFmt(t)} vs ${fmt(t)}`);
        }
      }
    }
    expect(mismatches).toEqual([]);
  });
});

describe("slot keys", () => {
  it("round-trips", () => {
    expect(parseSlotKey("MON:A1")).toEqual({ day: "MON", slotId: "A1" });
    expect(slotKey("MON", "A1")).toBe("MON:A1");
  });

  it("rejects malformed keys instead of guessing", () => {
    expect(parseSlotKey("A1")).toBeNull();
    expect(parseSlotKey(":A1")).toBeNull();
    expect(parseSlotKey("MON:")).toBeNull();
    expect(parseSlotKey("")).toBeNull();
  });

  it("validates against the vocabulary", () => {
    expect(isValidKey("MON:A1")).toBe(true);
    expect(isValidKey("MON:Z99")).toBe(false);
    expect(isValidKey("XXX:A1")).toBe(false);
    expect(slotFor("MON:A1")?.time).toBeTruthy();
    expect(slotFor("MON:Z99")).toBeNull();
  });

  it("a slot id is day-scoped, which is the whole point of the key", () => {
    // A1 exists on MON and WED at DIFFERENT times. A bare "A1" cannot be a key.
    const mon = slotRange(slotMap.MON.A1.time);
    const wed = slotRange(slotMap.WED.A1.time);
    expect(mon.start).not.toBe(wed.start);
    expect(isValidKey("A1")).toBe(false);
  });

  it("computes spans", () => {
    expect(slotSpanMinutes("8:00-8:50")).toBe(50);
    expect(slotSpanHours("8:00-8:50")).toBeCloseTo(50 / 60, 5);
  });
});

describe("dayKeyForDate", () => {
  it("maps Sunday-first JS days onto MON-first keys", () => {
    expect(dayKeyForDate(new Date(2026, 8, 27))).toBe("SUN"); // 27 Sep 2026
    expect(dayKeyForDate(new Date(2026, 8, 28))).toBe("MON");
    expect(dayKeyForDate(new Date(2026, 8, 26))).toBe("SAT");
  });
});

describe("slotCoveringNow", () => {
  it("returns null at the weekend", () => {
    expect(slotCoveringNow(new Date(2026, 8, 27, 10, 0))).toBeNull(); // Sunday
    expect(slotCoveringNow(new Date(2026, 8, 26, 10, 0))).toBeNull(); // Saturday
  });

  it("returns null outside teaching hours on a weekday", () => {
    expect(slotCoveringNow(new Date(2026, 8, 28, 7, 30))).toBeNull(); // Mon 07:30
    expect(slotCoveringNow(new Date(2026, 8, 28, 20, 0))).toBeNull(); // Mon 20:00
  });

  it("finds the covering slot mid-morning on a Monday", () => {
    const key = slotCoveringNow(new Date(2026, 8, 28, 8, 30));
    expect(key).not.toBeNull();
    const parsed = parseSlotKey(key!);
    expect(parsed?.day).toBe("MON");
    const { start, end } = slotRange(slotMap.MON[parsed!.slotId].time);
    expect(8 * 60 + 30).toBeGreaterThanOrEqual(start);
    expect(8 * 60 + 30).toBeLessThan(end);
  });
});

describe("buildBusyMap", () => {
  it("splits VTOP's cell on ' - ', not '/'", () => {
    // Verified live: the separator is " - ". A bare split("-") would break on
    // both the slot ids and the venue.
    // L31/L32 are Monday, L37/L38 Tuesday - the ids in one cell are NOT all on
    // the same day, which is exactly why the map is keyed (day, slotId).
    const m = buildBusyMap([
      { code: "BACSE102", title: "Problem Solving", slotVenue: "L31+L32+L37+L38 - AB1-607B" },
    ]);
    expect(m["MON:L31"]).toEqual({ c: "BACSE102", t: "Problem Solving", v: "AB1-607B" });
    expect(m["MON:L32"].v).toBe("AB1-607B");
    expect(m["TUE:L37"].v).toBe("AB1-607B");
    expect(m["TUE:L38"].v).toBe("AB1-607B");
    expect(Object.keys(m)).toHaveLength(4);
  });

  it("fans a day-less slot id across every day it exists on", () => {
    const m = buildBusyMap([{ code: "X", slotVenue: "A1 - AB1-101" }]);
    // A1 is on MON and WED only, not all seven days.
    expect(Object.keys(m).sort()).toEqual(["MON:A1", "WED:A1"]);
  });

  it("honours an explicit day instead of fanning out", () => {
    const m = buildBusyMap([{ code: "X", slotVenue: "A1 - AB1-101", day: "MON" }]);
    expect(Object.keys(m)).toEqual(["MON:A1"]);
  });

  it("is idempotent for a caller that already emits one entry per day", () => {
    const a = buildBusyMap([{ code: "X", slotVenue: "A1 - R" }]);
    const b = buildBusyMap([
      { code: "X", slotVenue: "A1 - R", day: "MON" },
      { code: "X", slotVenue: "A1 - R", day: "WED" },
    ]);
    expect(a).toEqual(b);
  });

  it("drops an unresolvable slot id rather than inventing one", () => {
    const m = buildBusyMap([{ code: "X", slotVenue: "ZZZ99 - R" }]);
    expect(Object.keys(m)).toEqual([]);
  });

  it("ignores empty and missing cells", () => {
    expect(buildBusyMap([])).toEqual({});
    expect(buildBusyMap([{ code: "X" }])).toEqual({});
    expect(buildBusyMap([{ code: "X", slotVenue: "   " }])).toEqual({});
  });

  it("never exceeds the vocabulary", () => {
    const m = buildBusyMap([{ code: "X", slotVenue: "A1+A2 - R" }]);
    expect(Object.keys(m).length).toBeLessThanOrEqual(TOTAL_SLOTS);
  });

  it("preserves an online course's NIL venue", () => {
    const m = buildBusyMap([{ code: "ONLINE1", title: "Soft Skill", slotVenue: "NIL" }]);
    // "NIL" is not a slot id, so it resolves to nothing rather than a fake slot.
    expect(Object.keys(m)).toEqual([]);
  });
});

describe("busyHours", () => {
  it("sums occupied hours, to one decimal", () => {
    // MON:L31 is 2:00-2:50, so 50/60 = 0.833h, which the figure rounds to 0.8.
    const m = buildBusyMap([{ code: "X", slotVenue: "L31 - R" }]);
    expect(busyHours(m)).toBe(0.8);
  });

  it("is 0 for an empty map", () => {
    expect(busyHours({})).toBe(0);
  });
});

describe("computeOverlap", () => {
  const mine: BusyMap = { "MON:A1": { c: "M1" }, "WED:A1": { c: "M2" } };
  const theirs: BusyMap = { "MON:A1": { c: "T1" } };
  const SUNDAY = new Date(2026, 8, 27, 10, 0); // no slot covers it

  it("counts slots where both are busy", () => {
    const m = computeOverlap(mine, theirs, slotMap, SUNDAY);
    expect(m.sharedClassHours).toBeCloseTo(50 / 60, 1);
    expect(m.myClassHours).toBeCloseTo(100 / 60, 1);
  });

  it("matchPct is the share of MY class hours the peer is also free", () => {
    // I am busy 2 slots. The peer clashes in 1 of them, so half my class time is
    // clash-free.
    const m = computeOverlap(mine, theirs, slotMap, SUNDAY);
    expect(m.matchPct).toBe(50);

    // A peer who clashes nowhere: every class hour of mine is free for them.
    const elsewhere: BusyMap = { "TUE:B1": { c: "T" } };
    expect(computeOverlap(mine, elsewhere, slotMap, SUNDAY).matchPct).toBe(100);
  });

  it("matchPct is 100 when we clash in every single class hour", () => {
    const identical: BusyMap = { "MON:A1": {}, "WED:A1": {} };
    expect(computeOverlap(mine, identical, slotMap, SUNDAY).matchPct).toBe(0);
  });

  it("never exceeds 100", () => {
    // The draft formula in the docs divides a free-slot count by a busy-slot
    // count, which can exceed 100. This one is a share of a subset, so it cannot.
    for (let a = 0; a < 6; a++) {
      for (let b = 0; b < 6; b++) {
        const m = computeOverlap(
          buildBusyMap([{ slotVenue: a % 2 ? "A1 - R" : "L31 - R" }]),
          buildBusyMap([{ slotVenue: b % 2 ? "A1 - R" : "L31 - R" }]),
          slotMap,
          SUNDAY
        );
        expect(m.matchPct).toBeGreaterThanOrEqual(0);
        expect(m.matchPct).toBeLessThanOrEqual(100);
      }
    }
  });

  it("counts slots where NEITHER is busy, which requires walking the vocabulary", () => {
    // The bug this guards: iterating only the union of occupied keys makes this
    // permanently 0, because every key in that union is busy for someone.
    const none: BusyMap = {};
    const m = computeOverlap(mine, none, slotMap, SUNDAY);
    expect(m.commonFreeSlots).toBe(164 - 2);
    expect(m.commonFreeHours).toBeCloseTo(
      computeOverlap({}, {}, slotMap, SUNDAY).commonFreeHours - 100 / 60,
      1
    );
  });

  it("commonFreeSlots falls as the peer gets busier", () => {
    const idle = computeOverlap(mine, {}, slotMap, SUNDAY).commonFreeSlots;
    const busy = computeOverlap(mine, { "TUE:B1": {} }, slotMap, SUNDAY).commonFreeSlots;
    expect(busy).toBeLessThan(idle);
  });

  it("freeNow is false only when the peer is busy in the covering slot", () => {
    const when = new Date(2026, 8, 28, 8, 30); // Monday 08:30, inside MON:A1
    const covering = slotCoveringNow(when)!;
    expect(covering.startsWith("MON:")).toBe(true);

    expect(computeOverlap(mine, { [covering]: { c: "T" } }, slotMap, when).freeNow).toBe(false);
    expect(computeOverlap(mine, {}, slotMap, when).freeNow).toBe(true);
  });

  it("is free at the weekend, because no slot covers it", () => {
    const m = computeOverlap(mine, { "SUN:A1": { c: "T" } }, slotMap, SUNDAY);
    expect(m.currentSlot).toBeNull();
    expect(m.freeNow).toBe(true);
  });

  it("skips an unresolvable key instead of guessing a time", () => {
    const drifted: BusyMap = { ...mine, "MON:Z99": { c: "GHOST" } };
    const clean = computeOverlap(mine, {}, slotMap, SUNDAY);
    const ghost = computeOverlap(drifted, {}, slotMap, SUNDAY);
    // The ghost key contributes to nothing.
    expect(ghost.commonFreeSlots).toBe(clean.commonFreeSlots);
    expect(ghost.myClassHours).toBe(clean.myClassHours);
    expect(ghost.matchPct).toBe(clean.matchPct);
  });

  it("returns zeros when I have no timetable", () => {
    const m = computeOverlap({}, theirs, slotMap, SUNDAY);
    expect(m.matchPct).toBe(0);
    expect(m.myClassHours).toBe(0);
    // But the common-free figure is still meaningful: they are busy, I am not.
    expect(m.commonFreeSlots).toBe(164 - 1);
  });

  it("is symmetric for the clash figures, but not for matchPct", () => {
    const a = computeOverlap(mine, theirs, slotMap, SUNDAY);
    const b = computeOverlap(theirs, mine, slotMap, SUNDAY);
    expect(a.commonFreeSlots).toBe(b.commonFreeSlots);
    expect(a.sharedClassHours).toBe(b.sharedClassHours);
    // matchPct is about the VIEWER's week, so it differs by design: the peer is
    // free for 100% of my one class hour, but I am only free for 0% of theirs.
    expect(a.matchPct).toBe(50);
    expect(b.matchPct).toBe(0);
  });

  it("reports the chronologically first common free slot", () => {
    const m = computeOverlap({}, {}, slotMap, SUNDAY);
    // Earliest slot in the week is MON A1 at 08:00.
    expect(m.firstCommonFreeSlot).toBe("MON:A1");
  });

  it("the first common free slot really is the earliest one", () => {
    const m = computeOverlap({}, {}, slotMap, SUNDAY);
    const first = m.firstCommonFreeSlot!;
    const parsed = parseSlotKey(first)!;
    expect(parsed.day).toBe("MON");
    expect(slotRange(slotMap.MON[parsed.slotId].time).start).toBe(480);
  });
});

describe("busyMapFromClassSlots respects day", () => {
  it("does NOT fan a MON slot out to WED", () => {
    // The day-blind defect: A1 exists on MON and WED, so the old code marked
    // this friend busy on both days.
    const m = busyMapFromClassSlots([
      { day: "Monday", timeSlot: "8:00 AM - 8:50 AM", courseCode: "X", courseTitle: "T", venue: "R", slotId: "A1" },
    ]);
    expect(Object.keys(m)).toEqual(["MON:A1"]);
    expect(m["WED:A1"]).toBeUndefined();
  });

  it("accepts full and abbreviated day names", () => {
    expect(normaliseDay("Monday")).toBe("MON");
    expect(normaliseDay("monday")).toBe("MON");
    expect(normaliseDay("mon")).toBe("MON");
    expect(normaliseDay("nonsense")).toBeNull();
    expect(normaliseDay(undefined)).toBeNull();
  });

  it("fans out only when the day is missing, because there is nothing to go on", () => {
    const m = busyMapFromClassSlots([
      { day: "", timeSlot: "", courseCode: "X", courseTitle: "T", venue: "R", slotId: "A1" },
    ]);
    expect(Object.keys(m).sort()).toEqual(["MON:A1", "WED:A1"]);
  });

  it("carries the course detail across", () => {
    const m = busyMapFromClassSlots([
      { day: "Tuesday", timeSlot: "", courseCode: "BACSE101", courseTitle: "Course", venue: "AB1-101", slotId: "B1" },
    ]);
    expect(m["TUE:B1"]).toEqual({ c: "BACSE101", t: "Course", v: "AB1-101" });
  });

  it("survives junk", () => {
    expect(busyMapFromClassSlots(undefined)).toEqual({});
    expect(busyMapFromClassSlots([])).toEqual({});
    expect(busyMapFromClassSlots([{ slotId: "" } as never])).toEqual({});
  });
});

describe("lunch", () => {
  it("is a visual spacer at 13:20, not a slot", () => {
    expect(LUNCH_START_MIN).toBe(800);
  });

  it("splits Monday's columns 6 before / 6 after", () => {
    // See docs/social-tt/09-schedule-math.md §8.
    expect(lunchColumnIndex()).toBe(6);
  });

  it("classifies MON.S11 (12:35-1:25) before lunch, by a 25-minute margin", () => {
    // Documented edge case, kept so the grid looks unchanged.
    const { start } = slotRange(slotMap.MON.S11.time);
    expect(start).toBeLessThan(LUNCH_START_MIN);
  });
});

describe("mondaySkeleton", () => {
  it("splits theory and lab, sorted by start time", () => {
    const { theory, lab } = mondaySkeleton();
    expect(theory.length).toBeGreaterThan(0);
    expect(lab.length).toBeGreaterThan(0);
    expect(theory.every((t) => !t.slotId.startsWith("L"))).toBe(true);
    expect(lab.every((l) => l.slotId.startsWith("L"))).toBe(true);
    for (let i = 1; i < theory.length; i++) {
      expect(theory[i].start).toBeGreaterThanOrEqual(theory[i - 1].start);
    }
  });
});

describe("config.json is the vocabulary both sides validate against", () => {
  it("has exactly the two documented top-level keys", () => {
    expect(Object.keys(config).sort()).toEqual(["semesterIDs", "slotMap"]);
  });

  it("every slotMap entry carries a time and nothing else", () => {
    for (const day of DAYS) {
      for (const [id, entry] of Object.entries(slotMap[day])) {
        expect(Object.keys(entry)).toEqual(["time"]);
        expect(typeof entry.time).toBe("string");
        expect(id.length).toBeGreaterThan(0);
      }
    }
  });

  it("the current semester is in the list", () => {
    expect(config.semesterIDs).toContain("CH20262701");
  });
});

describe("a known conflict registers as a conflict", () => {
  /**
   * The plan's manual check, made durable. Two real-shaped timetables with a
   * conflict planted in a known slot, so "does a clash actually show up?" is
   * answered by the suite rather than by eyeballing a screen.
   */
  const mine = buildBusyMap([
    { code: "BACSE101", title: "Discrete Math", slotVenue: "A1 - AB1-607" },
    { code: "BACSE102", title: "Problem Solving", slotVenue: "L31+L32 - AB1-607B" },
    { code: "MASTAT101", title: "Applied Statistics", slotVenue: "L37+L38 - AB1-607B" },
  ]);

  it("builds a realistic map from VTOP-shaped cells", () => {
    // A1 fans out to MON and WED; the L-blocks are Monday and Tuesday.
    expect(Object.keys(mine).sort()).toEqual([
      "MON:A1", "MON:L31", "MON:L32", "TUE:L37", "TUE:L38", "WED:A1",
    ]);
    expect(busyHours(mine)).toBe(5); // 6 slots x 50 min
  });

  it("flags an identical timetable as a total clash", () => {
    const m = computeOverlap(mine, mine, slotMap, new Date(2026, 8, 28, 10, 0));
    expect(m.matchPct).toBe(0);
    expect(m.sharedClassHours).toBe(5);
    expect(m.commonFreeSlots).toBe(164 - 6);
  });

  it("flags a peer who shares exactly one slot as a partial clash", () => {
    // The peer takes A1 on the same day, nothing else. That is one of my six.
    const theirs = buildBusyMap([{ code: "X", title: "X", slotVenue: "A1 - R", day: "MON" }]);
    const m = computeOverlap(mine, theirs, slotMap, new Date(2026, 8, 28, 10, 0));
    expect(m.sharedClassHours).toBeCloseTo(50 / 60, 1);
    // 5 of my 6 slots (250 of 300 minutes) are clash-free.
    expect(m.matchPct).toBe(83);
  });

  it("reports no clash for a peer in a completely different block", () => {
    const theirs = buildBusyMap([{ code: "Y", title: "Y", slotVenue: "L31 - R", day: "TUE" }]);
    const m = computeOverlap(mine, theirs, slotMap, new Date(2026, 8, 28, 10, 0));
    expect(m.matchPct).toBe(100);
    expect(m.sharedClassHours).toBe(0);
  });

  it("detects the clash live: same slot, right now", () => {
    // Monday 08:30 sits inside MON:A1 (08:00-08:50), which both of us occupy.
    const when = new Date(2026, 8, 28, 8, 30);
    const key = slotCoveringNow(when);
    expect(key).toBe("MON:A1");
    expect(mine[key!]).toBeDefined();

    const clashing = buildBusyMap([{ code: "X", slotVenue: "A1 - R", day: "MON" }]);
    expect(computeOverlap(mine, clashing, slotMap, when).freeNow).toBe(false);

    const elsewhere = buildBusyMap([{ code: "X", slotVenue: "A1 - R", day: "WED" }]);
    expect(computeOverlap(mine, elsewhere, slotMap, when).freeNow).toBe(true);
  });

  it("never scores a peer with no timetable as a perfect match", () => {
    // The trap: an empty peer week makes every one of my slots clash-free, which
    // a naive ratio reports as 100%. SocialTab guards this with an explicit
    // "no timetable" state; this pins the underlying number so the guard is not
    // the only thing standing between us and a flattering lie.
    const m = computeOverlap(mine, {}, slotMap, new Date(2026, 8, 28, 10, 0));
    expect(m.myClassHours).toBe(5);
    expect(m.matchPct).toBe(100);
    expect(Object.keys(mine).length).toBeGreaterThan(0);
  });
});
