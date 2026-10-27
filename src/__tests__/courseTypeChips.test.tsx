import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { CourseTypeChips } from "../components/custom/exams/FFCS/components/CourseTypeChips";

describe("CourseTypeChips", () => {
  it("merges theory and lab pairs and resolves their shared labels", () => {
    render(<CourseTypeChips typesInput={["TH", "LO", "ETH", "ELA"]} />);

    expect(screen.getByText("Theory + Lab")).toBeDefined();
    expect(screen.getByText("Embedded Theory and Lab")).toBeDefined();
    expect(screen.queryByText("Theory Only")).toBeNull();
    expect(screen.queryByText("Lab Only")).toBeNull();
  });

  it("returns no chip row when the course has no types", () => {
    const { container } = render(<CourseTypeChips typesInput={[]} />);
    expect(container.childElementCount).toBe(0);
  });
});
