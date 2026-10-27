import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useState } from "react";
import type { CourseLock, ParsedCourse } from "../components/custom/exams/FFCS/types";
import {
  GeneratorTargetCoursesWidget,
} from "../components/custom/exams/FFCS/components/GeneratorTargetCoursesWidget";

const reportCourses: ParsedCourse[] = [
  { CODE: "BCSE101", TITLE: "Data Structures", TYPE: "TH", CREDITS: "3", ROOM: "A", SLOT: "A1", FACULTY: "Prof Alpha" },
  { CODE: "BCSE101", TITLE: "Data Structures", TYPE: "TH", CREDITS: "3", ROOM: "B", SLOT: "B1", FACULTY: "Prof Beta" },
  { CODE: "BCSE102", TITLE: "Algorithms", TYPE: "TH", CREDITS: "3", ROOM: "C", SLOT: "C1", FACULTY: "Prof Gamma" },
];

function Harness() {
  const [targets, setTargets] = useState<CourseLock[]>([]);
  return (
    <GeneratorTargetCoursesWidget
      reportCourses={reportCourses}
      targets={targets}
      onSelectionChange={(course, selection) => setTargets((current) => {
        if (!selection) return current.filter((target) => target.code !== course.code);
        const index = current.findIndex((target) => target.code === course.code);
        if (index === -1) return [...current, selection];
        return current.map((target, targetIndex) => targetIndex === index ? selection : target);
      })}
    />
  );
}

describe("GeneratorTargetCoursesWidget", () => {
  it("searches the current report and adds or removes generator-only target locks", () => {
    render(<Harness />);

    fireEvent.change(screen.getByRole("textbox", { name: "Search current semester courses" }), {
      target: { value: "data structures" },
    });
    expect(screen.getByRole("checkbox", { name: /BCSE101/ })).toBeDefined();
    expect(screen.queryByRole("checkbox", { name: /BCSE102/ })).toBeNull();

    fireEvent.click(screen.getByRole("checkbox", { name: /BCSE101/ }));
    expect(screen.getByRole("button", { name: "Remove BCSE101 from generator targets" })).toBeDefined();
    expect(screen.getByText("Filter Slots (Optional)")).toBeDefined();

    fireEvent.click(screen.getByRole("button", { name: "Remove BCSE101 from generator targets" }));
    expect(screen.queryByRole("button", { name: "Remove BCSE101 from generator targets" })).toBeNull();
  });

  it("writes slot bundle selections only to the generator target state", () => {
    const onSelectionChange = vi.fn();
    render(
      <GeneratorTargetCoursesWidget
        reportCourses={reportCourses}
        targets={[{ code: "BCSE101", title: "Data Structures", allowedSlots: [], allowedFaculty: [] }]}
        onSelectionChange={onSelectionChange}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /A1 Slots/ }));
    expect(onSelectionChange).toHaveBeenCalledWith(
      expect.objectContaining({ code: "BCSE101" }),
      expect.objectContaining({ code: "BCSE101", allowedSlots: ["A1"] })
    );
  });
});
