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
    expect(badge.className).toContain("text-ok");
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
    expect(badge.className).toContain("text-warn");
    // The candidate must never borrow the curriculum colour.
    expect(badge.className).not.toContain("text-ok");
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
    expect(chip.className).toContain("text-accent");
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

    expect(screen.getByText("Grade improvement").className).toContain("border-warn/30");
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
    expect(chip.className).toContain("text-danger");
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

/**
 * The big letter answers a different question than the badge: the badge says
 * the RULE ("Retake · F"), the letter says what the student HAS. It arrives
 * as a prop (the host derives it with `gradeLetter`) and must render big,
 * tone-coloured, and — crucially — NOT render anything when there is none.
 */
describe("TargetCourseLockCard grade letter", () => {
  it("sets the recorded grade big at the card's right edge", () => {
    render(
      <TargetCourseLockCard
        course={course}
        offerings={[]}
        selection={undefined}
        onSelectionChange={() => {}}
        letter={{ text: "B", className: "text-2xl font-black text-warn", title: "Recorded grade: B" }}
      />,
    );

    const letter = screen.getByText("B");
    expect(letter.getAttribute("title")).toBe("Recorded grade: B");
    expect(letter.className).toContain("text-2xl");
    expect(letter.className).toContain("text-warn");
  });

  it("renders no empty span when the host passes no letter", () => {
    const { container } = render(
      <TargetCourseLockCard course={course} offerings={[]} selection={undefined} onSelectionChange={() => {}} />,
    );
    // Nothing to show — and no stray right-edge container left behind.
    expect(container.querySelector('[title^="Recorded grade"]')).toBeNull();
  });
});
