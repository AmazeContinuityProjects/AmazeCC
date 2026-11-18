import { describe, expect, it } from "vitest";
import config from "../../config.json";
import legacyHeadIndex from "../data/timetable/legacy/head-164-index.json";
import {
  CAMPUS_SCHEMA,
  DAY_ORDER,
  DAYS,
  EXTRAMURAL_SLOT_KEYS,
  LAB_PERIOD_IDS,
  PERIODS_BY_DAY,
  SLOT_MAP,
  SLOTS_BY_PERIOD,
  SLOTS_BY_PROGRAMME,
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

  it("preserves every config slot plus the first-class law slots", () => {
    const fromConfig = Object.entries(config.slotMap).reduce((n, [, days]) => n + Object.keys(days).length, 0);
    expect(fromConfig).toBe(214);
    expect(TOTAL_SLOTS).toBeGreaterThan(fromConfig);
    expect(TOTAL_SLOTS).toBe(TIMETABLE.baseline.slotCount);
    expect(DAYS).toHaveLength(7);
    expect(TIMETABLE.programmes.map((p) => p.id)).toContain("law");
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
    expect(monEight.map((s) => s.token).sort()).toEqual(["A", "A1", "M1"]);
    expect(resolveSlot("MON", "A1")!.programme).toBe("core");
    expect(resolveSlot("MON", "M1")!.programme).toBe("programme_m");
    expect(resolveSlot("MON", "A")!.programme).toBe("law");
    expect(equivalentTokens("MON", "A1")).toContain("M1");
    expect(equivalentTokens("MON", "M1")).toContain("A1");
  });

  it("promotes law tokens to first-class slots sharing core periods", () => {
    expect(resolveSlot("MON", "A")!.periodId).toBe(resolveSlot("MON", "A1")!.periodId);
    expect(resolveSlot("TUE", "TAA")!.periodId).toBe(resolveSlot("TUE", "TAA1")!.periodId);
    expect(resolveSlot("MON", "TEE")!.periodId).toBe(resolveSlot("MON", "S11")!.periodId);
    expect(resolveSlot("FRI", "TFF")!.periodId).toBe(resolveSlot("FRI", "S15")!.periodId);
    expect(equivalentTokens("MON", "A")).toContain("A1");
    // Legacy alias metadata stays on core slots for older decoders.
    expect(resolveSlot("MON", "A1")!.aliases.map((a) => a.token)).toContain("A");
    expect(resolveSlot("MON", "S11")!.aliases.map((a) => a.token)).toContain("TEE");
    expect(resolveSlot("MON", "M1")!.aliases).toEqual([]);
    expect(resolveSlot("TUE", "U1")!.aliases).toEqual([]);
  });

  it("keeps the weekend duplicate tokens as separate real slots", () => {
    expect(resolveSlot("SAT", "S8")!.time).toBe("11:40-12:30");
    expect(resolveSlot("SAT", "S8B")!.time).toBe("12:35-1:25");
    expect(resolveSlot("SAT", "S8")!.periodId).not.toBe(resolveSlot("SAT", "S8B")!.periodId);
    expect(resolveSlot("SUN", "S10")!.time).toBe("11:40-12:30");
    expect(resolveSlot("SUN", "S10B")!.time).toBe("12:35-1:25");
  });

  it("emits a flat projection that contains every config token", () => {
    for (const day of DAYS) {
      const configTokens = Object.keys(config.slotMap[day as keyof typeof config.slotMap]);
      const projected = Object.keys(SLOT_MAP[day]);
      expect(configTokens.every((token) => projected.includes(token))).toBe(true);
      for (const token of configTokens) {
        expect(SLOT_MAP[day][token].time).toBe(config.slotMap[day as keyof typeof config.slotMap][token].time);
      }
    }
  });

  it("emits a legacy campus projection without weekend or law tokens", () => {
    const tokens = Object.values(CAMPUS_SCHEMA).flatMap((periods) =>
      periods.flatMap((p: any) => Object.values(p.days ?? {})).flatMap((s: any) => String(s).split("+")),
    );
    expect(tokens.length).toBeGreaterThan(0);
    expect(tokens.some((t) => /^(X|Y|Z|W)\d/.test(t))).toBe(false);
    expect(tokens.some((t) => /^(A|TAA|TEE)$/.test(t))).toBe(false);
    expect(tokens).toContain("A1");
    expect(tokens).toContain("L1");
  });

  it("precomputes the scaffolding that grids and generators used to rebuild", () => {
    expect(DAY_ORDER).toEqual(DAYS);
    expect(PERIODS_BY_DAY.MON).toContain("T01");
    expect(PERIODS_BY_DAY.MON.length).toBeGreaterThan(0);
    expect(SLOTS_BY_PERIOD.T01).toContain("MON:A");
    expect(SLOTS_BY_PERIOD.T01).toContain("MON:A1");
    expect(SLOTS_BY_PERIOD.T01).toContain("MON:M1");
    expect(LAB_PERIOD_IDS.length).toBeGreaterThan(0);
    expect(EXTRAMURAL_SLOT_KEYS).toContain("WED:TBB1");
    expect(SLOTS_BY_PROGRAMME.law.length).toBe(27);
    expect(SLOTS_BY_PROGRAMME.programme_m.length).toBe(10);
  });

  it("freezes the pre-change 164-slot codec order", () => {
    expect(legacyHeadIndex.count).toBe(164);
    expect(legacyHeadIndex.order).toHaveLength(164);
    expect(legacyHeadIndex.order[0]).toBe("MON:A1");
    expect(new Set(legacyHeadIndex.order).size).toBe(164);
  });
});
