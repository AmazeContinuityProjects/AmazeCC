import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import { getDefaultStore } from "jotai";
import { isLoggedInAtom } from "../store";
import { storage } from "../lib/storage";
import { syncEngine } from "@/lib/sync-engine";
import {
  notifyCatalogCurriculumChanged,
  resetCatalogCurriculumBackfillForTests,
  useCatalogCurriculum,
} from "../components/custom/exams/FFCS/hooks/useCatalogCurriculum";
import { installLocalStorage } from "./helpers/localStorage";

// The hook only ever touches the engine through `syncBackground`; stubbing the
// module keeps the real engine (and any VTOP reachability) out of the test.
vi.mock("@/lib/sync-engine", () => ({
  syncEngine: { syncBackground: vi.fn() },
}));

const local = installLocalStorage();

const details = [
  {
    code: "UC",
    name: "University Core Courses",
    baskets: [{ title: "Basic Sciences", credits: 12, items: [{ code: "PHY101", name: "Physics", credits: 3 }] }],
  },
];

const backfill = vi.mocked(syncEngine.syncBackground);

describe("useCatalogCurriculum", () => {
  beforeEach(() => {
    resetCatalogCurriculumBackfillForTests();
    backfill.mockReset();
  });

  afterEach(() => {
    getDefaultStore().set(isLoggedInAtom, false);
    local.clear();
  });

  it("stays null while logged out, even with a cached payload", () => {
    storage.curriculum.set({ details });

    const { result } = renderHook(() => useCatalogCurriculum());

    expect(result.current).toBeNull();
    expect(backfill).not.toHaveBeenCalled();
  });

  it("reads a cached payload when logged in, without fetching", async () => {
    storage.curriculum.set({ details });
    getDefaultStore().set(isLoggedInAtom, true);

    const { result } = renderHook(() => useCatalogCurriculum());

    await waitFor(() => expect(result.current).not.toBeNull());
    expect(result.current?.categories).toEqual(["University Core Courses"]);
    expect(result.current?.categoryByCode.get("PHY101")).toBe("University Core Courses");
    expect(backfill).not.toHaveBeenCalled();
  });

  // The reported bug: `curriculum` is part of NO sync mode, so a logged-in
  // student who never opened Academics → Curriculum has an empty cache — and
  // the old memo read that empty cache exactly once and never again.
  it("backfills a missing payload once and picks up what it persisted", async () => {
    backfill.mockImplementation(async () => {
      storage.curriculum.set({ details }); // the op's own persistence
    });
    getDefaultStore().set(isLoggedInAtom, true);

    const { result } = renderHook(() => useCatalogCurriculum());
    expect(result.current).toBeNull();

    await waitFor(() => expect(result.current).not.toBeNull());
    expect(backfill).toHaveBeenCalledTimes(1);
    expect(backfill).toHaveBeenCalledWith("curriculum", {});
    expect(result.current?.categoryByCode.get("PHY101")).toBe("University Core Courses");
  });

  it("shares a single backfill across every picker instance", async () => {
    backfill.mockResolvedValue(undefined);
    getDefaultStore().set(isLoggedInAtom, true);

    const searchSheet = renderHook(() => useCatalogCurriculum());
    const targetModal = renderHook(() => useCatalogCurriculum());

    await waitFor(() => expect(backfill).toHaveBeenCalledTimes(1));
    expect(searchSheet.result.current).toBeNull();
    expect(targetModal.result.current).toBeNull();
  });

  it("keeps the switch hidden when the backfill fails", async () => {
    backfill.mockRejectedValue(new Error("VTOP unreachable"));
    getDefaultStore().set(isLoggedInAtom, true);

    const { result } = renderHook(() => useCatalogCurriculum());

    // The rejection is caught: no throw, no index — the same honest
    // "no curriculum yet" state as never having tried.
    await waitFor(() => expect(backfill).toHaveBeenCalledTimes(1));
    expect(result.current).toBeNull();
  });

  // The FFCS "Sync curriculum" button runs its own page sync, which writes
  // the cache and announces it; localStorage has no same-tab change events,
  // so the announce is what turns the switch on without a remount.
  it("re-reads when an explicit sync announces a fresh payload", () => {
    backfill.mockResolvedValue(undefined); // the silent backfill stays quiet
    getDefaultStore().set(isLoggedInAtom, true);
    const { result } = renderHook(() => useCatalogCurriculum());
    expect(result.current).toBeNull();

    storage.curriculum.set({ details });
    act(() => notifyCatalogCurriculumChanged());

    expect(result.current?.categories).toEqual(["University Core Courses"]);
    expect(result.current?.categoryByCode.get("PHY101")).toBe("University Core Courses");
  });

  it("forgets the cached index the moment the student logs out", async () => {
    storage.curriculum.set({ details });
    getDefaultStore().set(isLoggedInAtom, true);
    const { result, unmount } = renderHook(() => useCatalogCurriculum());
    await waitFor(() => expect(result.current).not.toBeNull());

    getDefaultStore().set(isLoggedInAtom, false);
    unmount();

    // A fresh mount after logout must not leak the previous student's index.
    const next = renderHook(() => useCatalogCurriculum());
    expect(next.result.current).toBeNull();
  });
});
