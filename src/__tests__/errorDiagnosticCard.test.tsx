import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ErrorDiagnosticCard from "../components/custom/ErrorDiagnosticCard";
import { sendPostHogSupportTicket } from "@/lib/posthog";

vi.mock("@/lib/posthog", () => ({
  sendPostHogSupportTicket: vi.fn(),
}));

describe("ErrorDiagnosticCard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("sends the displayed error details to PostHog", async () => {
    vi.mocked(sendPostHogSupportTicket).mockResolvedValue({ success: true });

    render(
      <ErrorDiagnosticCard
        title="Something failed while loading this page"
        description="Share this report with the developer."
        error={{ name: "TypeError", message: "activeTab is not defined", digest: "digest-1", stack: "stack trace" }}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /Report this Bug to Developers/i }));
    fireEvent.change(screen.getByPlaceholderText(/opened attendance/i), {
      target: { value: "Opened the home page" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Send Bug Report/i }));

    await waitFor(() => {
      expect(sendPostHogSupportTicket).toHaveBeenCalledWith(
        expect.objectContaining({
          category: "bug",
          message: expect.stringContaining("Opened the home page"),
          metadata: expect.objectContaining({
            error_name: "TypeError",
            error_message: "activeTab is not defined",
            error_digest: "digest-1",
            source: "error_page",
          }),
        }),
      );
    });
    expect(await screen.findByText("Bug Report Sent!")).toBeTruthy();
  });

  it("does not claim the report was sent when PostHog rejects it", async () => {
    vi.mocked(sendPostHogSupportTicket).mockResolvedValue({ success: false });

    render(
      <ErrorDiagnosticCard
        title="Something failed while loading this page"
        description="Share this report with the developer."
        error={{ message: "activeTab is not defined" }}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /Report this Bug to Developers/i }));
    fireEvent.click(screen.getByRole("button", { name: /Send Bug Report/i }));

    expect((await screen.findByRole("alert")).textContent).toContain("Could not send your report");
    expect(screen.queryByText("Bug Report Sent!")).toBeNull();
  });
});
