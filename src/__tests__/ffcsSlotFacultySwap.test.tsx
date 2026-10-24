import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import * as htmlToImage from "html-to-image";
import SlotFacultySwapSheet from "../components/custom/exams/FFCS/components/SlotFacultySwapSheet";
import { sameSlotFacultyAlternatives, expandCourseHalves, allCourseOfferings } from "../components/custom/exams/FFCS/logic/generate";
import type { AddedCourse, ParsedCourse } from "../components/custom/exams/FFCS/types";

/**
 * The same-slot faculty swap, in two halves like the feature itself.
 *
 * The logic half pins the matching rule that makes the swap safe elsewhere:
 * exact slot-token sets are the only alternatives shown, because a swap that
 * moved a single period would invalidate the metrics the preview was praised
 * with. The component half pins what the Student actually sees: the current
 * teacher named as current, venue/ERP fallbacks, and two different "empty"
 * explanations — "no one else" and "your search matched nobody".
 */

afterEach(cleanup);

const course = (over: Partial<ParsedCourse> = {}): ParsedCourse => ({
  CODE: "BACSE104",
  TITLE: "Object Oriented Analysis And Design",
  TYPE: "ETH+ELA",
  CREDITS: "4",
  ROOM: "AB1-212",
  SLOT: "G1+L31+L32",
  FACULTY: "AARTHI D",
  ...over,
});

const current = { faculty: "AARTHI D", employeeId: "54969" };

