import { describe, expect, it } from "vitest";
import config from "../../config.json";
import {
  DAYS,
  LUNCH_START_MIN,
  TOTAL_SLOTS,
  dayKeyForDate,
  fmt,
  isValidKey,
  lunchColumnIndex,
  minutesToTimeStr,
  mondaySkeleton,
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
} from "../lib/schedule";

/* ------------------------------------------------------------------ *
 * Equivalence with the three parsers this module replaces
 * ------------------------------------------------------------------ */

// Byte-for-byte the rule in the old CommonFreeSlotsGrid.tsx:17 and
// TimetableGrid.tsx:64.
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
          if (mine !== attendanceRule(t)) mismatches.push(`${t}: attendance ${attendanceRule(t)} vs ${mine}`);
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
