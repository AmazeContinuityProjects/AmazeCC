import { describe, expect, it, vi, beforeEach } from "vitest";
import "../lib/sync-engine/operations";
import { getOp, registerOp, allOps } from "../lib/sync-engine/operation-registry";
import {
  BUILT_IN_MODES,
  MAX_MODE_STEPS,
  BULK_ENDPOINT_META,
  collapseBulkSteps,
  createCustomMode,
  deleteCustomMode,
  duplicateMode,
  estimateModeCost,
  expandBulkSteps,
  foregroundSteps,
  backgroundSteps,
  listModes,
  loadCustomModes,
  resolveMode,
  updateCustomMode,
  validateMode,
  CUSTOM_MODES_KEY,
} from "../lib/sync-engine/sync-modes";
import { syncEngine } from "../lib/sync-engine/index";

const KNOWN = [
  "attendanceMarks",
  "marksStats",
  "core",
  "grades",
  "schedule",
  "hostel",
  "calendar",
  "all-grades",
  "profile-images",
  "studentProfile",
  "pastAttendance",
  "fresher",
  "buses",
  "transport",
  "events",
  "bulk",
  "lms",
  "officialOd",
  "social",
];

beforeEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
  // Reset the engine's logged-in ids between runner tests.
  (syncEngine as any).ids = null;
});

/** jsdom hands vitest an opaque origin, so `localStorage` is absent — install
 * the same in-memory stub the other engine tests use (see marksStatsOp). */
function installLocalStorage() {
  const map = new Map<string, string>();
  const stub: Storage = {
    get length() {
      return map.size;
    },
    key: (i: number) => Array.from(map.keys())[i] ?? null,
    getItem: (k: string) => (map.has(k) ? map.get(k)! : null),
    setItem: (k: string, v: string) => void map.set(k, String(v)),
    removeItem: (k: string) => void map.delete(k),
    clear: () => map.clear(),
  };
  Object.defineProperty(globalThis, "localStorage", {
    value: stub,
    configurable: true,
    writable: true,
  });
  if (typeof window !== "undefined") {
    Object.defineProperty(window, "localStorage", {
      value: stub,
      configurable: true,
      writable: true,
    });
  }
  return stub;
}

installLocalStorage();

describe("built-in modes", () => {
  it("every step references a registered op", () => {
    const registered = new Set(allOps().map((o) => o.name));
    for (const mode of BUILT_IN_MODES) {
      expect(validateMode(mode, registered).ok, mode.id).toBe(true);
      for (const s of mode.steps) {
        expect(getOp(s.op), `${mode.id}:${s.op}`).toBeDefined();
      }
    }
  });

  it("validates against the live registry with no explicit list", () => {
    for (const mode of BUILT_IN_MODES) {
      expect(validateMode(mode).ok, mode.id).toBe(true);
    }
  });

  it("quick is the lightest, full covers every background op", () => {
    const quick = BUILT_IN_MODES.find((m) => m.id === "quick")!;
    const full = BUILT_IN_MODES.find((m) => m.id === "full")!;
    expect(foregroundSteps(quick).map((s) => s.op)).toEqual(["attendanceMarks"]);
    expect(estimateModeCost(quick).score).toBeLessThan(estimateModeCost(full).score);
    expect(full.steps.some((s) => s.op === "social")).toBe(true);
  });

  it("resolveMode finds built-ins and customs", () => {
    expect(resolveMode("quick")?.label).toBe("Quick Sync");
    expect(resolveMode("nope")).toBeUndefined();
    const custom = createCustomMode({ label: "Mine", steps: [{ op: "buses" }] });
    expect(resolveMode(custom.id, [custom])?.builtIn).toBe(false);
    expect(listModes([custom]).length).toBe(BUILT_IN_MODES.length + 1);
  });
});

describe("validateMode", () => {
  it("rejects empty, unknown, oversized and untitled modes", () => {
    expect(validateMode({ id: "x", label: "X", steps: [] }, KNOWN).ok).toBe(false);
    expect(
      validateMode({ id: "x", label: "X", steps: [{ op: "nope" }] }, KNOWN).errors,
    ).toContain("Unknown op: nope");
    expect(
      validateMode(
        { id: "x", label: "X", steps: Array.from({ length: MAX_MODE_STEPS + 1 }, () => ({ op: "buses" })) },
        KNOWN,
      ).ok,
    ).toBe(false);
    expect(validateMode({ id: "x", label: "  ", steps: [{ op: "buses" }] }, KNOWN).ok).toBe(false);
    expect(validateMode(null, KNOWN).ok).toBe(false);
  });
});