describe("sameSlotFacultyAlternatives", () => {
  it("lists same-code offerings whose slot tokens match exactly, order blind", () => {
    const courses = [
      course({ FACULTY: "SHINY E", SLOT: "G1+L31+L32" }),
      course({ FACULTY: "OTHER", SLOT: "G2+L3+L4" }), // different time
      course({ CODE: "BMAT202", SLOT: "G1+L31+L32" }), // different course
      course({ FACULTY: "SHINY E", SLOT: "G1+L31" }), // a subset — not the same booking
      course({ FACULTY: "SHINY E", SLOT: "L32+G1+L31" }), // same tokens, spelled out of order
    ];
    const result = sameSlotFacultyAlternatives(
      "BACSE104",
      ["G1", "L31", "L32"],
      current,
      courses
    );
    expect(result.map((r) => r.FACULTY)).toEqual(["SHINY E"]);
  });

  it("excludes the current teacher by employee id, so a shared name does not hide the other person", () => {
    const courses = [
      course({ FACULTY: "AARTHI D", SLOT: "G1+L31+L32", ERP_ID: "98765" }),
      course({ FACULTY: "SHINY E", SLOT: "G1+L31+L32", ERP_ID: "55123" }),
    ];
    const result = sameSlotFacultyAlternatives(
      "BACSE104",
      ["G1", "L31", "L32"],
      current,
      courses
    );
    // A same-name teacher under a different employee id is a different
    // person: both stay, sorted by name.
    expect(result.map((r) => `${r.FACULTY}@${r.ERP_ID}`)).toEqual([
      "AARTHI D@98765",
      "SHINY E@55123",
    ]);
  });

  it("falls back to the name when the report carries no employee ids", () => {
    const courses = [
      course({ FACULTY: "AARTHI D", SLOT: "G1+L31+L32", ERP_ID: undefined }),
      course({ FACULTY: "SHINY E", SLOT: "G1+L31+L32", ERP_ID: undefined }),
    ];
    const result = sameSlotFacultyAlternatives(
      "BACSE104",
      ["g1", "l31", "l32"],
      { faculty: "AARTHI D", employeeId: undefined },
      courses
    );
    expect(result.map((r) => r.FACULTY)).toEqual(["SHINY E"]);
  });

  it("collapses duplicate report rows by offering identity, keeping different rooms", () => {
    const courses = [
      course({ FACULTY: "SHINY E", ROOM: "AB1-101", SLOT: "G1+L31+L32" }),
      course({ FACULTY: "SHINY E", ROOM: "AB1-101", SLOT: "G1+L31+L32" }),
      course({ FACULTY: "SHINY E", ROOM: "AB1-102", SLOT: "G1+L31+L32" }),
    ];
    const result = sameSlotFacultyAlternatives(
      "BACSE104",
      ["G1", "L31", "L32"],
      current,
      courses
    );
    expect(result.map((r) => r.ROOM)).toEqual(["AB1-101", "AB1-102"]);
  });

  it("sorts by faculty, then room", () => {
    const courses = [
      course({ FACULTY: "ZAHID A", ROOM: "", SLOT: "G1+L31+L32" }),
      course({ FACULTY: "SHINY E", ROOM: "AB2-102", SLOT: "G1+L31+L32" }),
      course({ FACULTY: "SHINY E", ROOM: "AB1-108", SLOT: "G1+L31+L32" }),
    ];
    const result = sameSlotFacultyAlternatives(
      "BACSE104",
      ["G1", "L31", "L32"],
      current,
      courses
    );
    expect(result.map((r) => `${r.FACULTY}@${r.ROOM}`)).toEqual([
      "SHINY E@AB1-108",
      "SHINY E@AB2-102",
      "ZAHID A@",
    ]);
  });

  it("matches embedded theory slots against combined master course offerings", () => {
    const courses = [
      course({ FACULTY: "DR ALICE", SLOT: "F1+TF1+L23+L24", ROOM: "SJT101 / SJT102" }),
      course({ FACULTY: "DR BOB", SLOT: "F1+TF1+L31+L32", ROOM: "SJT103 / SJT104" }),
      course({ FACULTY: "DR CHARLIE", SLOT: "G1+TG1+L1+L2", ROOM: "SJT105" }),
    ];
    const result = sameSlotFacultyAlternatives(
      "BACSE104",
      ["F1", "TF1"],
      { faculty: "CURRENT TEACHER" },
      courses
    );
    expect(result.map((r) => `${r.FACULTY}@${r.ROOM}`)).toEqual([
      "DR ALICE@SJT101",
      "DR BOB@SJT103",
    ]);
    expect(result[0].SLOT).toBe("F1+TF1");
    expect(result[0].TYPE).toBe("ETH");
  });

  it("matches embedded lab slots against combined master course offerings", () => {
    const courses = [
      course({ FACULTY: "DR ALICE / DR DAVE", SLOT: "F1+TF1+L23+L24", ROOM: "SJT101 / SJT102", TYPE: "ETH+ELA" }),
      course({ FACULTY: "DR EVE", SLOT: "A1+TA1+L23+L24", ROOM: "SJT201 / SJT202" }),
    ];
    const result = sameSlotFacultyAlternatives(
      "BACSE104",
      ["L23", "L24"],
      { faculty: "CURRENT LAB" },
      courses
    );
    expect(result.map((r) => `${r.FACULTY}@${r.ROOM}`)).toEqual([
      "DR DAVE@SJT102",
      "DR EVE@SJT202",
    ]);
    expect(result[0].SLOT).toBe("L23+L24");
    expect(result[0].TYPE).toBe("ELA");
  });
});

describe("expandCourseHalves", () => {
  it("keeps pure theory or pure lab courses as is", () => {
    const pure: AddedCourse = {
      id: "c-1",
      code: "CSE101",
      title: "Prog",
      faculty: "Prof A",
      venue: "SJT101",
      credits: "3",
      type: "Embedded Theory",
      slots: ["F1", "TF1"],
      color: "bg-blue-600",
    };
    expect(expandCourseHalves([pure])).toEqual([pure]);
  });

  it("decomposes combined course with theory and lab slots into two halves", () => {
    const combined: AddedCourse = {
      id: "c-comb",
      code: "CSE101",
      title: "Prog",
      faculty: "Prof Theory / Prof Lab",
      venue: "SJT101 / SJT102",
      credits: "4",
      type: "ETH+ELA",
      slots: ["F1", "TF1", "L23", "L24"],
      color: "bg-blue-600",
    };
    const halves = expandCourseHalves([combined]);
    expect(halves.length).toBe(2);
    expect(halves[0]).toMatchObject({
      id: "c-comb:theory",
      faculty: "Prof Theory",
      venue: "SJT101",
      slots: ["F1", "TF1"],
    });
    expect(halves[1]).toMatchObject({
      id: "c-comb:lab",
      faculty: "Prof Lab",
      venue: "SJT102",
      slots: ["L23", "L24"],
    });
  });
});

