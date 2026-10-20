import { describe, expect, it } from "vitest";
import { fireEvent, render } from "@testing-library/react";
import FacultyScheduleModal from "../components/custom/exams/FFCS/components/modals/FacultyScheduleModal";
import {
  buildFacultyNameGroups,
  type FacultyOffering,
} from "../components/custom/exams/FFCS/logic/facultyGroups";

/**
 * The modal is portalled to <body>, so it is queried on `document.body` rather
 * than the render container. The portal is the fix for the modal landing below
 * the fold inside an animated ancestor — see the note in the component.
 */

const offering = (over: Partial<FacultyOffering> = {}): FacultyOffering => ({
  CODE: "BCSE101",
  TITLE: "Programming",
  TYPE: "TH",
  CREDITS: "3",
  SLOT: "A1",
  FACULTY: "PARTHIBAN V",
  ROOM: "AB3-101",
  ...over,
});

describe("FacultyScheduleModal", () => {
  it("renders the faculty list through a portal", () => {
    const groups = buildFacultyNameGroups([offering()]);
    render(<FacultyScheduleModal open onClose={() => {}} groups={groups} />);

    expect(document.body.textContent).toContain("Faculty Schedule");
    expect(document.body.textContent).toContain("PARTHIBAN V");
  });

  it("lands on the first matching group's schedule", () => {
    const groups = buildFacultyNameGroups([offering()]);
    render(
      <FacultyScheduleModal
        open
        onClose={() => {}}
        groups={groups}
        initialFaculty="V PARTHIBAN"
      />
    );

    expect(document.body.textContent).toContain("Schedule");
    // The schedule view renders the offerings reference table.
    expect(document.body.textContent).toContain("Venue");
  });

  it("renders nothing while closed", () => {
    const groups = buildFacultyNameGroups([offering()]);
    render(<FacultyScheduleModal open={false} onClose={() => {}} groups={groups} />);

    expect(document.body.textContent).not.toContain("Faculty Schedule");
  });

  it("opens the slot detail sheet when a cell is tapped", () => {
    const groups = buildFacultyNameGroups([offering()]);
    render(
      <FacultyScheduleModal
        open
        onClose={() => {}}
        groups={groups}
        initialFaculty="V PARTHIBAN"
      />
    );

    const cell = Array.from(document.body.querySelectorAll("button")).find((button) =>
      button.textContent?.includes("BCSE101")
    );
    expect(cell).toBeTruthy();
    fireEvent.click(cell!);

    // The sheet names the full day and the course's venue; the reference table
    // below the grid shows neither the day nor the sheet's own header.
    expect(document.body.textContent).toContain("Monday");
    expect(document.body.textContent).toContain("AB3-101");
  });
});
