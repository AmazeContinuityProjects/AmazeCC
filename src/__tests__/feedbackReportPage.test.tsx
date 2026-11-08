import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent, waitFor } from "@testing-library/react";
import { Provider } from "jotai";
import FeedbackReportPage, { FeedbackSubpage } from "../components/custom/feedback/FeedbackReportPage";
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

function renderFeedbackPage(props?: {
  initialMode?: "guided" | "classic";
  initialStep?: 1 | 2 | 3 | 4;
  initialTab?: FeedbackSubpage;
  initialCategory?: "bug" | "feature" | "experience" | "other";
}) {
  return render(
    <Provider>
      <FeedbackReportPage {...props} />
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

  it("renders overview menu with 3 options following course subpage guidelines", () => {
    renderFeedbackPage();

    expect(screen.getByText("Feedback and Support")).toBeDefined();
    expect(screen.getByText("Support Sections")).toBeDefined();
    expect(screen.getByText("New Report")).toBeDefined();
    expect(screen.getByText("My Tickets & Support")).toBeDefined();
    expect(screen.getByText("PostHog Diagnostics")).toBeDefined();
    expect(screen.getByText("Support Channel")).toBeDefined();
    expect(screen.getByText("Telemetry & Replay")).toBeDefined();
  });

  it("renders categories in guided hero mode and PostHog badge when entering New Report subpage", () => {
    renderFeedbackPage({ initialTab: "report" });

    expect(screen.getByText("New Report")).toBeDefined();
    expect(screen.getByText("Bug Report")).toBeDefined();
    expect(screen.getByText("Feature Request")).toBeDefined();
    expect(screen.getByText("UI / UX Polish")).toBeDefined();
    expect(screen.getByText("General Notes")).toBeDefined();
    expect(screen.getByText("Guided Hero")).toBeDefined();
    expect(screen.getByText("Classic Form")).toBeDefined();
  });

  it("renders the hero submission flow in full screen with full-screen container classes and controls", () => {
    renderFeedbackPage({ initialTab: "report", initialMode: "guided" });

    const heroContainer = screen.getByTestId("guided-hero-container");
    expect(heroContainer).toBeDefined();
    expect(heroContainer.className).toContain("fixed inset-0 z-50 h-[100dvh] w-full");
    expect(screen.getByTitle(/Fullscreen/i)).toBeDefined();
    expect(screen.getByTitle(/Close/i)).toBeDefined();
    expect(screen.getByRole("button", { name: /Classic Form/i })).toBeDefined();
  });

  it("advances to Step 2 in Guided Hero Mode and toggles reactive DOM recording", () => {
    renderFeedbackPage({ initialTab: "report" });

    // Step 1: Click Bug Report menu entry
    fireEvent.click(screen.getByText("Bug Report"));

    // Step 2: Now on concern screen
    const recordingToggle = screen.getByLabelText(/Toggle reactive DOM session recording/i);
    expect(recordingToggle).toBeDefined();

    expect(
      screen.getByText(/The session recording will automatically take place within the reactive DOM of the app/i),
    ).toBeDefined();

    expect(screen.getByText(/the recording may include personal data or grades rendered on screen/i)).toBeDefined();

    fireEvent.click(recordingToggle);
    expect(posthogModule.startPostHogSessionRecording).toHaveBeenCalled();
  });

  it("walks the full Guided Hero flow and submits a bug report", async () => {
    renderFeedbackPage({ initialTab: "report" });

    // Step 1: Click on Bug Report menu entry
    fireEvent.click(screen.getByText("Bug Report"));

    // Step 2: Fill in concern and enable session recording
    const descInput = screen.getByPlaceholderText(/Explain what went wrong/i);
    fireEvent.change(descInput, { target: { value: "Buttons are unresponsive in Safari 17" } });

    const recordingToggle = screen.getByLabelText(/Toggle reactive DOM session recording/i);
    fireEvent.click(recordingToggle);

    // Click "Continue to Contact" to reach Step 3
    const continueBtn = screen.getByRole("button", { name: /Continue to Contact/i });
    fireEvent.click(continueBtn);

    // Step 3: Now on contact screen
    expect(screen.getByText("Where Should We Reach You?")).toBeDefined();

    // Click "Review Summary" to reach Step 4 (separate submission summary page)
    const reviewSummaryBtn = screen.getByRole("button", { name: /Review Summary/i });
    fireEvent.click(reviewSummaryBtn);

    // Step 4: Now on dedicated Submission Summary page
    expect(screen.getByText("Review Your Submission")).toBeDefined();
    expect(screen.getByText(/Submission Summary/i)).toBeDefined();
    expect(screen.getByText("Buttons are unresponsive in Safari 17")).toBeDefined();

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

  it("can switch to Classic Form mode and submit in all-in-one view", async () => {
    renderFeedbackPage({ initialTab: "report" });

    // Switch to Classic Form mode
    fireEvent.click(screen.getByText("Classic Form"));

    // All form inputs are now visible simultaneously
    const descInput = screen.getByPlaceholderText(/Explain what went wrong/i);
    fireEvent.change(descInput, { target: { value: "Classic form feedback submission" } });

    const submitBtn = screen.getByRole("button", { name: /Submit Report/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(posthogModule.sendPostHogSupportTicket).toHaveBeenCalledWith(
        expect.objectContaining({
          category: "bug",
          message: expect.stringContaining("Classic form feedback submission"),
        }),
      );
    });

    expect(screen.getByText("Report Dispatched to PostHog")).toBeDefined();
  });

  it("switches to My Tickets & Support subpage and renders tickets", async () => {
    renderFeedbackPage();

    const ticketsRow = screen.getByText("My Tickets & Support");
    fireEvent.click(ticketsRow);

    await waitFor(() => {
      expect(screen.getByText("Fix schedule clash UI")).toBeDefined();
      expect(screen.getByText("We deployed a fix in v3.1.2")).toBeDefined();
    });
  });

  it("switches to PostHog Diagnostics subpage and shows Distinct ID and Session Replay status", () => {
    renderFeedbackPage();

    const diagRow = screen.getByText("PostHog Diagnostics");
    fireEvent.click(diagRow);

    expect(screen.getByText("PostHog Telemetry & Integration Engine")).toBeDefined();
    expect(screen.getAllByText("21BCE0001").length).toBeGreaterThan(0);
    expect(screen.getByText("sess_test123")).toBeDefined();
    expect(screen.getByText("Signed Token Identity Verification")).toBeDefined();
  });

  it("renders submission summary on a separate page of the flow and navigates back to contact", () => {
    renderFeedbackPage({ initialTab: "report", initialStep: 4 });

    expect(screen.getByText("Review Your Submission")).toBeDefined();
    expect(screen.getByText(/Step 4 of 4 · Submission Summary/i)).toBeDefined();

    const backBtn = screen.getByRole("button", { name: /Back to Contact/i });
    fireEvent.click(backBtn);
    expect(screen.getByText("Where Should We Reach You?")).toBeDefined();
  });

  it("navigates into subpages and back to overview menu via subpage back button", async () => {
    renderFeedbackPage();

    // 1. Navigate to New Report subpage
    fireEvent.click(screen.getByText("New Report"));
    expect(screen.getByText("Bug Report")).toBeDefined();

    // Click back button to return to overview
    fireEvent.click(screen.getByRole("button", { name: /Support Sections/i }));
    expect(screen.getByText("Support Sections")).toBeDefined();
    expect(screen.getByText("My Tickets & Support")).toBeDefined();

    // 2. Navigate to PostHog Diagnostics subpage
    fireEvent.click(screen.getByText("PostHog Diagnostics"));
    expect(screen.getByText("PostHog Telemetry & Integration Engine")).toBeDefined();

    // Click back button to return to overview
    fireEvent.click(screen.getByRole("button", { name: /Support Sections/i }));
    expect(screen.getByText("Support Sections")).toBeDefined();
  });
});
