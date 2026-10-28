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

  it("keeps the left pane scrollable on a short landscape phone so actions can't clip", () => {
    // iPhone-class landscape: dual-pane kicks in (width > height) but there is
    // only ~350px of height — less than one step's content. The shell is
    // overflow-hidden, so the centre section between the pinned header and the
    // pinned action row must be its own scroll container.
    window.innerWidth = 844;
    window.innerHeight = 390;

    render(
      <AmazeOnboardingFlow
        initialStep={1}
        isStandaloneInterfacePicker={true}
        settings={{}}
        setSettings={vi.fn()}
        onComplete={vi.fn()}
      />
    );

    const heading = screen.getByText("Workspace Layout");
    expect(heading.closest("div.min-h-0.overflow-y-auto")).not.toBeNull();
    // Header and action row stay pinned outside the scroller, still reachable.
    expect(screen.getByText(/Select Minimal Dashboard|Continue/i)).toBeDefined();
  });

  it("makes the portrait step container scrollable on a phone", () => {
    // Portrait phone: steps render in the single-column branch; a tall card
    // (or the keyboard covering half the screen) must scroll inside <main>
    // instead of being clipped by the fixed shell.
    window.innerWidth = 390;
    window.innerHeight = 844;

    render(
      <AmazeOnboardingFlow
        initialStep={1}
        isStandaloneInterfacePicker={true}
        settings={{}}
        setSettings={vi.fn()}
        onComplete={vi.fn()}
      />
    );

    const heading = screen.getByText("Choose your interface");
    expect(heading.closest("main.overflow-y-auto")).not.toBeNull();
  });
});
