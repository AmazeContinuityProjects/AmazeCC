import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import { getDefaultStore } from "jotai";
import { isLoggedInAtom } from "../store";
import { storage } from "../lib/storage";
import { syncEngine } from "@/lib/sync-engine";
import {
  notifyCatalogGradesChanged,
  resetCatalogGradesBackfillForTests,
  useCatalogGrades,
} from "../components/custom/exams/FFCS/hooks/useCatalogGrades";
import { installLocalStorage } from "./helpers/localStorage";
import { courseGrade } from "../lib/ffcsPlannerGrades";

// The hook only ever touches the engine through `syncBackground`; stubbing the
// module keeps the real engine (and any VTOP reachability) out of the test.
vi.mock("@/lib/sync-engine", () => ({
  syncEngine: { syncBackground: vi.fn() },
}));

const local = installLocalStorage();

const item = (courseCode: string, grade: string) => ({
  slNo: "1",
  courseCode,
  courseTitle: `Title of ${courseCode}`,
  courseType: "Theory",
  grandTotal: "85",
  grade,
  courseId: null,
});

const allGrades = {
  grades: {
    CH20242501: { gpa: "8.5", grades: [item("BCSE101", "S"), item("BCSE102", "B")] },
    CH20252601: { gpa: "9.0", grades: [item("BCSE103", "F")] },
  },
};

const backfill = vi.mocked(syncEngine.syncBackground);

describe("useCatalogGrades", () => {
  beforeEach(() => {
    resetCatalogGradesBackfillForTests();
    backfill.mockReset();
  });

  afterEach(() => {
    getDefaultStore().set(isLoggedInAtom, false);
    local.clear();
  });

  it("stays null while logged out, even with a cached payload", () => {
    storage.allGrades.set(allGrades);

    const { result } = renderHook(() => useCatalogGrades());

    expect(result.current).toBeNull();
    expect(backfill).not.toHaveBeenCalled();
  });

  it("reads a cached payload when logged in, without fetching", async () => {
    storage.allGrades.set(allGrades);
    getDefaultStore().set(isLoggedInAtom, true);

    const { result } = renderHook(() => useCatalogGrades());

    await waitFor(() => expect(result.current).not.toBeNull());
    expect(result.current?.size).toBe(3);
    expect(courseGrade("BCSE101", result.current)?.disposition).toBe("completed");
    expect(courseGrade("BCSE102", result.current)?.disposition).toBe("improvement");
    expect(courseGrade("BCSE103", result.current)?.disposition).toBe("retry");
    expect(backfill).not.toHaveBeenCalled();
  });

  // `all-grades` is part of the academics mode only, so most sync modes leave
  // the cache empty — the hook fills it itself, once per page session.
  it("backfills a missing payload once and picks up what it persisted", async () => {
    backfill.mockImplementation(async () => {
      storage.allGrades.set(allGrades); // the op's own persistence
    });
    getDefaultStore().set(isLoggedInAtom, true);

    const { result } = renderHook(() => useCatalogGrades());
    expect(result.current).toBeNull();

    await waitFor(() => expect(result.current).not.toBeNull());
    expect(backfill).toHaveBeenCalledTimes(1);
    expect(backfill).toHaveBeenCalledWith("all-grades", {});
    expect(result.current?.size).toBe(3);
  });

  it("shares a single backfill across every picker instance", async () => {
    backfill.mockResolvedValue(undefined);
    getDefaultStore().set(isLoggedInAtom, true);

    const searchSheet = renderHook(() => useCatalogGrades());
    const targetModal = renderHook(() => useCatalogGrades());

    await waitFor(() => expect(backfill).toHaveBeenCalledTimes(1));
    expect(searchSheet.result.current).toBeNull();
    expect(targetModal.result.current).toBeNull();
  });

  it("applies no rules when the backfill fails", async () => {
    backfill.mockRejectedValue(new Error("VTOP unreachable"));
    getDefaultStore().set(isLoggedInAtom, true);

    const { result } = renderHook(() => useCatalogGrades());

    // The rejection is caught: no throw, no index — the same honest
    // "no grades yet" state as never having tried.
    await waitFor(() => expect(backfill).toHaveBeenCalledTimes(1));
    expect(result.current).toBeNull();
  });

  // The integration sheet's "Integrate now" runs its own page sync, which
  // writes the cache and announces it; localStorage has no same-tab change
  // events, so the announce is what refreshes open pickers without a remount.
  it("re-reads when an explicit sync announces fresh grades", () => {
    backfill.mockResolvedValue(undefined); // the silent backfill stays quiet
    getDefaultStore().set(isLoggedInAtom, true);
    const { result } = renderHook(() => useCatalogGrades());
    expect(result.current).toBeNull();

    storage.allGrades.set(allGrades);
    act(() => notifyCatalogGradesChanged());

    expect(result.current?.size).toBe(3);
    expect(courseGrade("BCSE103", result.current)?.grade).toBe("F");
  });

  it("forgets the cached index the moment the student logs out", async () => {
    storage.allGrades.set(allGrades);
    getDefaultStore().set(isLoggedInAtom, true);
    const { result, unmount } = renderHook(() => useCatalogGrades());
    await waitFor(() => expect(result.current).not.toBeNull());

    getDefaultStore().set(isLoggedInAtom, false);
    unmount();

    // A fresh mount after logout must not leak the previous student's grades.
    const next = renderHook(() => useCatalogGrades());
    expect(next.result.current).toBeNull();
  });

  // The planner setting `integrateCurriculumAndGrades` gates everything: off,
  // no grades are read into the pickers AT ALL, whatever is cached.
  it("returns null and fetches nothing when the integration is off", async () => {
    storage.allGrades.set(allGrades);
    getDefaultStore().set(isLoggedInAtom, true);

    const { result } = renderHook(() => useCatalogGrades({ enabled: false }));

    expect(result.current).toBeNull();
    expect(backfill).not.toHaveBeenCalled();
  });

  it("switches back on with the setting, without a remount", async () => {
    storage.allGrades.set(allGrades);
    getDefaultStore().set(isLoggedInAtom, true);

    const { result, rerender } = renderHook(({ enabled }: { enabled: boolean }) => useCatalogGrades({ enabled }), {
      initialProps: { enabled: false },
    });
    expect(result.current).toBeNull();

    rerender({ enabled: true });
    await waitFor(() => expect(result.current).not.toBeNull());
    expect(result.current?.size).toBe(3);
  });
});
