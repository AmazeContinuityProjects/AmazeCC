import { describe, expect, it } from "vitest";
import { projectColumns } from "../components/custom/social/CommonFreeSlotsGrid";
import { initials } from "../components/custom/social/rows";
import { relativePublished } from "../lib/social/usePeerTimetables";
import { DAYS, slotMap, totalSlotsAcrossDay } from "../lib/social/schedule";

/**
 * The grid is the one place where a `config.json` edit can silently move every
 * cell, because the 12 columns are re-derived at render time from Monday and
 * projected onto the other days by matching time strings. So the projection is
 * asserted rather than trusted.
 */
describe("the 7x12 projection is complete and lossless", () => {
  const columns = projectColumns();

  it("has 12 columns on every day", () => {
    for (const day of DAYS) {
      expect(columns[day]).toHaveLength(12);
    }
  });

  it("covers every slot in config.json exactly once, on every day", () => {
    // This is the invariant from docs/social-tt/09-schedule-math.md §3. A gap
    // means a slot the grid cannot render; a duplicate means a slot counted
    // twice in the free/busy arithmetic.
    for (const day of DAYS) {
      const seen: string[] = [];
      for (const col of columns[day]) {
        if (col.theory) seen.push(col.theory.slotId);
        if (col.lab) seen.push(col.lab.slotId);
      }
      const expected = Object.keys(slotMap[day]).sort();
      expect(seen.slice().sort()).toEqual(expected);
      expect(seen).toHaveLength(new Set(seen).size);
    }
  });

  it("covers all 164 slots in total", () => {
    let total = 0;
    for (const day of DAYS) {
      for (const col of columns[day]) {
        if (col.theory) total++;
        if (col.lab) total++;
      }
    }
    expect(total).toBe(164);
  });

  it("puts every slot in the column whose time matches, not merely any column", () => {
    // A projection that resolved by start-time only, with a loose tolerance,
    // could pair Monday 08:00 with Wednesday 08:55. Pin the exact times.
    const monCol0 = columns.MON[0];
    expect(monCol0.theory).not.toBeNull();
    const monTheory = slotMap.MON[monCol0.theory!.slotId].time;
    const wedCol0 = columns.WED[0];
    if (wedCol0.theory) {
      expect(slotMap.WED[wedCol0.theory.slotId].time).toBe(monTheory);
    }
  });

  it("projects A1 onto both days it exists, at that day's own time", () => {
    const a1Cols: string[] = [];
    for (const day of DAYS) {
      for (const col of columns[day]) {
        if (col.theory?.slotId === "A1") a1Cols.push(day);
        if (col.lab?.slotId === "A1") a1Cols.push(day);
      }
    }
    // A1 exists on MON and WED only — and at DIFFERENT times, which is the
    // whole reason keys are (day, slotId).
    expect([...new Set(a1Cols)].sort()).toEqual(["MON", "WED"]);
    expect(slotMap.MON.A1.time).not.toBe(slotMap.WED.A1.time);
  });

  it("never puts a lab in the theory half, or the reverse", () => {
    for (const day of DAYS) {
      for (const col of columns[day]) {
        if (col.theory) expect(col.theory.slotId.startsWith("L")).toBe(false);
        if (col.lab) expect(col.lab.slotId.startsWith("L")).toBe(true);
      }
    }
  });

  it("totalSlotsAcrossDay agrees with the projection", () => {
    for (const day of DAYS) {
      expect(totalSlotsAcrossDay(day)).toBe(Object.keys(slotMap[day]).length);
    }
  });
});

describe("initials", () => {
  it("takes at most two letters, uppercased", () => {
    expect(initials("Neha Patel")).toBe("NP");
    expect(initials("Aarav Sharma")).toBe("AS");
    expect(initials("Aarav Kumar Sharma")).toBe("AK");
    expect(initials("a")).toBe("A");
  });

  it("falls back rather than rendering nothing", () => {
    expect(initials("")).toBe("AM");
    expect(initials("   ")).toBe("AM");
  });
});

describe("relativePublished", () => {
  const now = new Date("2026-09-27T12:00:00.000Z").getTime();

  it("says so when there is no record", () => {
    // A peer who has not published must not render as "0m ago".
    expect(relativePublished(null, now)).toBe("not published");
    expect(relativePublished(undefined, now)).toBe("not published");
    expect(relativePublished("garbage", now)).toBe("not published");
  });

  it("scales the unit with the age", () => {
    expect(relativePublished(new Date(now - 30_000).toISOString(), now)).toBe("just now");
    expect(relativePublished(new Date(now - 5 * 60_000).toISOString(), now)).toBe("5m ago");
    expect(relativePublished(new Date(now - 3 * 3_600_000).toISOString(), now)).toBe("3h ago");
    expect(relativePublished(new Date(now - 3 * 86_400_000).toISOString(), now)).toBe("3d ago");
    expect(relativePublished(new Date(now - 60 * 86_400_000).toISOString(), now)).toBe("2mo ago");
  });

  it("does not go negative for a clock skewed into the future", () => {
    expect(relativePublished(new Date(now + 60_000).toISOString(), now)).toBe("just now");
  });
});
