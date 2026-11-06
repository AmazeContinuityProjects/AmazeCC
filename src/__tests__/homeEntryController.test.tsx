import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import HomeEntryController from "@/components/custom/app/HomeEntryController";
import { storage } from "@/lib/storage";

// Mock the heavy AuthenticatedRuntime component
vi.mock("@/components/custom/Main", () => ({
  default: ({ initialIntent, onSignedOut }: { initialIntent?: string; onSignedOut?: () => void }) => (
    <div data-testid="authenticated-workspace">
      <span>Workspace Active</span>
      <span data-testid="initial-intent">{initialIntent ?? "none"}</span>
      <button onClick={onSignedOut} data-testid="sign-out-btn">
        Sign Out
      </button>
    </div>
  ),
}));

// Mock next-themes used in GuestExperience
vi.mock("next-themes", () => ({
  useTheme: () => ({
    resolvedTheme: "dark",
    setTheme: vi.fn(),
  }),
}));

// Provide a mock IntersectionObserver for framer-motion in jsdom
class MockIntersectionObserver {
  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();
}
if (typeof window !== "undefined") {
  window.IntersectionObserver = MockIntersectionObserver as any;
  globalThis.IntersectionObserver = MockIntersectionObserver as any;
}

describe("HomeEntryController", () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.className = "";
  });

  it("immediately shows guest screen the moment it recognizes no login key in storage", () => {
    render(<HomeEntryController />);

    // The guest hero headline and action buttons should be immediately present
    expect(screen.getByText("Your VIT life,")).toBeDefined();
    expect(screen.getAllByRole("button", { name: /Get Started/i })[0]).toBeDefined();
    expect(screen.getAllByRole("button", { name: /Try demo|Try the demo/i })[0]).toBeDefined();

    // Authenticated workspace must NOT be rendered
    expect(screen.queryByTestId("authenticated-workspace")).toBeNull();
  });

  it("transitions immediately to authenticated workspace with login intent when Get Started is clicked", async () => {
    render(<HomeEntryController />);

    const getStartedBtn = screen.getAllByRole("button", { name: /Get Started/i })[0];
    fireEvent.click(getStartedBtn);

    await waitFor(() => {
      expect(screen.getByTestId("authenticated-workspace")).toBeDefined();
      expect(screen.getByTestId("initial-intent").textContent).toBe("login");
    });
  });

  it("transitions immediately to authenticated workspace with demo intent when Try demo is clicked", async () => {
    render(<HomeEntryController />);

    const tryDemoBtn = screen.getAllByRole("button", { name: /Try the demo/i })[0];
    fireEvent.click(tryDemoBtn);

    await waitFor(() => {
      expect(screen.getByTestId("authenticated-workspace")).toBeDefined();
      expect(screen.getByTestId("initial-intent").textContent).toBe("demo");
    });
  });

  it("recognizes existing IDs in storage and mounts authenticated workspace directly", async () => {
    storage.ids.set({
      VtopUsername: "21BCE1234",
      VtopPassword: "password123",
    } as any);

    render(<HomeEntryController />);

    await waitFor(() => {
      expect(screen.getByTestId("authenticated-workspace")).toBeDefined();
    });
    expect(screen.queryByText("Your VIT life,")).toBeNull();
  });

  it("recognizes demo mode in storage and mounts authenticated workspace directly", async () => {
    storage.demoMode.set(true);

    render(<HomeEntryController />);

    await waitFor(() => {
      expect(screen.getByTestId("authenticated-workspace")).toBeDefined();
    });
  });

  it("returns cleanly to guest experience when user signs out", async () => {
    storage.ids.set({
      VtopUsername: "21BCE1234",
      VtopPassword: "password123",
    } as any);

    render(<HomeEntryController />);

    await waitFor(() => {
      expect(screen.getByTestId("authenticated-workspace")).toBeDefined();
    });

    const signOutBtn = screen.getByTestId("sign-out-btn");
    fireEvent.click(signOutBtn);

    await waitFor(() => {
      expect(screen.getByText("Your VIT life,")).toBeDefined();
    });

    expect(screen.queryByTestId("authenticated-workspace")).toBeNull();
  });
});
