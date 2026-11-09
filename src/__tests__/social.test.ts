import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import config from "../../config.json";
import {
  LEGACY_FRIENDS_KEY,
  LEGACY_GROUPS_KEY,
  friendsKey,
  groupsKey,
  migrateLegacyStore,
  readList,
  writeList,
  clearPeerTimetables,
  grantsKey,
  readGrants,
  writeGrants,
  readIdentity,
  writeIdentity,
  readOwnTimetable,
  writeOwnTimetable,
  readPeerTimetable,
  writePeerTimetable,
  _resetForTests,
} from "../lib/social/storage";
import {
  getActiveDisplayName,
  getActiveRegNumber,
  hasIdentity,
} from "../lib/social/identity";
import { toCoarse } from "../lib/social/types";

/**
 * jsdom only exposes `localStorage` for a non-opaque document origin, and the
 * vitest jsdom environment hands it an opaque one, so `window.localStorage` is
 * undefined here. Install a minimal in-memory Storage so these tests assert
 * real behaviour instead of silently no-opping behind a guard.
 *
 * (`fetch-utils.test.ts` guards with `typeof window.localStorage`, which means
 * its localStorage assertions may be skipping entirely — worth a look.)
 */
function installLocalStorage() {
  const w = window as unknown as { localStorage?: Storage };
  if (w.localStorage) return;

  const map = new Map<string, string>();
  const storage: Storage = {
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
  Object.defineProperty(w, "localStorage", { value: storage, configurable: true });
}

beforeAll(() => {
  installLocalStorage();
});

const REG = "22BCE1234";

function setProfile(value: unknown) {
  window.localStorage.setItem("profile", JSON.stringify(value));
}

describe("getActiveRegNumber", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("reads the live profile shape (registerNo)", () => {
    // What /api/student → parseStudentProfile actually writes.
    setProfile({ registerNo: "22BCE1102", name: "Aarav Sharma" });
    expect(getActiveRegNumber()).toBe("22BCE1102");
  });

  it("reads the demo profile shape (registerNumber)", () => {
    // src/data/demoData.json uses a different key for the same thing.
    setProfile({ registerNumber: "22BCE1234", studentName: "Demo Student" });
    expect(getActiveRegNumber()).toBe("22BCE1234");
  });

  it("tries every spelling rather than betting on one", () => {
    const spellings = [
      "registerNo",
      "registerNumber",
      "regNo",
      "regNumber",
      "applicationNumber",
    ];
    for (const key of spellings) {
      setProfile({ [key]: `V-${key}` });
      expect(getActiveRegNumber()).toBe(`V-${key}`);
    }
  });

  it("prefers the first spelling in order when several are present", () => {
    setProfile({ applicationNumber: "last", registerNo: "first" });
    expect(getActiveRegNumber()).toBe("first");
  });

  it("trims whitespace", () => {
    setProfile({ registerNo: "  22BCE1102  " });
    expect(getActiveRegNumber()).toBe("22BCE1102");
  });

  it("falls through a blank value to the next spelling", () => {
    setProfile({ registerNo: "   ", registerNumber: "22BCE1234" });
    expect(getActiveRegNumber()).toBe("22BCE1234");
  });

  it("ignores a non-string value", () => {
    setProfile({ registerNo: 12345, registerNumber: "22BCE1234" });
    expect(getActiveRegNumber()).toBe("22BCE1234");
  });

  it("returns empty when absent, empty, or corrupt", () => {
    expect(getActiveRegNumber()).toBe("");
    expect(hasIdentity()).toBe(false);

    setProfile({});
    expect(getActiveRegNumber()).toBe("");

    window.localStorage.setItem("profile", "{not json");
    expect(getActiveRegNumber()).toBe("");
  });

  it("falls back to attendance.studentInfo when present", () => {
    // Not declared on `attendanceRes`, so this path is defensive only.
    window.localStorage.setItem(
      "attendance",
      JSON.stringify({ studentInfo: { regNumber: "22BCE9999" } })
    );
    expect(getActiveRegNumber()).toBe("22BCE9999");
  });

  it("reads the display name under both shapes", () => {
    setProfile({ registerNo: "a", name: "Aarav Sharma" });
    expect(getActiveDisplayName()).toBe("Aarav Sharma");

    setProfile({ registerNumber: "b", studentName: "Demo Student" });
    expect(getActiveDisplayName()).toBe("Demo Student");

    setProfile({ registerNo: "c" });
    expect(getActiveDisplayName()).toBe("");
  });
});

