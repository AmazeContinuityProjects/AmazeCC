import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import PdfGenerationBadge from "../components/custom/exams/FFCS/components/PdfGenerationBadge";

describe("PdfGenerationBadge Component", () => {
  it("renders nothing when not generating and no messages", () => {
    const { container } = render(<PdfGenerationBadge isGenerating={false} />);
    expect(container.firstChild).toBeNull();
  });

  it("renders collapsed rotating loading badge while PDF is being generated", () => {
    render(
      <PdfGenerationBadge
        isGenerating={true}
        timetableName="Fall 2026 Primary"
        theme="light"
      />
    );

    expect(screen.getByText("Preparing Dossier Download")).toBeDefined();
    expect(screen.getByText("Preparing Fall 2026 Primary download...")).toBeDefined();
    expect(screen.getByText("Light")).toBeDefined();
  });

  it("renders success state and handles dismissal", () => {
    const onDismiss = vi.fn();
    render(
      <PdfGenerationBadge
        isGenerating={false}
        successMessage="Downloaded successfully!"
        timetableName="Fall 2026 Primary"
        theme="dark"
        onDismiss={onDismiss}
      />
    );

    expect(screen.getByText("Dossier Downloaded")).toBeDefined();
    expect(screen.getByText("Downloaded successfully!")).toBeDefined();
    expect(screen.getByText("Dark")).toBeDefined();

    const dismissBtn = screen.getByTitle("Dismiss notification");
    fireEvent.click(dismissBtn);
    expect(onDismiss).toHaveBeenCalled();
  });

  it("renders error state when errorMessage is provided", () => {
    render(
      <PdfGenerationBadge
        isGenerating={false}
        errorMessage="Failed to render timetable"
        timetableName="Fall 2026 Primary"
      />
    );

    expect(screen.getByText("Dossier Download Failed")).toBeDefined();
    expect(screen.getByText("Failed to render timetable")).toBeDefined();
  });
});
