import { describe, expect, it, vi, beforeEach } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import AmazeOnboardingFlow from "../components/custom/onboarding/AmazeOnboardingFlow";

// Mock Sync Engine API
vi.mock("@/lib/sync-engine", () => ({
  api: vi.fn(),
}));

// Mock framer-motion to avoid animation timing issues in tests
vi.mock("framer-motion", () => ({
  AnimatePresence: ({ children }: any) => <>{children}</>,
  m: {
    div: ({ children, className, style, ...props }: any) => (
      <div className={className} style={style} {...props}>
        {children}
      </div>
    ),
  },
}));

describe("AmazeOnboardingFlow interface selection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("skips the interface step when only one interface is available", () => {
    render(<AmazeOnboardingFlow initialStep={1} settings={{}} setSettings={vi.fn()} onComplete={vi.fn()} />);

    expect(screen.queryByText("Choose your interface")).toBeNull();
    expect(screen.getByText("Display & Goals")).toBeDefined();
    expect(screen.getByText("Step 2 of 5")).toBeDefined();
  });

  it("continues from welcome directly to display settings", () => {
    render(<AmazeOnboardingFlow initialStep={0} settings={{}} setSettings={vi.fn()} onComplete={vi.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: /^Continue$/i }));

    expect(screen.queryByText("Choose your interface")).toBeNull();
    expect(screen.getByText("Display & Goals")).toBeDefined();
  });

  it("skips the standalone picker and applies the only available interface", async () => {
    const onComplete = vi.fn();

    render(
      <AmazeOnboardingFlow
        initialStep={1}
        isStandaloneInterfacePicker={true}
        settings={{}}
        setSettings={vi.fn()}
        onComplete={onComplete}
      />,
    );

    expect(screen.queryByText("Choose your interface")).toBeNull();

    await waitFor(() => expect(onComplete).toHaveBeenCalledTimes(1));
  });
});
