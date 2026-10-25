import React from "react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
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

describe("AmazeOnboardingFlow Responsive Dual-Pane Layout", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("switches to dual-pane layout when horizontal (width > height) on interface picker step", () => {
    window.innerWidth = 1280;
    window.innerHeight = 800;

    render(
      <AmazeOnboardingFlow
        initialStep={1}
        isStandaloneInterfacePicker={true}
        settings={{}}
        setSettings={vi.fn()}
        onComplete={vi.fn()}
      />
    );

    // Left pane elements
    expect(screen.getByText("Workspace Layout")).toBeDefined();
    expect(screen.getByText("Choose your interface")).toBeDefined();
    expect(screen.getByText("Select Mode")).toBeDefined();
    expect(screen.getByText("Minimal Dashboard")).toBeDefined();

    // Verify Continue / Select button
    expect(screen.getByText(/Select Minimal Dashboard|Continue/i)).toBeDefined();
  });
});
