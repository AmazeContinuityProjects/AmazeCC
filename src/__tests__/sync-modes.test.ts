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
  resolveReloadModeId,
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
  "coursePage",
  "studentProfile",
  "pastAttendance",
  "fresher",
  "buses",
  "transport",
  "events",
  "bulk",
  "lms",
  "officialOd",
  "curriculum",
  "qcm",
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

  it("daily is the lightest, quarterly covers every op, tiers are cumulative", () => {
    const daily = BUILT_IN_MODES.find((m) => m.id === "daily")!;
    const weekly = BUILT_IN_MODES.find((m) => m.id === "weekly")!;
    const monthly = BUILT_IN_MODES.find((m) => m.id === "monthly")!;
    const quarterly = BUILT_IN_MODES.find((m) => m.id === "quarterly")!;

    const opsOf = (m: (typeof BUILT_IN_MODES)[number]) => m.steps.map((s) => s.op);
    const contains = (a: string[], b: string[]) => b.every((op) => a.includes(op));
    expect(contains(opsOf(weekly), opsOf(daily))).toBe(true);
    expect(contains(opsOf(monthly), opsOf(weekly))).toBe(true);
    expect(contains(opsOf(quarterly), opsOf(monthly))).toBe(true);

    expect(opsOf(daily)).toEqual(["attendanceMarks", "marksStats", "hostel"]);
    expect(estimateModeCost(daily).score).toBeLessThan(estimateModeCost(quarterly).score);
    expect(opsOf(quarterly)).toContain("whoami");
    // Curriculum is a monthly-tier op and must not run in the shallow tiers.
    expect(opsOf(daily)).not.toContain("curriculum");
    expect(opsOf(weekly)).not.toContain("curriculum");
    expect(opsOf(monthly)).toContain("curriculum");
  });

  it("resolveMode finds built-ins and customs", () => {
    expect(resolveMode("daily")?.label).toBe("Daily Sync");
    expect(resolveMode("nope")).toBeUndefined();
    const custom = createCustomMode({ label: "Mine", steps: [{ op: "buses" }] });
    expect(resolveMode(custom.id, [custom])?.builtIn).toBe(false);
    expect(listModes([custom]).length).toBe(BUILT_IN_MODES.length + 1);
  });
});

describe("resolveReloadModeId", () => {
  it("forces the quarterly tier on a semester switch, whatever was asked for", () => {
    // Every cache — attendance, marks, grades — is keyed to the term just
    // left, so a switch outranks an explicit quick request…
    expect(resolveReloadModeId({ switchedSemester: true, modeId: "daily" })).toBe("quarterly");
    // …the saved default…
    expect(resolveReloadModeId({ switchedSemester: true, defaultSyncMode: "weekly" })).toBe("quarterly");
    // …and even an explicit choice of another tier: the caller picked a
    // semester, not a sweep, and the quarterly tier is the only one a new
    // term can trust.
    expect(resolveReloadModeId({ switchedSemester: true, modeId: "weekly" })).toBe("quarterly");
    expect(resolveReloadModeId({ switchedSemester: true, modeId: "daily", defaultSyncMode: "monthly" })).toBe(
      "quarterly",
    );
  });

  it("keeps explicit mode, then default, then the auto sweep when no switch happened", () => {
    expect(resolveReloadModeId({ switchedSemester: false, modeId: "weekly" })).toBe("weekly");
    // An explicit mode also outranks the saved default (the palette passes
    // one on purpose).
    expect(resolveReloadModeId({ switchedSemester: false, modeId: "daily", defaultSyncMode: "quarterly" })).toBe(
      "daily",
    );
    expect(resolveReloadModeId({ switchedSemester: false, defaultSyncMode: "monthly" })).toBe("monthly");
    expect(resolveReloadModeId({ switchedSemester: false })).toBe("quarterly");
  });

  it("resolves to a mode the engine can actually run", () => {
    const id = resolveReloadModeId({ switchedSemester: true });
    expect(resolveMode(id)?.id).toBe("quarterly");
  });
});