describe("allCourseOfferings", () => {
  it("filters out individual half-slots of faculties when combined offerings exist", () => {
    const courses = [
      // Faculty 1: combined offering + raw individual slots
      course({ FACULTY: "PROF A", SLOT: "F1+TF1+L1+L2", TYPE: "ETH+ELA" }),
      course({ FACULTY: "PROF A", SLOT: "F1+TF1", TYPE: "ETH" }),
      course({ FACULTY: "PROF A", SLOT: "L1+L2", TYPE: "ELA" }),

      // Faculty 2: combined offering
      course({ FACULTY: "PROF B", SLOT: "G1+TG1+L3+L4", TYPE: "ETH+ELA" }),

      // Different course
      course({ CODE: "BMAT201", FACULTY: "PROF C", SLOT: "A1+TA1" }),
    ];

    const offerings = allCourseOfferings("BACSE104", courses);

    // Only combined offerings should be returned. Individual slots of PROF A must not occupy the list!
    expect(offerings.length).toBe(2);
    expect(offerings.map((o) => `${o.FACULTY}@${o.SLOT}`)).toEqual([
      "PROF A@F1+TF1+L1+L2",
      "PROF B@G1+TG1+L3+L4",
    ]);
  });
});

const half: AddedCourse = {
  id: "half-1",
  code: "BACSE104",
  title: "Object Oriented Analysis And Design",
  faculty: "AARTHI D",
  employeeId: "54969",
  venue: "AB1-101",
  slots: ["G1"],
  credits: "3",
  type: "Embedded Theory",
  color: "bg-amber-500",
};

const sheet = (over: { masterCourses?: ParsedCourse[] } = {}) => {
  const onSwap = vi.fn();
  const onClose = vi.fn();
  render(
    <SlotFacultySwapSheet
      code="BACSE104"
      courseTitle="Object Oriented Analysis And Design"
      halves={[half]}
      masterCourses={over.masterCourses ?? [
        course({ FACULTY: "SHINY E", ERP_ID: "55123", ROOM: "AB1-212" }),
        course({ FACULTY: "ZAHID A", ERP_ID: undefined, ROOM: "" }),
      ]}
      onSwap={onSwap}
      onClose={onClose}
    />
  );
  return { onSwap, onClose };
};