describe("social storage", () => {
  beforeEach(() => {
    window.localStorage.clear();
    _resetForTests(REG);
  });

  it("round-trips a list through the namespaced key", () => {
    expect(writeList("friends", [{ id: "a" }], REG)).toBe(true);
    expect(readList("friends", REG)).toEqual([{ id: "a" }]);
    expect(window.localStorage.getItem(friendsKey(REG))).toBe(' [{"id":"a"}]'.trim());
  });

  it("does not write the legacy global mirror", () => {
    // The mirror leaked one account's friends to another on the same browser.
    writeList("friends", [{ id: "a" }], REG);
    writeList("groups", [{ id: "g" }], REG);
    expect(window.localStorage.getItem(LEGACY_FRIENDS_KEY)).toBeNull();
    expect(window.localStorage.getItem(LEGACY_GROUPS_KEY)).toBeNull();
  });

  it("returns empty rather than another account's data when no reg resolves", () => {
    window.localStorage.setItem(LEGACY_FRIENDS_KEY, JSON.stringify([{ id: "leak" }]));
    expect(readList("friends", "")).toEqual([]);
    expect(readList("friends")).toEqual([]);
  });

  it("refuses to write with no reg", () => {
    expect(writeList("friends", [{ id: "a" }], "")).toBe(false);
  });

  it("keeps two accounts separate", () => {
    writeList("friends", [{ id: "mine" }], "22BCE1111");
    writeList("friends", [{ id: "theirs" }], "22BCE2222");
    expect(readList("friends", "22BCE1111")).toEqual([{ id: "mine" }]);
    expect(readList("friends", "22BCE2222")).toEqual([{ id: "theirs" }]);
  });

  describe("one-time migration from the legacy global key", () => {
    it("carries an existing list into the namespaced key", () => {
      // This is the real state of a returning user: reg resolution always
      // failed, so everything was written to the bare global key.
      window.localStorage.setItem(
        LEGACY_FRIENDS_KEY,
        JSON.stringify([{ id: "22BCE1102" }, { id: "22BCE1140" }])
      );
      window.localStorage.setItem(LEGACY_GROUPS_KEY, JSON.stringify([{ id: "group-01" }]));

      expect(migrateLegacyStore(REG)).toBe(true);

      expect(readList("friends", REG)).toEqual([
        { id: "22BCE1102" },
        { id: "22BCE1140" },
      ]);
      expect(readList("groups", REG)).toEqual([{ id: "group-01" }]);
    });

    it("is idempotent", () => {
      window.localStorage.setItem(LEGACY_FRIENDS_KEY, JSON.stringify([{ id: "old" }]));
      expect(migrateLegacyStore(REG)).toBe(true);
      expect(migrateLegacyStore(REG)).toBe(false);

      writeList("friends", [{ id: "new" }], REG);
      expect(migrateLegacyStore(REG)).toBe(false);
      expect(readList("friends", REG)).toEqual([{ id: "new" }]);
    });

    it("never clobbers a real list with another account's leftovers", () => {
      writeList("friends", [{ id: "mine" }], REG);
      window.localStorage.setItem(LEGACY_FRIENDS_KEY, JSON.stringify([{ id: "stale" }]));

      expect(migrateLegacyStore(REG)).toBe(false);
      expect(readList("friends", REG)).toEqual([{ id: "mine" }]);
    });

    it("serves the legacy list before migration has run", () => {
      window.localStorage.setItem(LEGACY_FRIENDS_KEY, JSON.stringify([{ id: "old" }]));
      expect(readList("friends", REG)).toEqual([{ id: "old" }]);
    });

    it("tolerates corrupt legacy JSON", () => {
      window.localStorage.setItem(LEGACY_FRIENDS_KEY, "{not json");
      expect(migrateLegacyStore(REG)).toBe(false);
      expect(readList("friends", REG)).toEqual([]);
    });

    it("migrates nothing when the legacy keys are absent", () => {
      expect(migrateLegacyStore(REG)).toBe(false);
      expect(migrateLegacyStore("")).toBe(false);
    });
  });

  it("namespaces groups separately from friends", () => {
    expect(friendsKey(REG)).not.toBe(groupsKey(REG));
    writeList("friends", [{ id: "f" }], REG);
    expect(readList("groups", REG)).toEqual([]);
  });
});