describe("validateMode", () => {
  it("rejects empty, unknown, oversized and untitled modes", () => {
    expect(validateMode({ id: "x", label: "X", steps: [] }, KNOWN).ok).toBe(false);
    expect(validateMode({ id: "x", label: "X", steps: [{ op: "nope" }] }, KNOWN).errors).toContain("Unknown op: nope");
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

  it("core without `only` keeps the full bundle", async () => {
    const calls: string[] = [];
    await getOp("core")!.run(fakeCtx(calls), { semesterId: "S1", isHosteller: true });
    // Grades and all-grades share the unified /api/grades call; the exam
    // schedule is extracted from /api/ffcs.
    expect(calls.sort()).toEqual(["grades", "ffcs", "hostel", "calendar"].sort());
  });

  it("bulk `only` caches a subset of endpoints", async () => {
    const calls: string[] = [];
    const res = (await getOp("bulk")!.run(fakeCtx(calls), {
      settings: {},
      only: ["library-due", "bogus-endpoint"],
    })) as { endpoints: string[] };
    expect(res.endpoints).toEqual(["library-due"]);
    // library-due is a finance section, so it rides in one /api/finance call.
    expect(calls).toEqual(["finance"]);
  });

  it("bulk sends batchable endpoints to /api/bulk in a single call", async () => {
    const calls: string[] = [];
    await getOp("bulk")!.run(fakeCtx(calls), { settings: {} });
    // Finance sections ride in one /api/finance call, the remaining batchable
    // endpoints in one /api/bulk call. `minor-honour` is gone from the API, so
    // it is no longer requested at all.
    expect(calls.filter((c) => c === "finance").length).toBe(1);
    expect(calls.filter((c) => c === "bulk").length).toBe(1);
    expect(calls.sort()).toEqual(["bulk", "finance"]);
    expect(calls).not.toContain("minor-honour");
  });

  it("standalone child ops persist individually", async () => {
    const calls: string[] = [];
    await getOp("grades")!.run(fakeCtx(calls), { semesterId: "S1" });
    await getOp("calendar")!.run(fakeCtx(calls), { semesterId: "S1" });
    expect(calls).toEqual(["grades", "calendar"]);
    // The grades op adapts the unified /api/grades payload into the legacy
    // summary shape before persisting it.
    expect(JSON.parse(localStorage.getItem("grades") || "null")).toEqual({
      effectiveGrades: [],
      curriculum: [],
      cgpa: {},
      success: true,
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
    const res = await syncEngine.syncMode("monthly", { semesterId: "S1" });
    expect(order).toEqual([
      // Foreground, in order.
      "attendanceMarks",
      "grades",
      "all-grades",
      "calendar",
      // Background steps follow, in declaration order.
      "marksStats",
      "hostel",
      "ffcs",
      "coursePage",
      "bulk",
      "transport",
      "events",
      "buses",
      "lms",
      "circulars",
      "officialOd",
      "curriculum",
      "fresher",
      "pastAttendance",
      "social",
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
    const res = await syncEngine.syncMode("daily", { semesterId: "S1" });
    expect(res.aborted).toBe(false);
    expect(res.errors.map((e) => e.op)).toEqual(["marksStats"]);
  });

  it("throws on unknown modes", async () => {
    vi.spyOn(syncEngine, "sync").mockResolvedValue(null);
    await expect(syncEngine.syncMode("nope", {})).rejects.toThrow("Unknown sync mode");
  });

  it("legacy syncAll runs the quarterly tier (everything due, cadence-pruned)", async () => {
    const seen: string[] = [];
    vi.spyOn(syncEngine, "sync").mockResolvedValue(null as any);
    const spy = vi.mocked(syncEngine.sync);
    spy.mockImplementation(async (name: string) => {
      seen.push(name);
      return null;
    });
    await syncEngine.syncAll({ semesterId: "S1" });
    // Foreground ops first, in order.
    expect(seen.slice(0, 4)).toEqual(["attendanceMarks", "grades", "all-grades", "calendar"]);
    expect(seen).toContain("bulk");
    // Quarterly tier adds identity — nothing else includes it.
    expect(seen).toContain("whoami");
    expect(seen.indexOf("whoami")).toBeGreaterThan(seen.indexOf("all-grades"));
  });
});

describe("bulk endpoint expand/collapse", () => {
  it("expands a bare bulk step to every endpoint", () => {
    const { steps, bulkEndpoints, bulkPos } = expandBulkSteps([{ op: "grades" }, { op: "bulk" }]);
    expect(steps.map((s) => s.op)).toEqual(["grades"]);
    expect(bulkEndpoints.sort()).toEqual(BULK_ENDPOINT_META.map((m) => m.endpoint).sort());
    expect(bulkPos).toBe(1);
  });

  it("expands an `only` bulk step to just those endpoints", () => {
    const { bulkEndpoints } = expandBulkSteps([{ op: "bulk", args: { only: ["library-due", "wallet"] } }]);
    expect(bulkEndpoints).toEqual(["library-due", "wallet"]);
  });

  it("collapses a full house back to a bare bulk step", () => {
    const all = BULK_ENDPOINT_META.map((m) => m.endpoint);
    expect(collapseBulkSteps([{ op: "grades" }], all, 1)).toEqual([{ op: "grades" }, { op: "bulk" }]);
  });

  it("collapses a subset into `only`, preserving position", () => {
    const steps = collapseBulkSteps([{ op: "grades" }, { op: "events" }], ["library-due", "wallet"], 1);
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
      steps: [{ op: "grades" }, { op: "bulk", args: { only: ["library-due"] } }, { op: "events", background: true }],
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
    localStorage.setItem(CUSTOM_MODES_KEY, JSON.stringify([{ id: "x", label: "", steps: [] }, "garbage", null]));
    expect(loadCustomModes()).toEqual([]);
  });

  it("ignores ids that collide with built-ins", () => {
    localStorage.setItem(
      CUSTOM_MODES_KEY,
      JSON.stringify([{ id: "daily", label: "Fake", builtIn: false, steps: [{ op: "buses" }] }]),
    );
    expect(loadCustomModes()).toEqual([]);
    expect(resolveMode("daily")?.builtIn).toBe(true);
  });

  it("backgroundSteps/foregroundSteps split correctly", () => {
    const monthly = resolveMode("monthly")!;
    expect(foregroundSteps(monthly).every((s) => !s.background)).toBe(true);
    expect(backgroundSteps(monthly).length).toBeGreaterThan(0);
    expect(foregroundSteps(monthly).length + backgroundSteps(monthly).length).toBe(monthly.steps.length);
  });
});
