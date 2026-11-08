import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { TipDeck } from "../components/custom/exams/FFCS/features/tour/Tip";

const HINTS = [
  { id: "a", text: "First tip" },
  { id: "b", text: "Second tip" },
  { id: "c", text: "Third tip" },
];

describe("TipDeck", () => {
  afterEach(cleanup);

  it("shows one tip at a time and pages through them, wrapping around", () => {
    render(<TipDeck hints={HINTS} onDismiss={() => {}} />);
    expect(screen.getByText("First tip")).toBeTruthy();
    expect(screen.queryByText("Second tip")).toBeNull();
    expect(screen.getByText("Tip 1/3")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Next tip" }));
    expect(screen.getByText("Second tip")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Previous tip" }));
    fireEvent.click(screen.getByRole("button", { name: "Previous tip" }));
    expect(screen.getByText("Third tip")).toBeTruthy();
  });

  it("dismisses the tip on screen", () => {
    const onDismiss = vi.fn();
    render(<TipDeck hints={HINTS} onDismiss={onDismiss} />);
    fireEvent.click(screen.getByRole("button", { name: "Next tip" }));
    fireEvent.click(screen.getByRole("button", { name: "Dismiss tip" }));
    expect(onDismiss).toHaveBeenCalledWith("b");
  });

  it("stays on a valid tip when the list shrinks, and hides the arrows for one tip", () => {
    const { rerender } = render(<TipDeck hints={HINTS} onDismiss={() => {}} />);
    fireEvent.click(screen.getByRole("button", { name: "Next tip" }));
    fireEvent.click(screen.getByRole("button", { name: "Next tip" }));
    rerender(<TipDeck hints={HINTS.slice(0, 1)} onDismiss={() => {}} />);
    expect(screen.getByText("First tip")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Next tip" })).toBeNull();
    expect(screen.queryByText(/Tip \d\/\d/)).toBeNull();
  });

  it("renders nothing when every tip is dismissed", () => {
    const { container } = render(<TipDeck hints={[]} onDismiss={() => {}} />);
    expect(container.innerHTML).toBe("");
  });
});
