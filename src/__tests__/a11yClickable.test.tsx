import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { clickable } from "../lib/a11y";

describe("clickable", () => {
  it("is focusable, announced as a button and activated by Enter and Space", () => {
    const onActivate = vi.fn();
    render(<div {...clickable(onActivate)}>Open course</div>);
    const el = screen.getByRole("button", { name: "Open course" });
    expect(el.getAttribute("tabindex")).toBe("0");
    fireEvent.keyDown(el, { key: "Enter" });
    fireEvent.keyDown(el, { key: " " });
    fireEvent.keyDown(el, { key: "a" });
    fireEvent.click(el);
    expect(onActivate).toHaveBeenCalledTimes(3);
  });

  it("ignores keys pressed on an inner control", () => {
    const outer = vi.fn();
    const { container } = render(
      <div {...clickable(outer)}>
        <button type="button">Delete</button>
      </div>,
    );
    fireEvent.keyDown(container.querySelector("button")!, { key: "Enter" });
    expect(outer).not.toHaveBeenCalled();
  });

  it("adds nothing when there is no handler", () => {
    expect(clickable(undefined)).toEqual({});
  });
});
