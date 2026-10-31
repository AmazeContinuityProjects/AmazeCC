import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { TargetCourseLockCard } from "../components/custom/exams/FFCS/components/TargetCourseLockCard";
import { gradeBadge } from "../lib/ffcsPlannerGrades";

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
        category="NC Open Elective"
        curriculumListed={false}
      />,
    );

    const badge = screen.getByText("NC Open Elective");
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

/**
 * The grade rules reach this card as props (the host derives the badge with
 * `gradeBadge`), so the card's job is: render the wording verbatim, and make
 * a blocked subject impossible to select — checkbox AND label.
 */
describe("TargetCourseLockCard grade rule", () => {
  it("wears the retake badge when the host passes one", () => {
    // The host derives the badge (`gradeBadge(code, grades)`); with no index
    // there is none — so what the card renders IS exactly what it was given.
    expect(gradeBadge("BCSE101", null)).toBeNull();

    render(
      <TargetCourseLockCard
        course={course}
        offerings={[]}
        selection={undefined}
        onSelectionChange={() => {}}
        grade={{ text: "Retake · F", title: "Your recorded grade is F", tone: "blue", blocked: false }}
      />,
    );

    const chip = screen.getByText("Retake · F");
    expect(chip.getAttribute("title")).toBe("Your recorded grade is F");
    expect(chip.className).toContain("text-blue-500");
    // Allowed to select: the checkbox stays live.
    expect((screen.getByRole("checkbox") as HTMLInputElement).disabled).toBe(false);
  });

  it("wears the improvement badge without blocking selection", () => {
    render(
      <TargetCourseLockCard
        course={course}
        offerings={[]}
        selection={undefined}
        onSelectionChange={() => {}}
        grade={{ text: "Grade improvement", title: "Re-registering counts", tone: "amber", blocked: false }}
      />,
    );

    expect(screen.getByText("Grade improvement").className).toContain("border-amber-500/30");
    expect((screen.getByRole("checkbox") as HTMLInputElement).disabled).toBe(false);
  });

  it("makes a completed subject impossible to select", () => {
    render(
      <TargetCourseLockCard
        course={course}
        offerings={[]}
        selection={undefined}
        onSelectionChange={() => {}}
        grade={{ text: "Completed · S", title: "Already earned an S", tone: "red", blocked: true }}
        disabled
      />,
    );

    const chip = screen.getByText("Completed · S");
    expect(chip.className).toContain("text-red-500");
    const checkbox = screen.getByRole("checkbox") as HTMLInputElement;
    expect(checkbox.disabled).toBe(true);
    // A click on a disabled checkbox fires nothing — no selection may leak.
  });

  it("keeps course details and chips visible on a blocked card", () => {
    render(
      <TargetCourseLockCard
        course={course}
        offerings={[]}
        selection={undefined}
        onSelectionChange={() => {}}
        grade={{ text: "Completed · S", title: "Already earned an S", tone: "red", blocked: true }}
        disabled
      />,
    );

    expect(screen.getByText("BCSE101")).toBeTruthy();
    expect(screen.getByText(/Programming/)).toBeTruthy();
  });
});
