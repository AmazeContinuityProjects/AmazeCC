import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent, waitFor } from "@testing-library/react";
import { Provider } from "jotai";
import { useHydrateAtoms } from "jotai/utils";
import { isFeedbackModalOpenAtom } from "@/store/uiAtoms";
import FeedbackModal from "../components/custom/feedback/FeedbackModal";
import { DashboardNavigatorProvider } from "../components/custom/dashboard/DashboardNavigator";
import * as posthogModule from "@/lib/posthog";

vi.mock("@/lib/posthog", async () => {
  const actual = await vi.importActual<typeof posthogModule>("@/lib/posthog");
  return {
    ...actual,
    submitPostHogFeedback: vi.fn(() => true),
    trackModalOpen: vi.fn(),
    trackModalClose: vi.fn(),
    trackModalInteraction: vi.fn(),
  };
});

function HydrateAtoms({ initialValues, children }: { initialValues: any; children: any }) {
  useHydrateAtoms(initialValues);
  return children;
}

function renderFeedbackModal(isOpen = true) {
  return render(
    <Provider>
      <HydrateAtoms initialValues={[[isFeedbackModalOpenAtom, isOpen]]}>
        <DashboardNavigatorProvider>
          <FeedbackModal />
        </DashboardNavigatorProvider>
      </HydrateAtoms>
    </Provider>,
  );
}

describe("FeedbackModal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it("does not render when isFeedbackModalOpenAtom is false", () => {
    renderFeedbackModal(false);
    expect(screen.queryByText("Share Feedback")).toBeNull();
  });

  it("renders with categories and rating options when open", () => {
    renderFeedbackModal(true);

    expect(screen.getByText("Share Feedback")).toBeDefined();
    expect(screen.getByText("Experience")).toBeDefined();
    expect(screen.getByText("Feature Request")).toBeDefined();
    expect(screen.getByText("Report Bug")).toBeDefined();
    expect(screen.getByText("Other")).toBeDefined();
    expect(screen.getByPlaceholderText(/Tell us what you love or what could be better/i)).toBeDefined();
  });

  it("submits feedback and displays celebratory confirmation state", async () => {
    renderFeedbackModal(true);

    const textarea = screen.getByPlaceholderText(/Tell us what you love or what could be better/i);
    fireEvent.change(textarea, { target: { value: "AmazeCC is lighting fast! Love the UI." } });

    const submitBtn = screen.getByRole("button", { name: /Submit to PostHog/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(posthogModule.submitPostHogFeedback).toHaveBeenCalledWith(
        expect.objectContaining({
          category: "experience",
          message: "AmazeCC is lighting fast! Love the UI.",
          rating: 5,
          sentiment: "positive",
        }),
      );
    });

    expect(screen.getByText("Thank you for your feedback!")).toBeDefined();
  });
});