describe("granular op subsets", () => {
  function fakeCtx(calls: string[]) {
    return {
      ids: { VtopUsername: "u", VtopPassword: "p" },
      emit: () => {},
      bridge: { setAtom: () => {}, getAtom: () => undefined },
      request: async (path: string, body?: unknown) => {
        calls.push(path);
        if (path === "grades") return { success: true, grades: {} };
        if (path === "profile-images") return { success: true };
        return { success: true };
      },
    } as any;
  }

  it("core `only` fetches a subset without touching the rest", async () => {
    const calls: string[] = [];
    const core = getOp("core")!;
    await core.run(fakeCtx(calls), { semesterId: "S1", only: ["grades"] });
    expect(calls).toEqual(["grades"]);
  });

  it("core without `only` keeps the full six-module bundle", async () => {
    const calls: string[] = [];
    await getOp("core")!.run(fakeCtx(calls), { semesterId: "S1", isHosteller: true });
    expect(calls.sort()).toEqual(
      ["grades", "schedule", "hostel", "calendar", "all-grades", "profile-images"].sort(),
    );
  });

  it("bulk `only` caches a subset of endpoints", async () => {
    const calls: string[] = [];
    const res = (await getOp("bulk")!.run(fakeCtx(calls), {
      settings: {},
      only: ["library-due", "bogus-endpoint"],
    })) as { endpoints: string[] };
    expect(calls).toEqual(["library-due"]);
    expect(res.endpoints).toEqual(["library-due"]);
  });

  it("standalone child ops persist individually", async () => {
    const calls: string[] = [];
    await getOp("grades")!.run(fakeCtx(calls), { semesterId: "S1" });
    await getOp("calendar")!.run(fakeCtx(calls), { semesterId: "S1" });
    expect(calls).toEqual(["grades", "calendar"]);
    expect(JSON.parse(localStorage.getItem("grades") || "null")).toEqual({
      success: true,
      grades: {},
    });
  });
});

describe("syncMode runner", () => {
  beforeEach(() => {
    // Bypass login: the runner only needs ids present; `sync` itself is mocked.
    (syncEngine as any).ids = { VtopUsername: "u", VtopPassword: "p" };
  });

  it("runs foreground sequentially and collects background concurrently", async () => {
    const order: string[] = [];
    vi.spyOn(syncEngine, "sync").mockImplementation(async (name: string) => {
      order.push(name);
      return name;
    });
    const res = await syncEngine.syncMode("academics", { semesterId: "S1" });
    expect(order).toEqual([
      "attendanceMarks",
      "marksStats",
      "grades",
      "schedule",
      "calendar",
      "all-grades",
    ]);
    expect(res.aborted).toBe(false);
    expect(res.errors).toEqual([]);
    expect(res.results.map((r) => r.op)).toEqual(order);
  });

  it("aborts the foreground chain on a critical failure but still settles background", async () => {
    registerOp({
      name: "__crit_test",
      auth: "none",
      critical: true,
      async run() {
        throw new Error("boom");
      },
    });
    const seen: string[] = [];
    vi.spyOn(syncEngine, "sync").mockImplementation(async (name: string) => {
      seen.push(name);
      if (name === "__crit_test") throw new Error("boom");
      return name;
    });
    // Route through a custom mode so the temp op can lead the chain.
    const custom = createCustomMode({
      label: "Abort",
      steps: [{ op: "__crit_test" }, { op: "buses" }, { op: "fresher", background: true }],
    });
    const res = await syncEngine.syncMode(custom.id, {});
    expect(res.aborted).toBe(true);
    expect(res.errors.map((e) => e.op)).toEqual(["__crit_test"]);
    // Foreground `buses` skipped; background `fresher` still attempted.
    expect(seen).toEqual(["__crit_test", "fresher"]);
  });

  it("non-critical foreground failures do not abort", async () => {
    vi.spyOn(syncEngine, "sync").mockImplementation(async (name: string) => {
      if (name === "marksStats") throw new Error("stats down");
      return name;
    });
    const res = await syncEngine.syncMode("quick", { semesterId: "S1" });
    expect(res.aborted).toBe(false);
    expect(res.errors.map((e) => e.op)).toEqual(["marksStats"]);
  });

  it("throws on unknown modes", async () => {
    vi.spyOn(syncEngine, "sync").mockResolvedValue(null);
    await expect(syncEngine.syncMode("nope", {})).rejects.toThrow("Unknown sync mode");
  });

  it("legacy syncAll still runs the balanced sweep", async () => {
    const seen: string[] = [];
    vi.spyOn(syncEngine, "sync").mockResolvedValue(null as any);
    const spy = vi.mocked(syncEngine.sync);
    spy.mockImplementation(async (name: string) => {
      seen.push(name);
      return null;
    });
    await syncEngine.syncAll({ semesterId: "S1" });
    expect(seen.slice(0, 4)).toEqual(["attendanceMarks", "marksStats", "core", "studentProfile"]);
    expect(seen).toContain("bulk");
  });
});

