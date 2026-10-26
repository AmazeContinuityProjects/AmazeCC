import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import FFCSGeneratorViewModeModal from "../components/custom/exams/FFCS/components/modals/FFCSGeneratorViewModeModal";

describe("FFCSGeneratorViewModeModal", () => {
  it("does not render when isOpen is false", () => {
    const { container } = render(
      <FFCSGeneratorViewModeModal
        isOpen={false}
        onClose={vi.fn()}
        currentMode="modern"
        onSelectMode={vi.fn()}
      />
    );
    expect(container.firstChild).toBeNull();
  });

  it("renders both generator view options when open", () => {
    render(
      <FFCSGeneratorViewModeModal
        isOpen={true}
        onClose={vi.fn()}
        currentMode="modern"
        onSelectMode={vi.fn()}
      />
    );

    expect(screen.getByText("Choose Your Generator Experience")).toBeDefined();
    expect(screen.getByText("Modern dashboard")).toBeDefined();
    expect(screen.getByText("Classic full form")).toBeDefined();
    expect(screen.getByText(/Remember my preference/i)).toBeDefined();
    expect(screen.getByRole("radio", { name: /Modern dashboard/ }).getAttribute("aria-checked")).toBe(
      "true"
    );
  });

  it("applies classic view and closes", () => {
    const onSelectMode = vi.fn();
    const onClose = vi.fn();

    render(
      <FFCSGeneratorViewModeModal
        isOpen={true}
        onClose={onClose}
        currentMode="modern"
        onSelectMode={onSelectMode}
      />
    );

    fireEvent.click(screen.getByRole("radio", { name: /Classic full form/ }));
    fireEvent.click(screen.getByRole("button", { name: /Switch to Classic full form/ }));

    expect(onSelectMode).toHaveBeenCalledWith("classic", true);
    expect(onClose).toHaveBeenCalled();
  });
});
