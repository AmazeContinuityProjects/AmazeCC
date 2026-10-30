import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import ExportDossierWidget from "../components/custom/exams/FFCS/components/ExportDossierWidget";

/**
 * The detailed clash-report action is opt-in: the widget renders it only when
 * its callback is wired (the tab wires it; other callers of the header may
 * not), and hides it entirely otherwise — same rule as the print-page buttons
 * beside it.
 */

const requiredProps = {
  courseCount: 3,
  onExportIcal: () => {},
  onExportTimetablesJson: () => {},
};

describe("ExportDossierWidget clash report action", () => {
  afterEach(cleanup);

  it("shows the Detailed report (PDF) action when the callback is provided", () => {
    render(<ExportDossierWidget {...requiredProps} onDownloadClashReport={vi.fn()} />);
    expect(screen.getByRole("button", { name: /Detailed report \(PDF\)/ })).toBeTruthy();
  });

  it("omits the action when no callback is wired", () => {
    render(<ExportDossierWidget {...requiredProps} />);
    expect(screen.queryByRole("button", { name: /Detailed report \(PDF\)/ })).toBeNull();
  });
});
