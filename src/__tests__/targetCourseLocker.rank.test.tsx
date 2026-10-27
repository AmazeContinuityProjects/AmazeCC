import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { TargetCourseLocker } from "../components/custom/exams/FFCS/components/TargetCourseLocker";
import type { CourseLock, ParsedCourse } from "../components/custom/exams/FFCS/types";
import { installLocalStorage } from "./helpers/localStorage";

installLocalStorage();

/**
 * Vitfac-backed ordering and badges in the target-course locker.
 *
 * The locker's faculty ranking is only as good as its ability to match a
 * course offering to a vitfac review, and that matching runs through the
 * shared catalog (by decoded ERP id, else by normalized name). These tests
 * pin the two visible outcomes of a successful match, in the slot grouping
 * where each row is a faculty card:
 *
 * - the right-side badge shows the faculty's rank among rated faculty
 *   (amber-filled for #1) instead of the alternatives count;
 * - the W% pill renders on the card, so the review stat is visible without
 *   opening the sheet.
 *
 * Names are chosen so alphabetical order (Zeta after Alpha) deliberately
 * disagrees with rank order (Zeta rates higher), which is what proves the
 * list is actually ranked rather than merely labeled.
 */
const REVIEWS: Record<string, { wPct: number; reviews: number }> = {
  "111": { wPct: 92, reviews: 20 }, // Dr. Zeta Star — best rated, last alphabetically
  "222": { wPct: 45, reviews: 8 }, // Mr. Alpha Low — lower rated, first alphabetically
};

vi.mock("@/lib/vitfacService", () => {
  const reviewFor = (employeeId?: string | null) => {
    const hit = employeeId ? REVIEWS[String(employeeId)] : undefined;
    return hit ? { ...hit, lecture: 3, da: 3, vibe: 3, id: "", name: "" } : null;
  };
  return {
    ENABLE_VITFAC_INTEGRATION: true,
    VITFAC_WORKER_BASE: "https://vitfac.amazecc.com",
    getFacultyReview: ({ employeeId }: { employeeId?: string | null }) => reviewFor(employeeId),
    // The pill reads the catalog through this hook; same table, no listeners.
    useVitfacReview: (employeeId?: string | null) => ({ review: reviewFor(employeeId), loading: false }),
    loadVitfacCatalog: () => Promise.resolve(new Map()),
    getFacultyProfileBundle: () => Promise.resolve(null),
    getVitfacProfileUrl: () => "https://vitfac.amazecc.com",
  };
});

const offering = (faculty: string, slot: string, employeeId: string): ParsedCourse =>
  ({
    CODE: "CSE101",
    TITLE: "Demo Course",
    FACULTY: faculty,
    SLOT: slot,
    ROOM: "AP-101",
    ERP_ID: employeeId,
    CLASS_ID: `cls-${employeeId}-${slot}`,
  }) as unknown as ParsedCourse;

const masterCourses: ParsedCourse[] = [
  offering("Dr. Zeta Star", "A1+TA1", "111"),
  offering("Mr. Alpha Low", "A1+TB1", "222"),
  offering("Ms. Beta Mid", "A1", "333"),
];

const selection: CourseLock = {
  code: "CSE101",
  title: "Demo Course",
  allowedSlots: [],
  allowedFaculty: [],
  offerings: [],
};

const renderSlotGrouped = () =>
  render(
    <TargetCourseLocker
      course={{ code: "CSE101", title: "Demo Course" }}
      masterCourses={masterCourses}
      selection={selection}
      onChange={() => {}}
    />
  );

/** Switch the locker's grouping to "Slot" via its Group by toggle. */
const chooseSlotGrouping = () => {
  fireEvent.click(screen.getByRole("button", { name: "Slot" }));
};

afterEach(cleanup);

describe("TargetCourseLocker vitfac ranking", () => {
  it("shows rank badges and W% pills on the faculty cards in slot grouping", async () => {
    renderSlotGrouped();
    chooseSlotGrouping();

    // Both rated faculty get a rank badge on the right of their card…
    expect(await screen.findByTitle("Rank #1 of rated faculty by overall W%")).toBeTruthy();
    expect(screen.getByTitle("Rank #2 of rated faculty by overall W%")).toBeTruthy();
    // …and only those two: the unrated one keeps the alternatives badge.
    expect(screen.getAllByTitle(/Rank #\d+ of rated faculty/)).toHaveLength(2);

    // The W% stat from the mocked reviews renders on the cards.
    expect(screen.getByText("92% W")).toBeTruthy();
    expect(screen.getByText("45% W")).toBeTruthy();
  });

  it("orders rated faculty by rank, not alphabetically, within a slot", async () => {
    renderSlotGrouped();
    chooseSlotGrouping();

    const rankOne = await screen.findByTitle("Rank #1 of rated faculty by overall W%");
    const rankTwo = screen.getByTitle("Rank #2 of rated faculty by overall W%");
    // Zeta (rank 1) must precede Alpha (rank 2) in document order even though
    // "Dr. Zeta Star" sorts after "Mr. Alpha Low" alphabetically.
    expect(rankOne.compareDocumentPosition(rankTwo) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    // The unrated faculty trails both ranked ones.
    const unrated = screen.getByText("Ms. Beta Mid");
    expect(rankTwo.compareDocumentPosition(unrated) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
});
