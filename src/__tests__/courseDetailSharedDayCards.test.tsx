import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import CourseDetailSubpage from "../components/custom/exams/CourseDetailSubpage";

/**
 * The course detail page's day map, on the shared builder.
 *
 * This page used to carry its own copy of the day→classes builder — a
 * hand-rolled slotMap walk with an `if (h < 8) h += 12` time hack and no
 * Saturday override — feeding `countRemainingClasses` for the four
 * "Classes before CAT I / II / Mid Term / FAT" cards on the Predictor page.
 * Every other surface builds that map with
 * `lib/attendanceTimetable`'s `buildAttendanceDayCardsMap`.
 *
 * Two things are pinned, and the second is the reason the call happens
 * **twice** rather than once over all rows:
 *
 *  1. It really is the shared builder now — the spy fires with this page's
 *     attendance rows, so a revert to a private walk fails the test outright.
 *  2. Theory and lab attendance stay separate *into* the builder. The shared
 *     builder merges adjacent same-course entries within one call, keyed on
 *     title/type/faculty rather than on code; feed it both halves at once and
 *     a theory row can fuse with its lab row, erasing the lab's `(L)` code
 *     from that day — which `countRemainingClasses` reads as "the lab does
 *     not meet that day". So each component group is built separately, by the
 *     same `(L)`/`(P)` rule the page uses to split its theory/lab items.
 */

const { buildSpy } = vi.hoisted(() => ({ buildSpy: vi.fn() }));

vi.mock("@/lib/attendanceTimetable", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/attendanceTimetable")>();
  return {
    ...actual,
    buildAttendanceDayCardsMap: (attendance: any[] = [], ...rest: any[]) => {
      buildSpy(attendance);
      return (actual.buildAttendanceDayCardsMap as any)(attendance, ...rest);
    },
  };
});

const THEORY_ROW = {
  courseCode: "CSE201",
  courseTitle: "Data Structures",
  courseType: "ETH",
  slotName: "A1",
  faculty: "DR A",
  attendancePercentage: "85",
  viewLink: [],
};

const LAB_ROW = {
  courseCode: "CSE201 (L)",
  courseTitle: "Data Structures",
  courseType: "LO",
  slotName: "L1+L2+L3",
  faculty: "DR A",
  attendancePercentage: "70",
  viewLink: [],
};

beforeEach(() => {
  buildSpy.mockClear();
});

function renderPage() {
  return render(
    <CourseDetailSubpage
      marksData={{}}
      attendanceData={{ attendance: [THEORY_ROW, LAB_ROW] }}
      loginToVTOP={() => Promise.resolve({} as any)}
      setActiveSubTab={() => {}}
      selectedCode="CSE201"
      initialTab="attendance"
      onBack={() => {}}
    />
  );
}

describe("course detail day map", () => {
  it("builds the day map with the shared builder, per component group", async () => {
    renderPage();

    await waitFor(() => expect(buildSpy).toHaveBeenCalledTimes(2));

    // The shared builder, called with this page's rows — once per component
    // group, never with theory and lab mixed in the same call. Both
    // assertions fail against the old private walk (no call at all) and
    // against a single combined call (the lab rows would ride along in the
    // first one).
    expect(buildSpy).toHaveBeenCalledWith([THEORY_ROW]);
    expect(buildSpy).toHaveBeenCalledWith([LAB_ROW]);
  });

  it("still renders the attendance log the map feeds", async () => {
    renderPage();

    // The Predictor/Log pages render their sections from the same component;
    // if the swap broke the render, nothing below would land.
    expect(await screen.findByText("Heatmap")).toBeDefined();
    expect(screen.getByText("Margin")).toBeDefined();
  });
});
