import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PageSkeleton } from "../components/custom/shared/primitives/PageSkeleton";

describe("PageSkeleton", () => {
  it("announces what is loading and is marked busy", () => {
    render(<PageSkeleton label="Loading attendance" />);
    const el = screen.getByRole("status", { name: "Loading attendance" });
    expect(el.getAttribute("aria-busy")).toBe("true");
  });
});
