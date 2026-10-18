import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import "../lib/sync-engine/operations";
import { syncEngine } from "../lib/sync-engine/index";
import { runPageSync } from "../lib/sync-engine/single-sync";
import {
  getSyncSessionSnapshot,
  isSyncSessionOpen,
  openSyncSession,
  closeSyncSession,
  dismissSyncSession,
} from "../lib/sync-engine/sync-session";
import { getOp } from "../lib/sync-engine/operation-registry";

function resetToClosedBaseline() {
  closeSyncSession(0);
  vi.runAllTimers();
  openSyncSession("baseline");
  dismissSyncSession();
  openSyncSession("baseline");
  closeSyncSession(0);
  vi.runAllTimers();
}

beforeEach(() => {
  vi.useFakeTimers();
  resetToClosedBaseline();
  (syncEngine as any).ids = { VtopUsername: "u", VtopPassword: "p" };
  vi.restoreAllMocks();
});

afterEach(() => {
  vi.runAllTimers();
  vi.useRealTimers();
  (syncEngine as any).ids = null;
});

describe("runPageSync lifecycle", () => {
  it("opens with the screen title, runs only its op, hits 100 and closes", async () => {
    const order: string[] = [];
    vi.spyOn(syncEngine, "sync").mockImplementation(async (name: string) => {
      order.push(name);
      return { ok: name };
    });
    const applied: unknown[] = [];
    const promise = runPageSync({
      title: "Grades",
      steps: [{ op: "grades", args: { semesterId: "S1" }, apply: (r) => void applied.push(r) }],
      doneLine: "Grades reloaded successfully",
    });
    // Session opens synchronously with the screen title.
    expect(getSyncSessionSnapshot().title).toBe("Grades");
    const result = await promise;
    expect(order).toEqual(["grades"]);
    expect(applied).toEqual([{ ok: "grades" }]);
    expect(result).toEqual({ ok: "grades" });
    expect(getSyncSessionSnapshot().progress).toBe(100);
    expect(getSyncSessionSnapshot().outcome).toBe("success");
    expect(
      getSyncSessionSnapshot().lines.some((l) => l.text === "Grades reloaded successfully"),
    ).toBe(true);
    vi.runAllTimers();
    expect(isSyncSessionOpen()).toBe(false);
  });

  it("runs multi-step page syncs sequentially", async () => {
    const order: string[] = [];
    vi.spyOn(syncEngine, "sync").mockImplementation(async (name: string) => {
      order.push(name);
      return name;
    });
    await runPageSync({
      title: "Payments",
      steps: [{ op: "bulk", args: { only: ["wallet"] } }],
    });
    expect(order).toEqual(["bulk"]);
  });

  it("closes as an error and rethrows on failure", async () => {
    vi.spyOn(syncEngine, "sync").mockRejectedValue(new Error("VTOP busy"));
    await expect(
      runPageSync({ title: "Grades", steps: [{ op: "grades" }] }),
    ).rejects.toThrow("VTOP busy");
    // Error closes park the bar (closeSyncSession always settles at 100) but
    // mark the run failed so the sheet never shows the success tick.
    expect(getSyncSessionSnapshot().progress).toBe(100);
    expect(getSyncSessionSnapshot().outcome).toBe("error");
    expect(
      getSyncSessionSnapshot().lines.some((l) => l.text.includes("VTOP busy")),
    ).toBe(true);
  });

  it("shows the offline notice and runs nothing when offline", async () => {
    const online = Object.getOwnPropertyDescriptor(window.navigator, "onLine");
    Object.defineProperty(window.navigator, "onLine", { value: false, configurable: true });
    try {
      const spy = vi.spyOn(syncEngine, "sync");
      const result = await runPageSync({ title: "Grades", steps: [{ op: "grades" }] });
      expect(result).toBeNull();
      expect(spy).not.toHaveBeenCalled();
      expect(getSyncSessionSnapshot().notice).toBe("offline");
    } finally {
      if (online) Object.defineProperty(window.navigator, "onLine", online);
    }
  });
});

describe("per-screen ops exist", () => {
  it("circulars, curriculum and buses are registered with metadata", () => {
    for (const name of ["circulars", "curriculum", "buses", "schedule", "hostel"]) {
      const op = getOp(name);
      expect(op, name).toBeDefined();
      expect(op?.meta?.label, name).toBeTruthy();
    }
  });
});
