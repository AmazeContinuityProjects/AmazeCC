import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent, act } from "@testing-library/react";
import { Provider } from "jotai";
import { useHydrateAtoms } from "jotai/utils";
import BugRecordingFloatingBar, { formatElapsed } from "../components/custom/feedback/BugRecordingFloatingBar";
import {
  isBugRecordingActiveAtom,
  bugRecordingStartedAtAtom,
  hasBugRecordingClipAtom,
  bugRecordingDurationAtom,
  bugRecordingOriginAtom,
} from "@/store/uiAtoms";
import { DashboardNavigatorProvider } from "../components/custom/dashboard/DashboardNavigator";
import * as posthogModule from "@/lib/posthog";

vi.mock("@/lib/posthog", async () => {
  const actual = await vi.importActual<typeof posthogModule>("@/lib/posthog");
  return {
    ...actual,
    stopPostHogSessionRecording: vi.fn(),
  };
});

function HydrateAtoms({ initialValues, children }: { initialValues: any; children: any }) {
  useHydrateAtoms(initialValues);
  return children;
}

function renderBar(isActive = true, startedAt = Date.now()) {
  return render(
    <Provider>
      <HydrateAtoms
        initialValues={[
          [isBugRecordingActiveAtom, isActive],
          [bugRecordingStartedAtAtom, startedAt],
          [bugRecordingOriginAtom, "page"],
        ]}
      >
        <DashboardNavigatorProvider>
          <BugRecordingFloatingBar />
        </DashboardNavigatorProvider>
      </HydrateAtoms>
    </Provider>,
  );
}

describe("BugRecordingFloatingBar", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it("formats elapsed time correctly", () => {
    expect(formatElapsed(0)).toBe("0:00");
    expect(formatElapsed(9)).toBe("0:09");
    expect(formatElapsed(65)).toBe("1:05");
  });

  it("does not render when recording is inactive", () => {
    renderBar(false, null as any);
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("renders with live timer and Finish & Review button when active", () => {
    renderBar(true, Date.now() - 5000);
    expect(screen.getByRole("status")).toBeDefined();
    expect(screen.getByText(/REC/i)).toBeDefined();
    expect(screen.getByRole("button", { name: /Finish & Review/i })).toBeDefined();
  });

  it("finishes recording and stops PostHog session recording when clicked", () => {
    renderBar(true, Date.now() - 3000);

    const finishBtn = screen.getByRole("button", { name: /Finish & Review/i });
    fireEvent.click(finishBtn);

    expect(posthogModule.stopPostHogSessionRecording).toHaveBeenCalled();
  });

  it("cancels recording when X is clicked", () => {
    renderBar(true, Date.now() - 3000);

    const cancelBtn = screen.getByTitle("Cancel recording");
    fireEvent.click(cancelBtn);

    expect(posthogModule.stopPostHogSessionRecording).toHaveBeenCalled();
  });
});
