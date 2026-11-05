import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import FreeClassroomsWidget from "../components/custom/mobile/FreeClassroomsWidget";
import * as XLSX from "xlsx";
import { getDefaultStore } from "jotai";
import { activeTabAtom } from "@/store/uiAtoms";
import * as freeClassroomsModule from "@/lib/freeClassrooms";

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
const jotaiStore = getDefaultStore();

describe("FreeClassroomsWidget Room Inspection & Class Details", () => {
  beforeEach(() => {
    localStorage.clear();
    jotaiStore.set(activeTabAtom, "home");

    // Force resolveNow to land on Monday slot A1 (08:00 AM - 08:50 AM)
    vi.spyOn(freeClassroomsModule, "resolveNow").mockImplementation((periods) => ({
      day: "mon",
      period: periods[0] ?? null,
      isLive: true,
    }));

    // Mock XLSX fetch
    const mockRows = [
      {
        "COURSE CODE": "BCSE101L",
        "COURSE TITLE": "Java Programming",
        TYPE: "ETH",
        CREDITS: "3",
        ROOM: "AB3-101",
        SLOT: "A1",
        "EMPLOYEE NAME": "Dr. Grace Hopper",
        "ERP ID": "10099",
        "CLASS ID": "5501",
      },
      {
        "COURSE CODE": "BMAT201L",
        "COURSE TITLE": "Complex Variables",
        TYPE: "ETH",
        CREDITS: "3",
        ROOM: "AB3-102",
        SLOT: "F1",
        "EMPLOYEE NAME": "Dr. Carl Gauss",
        "ERP ID": "10088",
        "CLASS ID": "5502",
      },
    ];

    const ws = XLSX.utils.json_to_sheet(mockRows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Sheet1");
    const buf = XLSX.write(wb, { type: "array", bookType: "xlsx" });

    globalThis.fetch = vi.fn().mockImplementation((url: any) => {
      const urlStr = String(url);
      if (urlStr.includes("rooms/free")) {
        return Promise.resolve({
          ok: false,
          status: 404,
          json: () => Promise.resolve(null),
        } as any);
      }
      return Promise.resolve({
        ok: true,
        arrayBuffer: () => Promise.resolve(buf),
      } as any);
    });
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("allows inspecting a room by clicking on its chip and opening class details on clicking a taken class", async () => {
    render(<FreeClassroomsWidget />);

    await waitFor(() => {
      expect(screen.queryByText(/Scanning timetable/i)).toBeNull();
    });

    // In slot A1 (Monday morning), AB3-101 is taken by Java Programming, so AB3-102 is free
    const roomBtn = screen.getByRole("button", { name: "102" });
    expect(roomBtn).toBeDefined();

    // Click on AB3-102 to inspect its schedule
    await act(async () => {
      fireEvent.click(roomBtn);
    });

    // The room inspector sheet opens with title "AB3-102"
    expect(screen.getByText("AB3-102")).toBeDefined();

    // Find the taken class period in AB3-102's timeline (slot F1: Complex Variables / Dr. Carl Gauss)
    const takenPeriodBtn = screen.getByRole("button", {
      name: /Complex Variables/i,
    });
    expect(takenPeriodBtn).toBeDefined();

    // Click on the taken class to open ClassDetailsModal
    await act(async () => {
      fireEvent.click(takenPeriodBtn);
    });

    // Verify ClassDetailsModal shows full details:
    // Course code, Subject, Faculty name, ERP ID badge, Room
    expect(screen.getAllByText("Complex Variables").length).toBeGreaterThan(0);
    expect(screen.getByText("BMAT201L")).toBeDefined();
    expect(screen.getByText("Dr. Carl Gauss")).toBeDefined();
    expect(screen.getByText("10088")).toBeDefined();
    expect(screen.getByText("#5502")).toBeDefined();

    // Click "View Faculty Schedule" button
    const viewFacultyBtn = screen.getByRole("button", { name: /View Faculty Schedule/i });
    await act(async () => {
      fireEvent.click(viewFacultyBtn);
    });

    // Verify localStorage has target ERP and activeTab is switched to faculty-schedule
    expect(localStorage.getItem("faculty_schedule_target_erp")).toBe("10088");
    expect(jotaiStore.get(activeTabAtom)).toBe("faculty-schedule");
  });
});