describe("SlotFacultySwapSheet", () => {
  it("names the current teacher and lists the same-slot faculties with venue fallbacks", () => {
    sheet();
    expect(screen.getByText("Current:")).toBeTruthy();
    expect(screen.getByText("AARTHI D")).toBeTruthy();
    expect(screen.getByText("SHINY E")).toBeTruthy();
    expect(screen.getByText("AB1-212")).toBeTruthy();
    expect(screen.getByText("ZAHID A")).toBeTruthy();
    expect(screen.getByText("TBA")).toBeTruthy();
    // The current assignment's own chips sit in the block header.
    expect(screen.getAllByText("G1").length).toBeGreaterThan(0);
  });

  it("hands the tapped course to the chosen faculty", () => {
    const { onSwap } = sheet();
    fireEvent.click(screen.getByText("SHINY E"));
    expect(onSwap).toHaveBeenCalledTimes(1);
    expect(onSwap).toHaveBeenCalledWith(
      "half-1",
      expect.objectContaining({ FACULTY: "SHINY E", ERP_ID: "55123" })
    );
  });

  it("filters the list by faculty name", () => {
    sheet();
    fireEvent.change(screen.getByPlaceholderText("Search by faculty name..."), {
      target: { value: "zahid" },
    });
    expect(screen.getByText("ZAHID A")).toBeTruthy();
    expect(screen.queryByText("SHINY E")).toBeNull();
  });

  it("explains when no one else teaches the same slots", () => {
    sheet({ masterCourses: [course({ SLOT: "G2+L3+L4" })] });
    expect(screen.getByText("No other faculty at this time slot")).toBeTruthy();
  });

  it("keeps the search's empty answer separate from the no-one-else one", () => {
    sheet();
    fireEvent.change(screen.getByPlaceholderText("Search by faculty name..."), {
      target: { value: "nobody" },
    });
    expect(screen.getByText(/No faculty matches/)).toBeTruthy();
    expect(screen.queryByText("No other faculty at this time slot")).toBeNull();
  });

  it("renders the Download JPEG button and How to Pick It Out guide", () => {
    sheet();
    expect(screen.getByText("Download JPEG")).toBeTruthy();
    expect(screen.getByText("How to Pick It Out in FFCS:")).toBeTruthy();
    expect(screen.getByText(/Search course code/)).toBeTruthy();
  });

  it("triggers JPEG generation and download on button click", async () => {
    const spy = vi
      .spyOn(htmlToImage, "toJpeg")
      .mockResolvedValue("data:image/jpeg;base64,mockjpegdata");
    const clickSpy = vi
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(() => {});

    sheet();
    const btn = screen.getByText("Download JPEG");
    await act(async () => {
      fireEvent.click(btn);
    });

    expect(spy).toHaveBeenCalledTimes(1);
    spy.mockRestore();
    clickSpy.mockRestore();
  });

  it("supports read-only mode without onSwap and custom z-indices", () => {
    render(
      <SlotFacultySwapSheet
        code="BACSE104"
        courseTitle="Object Oriented Analysis And Design"
        halves={[half]}
        masterCourses={[
          course({ FACULTY: "SHINY E", SLOT: "G1+L31+L32" }),
        ]}
        onClose={() => {}}
        panelZIndex={450}
        backdropZIndex={445}
      />
    );

    expect(screen.getByText("Faculty in this Slot")).toBeTruthy();
    expect(screen.getByText("Download JPEG")).toBeTruthy();
    expect(screen.getByText("SHINY E")).toBeTruthy();
  });

  it("omits component split for embedded courses and shows drop-in replacements and other slots", () => {
    const onSwap = vi.fn();
    const combinedCourse: AddedCourse = {
      id: "comb-1",
      code: "BACSE104",
      title: "Object Oriented Analysis And Design",
      faculty: "AARTHI D / LAB TEACHER",
      venue: "AB1-101 / LAB-102",
      slots: ["G1", "L31", "L32"],
      credits: "4",
      type: "ETH+ELA",
      color: "bg-blue-600",
    };
    render(
      <SlotFacultySwapSheet
        code="BACSE104"
        courseTitle="Object Oriented Analysis And Design"
        halves={[combinedCourse]}
        masterCourses={[
          course({ FACULTY: "SHINY E", ERP_ID: "55123", ROOM: "AB1-212 / LAB-212", SLOT: "G1+L31+L32" }),
        ]}
        onSwap={onSwap}
        onClose={() => {}}
      />
    );

    // Same-slot component alternatives are NOT shown for embedded courses
    expect(screen.queryByText("Same-Slot Faculty by Component")).toBeNull();
    expect(screen.queryByText("Embedded Theory Offering")).toBeNull();
    expect(screen.queryByText("Embedded Lab Offering")).toBeNull();

    // Drop-In Combined Replacements are prioritized and shown
    expect(screen.getByText("Drop-In Combined Replacements")).toBeTruthy();
    expect(screen.getByText("Full Drop-In")).toBeTruthy();

    // Single Drop-In button for SHINY E
    const shinyButtons = screen.getAllByText("SHINY E");
    expect(shinyButtons.length).toBe(1);

    // Clicking drop-in swaps the whole combined course
    fireEvent.click(shinyButtons[0]);
    expect(onSwap).toHaveBeenCalledWith("comb-1", expect.anything());
  });

  it("shows other available faculties with embedded badge, split TH/LAB slots, and darkened clashes", () => {
    const onSwap = vi.fn();
    const combinedCourse: AddedCourse = {
      id: "comb-1",
      code: "BACSE104",
      title: "Object Oriented Analysis And Design",
      faculty: "AARTHI D",
      venue: "AB1-101",
      slots: ["G1", "L31", "L32"],
      credits: "4",
      type: "ETH+ELA",
      color: "bg-blue-600",
    };

    // Another course in the timetable taking slot F1
    const otherCourseInTimetable: AddedCourse = {
      id: "c-other",
      code: "BMAT201",
      title: "Maths",
      faculty: "DR MATH",
      venue: "SJT101",
      slots: ["F1", "TF1"],
      credits: "4",
      type: "ETH",
      color: "bg-green-600",
    };

    render(
      <SlotFacultySwapSheet
        code="BACSE104"
        courseTitle="Object Oriented Analysis And Design"
        halves={[combinedCourse]}
        allTimetableCourses={[combinedCourse, otherCourseInTimetable]}
        blockedSlots={new Set(["B2"])}
        masterCourses={[
          // Offering 1: Clash with BMAT201 on F1
          course({ FACULTY: "PROF CLASH", SLOT: "F1+TF1+L1+L2", ERP_ID: "11111" }),
          // Offering 2: Blocked slot B2
          course({ FACULTY: "PROF BLOCKED", SLOT: "B2+TB2+L5+L6", ERP_ID: "22222" }),
          // Offering 3: No clash (e.g. C1+TC1)
          course({ FACULTY: "PROF FREE", SLOT: "C1+TC1+L7+L8", ERP_ID: "33333" }),
        ]}
        onSwap={onSwap}
        onClose={() => {}}
      />
    );

    // Other Available Offerings section is rendered
    expect(screen.getByText("Other Available Offerings for BACSE104 (Other Slots)")).toBeTruthy();
    expect(screen.getByText("PROF CLASH")).toBeTruthy();
    expect(screen.getByText("PROF BLOCKED")).toBeTruthy();
    expect(screen.getByText("PROF FREE")).toBeTruthy();

    // Embedded badge is shown for embedded course offerings
    expect(screen.getAllByText("Embedded").length).toBeGreaterThanOrEqual(3);

    // Theory and Lab slots are split and labeled
    expect(screen.getByText("TH: C1+TC1")).toBeTruthy();
    expect(screen.getByText("LAB: L7+L8")).toBeTruthy();

    // Clash indicators
    expect(screen.getAllByText("⚠️ Clash").length).toBe(2);
    expect(screen.getByText("✓ No Clash")).toBeTruthy();

    // Clicking clash offering does NOT call onSwap
    fireEvent.click(screen.getByText("PROF CLASH"));
    expect(onSwap).not.toHaveBeenCalled();

    // Clicking clash-free offering calls onSwap with comb-1
    fireEvent.click(screen.getByText("PROF FREE"));
    expect(onSwap).toHaveBeenCalledWith(
      "comb-1",
      expect.objectContaining({ FACULTY: "PROF FREE", ERP_ID: "33333" })
    );
  });

  it("does not show individual slots of faculties in other offerings when course is embedded", () => {
    const combinedCourse: AddedCourse = {
      id: "comb-1",
      code: "BACSE104",
      title: "Object Oriented Analysis And Design",
      faculty: "AARTHI D",
      venue: "AB1-101",
      slots: ["G1", "L31", "L32"],
      credits: "4",
      type: "ETH+ELA",
      color: "bg-blue-600",
    };

    render(
      <SlotFacultySwapSheet
        code="BACSE104"
        courseTitle="Object Oriented Analysis And Design"
        halves={[combinedCourse]}
        masterCourses={[
          // PROF COMBINED: has combined offering + leftover individual slot
          course({ FACULTY: "PROF COMBINED", SLOT: "A1+TA1+L11+L12", TYPE: "ETH+ELA", ERP_ID: "100" }),
          course({ FACULTY: "PROF COMBINED", SLOT: "A1+TA1", TYPE: "ETH", ERP_ID: "100" }),
          // PROF INDIVIDUAL: only theory half (unmerged)
          course({ FACULTY: "PROF INDIVIDUAL", SLOT: "B1+TB1", TYPE: "ETH", ERP_ID: "200" }),
        ]}
        onClose={() => {}}
      />
    );

    // Only complete embedded offering is shown
    expect(screen.getByText("PROF COMBINED")).toBeTruthy();
    expect(screen.getByText("TH: A1+TA1")).toBeTruthy();
    expect(screen.getByText("LAB: L11+L12")).toBeTruthy();

    // Individual slot of PROF COMBINED or PROF INDIVIDUAL is not in the list!
    expect(screen.queryByText("PROF INDIVIDUAL")).toBeNull();
  });
});
