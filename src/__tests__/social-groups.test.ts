/**
 * Group maths and storage.
 *
 * The properties that matter, and why each one is asserted rather than assumed:
 *
 *   1. AND, not OR — a common-free slot must be free for *everyone* in the
 *      group, or a group of five would report a slot that only two of them can
 *      actually attend.
 *   2. An empty group reports zeros, not "164 free". With no members, "free for
 *      all" is vacuously true everywhere, which would render a group of nobody
 *      as a completely open week.
 *   3. Unloaded members are excluded, never counted as free. "Unknown" and
 *      "free" are different claims and only one of them is evidence.
 *   4. Handles are pruned, so a revoked pairing cannot linger and inflate a
 *      group's member count forever.
 */

import { afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { computeGroupOverlap, orderedDays, slotKey, slotMap, type SlotMap } from "../lib/social/schedule";
import { groupsKeyV1, readGroups, writeGroups, _resetForTests } from "../lib/social/storage";
import { normaliseGroupName, pruneHandles } from "../lib/social/useSocialGroups";
import { GROUP_NAME_MAX, type BusyMap, type SocialGroup } from "../lib/social/types";

function installLocalStorage() {
  const w = window as unknown as { localStorage?: Storage };
  if (w.localStorage) return;
  const map = new Map<string, string>();
  const shim: Storage = {
    get length() {
      return map.size;
    },
    key: (i: number) => Array.from(map.keys())[i] ?? null,
    getItem: (k: string) => (map.has(k) ? (map.get(k) as string) : null),
    setItem: (k: string, v: string) => {
      map.set(k, String(v));
    },
    removeItem: (k: string) => {
      map.delete(k);
    },
    clear: () => map.clear(),
  };
  Object.defineProperty(w, "localStorage", { value: shim, configurable: true });
}

const REG = "20626703";

/** First N real slot keys, so the tests use the app's own vocabulary. */
function firstKeys(n: number, map: SlotMap = slotMap): string[] {
  const out: string[] = [];
  for (const daySlots of orderedDays(map)) {
    for (const { day, slotId } of daySlots) {
      out.push(slotKey(day, slotId));
      if (out.length >= n) return out;
    }
  }
  return out;
}

const [K1, K2, K3] = firstKeys(3);
const [W1, W2, W3] = firstKeys(6).slice(3);

beforeAll(installLocalStorage);
beforeEach(() => window.localStorage.clear());
afterEach(() => _resetForTests(REG));

describe("computeGroupOverlap", () => {
  it("reports zeros for an empty group, not a free week", () => {
    // Vacuous truth would give 164 common-free slots for a group of nobody.
    const m = computeGroupOverlap({}, []);
    expect(m.commonFreeSlots).toBe(0);
    expect(m.commonFreeHours).toBe(0);
    expect(m.memberCount).toBe(0);
    expect(m.firstCommonFreeSlot).toBeNull();
  });

  it("treats a slot as common free only when every member is free", () => {
    // The distinguishing slot must be one where the VIEWER is free, otherwise
    // my own class hours mask the member difference and both counts match.
    const me: BusyMap = { [K1]: { c: "LEC_A" } };
    const freeMember: BusyMap = {};
    const busyMember: BusyMap = { [K2]: { c: "LEC_B" } };

    // Alone, K2 is free (I am free, they are free). With the second member it
    // is not, because they are busy. That difference is what AND produces.
    const alone = computeGroupOverlap(me, [freeMember]).commonFreeSlots;
    const both = computeGroupOverlap(me, [freeMember, busyMember]).commonFreeSlots;
    expect(alone).toBe(163);
    expect(both).toBe(162);
  });

  it("matches the pairwise result for a one-person group", () => {
    const me: BusyMap = { [K1]: { c: "LEC_A" }, [K2]: { c: "LEC_B" } };
    const them: BusyMap = { [K1]: { c: "LEC_X" }, [K3]: { c: "LEC_Y" } };
    const single = computeGroupOverlap(me, [them]);
    expect(single.commonFreeHours).toBeGreaterThan(0);
    expect(single.myClassHours).toBeGreaterThan(0);
    // Busy is the union of the two busy maps: K1+K2 (mine) and K1+K3 (theirs)
    // is {K1, K2, K3}, so 164 - 3.
    expect(single.commonFreeSlots).toBe(164 - 3);
  });

  it("narrows monotonically as members are added", () => {
    const me: BusyMap = { [K1]: { c: "LEC_A" } };
    const one = computeGroupOverlap(me, [{}]).commonFreeSlots;
    const two = computeGroupOverlap(me, [{}, { [W1]: { c: "LEC" } }]).commonFreeSlots;
    const three = computeGroupOverlap(me, [{}, { [W1]: { c: "LEC" } }, { [W2]: { c: "LEC" } }]).commonFreeSlots;
    // Adding people can only remove common-free slots, never add them.
    expect(two).toBeLessThanOrEqual(one);
    expect(three).toBeLessThanOrEqual(two);
  });

  it("counts a slot as all-clash when the viewer and everyone are busy", () => {
    const me: BusyMap = { [K1]: { c: "LEC_A" } };
    const all: BusyMap = { [K1]: { c: "LEC_X" } };
    const m = computeGroupOverlap(me, [all, { ...all }]);
    expect(m.allClashSlots).toBe(1);
  });

  it("reports the group match as a mean per member, not an all-or-nothing gate", () => {
    // The viewer is busy in K1 and K2. In K1 both members are free; in K2 only
    // one is. Mean over the two is (2/2 + 1/2)/2 = 75%.
    const me: BusyMap = { [K1]: { c: "LEC_A" }, [K2]: { c: "LEC_B" } };
    const a: BusyMap = {};
    const b: BusyMap = { [K2]: { c: "LEC_B" } };
    const m = computeGroupOverlap(me, [a, b]);
    expect(m.groupMatchPct).toBe(75);
  });

  it("has no free-now claim outside class hours", () => {
    const map: SlotMap = slotMap;
    // 03:00 on a Sunday is outside every slot, so the question does not arise.
    const night = new Date("2026-09-27T03:00:00");
    const m = computeGroupOverlap({}, [{}], map, night);
    expect(m.currentSlot).toBeNull();
  });

  it("is 100% common free when nobody has any classes", () => {
    const m = computeGroupOverlap({}, [{}, {}, {}]);
    expect(m.commonFreeSlots).toBe(164);
    expect(m.commonFreeHours).toBeGreaterThan(0);
    expect(m.allClashSlots).toBe(0);
  });
});

describe("group storage", () => {
  const group: SocialGroup = {
    id: "g_1",
    name: "Project team",
    handles: ["AMZ-AAAA-1111", "AMZ-BBBB-2222"],
    createdAt: 1_700_000_000_000,
  };

  it("round-trips under a reg-scoped key", () => {
    expect(writeGroups([group], REG)).toBe(true);
    expect(readGroups(REG)).toEqual([group]);
    expect(window.localStorage.getItem(groupsKeyV1(REG))).toBeTruthy();
  });

  it("never writes to a global key", () => {
    writeGroups([group], REG);
    expect(window.localStorage.getItem("social_groups_v1")).toBeNull();
  });

  it("returns an empty list, not a throw, on corrupt data", () => {
    window.localStorage.setItem(groupsKeyV1(REG), "{not json");
    expect(readGroups(REG)).toEqual([]);
  });

  it("rejects malformed rows rather than casting them", () => {
    // A group missing `handles` would throw inside the group maths, so the read
    // validates instead of trusting the blob. Both rows here are invalid — the
    // first has no `handles`, the second has no `createdAt` — so the result is
    // empty rather than a partially-populated list.
    window.localStorage.setItem(
      groupsKeyV1(REG),
      JSON.stringify([
        { id: "g1", name: "no handles", createdAt: 1 },
        { id: "g2", handles: [], name: "no createdAt" },
      ])
    );
    expect(readGroups(REG)).toEqual([]);
  });

  it("keeps the valid rows and drops only the malformed ones", () => {
    window.localStorage.setItem(
      groupsKeyV1(REG),
      JSON.stringify([group, { id: "g2", name: "broken" }])
    );
    expect(readGroups(REG)).toEqual([group]);
  });

  it("drops a group whose handles are not all strings", () => {
    window.localStorage.setItem(
      groupsKeyV1(REG),
      JSON.stringify([{ ...group, handles: ["AMZ-OK-1111", 42] }])
    );
    expect(readGroups(REG)).toEqual([]);
  });

  it("keeps two accounts separate", () => {
    writeGroups([group], REG);
    writeGroups([{ ...group, id: "g_other", name: "Other" }], "21999999");
    expect(readGroups(REG)[0].name).toBe("Project team");
    expect(readGroups("21999999")[0].name).toBe("Other");
  });
});

describe("pruneHandles", () => {
  it("drops handles that are no longer peers", () => {
    // A revoked pairing must not linger in the group forever.
    expect(pruneHandles(["A", "B", "C"], ["A", "C"])).toEqual(["A", "C"]);
  });

  it("de-duplicates while preserving order", () => {
    expect(pruneHandles(["B", "A", "B"], ["A", "B"])).toEqual(["B", "A"]);
  });

  it("returns empty when nothing survives", () => {
    expect(pruneHandles(["A", "B"], [])).toEqual([]);
  });
});

describe("normaliseGroupName", () => {
  it("collapses whitespace and trims", () => {
    expect(normaliseGroupName("  project   team  ")).toBe("project team");
  });

  it("caps the length", () => {
    expect(normaliseGroupName("x".repeat(200))).toHaveLength(GROUP_NAME_MAX);
  });

  it("returns empty for a name of only whitespace", () => {
    // The sheet relies on this to reject an unnamed group.
    expect(normaliseGroupName("   ")).toBe("");
  });
});
