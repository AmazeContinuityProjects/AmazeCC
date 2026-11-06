import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { getDefaultStore } from "jotai";
import FreeClassroomsTab from "../components/custom/exams/FreeClassroomsTab";
import { settingsAtom } from "@/store/settingsAtoms";

/**
 * Free Classrooms' semester switch is the same contract as the faculty
 * schedule's: picking a term is a data migration, so it hands the target to
 * the shell's reload (which forces a full sync) instead of only relabeling the
 * page. Only the live-room fetch is mocked — it is a server call this test has
 * no interest in, and left alone it would reject unhandled under jsdom's
 * relative-URL fetch. The pure helpers (`livePeriodFor` etc.) stay real, since
 * `roomMerge` needs them to render the room list.
 */
vi.mock("@/lib/roomAvailability", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/roomAvailability")>();
  return { ...actual, fetchLiveDay: vi.fn(async () => null) };
});

/**
 * This jsdom environment has no `localStorage` — not even on `window`. Same
 * in-memory shim the other storage-backed suites install (see
 * facultyScheduleTab.render.test.tsx).
 */
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

const store = installLocalStorage();
const jotaiStore = getDefaultStore();

beforeEach(() => {
  store.clear();
  // Pin the starting term: fall (the app's default) so the switch below is
  // unambiguous. Writing the atom also lands the settings key in storage —
  // which is what makes "the tab wrote nothing behind the reload's back"
  // checkable as before/after rather than as an absence.
  jotaiStore.set(settingsAtom, { ...jotaiStore.get(settingsAtom), currSemesterID: "CH20262701" });
  // The page's report cache, seeded the way the page itself caches it: a row
  // with a faculty short-circuits the mount into the cache, so no CSV fetch or
  // xlsx import happens in jsdom.
  for (const sem of ["fall-2026-2027", "winter-2026-2027"]) {
    store.setItem(
      `ffcs_raw_courses_${sem}`,
      JSON.stringify([
        { CODE: "BCSE101", TITLE: "Programming", TYPE: "Theory", SLOT: "A1", FACULTY: "PARTHIBAN V", VENUE: "AB3-101" },
      ]),
    );
  }
});

afterEach(cleanup);

describe("FreeClassroomsTab semester switch", () => {
  it("hands a user semester switch to the shell reload, not a local relabel", async () => {
    const handleReloadRequest = vi.fn(async () => {});

    render(<FreeClassroomsTab handleReloadRequest={handleReloadRequest} />);
    const winter = await screen.findByRole("button", { name: "Winter 2026-27" });
    const settingsBefore = store.getItem("settings");

    fireEvent.click(winter);

    // VTOP id for winter: the reload rewrites the global semester, broadcasts,
    // and runs the forced full sync for the new term's caches.
    expect(handleReloadRequest).toHaveBeenCalledTimes(1);
    expect(handleReloadRequest).toHaveBeenCalledWith("CH20262705");
    // The tab never wrote settings behind the reload's back.
    expect(store.getItem("settings")).toBe(settingsBefore);
  });

  it("keeps the legacy local+global relabel when no reload action is wired", async () => {
    render(<FreeClassroomsTab />);

    fireEvent.click(await screen.findByRole("button", { name: "Winter 2026-27" }));

    // Bare mount (tests, standalone use): broadcast + settings write as before.
    // The app's semester moves; the planner's own key must not — the two are
    // resolved independently now.
    expect(store.getItem("ffcs_semester")).toBeNull();
    expect(JSON.parse(store.getItem("settings") || "{}").currSemesterID).toBe("CH20262705");
  });
});
