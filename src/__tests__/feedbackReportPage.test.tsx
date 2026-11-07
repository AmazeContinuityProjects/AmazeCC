import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent, waitFor } from "@testing-library/react";
import { Provider } from "jotai";
import FeedbackReportPage from "../components/custom/feedback/FeedbackReportPage";
import * as posthogModule from "@/lib/posthog";

vi.mock("@/lib/posthog", async () => {
  const actual = await vi.importActual<typeof posthogModule>("@/lib/posthog");
  return {
    ...actual,
    isPostHogConfigured: vi.fn(() => true),
    isPostHogConversationsAvailable: vi.fn(() => true),
    getPostHogDistinctId: vi.fn(() => "21BCE0001"),
    resolveCanonicalDistinctId: vi.fn(() => "21BCE0001"),
    syncPostHogIdentityVerification: vi.fn(async () => null),
    getPostHogSessionId: vi.fn(() => "sess_test123"),
    getPostHogSessionReplayUrl: vi.fn(() => "https://shoot.amazecc.com/replay/sess_test123"),
    startPostHogSessionRecording: vi.fn(() => true),
    stopPostHogSessionRecording: vi.fn(),
    isPostHogSessionRecordingActive: vi.fn(() => false),
    sendPostHogSupportTicket: vi.fn(async () => ({ success: true, ticketId: "ticket_999" })),
    requestPostHogConversationRestore: vi.fn(async () => true),
    getPostHogConversations: vi.fn(() => ({
      isAvailable: () => true,
      sendMessage: vi.fn(async () => ({ ticket_id: "ticket_999" })),
      getTickets: vi.fn(async () => ({
        tickets: [
          {
            id: "ticket_1",
            subject: "Fix schedule clash UI",
            status: "open",
            created_at: new Date().toISOString(),
            last_message: "We deployed a fix in v3.1.2",
          },
        ],
      })),
      getMessages: vi.fn(async () => ({
        messages: [
          {
            id: "msg_1",
            content: "Fix schedule clash UI",
            created_at: new Date().toISOString(),
            is_customer: true,
          },
          {
            id: "msg_2",
            content: "We deployed a fix in v3.1.2",
            created_at: new Date().toISOString(),
            is_customer: false,
            sender: { name: "PostHog Support Agent" },
          },
        ],
      })),
      markAsRead: vi.fn(async () => {}),
      requestRestoreLink: vi.fn(async () => ({ success: true })),
    })),
  };
});

function renderFeedbackPage() {
  return render(
    <Provider>
      <FeedbackReportPage />
    </Provider>,
  );
}

describe("FeedbackReportPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it("renders page header, categories, and PostHog badge", () => {
    renderFeedbackPage();

    expect(screen.getByText("Feedback and Bug Report")).toBeDefined();
    expect(screen.getByText("Bug Report")).toBeDefined();
    expect(screen.getByText("Feature Request")).toBeDefined();
    expect(screen.getByText("UI / UX Polish")).toBeDefined();
    expect(screen.getByText("General Notes")).toBeDefined();
    expect(screen.getByText("PostHog Analytics")).toBeDefined();
  });

  it("toggles reactive DOM session recording and shows privacy guidance", () => {
    renderFeedbackPage();

    const recordingToggle = screen.getByLabelText(/Toggle reactive DOM session recording/i);
    expect(recordingToggle).toBeDefined();

    expect(
      screen.getByText(/The session recording will automatically take place within the reactive DOM of the app/i),
    ).toBeDefined();

    expect(screen.getByText(/the recording may include personal data or grades rendered on screen/i)).toBeDefined();

    fireEvent.click(recordingToggle);
    expect(posthogModule.startPostHogSessionRecording).toHaveBeenCalled();
  });

  it("submits bug report with PostHog session recording opt-in", async () => {
    renderFeedbackPage();

    // Fill in subject & description
    const descInput = screen.getByPlaceholderText(/Explain what went wrong/i);
    fireEvent.change(descInput, { target: { value: "Buttons are unresponsive in Safari 17" } });

    // Enable session recording
    const recordingToggle = screen.getByLabelText(/Toggle reactive DOM session recording/i);
    fireEvent.click(recordingToggle);

    // Click submit
    const submitBtn = screen.getByRole("button", { name: /Submit Report/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(posthogModule.sendPostHogSupportTicket).toHaveBeenCalledWith(
        expect.objectContaining({
          category: "bug",
          includeSessionRecording: true,
          message: expect.stringContaining("Buttons are unresponsive in Safari 17"),
        }),
      );
    });

    expect(screen.getByText("Report Dispatched to PostHog")).toBeDefined();
    expect(screen.getByText("Ticket ID: #ticket_999")).toBeDefined();
  });

  it("switches to My Tickets & Support tab and renders tickets", async () => {
    renderFeedbackPage();

    const ticketsTab = screen.getByText("My Tickets & Support");
    fireEvent.click(ticketsTab);

    await waitFor(() => {
      expect(screen.getByText("Fix schedule clash UI")).toBeDefined();
      expect(screen.getByText("We deployed a fix in v3.1.2")).toBeDefined();
    });
  });

  it("switches to PostHog Diagnostics tab and shows Distinct ID and Session Replay status", () => {
    renderFeedbackPage();

    const diagTab = screen.getByText("PostHog Diagnostics");
    fireEvent.click(diagTab);

    expect(screen.getByText("PostHog Telemetry & Integration Engine")).toBeDefined();
    expect(screen.getAllByText("21BCE0001").length).toBeGreaterThan(0);
    expect(screen.getByText("sess_test123")).toBeDefined();
    expect(screen.getByText("Signed Token Identity Verification")).toBeDefined();
  });
});