describe("toCoarse", () => {
  it("keeps every slot key and strips every value", () => {
    const full = {
      "MON:A1": { c: "BACSE102", t: "Problem Solving Using Java", v: "AB1-607B" },
      "TUE:B1": { c: "BACSE105", t: "Data Structures", v: "AB1-609" },
    };
    const coarse = toCoarse(full);

    expect(Object.keys(coarse).sort()).toEqual(["MON:A1", "TUE:B1"]);
    for (const entry of Object.values(coarse)) {
      expect(entry).toEqual({});
      expect(entry.c).toBeUndefined();
      expect(entry.t).toBeUndefined();
      expect(entry.v).toBeUndefined();
    }
  });

  it("does not mutate the input", () => {
    const full = { "MON:A1": { c: "X", t: "Y", v: "Z" } };
    toCoarse(full);
    expect(full["MON:A1"]).toEqual({ c: "X", t: "Y", v: "Z" });
  });
});

describe("slot vocabulary invariants", () => {
  // Not snapshots: a config.json change is legitimate, but a change that
  // breaks these is not, and these are what make the difference loud.
  const slotMap = config.slotMap as Record<string, Record<string, { time: string }>>;

  it("has 164 slots", () => {
    const total = Object.values(slotMap).reduce(
      (sum, day) => sum + Object.keys(day).length,
      0
    );
    expect(total).toBe(164);
  });

  it("has a stable per-day shape", () => {
    const counts = Object.fromEntries(
      Object.entries(slotMap).map(([d, slots]) => [d, Object.keys(slots).length])
    );
    expect(counts).toEqual({
      MON: 24,
      TUE: 23,
      WED: 23,
      THU: 23,
      FRI: 23,
      SAT: 24,
      SUN: 24,
    });
  });

  it("treats every slot id as day-scoped, because 24 of them are", () => {
    const days: Record<string, string[]> = {};
    for (const [day, slots] of Object.entries(slotMap)) {
      for (const id of Object.keys(slots)) {
        (days[id] ??= []).push(day);
      }
    }
    const shared = Object.entries(days).filter(([, d]) => d.length > 1);
    expect(shared.length).toBe(24);
  });

  it("gives A1 a different time on MON and WED", () => {
    // The concrete proof that `slotId` alone cannot be a storage key.
    expect(slotMap.MON.A1.time).toBe("8:00-8:50");
    expect(slotMap.WED.A1.time).toBe("8:55-9:45");
  });

  it("carries a time and nothing else on every slot", () => {
    for (const slots of Object.values(slotMap)) {
      for (const entry of Object.values(slots)) {
        expect(Object.keys(entry)).toEqual(["time"]);
      }
    }
  });
});

