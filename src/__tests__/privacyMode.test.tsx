import { render, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useAppAppearance } from "../components/custom/app/useAppAppearance";
import { StatTile } from "../components/custom/shared/primitives/Surfaces";

describe("privacy mode", () => {
  it("adds and removes the privacy-mode class on <html>", () => {
    const { rerender } = renderHook(({ on }) => useAppAppearance({ privacyMode: on, colorPalette: "default" }, "dark"), {
      initialProps: { on: true },
    });
    expect(document.documentElement.classList.contains("privacy-mode")).toBe(true);
    rerender({ on: false });
    expect(document.documentElement.classList.contains("privacy-mode")).toBe(false);
  });

  it("marks stat tile values as private", () => {
    const { getByText } = render(<StatTile label="CGPA" value="8.91" />);
    expect(getByText("8.91").hasAttribute("data-private")).toBe(true);
  });
});
