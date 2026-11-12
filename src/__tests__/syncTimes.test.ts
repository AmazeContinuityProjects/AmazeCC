import { installLocalStorage } from "./helpers/localStorage";
installLocalStorage();
import { beforeEach, describe, expect, it } from "vitest";
import { formatSyncAge, getSyncTimes, lastSyncedAt, recordSyncTime } from "../lib/syncTimes";

const MIN = 60_000;
const HOUR = 60 * MIN;

describe("formatSyncAge", () => {
  const now = 1_800_000_000_000;
  it.each([
    [now - 10_000, "just now"],
    [now - 5 * MIN, "5 min ago"],
    [now - 3 * HOUR, "3 h ago"],
    [now - 26 * HOUR, "yesterday"],
    [now - 4 * 24 * HOUR, "4 days ago"],
    [now + 5_000, "just now"],
  ])("%d -> %s", (at, label) => {
    expect(formatSyncAge(at, now)).toBe(label);
  });
});

describe("sync time store", () => {
  beforeEach(() => localStorage.clear());

  it("records per op and returns the newest of a group", () => {
    recordSyncTime("grades", 1000);
    recordSyncTime("all-grades", 3000);
    expect(getSyncTimes()).toMatchObject({ grades: 1000, "all-grades": 3000 });
    expect(lastSyncedAt(["grades", "all-grades"])).toBe(3000);
    expect(lastSyncedAt(["never-ran"])).toBeNull();
  });

  it("persists to localStorage", () => {
    recordSyncTime("calendar", 42);
    expect(JSON.parse(localStorage.getItem("sync_times") || "{}").calendar).toBe(42);
  });
});

describe("sync failures", () => {
  beforeEach(() => localStorage.clear());

  it("reports a failure newer than the last success, with its args", async () => {
    const { recordSyncFailure, clearSyncFailure, openFailure } = await import("../lib/syncTimes");
    recordSyncTime("schedule", 1000);
    recordSyncFailure("schedule", "VTOP timed out", { semesterId: "CH20262705" }, 2000);
    expect(openFailure(["schedule"])).toMatchObject({ op: "schedule", args: { semesterId: "CH20262705" } });

    // A later success closes it.
    recordSyncTime("schedule", 3000);
    expect(openFailure(["schedule"])).toBeNull();

    recordSyncFailure("schedule", "again", {}, 4000);
    clearSyncFailure("schedule");
    expect(openFailure(["schedule"])).toBeNull();
  });
});