describe("bulk endpoint expand/collapse", () => {
  it("expands a bare bulk step to every endpoint", () => {
    const { steps, bulkEndpoints, bulkPos } = expandBulkSteps([
      { op: "grades" },
      { op: "bulk" },
    ]);
    expect(steps.map((s) => s.op)).toEqual(["grades"]);
    expect(bulkEndpoints.sort()).toEqual(BULK_ENDPOINT_META.map((m) => m.endpoint).sort());
    expect(bulkPos).toBe(1);
  });

  it("expands an `only` bulk step to just those endpoints", () => {
    const { bulkEndpoints } = expandBulkSteps([
      { op: "bulk", args: { only: ["library-due", "wallet"] } },
    ]);
    expect(bulkEndpoints).toEqual(["library-due", "wallet"]);
  });

  it("collapses a full house back to a bare bulk step", () => {
    const all = BULK_ENDPOINT_META.map((m) => m.endpoint);
    expect(
      collapseBulkSteps([{ op: "grades" }], all, 1),
    ).toEqual([{ op: "grades" }, { op: "bulk" }]);
  });

  it("collapses a subset into `only`, preserving position", () => {
    const steps = collapseBulkSteps(
      [{ op: "grades" }, { op: "events" }],
      ["library-due", "wallet"],
      1,
    );
    expect(steps).toEqual([
      { op: "grades" },
      { op: "bulk", args: { only: ["library-due", "wallet"] } },
      { op: "events" },
    ]);
  });

  it("drops unknown endpoints and the bulk step when empty", () => {
    expect(collapseBulkSteps([{ op: "grades" }], ["bogus"], 0)).toEqual([{ op: "grades" }]);
    expect(collapseBulkSteps([{ op: "grades" }], [], 0)).toEqual([{ op: "grades" }]);
  });

  it("round-trips edit -> save without losing order", () => {
    const mode = createCustomMode({
      label: "Roundtrip",
      steps: [
        { op: "grades" },
        { op: "bulk", args: { only: ["library-due"] } },
        { op: "events", background: true },
      ],
    });
    const stored = loadCustomModes().find((m) => m.id === mode.id)!;
    const { steps, bulkEndpoints, bulkPos } = expandBulkSteps(stored.steps);
    const collapsed = collapseBulkSteps(steps, [...bulkEndpoints, "wallet"], bulkPos);
    updateCustomMode(mode.id, { steps: collapsed });
    expect(loadCustomModes().find((m) => m.id === mode.id)!.steps).toEqual([
      { op: "grades" },
      { op: "bulk", args: { only: ["library-due", "wallet"] } },
      { op: "events", background: true },
    ]);
  });
});

describe("custom mode persistence", () => {
  it("round-trips create/update/duplicate/delete", () => {
    const created = createCustomMode({
      label: "My Exams",
      steps: [{ op: "grades" }, { op: "schedule", background: true }],
    });
    expect(loadCustomModes().map((m) => m.id)).toContain(created.id);

    const updated = updateCustomMode(created.id, { label: "My Exams v2" });
    expect(updated.label).toBe("My Exams v2");
    expect(loadCustomModes()[0].label).toBe("My Exams v2");

    const copy = duplicateMode(updated);
    expect(copy.id).not.toBe(updated.id);
    expect(copy.steps).toEqual(updated.steps);
    expect(loadCustomModes().length).toBe(2);

    deleteCustomMode(created.id);
    deleteCustomMode(copy.id);
    expect(loadCustomModes()).toEqual([]);
  });

  it("rejects invalid creations and drops corrupt stored entries", () => {
    expect(() => createCustomMode({ label: "Bad", steps: [{ op: "nope" }] })).toThrow();
    expect(() => createCustomMode({ label: "  ", steps: [{ op: "buses" }] })).toThrow();
    localStorage.setItem(
      CUSTOM_MODES_KEY,
      JSON.stringify([{ id: "x", label: "", steps: [] }, "garbage", null]),
    );
    expect(loadCustomModes()).toEqual([]);
  });

  it("ignores ids that collide with built-ins", () => {
    localStorage.setItem(
      CUSTOM_MODES_KEY,
      JSON.stringify([{ id: "quick", label: "Fake", builtIn: false, steps: [{ op: "buses" }] }]),
    );
    expect(loadCustomModes()).toEqual([]);
    expect(resolveMode("quick")?.builtIn).toBe(true);
  });

  it("backgroundSteps/foregroundSteps split correctly", () => {
    const full = resolveMode("full")!;
    expect(foregroundSteps(full).every((s) => !s.background)).toBe(true);
    expect(backgroundSteps(full).length).toBeGreaterThan(0);
    expect(foregroundSteps(full).length + backgroundSteps(full).length).toBe(full.steps.length);
  });
});
