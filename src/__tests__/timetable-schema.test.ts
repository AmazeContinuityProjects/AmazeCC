import { describe, expect, it } from "vitest";
import config from "../../config.json";
import legacyHeadIndex from "../data/timetable/legacy/head-164-index.json";
import {
  CAMPUS_SCHEMA,
  DAYS,
  SLOT_MAP,
  TIMETABLE,
  TOTAL_SLOTS,
  equivalentTokens,
  periodOf,
  resolveSlot,
  slotsOfPeriod,
  tokensForPeriod,
} from "../lib/generated/timetable";

describe("unified timetable schema", () => {
  it("computes a stable vocabulary fingerprint", () => {
    expect(TIMETABLE.vocabularyVersion).toMatch(/^[0-9a-f]{16}$/);
    expect(TIMETABLE.schemaVersion).toBe(1);
    expect(TIMETABLE.campusId).toBe("chennai");
  });

  it("preserves every slot from the editable config, including overlapping tokens", () => {
    const fromConfig = Object.entries(config.slotMap).reduce((n, [, days]) => n + Object.keys(days).length, 0);
    expect(TOTAL_SLOTS).toBe(fromConfig);
    expect(TOTAL_SLOTS).toBe(TIMETABLE.baseline.slotCount);
    expect(DAYS).toHaveLength(7);
  });

  it("gives every token a physical period and keeps the back-reference consistent", () => {
    for (const slot of Object.values(TIMETABLE.slots)) {
      const period = periodOf(slot.day, slot.token);
      expect(period, `${slot.key} has no period`).toBeTruthy();
      expect(period!.id).toBe(slot.periodId);
      expect(tokensForPeriod(slot.day, slot.periodId)).toContain(slot.token);
    }
  });

  it("models overlapping programme tokens as distinct slots on one period", () => {
    const monEight = slotsOfPeriod("T01").filter((s) => s.day === "MON");
    expect(monEight.map((s) => s.token).sort()).toEqual(["A1", "M1"]);
    expect(resolveSlot("MON", "A1")!.programme).toBe("core");
    expect(resolveSlot("MON", "M1")!.programme).toBe("programme_m");
    expect(equivalentTokens("MON", "A1")).toContain("M1");
    expect(equivalentTokens("MON", "M1")).toContain("A1");
  });

  it("keeps the weekend duplicate tokens as separate real slots", () => {
    expect(resolveSlot("SAT", "S8")!.time).toBe("11:40-12:30");
    expect(resolveSlot("SAT", "S8B")!.time).toBe("12:35-1:25");
    expect(resolveSlot("SAT", "S8")!.periodId).not.toBe(resolveSlot("SAT", "S8B")!.periodId);
    expect(resolveSlot("SUN", "S10")!.time).toBe("11:40-12:30");
    expect(resolveSlot("SUN", "S10B")!.time).toBe("12:35-1:25");
  });

  it("keeps law aliases data-driven and away from the new programme families", () => {
    expect(resolveSlot("MON", "A1")!.aliases.map((a) => a.token)).toContain("A");
    expect(resolveSlot("MON", "S11")!.aliases.map((a) => a.token)).toContain("TEE");
    expect(resolveSlot("MON", "M1")!.aliases).toEqual([]);
    expect(resolveSlot("TUE", "U1")!.aliases).toEqual([]);
  });

  it("emits a flat projection identical to the editable config vocabulary", () => {
    for (const day of DAYS) {
      expect(Object.keys(SLOT_MAP[day]).sort()).toEqual(
        Object.keys(config.slotMap[day as keyof typeof config.slotMap]).sort(),
      );
    }
  });

  it("emits a legacy campus projection without weekend tokens", () => {
    const tokens = Object.values(CAMPUS_SCHEMA).flatMap((periods) =>
      periods.flatMap((p: any) => Object.values(p.days ?? {})).flatMap((s: any) => String(s).split("+")),
    );
    expect(tokens.length).toBeGreaterThan(0);
    expect(tokens.some((t) => /^(X|Y|Z|W)\d/.test(t))).toBe(false);
    expect(tokens).toContain("A1");
    expect(tokens).toContain("L1");
  });

  it("freezes the pre-change 164-slot codec order", () => {
    expect(legacyHeadIndex.count).toBe(164);
    expect(legacyHeadIndex.order).toHaveLength(164);
    expect(legacyHeadIndex.order[0]).toBe("MON:A1");
    expect(new Set(legacyHeadIndex.order).size).toBe(164);
  });
});
