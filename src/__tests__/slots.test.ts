import { describe, expect, it } from "vitest";
import {
  expandSlotSpellings,
  hasSlot,
  lawSlotFor,
  schemaSlotFor,
  slotSpellings,
} from "../lib/slots";

/**
 * One period, two names.
 *
 * The law school books its morning periods with no number at all — `A+TA+TAA`
 * where the rest of campus writes `A1+TA1+TAA1` — and the generator and the
 * free-classroom page both answer "which periods does this course run in?" by
 * comparing those strings. Compared literally, the answer is *none* for all 99
 * law rows: the free-classroom page reported every AB5 room free all morning
 * with a class sitting in it, and the generator scored a law student's full
 * timetable as ten free half-days.
 */
describe("slotSpellings", () => {
  it("gives a schema slot and its law spelling the same spellings", () => {
    expect(slotSpellings("A1").sort()).toEqual(["A", "A1"]);
    expect(slotSpellings("A").sort()).toEqual(["A", "A1"]);
  });

  it("answers the same whichever way round the question is asked", () => {
    // The free-classroom page holds a period and asks who is in it; the
    // generator holds a course and asks when it runs. Both have to get here.
    expect(slotSpellings("A1").sort()).toEqual(slotSpellings("A").sort());
  });

  it("covers the whole third row, not just the first column", () => {
    expect(slotSpellings("TCC1").sort()).toEqual(["TCC", "TCC1"]);
    expect(slotSpellings("TDD").sort()).toEqual(["TDD", "TDD1"]);
  });

  it("maps the two S-id periods onto the law school's last two slots", () => {
    // The law grid runs a third period past TAA/TBB/TCC/TDD, and the last two
    // land on the 12:35 periods the schema gives an S id: S11 Monday, S15 Friday.
    expect(slotSpellings("S11").sort()).toEqual(["S11", "TEE"]);
    expect(slotSpellings("S15").sort()).toEqual(["S15", "TFF"]);
    expect(slotSpellings("TEE").sort()).toEqual(["S11", "TEE"]);
    expect(slotSpellings("TFF").sort()).toEqual(["S15", "TFF"]);
  });

  it("gives an evening slot only itself, because law has no evening", () => {
    // If A2 picked up an alias, a law course would mark itself busy from 2pm
    // on the strength of a morning class.
    expect(slotSpellings("A2")).toEqual(["A2"]);
    expect(slotSpellings("TDD2")).toEqual(["TDD2"]);
  });

  it("leaves a real evening S slot alone", () => {
    // S1 is a genuine 6:35pm theory slot that happens to fit the letters-plus-1
    // shape. Aliasing it would invent an "S" that collides with it.
    expect(slotSpellings("S1")).toEqual(["S1"]);
  });

  it("leaves labs alone, which have no law equivalent", () => {
    expect(slotSpellings("L1")).toEqual(["L1"]);
    expect(slotSpellings("L31")).toEqual(["L31"]);
  });

  it("leaves NIL alone, so the placeholder never grows a partner", () => {
    // NIL is letters, so a naive reading would hand it an "NIL1".
    expect(slotSpellings("NIL")).toEqual(["NIL"]);
  });

  it("tolerates the casing and padding a spreadsheet brings", () => {
    expect(slotSpellings(" a1 ").sort()).toEqual(["A", "A1"]);
  });

  it("has nothing to say about nothing", () => {
    expect(slotSpellings("")).toEqual([]);
  });
});

describe("lawSlotFor", () => {
  it("drops a lone trailing 1", () => {
    expect(lawSlotFor("A1")).toBe("A");
    expect(lawSlotFor("TG1")).toBe("TG");
  });

  it("keeps the S-id table ahead of the shape it would otherwise match", () => {
    // S11 and S15 carry two digits, so the shape misses them anyway — but the
    // table is what makes them TEE and TFF rather than nothing.
    expect(lawSlotFor("S11")).toBe("TEE");
    expect(lawSlotFor("S15")).toBe("TFF");
    expect(lawSlotFor("S12")).toBeNull();
  });
});

describe("schemaSlotFor", () => {
  it("puts the number back on a law slot", () => {
    expect(schemaSlotFor("A")).toBe("A1");
    expect(schemaSlotFor("TAA")).toBe("TAA1");
  });

  it("returns the S id where the law school has one", () => {
    expect(schemaSlotFor("TEE")).toBe("S11");
    expect(schemaSlotFor("TFF")).toBe("S15");
  });

  it("refuses the ids that are not law slots", () => {
    expect(schemaSlotFor("NIL")).toBeNull();
    expect(schemaSlotFor("S")).toBeNull();
  });
});

describe("expandSlotSpellings", () => {
  it("makes one Set answer for both spellings, which is the point", () => {
    // The half-day metrics do `owned.has(schemaSlot)` in a loop, so the
    // translation has to happen once here rather than at every call site. The
    // caller splits the "+" first, exactly as a report row is split.
    const owned = expandSlotSpellings(["A", "TA", "TAA"]);
    expect(owned.has("A1")).toBe(true);
    expect(owned.has("TA1")).toBe(true);
    expect(owned.has("TAA1")).toBe(true);
  });

  it("resolves the two law slots that land on an S-id period", () => {
    const owned = expandSlotSpellings(["E", "TE", "TEE", "F", "TF", "TFF"]);
    expect(owned.has("S11")).toBe(true);
    expect(owned.has("S15")).toBe(true);
  });

  it("still reports an evening slot free for a law student", () => {
    const owned = expandSlotSpellings(["A"]);
    expect(owned.has("A2")).toBe(false);
  });
});

describe("hasSlot", () => {
  it("matches a course's law slot against a schema slot", () => {
    expect(hasSlot(["A", "TA"], "A1")).toBe(true);
    expect(hasSlot(["A", "TA"], "TA1")).toBe(true);
  });

  it("matches a schema slot against a course's law slot", () => {
    expect(hasSlot(["A1"], "A")).toBe(true);
  });

  it("does not match a law slot to the evening", () => {
    expect(hasSlot(["A"], "A2")).toBe(false);
  });

  it("is not fooled by a slot it has never heard of", () => {
    expect(hasSlot(["A1"], "ZZZ")).toBe(false);
    expect(hasSlot([], "A1")).toBe(false);
  });
});
