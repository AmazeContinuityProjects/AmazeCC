import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import FFCSLayoutModeModal from "../components/custom/exams/FFCS/components/modals/FFCSLayoutModeModal";

describe("FFCSLayoutModeModal", () => {
  it("does not render when isOpen is false", () => {
    const { container } = render(
      <FFCSLayoutModeModal
        isOpen={false}
        onClose={vi.fn()}
        currentMode="modern"
        onSelectMode={vi.fn()}
      />
    );
    expect(container.firstChild).toBeNull();
  });

  it("renders both layout mode options and header details when open", () => {
    render(
      <FFCSLayoutModeModal
        isOpen={true}
        onClose={vi.fn()}
        currentMode="modern"
        onSelectMode={vi.fn()}
      />
    );

    expect(screen.getByText("Choose Your Planner Experience")).toBeDefined();
    expect(screen.getByText("Guided Hero Mode")).toBeDefined();
    expect(screen.getByText("Standard Single Page View")).toBeDefined();
    expect(screen.getByText("Mobile First")).toBeDefined();
    expect(screen.getByText("All-in-One")).toBeDefined();
    expect(screen.getByText(/Remember my preference/i)).toBeDefined();
  });

  it("selects Guided Hero Mode and triggers onSelectMode with remember flag", () => {
    const onSelectMode = vi.fn();
    const onClose = vi.fn();

    render(
      <FFCSLayoutModeModal
        isOpen={true}
        onClose={onClose}
        currentMode="modern"
        onSelectMode={onSelectMode}
      />
    );

    const guidedOption = screen.getByText("Guided Hero Mode").closest("button");
    expect(guidedOption).toBeDefined();
    fireEvent.click(guidedOption!);

    const switchBtn = screen.getByText("Switch to Guided Hero Mode");
    fireEvent.click(switchBtn);

    expect(onSelectMode).toHaveBeenCalledWith("guided", true);
    expect(onClose).toHaveBeenCalled();
  });

  it("selects Standard Single Page View and unchecks remember preference", () => {
    const onSelectMode = vi.fn();
    const onClose = vi.fn();

    render(
      <FFCSLayoutModeModal
        isOpen={true}
        onClose={onClose}
        currentMode="guided"
        onSelectMode={onSelectMode}
      />
    );

    const standardOption = screen.getByText("Standard Single Page View").closest("button");
    expect(standardOption).toBeDefined();
    fireEvent.click(standardOption!);

    // Uncheck remember preference
    const checkbox = screen.getByRole("checkbox");
    fireEvent.click(checkbox);

    const switchBtn = screen.getByText("Switch to Standard View");
    fireEvent.click(switchBtn);

    expect(onSelectMode).toHaveBeenCalledWith("modern", false);
    expect(onClose).toHaveBeenCalled();
  });

  it("invokes onClose when clicking Cancel", () => {
    const onSelectMode = vi.fn();
    const onClose = vi.fn();

    render(
      <FFCSLayoutModeModal
        isOpen={true}
        onClose={onClose}
        currentMode="modern"
        onSelectMode={onSelectMode}
      />
    );

    const cancelBtn = screen.getByText("Cancel");
    fireEvent.click(cancelBtn);

    expect(onClose).toHaveBeenCalled();
    expect(onSelectMode).not.toHaveBeenCalled();
  });
});
