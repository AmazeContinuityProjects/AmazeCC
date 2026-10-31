import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { TargetCourseLockCard } from "../components/custom/exams/FFCS/components/TargetCourseLockCard";

const course = { code: "BCSE101", title: "Programming", types: ["CORE"] };

afterEach(cleanup);

/**
 * The picker has to TELL the two apart: a full code match is a curriculum
 * course ("counts toward …"), a shared-start match is a non-curriculum
 * open-elective candidate. Both live in the same badge slot, so the badge's
 * wording and colour are the whole distinction.
 */
describe("TargetCourseLockCard curriculum badge", () => {
  it("wears the curriculum look for a listed course", () => {
    render(
      <TargetCourseLockCard
        course={course}
        offerings={[]}
        selection={undefined}
        onSelectionChange={() => {}}
        category="Programme Core Courses"
        curriculumListed
      />,
    );

    const badge = screen.getByText("Programme Core Courses");
    expect(badge.getAttribute("title")).toBe("In your curriculum — counts toward Programme Core Courses");
    expect(badge.className).toContain("text-emerald-500");
  });

  it("wears the open-elective look for a shared-start candidate", () => {
    render(
      <TargetCourseLockCard
        course={course}
        offerings={[]}
        selection={undefined}
        onSelectionChange={() => {}}
        category="Open Elective"
        curriculumListed={false}
      />,
    );

    const badge = screen.getByText("Open Elective");
    expect(badge.getAttribute("title")).toContain("Not in your curriculum");
    expect(badge.className).toContain("text-amber-600");
    // The candidate must never borrow the curriculum colour.
    expect(badge.className).not.toContain("text-emerald-500");
  });

  it("defaults to the curriculum look when a host only passes the category", () => {
    render(
      <TargetCourseLockCard
        course={course}
        offerings={[]}
        selection={undefined}
        onSelectionChange={() => {}}
        category="Concentration"
      />,
    );

    expect(screen.getByText("Concentration").getAttribute("title")).toContain("In your curriculum");
  });
});
