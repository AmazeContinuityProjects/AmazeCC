import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { getDefaultStore } from "jotai";
import { attendanceDataAtom, marksDataAtom } from "../store/dataAtoms";
import FacultyScheduleTab from "../components/custom/exams/FacultyScheduleTab";

/**
 * This jsdom environment has no `localStorage` — not even on `window`. Stubbed
 * here rather than by touching `vitest.config.ts`, because a global `setupFiles`
 * polyfill would change the environment for every other suite in the repo.
 * Same in-memory shim the other storage-backed suites install.
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
/** The component reads the two data atoms off the default store (no Provider). */
const jotaiStore = getDefaultStore();

/**
 * The faculty-schedule page the home screen's button opens.
 *
 * Two things are load-bearing and neither is obvious from the component's own
 * shape: the reader's *own* course faculties are hoisted into a section above
 * everyone else (resolved to report groups the same way the rest of the app
 * resolves a name), and the single search bar reaches across the whole report —
 * not just the hoisted section. `loadFacultyOfferings` is stubbed so the tests
 * are deterministic, but `buildFacultyNameGroups`/`findFirstMatchingGroup` stay
 * real so the hoisting exercises the actual matching contract.
 */

vi.mock("../components/custom/exams/FFCS/logic/facultyGroups", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("../components/custom/exams/FFCS/logic/facultyGroups")>();
  return {
    ...actual,
    loadFacultyOfferings: async () => [
      {
        CODE: "BCSE101",
        TITLE: "Programming",
        TYPE: "Theory",
        CREDITS: "4",
        SLOT: "A1",
        FACULTY: "PARTHIBAN V",
        ROOM: "AB3-101",
      },
      {
        CODE: "BCSE202",
        TITLE: "Data Structures",
        TYPE: "Theory",
        CREDITS: "3",
        SLOT: "B1",
        FACULTY: "MEENA R",
        ROOM: "AB3-102",
      },
      {
        CODE: "BCSE303",
        TITLE: "Networks",
        TYPE: "Theory",
        CREDITS: "3",
        SLOT: "C1",
        FACULTY: "ARJUN K",
        ROOM: "AB3-103",
      },
    ],
  };
});

/** Seed the FFCS planner's storage so MEENA R is a "current course" faculty. */
function seedRegistration() {
  store.setItem(
    "ffcs_timetables",
    JSON.stringify([
      {
        id: "default",
        name: "Draft 1",
        courses: [
          {
            id: "c1",
            code: "BCSE202",
            title: "Data Structures",
            slots: ["B1"],
            faculty: "MEENA R",
            venue: "AB3-102",
            credits: "3",
            type: "Theory",
            color: "#eee",
          },
        ],
      },
    ])
  );
  store.setItem("ffcs_activeTimetableId", "default");
}

beforeEach(() => {
  store.clear();
  seedRegistration();
  // Jotai's default store is global to the file — reset so one test's
  // timetable/marks payload cannot leak into the next.
  jotaiStore.set(attendanceDataAtom, {});
  jotaiStore.set(marksDataAtom, {});
});

afterEach(cleanup);

describe("FacultyScheduleTab", () => {
  it("hoists the reader's own course faculties above the rest", async () => {
    render(<FacultyScheduleTab />);

    expect(await screen.findByText("Your course faculties")).toBeTruthy();
    const othersHeader = screen.getByText("All other faculty");
    expect(othersHeader).toBeTruthy();

    // MEENA R is registered → her row sits in the hoisted section, i.e. above
    // the "all other faculty" divider. PARTHIBAN V is not → below it.
    const meena = screen.getByText("MEENA R");
    expect(meena.compareDocumentPosition(othersHeader) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    const parthiban = screen.getByText("PARTHIBAN V");
    expect(
      othersHeader.compareDocumentPosition(parthiban) & Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
  });

  it("hoists faculties from the current timetable and semester even without an FFCS draft", async () => {
    // No FFCS registration: these names can only be coming from the two atoms.
    store.clear();
    jotaiStore.set(attendanceDataAtom, {
      attendance: [{ courseCode: "BCSE303", faculty: "ARJUN K" }],
    } as any);
    jotaiStore.set(marksDataAtom, {
      courses: [{ courseCode: "BCSE101", faculty: "PARTHIBAN V" }],
    });

    render(<FacultyScheduleTab />);
    expect(await screen.findByText("Your course faculties")).toBeTruthy();

    const othersHeader = screen.getByText("All other faculty");
    // Both atom-sourced faculties are hoisted...
    expect(
      screen.getByText("ARJUN K").compareDocumentPosition(othersHeader) &
        Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
    expect(
      screen.getByText("PARTHIBAN V").compareDocumentPosition(othersHeader) &
        Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
    // ...while MEENA R, who appears only in the report, stays below.
    expect(
      othersHeader.compareDocumentPosition(screen.getByText("MEENA R")) &
        Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
  });

  it("searches across every faculty, not just the hoisted section", async () => {
    render(<FacultyScheduleTab />);
    await screen.findByText("Your course faculties");

    fireEvent.change(screen.getByLabelText("Search all faculty"), {
      target: { value: "arjun" },
    });

    expect(await screen.findByText("Results")).toBeTruthy();
    expect(screen.getByText("ARJUN K")).toBeTruthy();
    // The hoisted section collapses while searching, and a non-matching faculty
    // is filtered out of the single results list.
    expect(screen.queryByText("Your course faculties")).toBeNull();
    expect(screen.queryByText("PARTHIBAN V")).toBeNull();
  });

  it("labels the list 'All faculty' and shows the join hint when nothing is registered", async () => {
    store.clear();
    render(<FacultyScheduleTab />);

    expect(await screen.findByText("All faculty")).toBeTruthy();
    expect(screen.queryByText("Your course faculties")).toBeNull();
    expect(screen.getByText(/Once your timetable and marks are synced/)).toBeTruthy();
  });
});
