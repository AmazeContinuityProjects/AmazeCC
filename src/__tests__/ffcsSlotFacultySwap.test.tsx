import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import * as htmlToImage from "html-to-image";
import SlotFacultySwapSheet from "../components/custom/exams/FFCS/components/SlotFacultySwapSheet";
import { sameSlotFacultyAlternatives } from "../components/custom/exams/FFCS/logic/generate";
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
});

const half: AddedCourse = {
  id: "half-1",
  code: "BACSE104",
  title: "Object Oriented Analysis And Design",
  faculty: "AARTHI D",
  employeeId: "54969",
  venue: "AB1-101",
  slots: ["G1", "L31", "L32"],
  credits: "4",
  type: "ETH+ELA",
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
    expect(screen.getByText("G1")).toBeTruthy();
    expect(screen.getByText("L32")).toBeTruthy();
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
});