describe("server-derived storage", () => {
  beforeEach(() => {
    window.localStorage.clear();
    setProfile({ registerNo: REG });
  });

  it("round-trips grant secrets under a reg-scoped key", () => {
    const grants = [{ grantId: "gr_1", secret: "abc", peerHandle: "AMZ-7K2P-9RTW" }];
    expect(writeGrants(grants, REG)).toBe(true);
    expect(readGrants(REG)).toEqual(grants);
    expect(window.localStorage.getItem(grantsKey(REG))).toBeTruthy();
  });

  it("never writes a grant secret to a global key", () => {
    writeGrants([{ grantId: "gr_1", secret: "topsecret" }], REG);
    const bare = Object.keys(window.localStorage).filter(
      (k) => !k.includes(REG) && k.startsWith("social_")
    );
    expect(bare).toEqual([]);
  });

  it("replaces grants wholesale rather than merging", () => {
    writeGrants([{ grantId: "gr_1", secret: "a" }], REG);
    writeGrants([{ grantId: "gr_2", secret: "b" }], REG);
    const stored = readGrants<{ grantId: string }>(REG);
    // A locally-orphaned secret would keep being sent on reads that 403.
    expect(stored.map((g) => g.grantId)).toEqual(["gr_2"]);
  });

  it("returns an empty list, not a throw, when nothing is stored", () => {
    expect(readGrants(REG)).toEqual([]);
    expect(readGrants("")).toEqual([]);
  });

  it("survives a corrupt grant blob", () => {
    window.localStorage.setItem(grantsKey(REG), "{not json");
    expect(readGrants(REG)).toEqual([]);
  });

  it("round-trips the derived identity and own timetable", () => {
    expect(writeIdentity({ handle: "AMZ-7K2P-9RTW" }, REG)).toBe(true);
    expect(readIdentity<{ handle: string }>(REG)?.handle).toBe("AMZ-7K2P-9RTW");

    expect(writeOwnTimetable({ busyMap: { "MON:A1": { c: "X" } } }, REG)).toBe(true);
    expect(readOwnTimetable<{ busyMap: object }>(REG)?.busyMap).toEqual({ "MON:A1": { c: "X" } });
  });

  it("caches peer timetables per handle", () => {
    writePeerTimetable("AMZ-7K2P-9RTW", { version: 1 }, REG);
    writePeerTimetable("AMZ-AAAA-BBBB", { version: 2 }, REG);
    expect(readPeerTimetable<{ version: number }>("AMZ-7K2P-9RTW", REG)?.version).toBe(1);
    expect(readPeerTimetable<{ version: number }>("AMZ-AAAA-BBBB", REG)?.version).toBe(2);
  });

  it("clears every peer timetable on a term switch", () => {
    writePeerTimetable("AMZ-7K2P-9RTW", { version: 1 }, REG);
    writePeerTimetable("AMZ-AAAA-BBBB", { version: 2 }, REG);
    clearPeerTimetables(REG);
    // A previous term's busy map is a different schedule, not a stale one.
    expect(readPeerTimetable("AMZ-7K2P-9RTW", REG)).toBeNull();
    expect(readPeerTimetable("AMZ-AAAA-BBBB", REG)).toBeNull();
  });

  it("clearing peer timetables leaves grants and identity intact", () => {
    writeGrants([{ grantId: "gr_1" }], REG);
    writeIdentity({ handle: "AMZ-7K2P-9RTW" }, REG);
    writePeerTimetable("AMZ-7K2P-9RTW", { version: 1 }, REG);
    clearPeerTimetables(REG);
    expect(readGrants(REG)).toHaveLength(1);
    expect(readIdentity(REG)).not.toBeNull();
  });

  it("scopes the peer cache to one account", () => {
    writePeerTimetable("AMZ-7K2P-9RTW", { version: 1 }, REG);
    expect(readPeerTimetable("AMZ-7K2P-9RTW", "22BCE9999")).toBeNull();
  });

  it("_resetForTests removes every key this module owns", () => {
    writeGrants([{ grantId: "gr_1" }], REG);
    writeIdentity({ handle: "AMZ-7K2P-9RTW" }, REG);
    writeOwnTimetable({ busyMap: {} }, REG);
    writePeerTimetable("AMZ-7K2P-9RTW", { version: 1 }, REG);
    writeList("friends", [{ id: "1" }], REG);
    _resetForTests(REG);
    expect(readGrants(REG)).toEqual([]);
    expect(readIdentity(REG)).toBeNull();
    expect(readOwnTimetable(REG)).toBeNull();
    expect(readPeerTimetable("AMZ-7K2P-9RTW", REG)).toBeNull();
    expect(readList("friends", REG)).toEqual([]);
  });
});
