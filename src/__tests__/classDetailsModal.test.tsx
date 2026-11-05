import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import ClassDetailsModal from "../components/custom/exams/ClassDetailsModal";
import type { MergedOccupant } from "@/lib/roomMerge";
import { getDefaultStore } from "jotai";
import { activeTabAtom } from "@/store/uiAtoms";

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

describe("ClassDetailsModal", () => {
  beforeEach(() => {
    localStorage.clear();
    jotaiStore.set(activeTabAtom, "home");
  });

  afterEach(() => {
    cleanup();
  });

  const mockOccupant: MergedOccupant = {
    code: "AB3-101",
    courseCode: "BCSE101L",
    title: "Computer Programming: Java",
    faculty: "Dr. Alan Turing",
    erpId: "10023",
    classId: "4021",
    slot: "A1+TA1",
    type: "Theory",
    source: "report",
  };

  it("renders all class details including room, teacher, employee id, course code, and subject", () => {
    render(
      <ClassDetailsModal
        isOpen={true}
        onClose={vi.fn()}
        occupant={mockOccupant}
        roomCode="AB3-101"
        dayLabel="Monday"
        periodLabel="08:00 AM – 08:50 AM"
      />,
    );

    // Subject and Course code
    expect(screen.getAllByText("Computer Programming: Java").length).toBeGreaterThan(0);
    expect(screen.getByText("BCSE101L")).toBeDefined();

    // Teacher and Employee ID
    expect(screen.getByText("Dr. Alan Turing")).toBeDefined();
    expect(screen.getByText("10023")).toBeDefined();

    // Room and Block
    expect(screen.getByText("AB3-101")).toBeDefined();
    expect(screen.getByText("AB3 Block")).toBeDefined();

    // Period and Day
    expect(screen.getByText("08:00 AM – 08:50 AM")).toBeDefined();
    expect(screen.getByText("Monday")).toBeDefined();

    // Slot and Class ID
    expect(screen.getByText("A1+TA1")).toBeDefined();
    expect(screen.getByText("#4021")).toBeDefined();
  });

  it("handles clicking View Faculty Schedule by setting target ERP and navigating", () => {
    const handleClose = vi.fn();
    const handleViewFaculty = vi.fn();

    render(
      <ClassDetailsModal
        isOpen={true}
        onClose={handleClose}
        occupant={mockOccupant}
        roomCode="AB3-101"
        onViewFacultySchedule={handleViewFaculty}
      />,
    );

    const facultyBtn = screen.getByRole("button", { name: /View Faculty Schedule/i });
    fireEvent.click(facultyBtn);

    expect(localStorage.getItem("faculty_schedule_target_erp")).toBe("10023");
    expect(handleViewFaculty).toHaveBeenCalledWith("erp:10023");
    expect(handleClose).toHaveBeenCalled();
  });

  it("navigates to faculty-schedule tab via activeTabAtom when onViewFacultySchedule callback is not passed", () => {
    const handleClose = vi.fn();

    render(<ClassDetailsModal isOpen={true} onClose={handleClose} occupant={mockOccupant} roomCode="AB3-101" />);

    const facultyBtn = screen.getByRole("button", { name: /View Faculty Schedule/i });
    fireEvent.click(facultyBtn);

    expect(localStorage.getItem("faculty_schedule_target_erp")).toBe("10023");
    expect(jotaiStore.get(activeTabAtom)).toBe("faculty-schedule");
    expect(handleClose).toHaveBeenCalled();
  });

  it("supports switching between multiple occupants in the same slot", () => {
    const occ2: MergedOccupant = {
      code: "AB3-101",
      courseCode: "BMAT102L",
      title: "Differential Equations and Transforms",
      faculty: "Dr. Leonhard Euler",
      erpId: "10045",
      classId: "4022",
      slot: "A1+TA1",
      type: "Theory",
      source: "report",
    };

    render(
      <ClassDetailsModal
        isOpen={true}
        onClose={vi.fn()}
        occupant={mockOccupant}
        occupants={[mockOccupant, occ2]}
        roomCode="AB3-101"
      />,
    );

    // Initial is Alan Turing
    expect(screen.getByText("Dr. Alan Turing")).toBeDefined();

    // Click tab for second occupant
    const occ2Tab = screen.getByRole("button", { name: "BMAT102L" });
    fireEvent.click(occ2Tab);

    // Now shows Leonhard Euler
    expect(screen.getByText("Dr. Leonhard Euler")).toBeDefined();
    expect(screen.getByText("10045")).toBeDefined();
  });
});
