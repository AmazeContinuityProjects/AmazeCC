import { describe, expect, it, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup, waitFor } from "@testing-library/react";
import SyncNotification from "../components/custom/shared/SyncNotification";
import type { SyncMode } from "@/lib/sync-engine/sync-modes";
import * as vtopHealth from "@/lib/vtopHealth";
import * as syncSession from "@/lib/sync-engine/sync-session";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  document.body.style.overflow = "";
});

const sampleModes: SyncMode[] = [
  {
    id: "quick",
    label: "Quick Sync",
    description: "Attendance and marks",
    builtIn: true,
    steps: [{ op: "attendanceMarks" }],
  },
  {
    id: "full",
    label: "Full Sync",
    description: "Everything",
    builtIn: true,
    steps: [{ op: "attendanceMarks" }, { op: "core" }],
  },
];

describe("SyncNotification Redesign", () => {
  // The minimized bar is the default now — expand before asserting on the
  // sheet's contents.
  const expand = () => {
    fireEvent.click(screen.getByTitle(/expand sync view/i));
  };

  it("renders active session with hero progress and milestones", () => {
    const onDismiss = vi.fn();
    render(
      <SyncNotification
        active={true}
        progress={45}
        message={"Logging in to VTOP...\nFetching attendance records..."}
        onDismiss={onDismiss}
        modeId="quick"
        defaultModeId="quick"
        modes={sampleModes}
      />,
    );
    expand();

    // Headline derived from latest log line
    expect(screen.getAllByText(/Fetching attendance records/i).length).toBeGreaterThan(0);
    expect(screen.getByText("45%")).toBeDefined();

    // Mode Chip (the exiting minimized pill can linger in the DOM)
    expect(screen.getAllByText("Quick Sync").length).toBeGreaterThan(0);

    // Milestones
    expect(screen.getByText("Authentication & Session")).toBeDefined();
    expect(screen.getByText("Attendance & Timetable")).toBeDefined();
    expect(screen.getByText("Marks & Grades")).toBeDefined();
    expect(screen.getByText("Local Storage & Finalize")).toBeDefined();

    // Bottom Red Neon Cancel Button (pill + sheet both carry one)
    const cancelBtns = screen.getAllByRole("button", { name: /cancel sync/i });
    const cancelBtn = cancelBtns.find((b) => b.className.includes("border-rose-500"))!;
    expect(cancelBtn).toBeDefined();
    expect(cancelBtn.className).toContain("border-rose-500");
    expect(cancelBtn.className).toContain("shadow-");
    fireEvent.click(cancelBtn);
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it("renders a larger, prominent minimize button in the header", () => {
    render(<SyncNotification active={true} progress={25} message="Running sync..." onDismiss={vi.fn()} />);
    expand();

    const minimizeBtn = screen.getByTitle(/run in background/i);
    expect(minimizeBtn).toBeDefined();
    expect(minimizeBtn.className).toContain("p-2");
    expect(minimizeBtn.className).toContain("rounded-xl");
  });

  it("toggles the diagnostics console log drawer", () => {
    render(
      <SyncNotification
        active={true}
        progress={50}
        message={"✅ Captcha validated\n⏳ Fetching timetable..."}
        onDismiss={vi.fn()}
      />,
    );
    expand();

    const diagnosticsBtn = screen.getByRole("button", { name: /diagnostics/i });
    expect(diagnosticsBtn).toBeDefined();

    // Initially console is collapsed; first line is not rendered
    expect(screen.queryByText(/Captcha validated/i)).toBeNull();

    // Click to expand
    fireEvent.click(diagnosticsBtn);
    expect(screen.getByText(/Captcha validated/i)).toBeDefined();
    expect(screen.getAllByText(/Fetching timetable/i).length).toBeGreaterThanOrEqual(1);
  });

  it("allows switching mode from header mode chip", () => {
    const onSelectMode = vi.fn();
    render(
      <SyncNotification
        active={true}
        progress={10}
        message="Starting sync..."
        onDismiss={vi.fn()}
        modeId="quick"
        modes={sampleModes}
        onSelectMode={onSelectMode}
      />,
    );
    expand();

    const modeChip = screen.getByRole("button", { name: /quick sync/i });
    fireEvent.click(modeChip);

    // Dropdown reveals other modes
    const fullModeBtn = screen.getByRole("button", { name: /full sync/i });
    fireEvent.click(fullModeBtn);
    expect(onSelectMode).toHaveBeenCalledWith("full");
  });

  it("supports minimize to mobile capsule dock and expand", () => {
    render(
      <SyncNotification
        active={true}
        progress={30}
        message="Running checks..."
        onDismiss={vi.fn()}
        modeLabel="VTOP Sync"
      />,
    );

    expand();

    const minimizeBtn = screen.getByTitle(/run in background/i);
    fireEvent.click(minimizeBtn);

    // Minimized pill expand button appears
    const expandBtn = screen.getByTitle(/expand sync view/i);
    expect(expandBtn).toBeDefined();

    // Click expand — the exiting pill may linger in the DOM during its exit
    // animation, so target the expanded sheet's Cancel Sync button by text.
    fireEvent.click(expandBtn);
    expect(screen.getByText("Cancel Sync")).toBeDefined();
  });

  it("occupies full screen of the bottom sheet modal on error like offline notice", async () => {
    render(
      <SyncNotification
        active={true}
        progress={100}
        outcome="error"
        message="Connection failed\nServer timed out"
        onDismiss={vi.fn()}
        onRetry={vi.fn()}
      />,
    );

    // Full screen error takeover title once reachability completes
    await waitFor(() => {
      expect(screen.getByText(/Sync Failed/i)).toBeDefined();
    });
    expect(screen.getByRole("button", { name: /retry sync/i })).toBeDefined();
    expect(screen.getByRole("button", { name: /dismiss/i })).toBeDefined();

    // Mode chip and progress bar are NOT rendered in full-screen error takeover
    expect(screen.queryByTitle(/run in background/i)).toBeNull();
    expect(screen.queryByTitle(/change sync mode/i)).toBeNull();
  });

  it("pings vtopcc.vit.ac.in directly and reports 'VTOP is Down' when all APIs fail and ping fails", async () => {
    // Mock pingVtopDirectly to resolve false (VTOP unreachable)
    const pingSpy = vi.spyOn(vtopHealth, "pingVtopDirectly").mockResolvedValue(false);

    render(
      <SyncNotification
        active={true}
        progress={100}
        outcome="error"
        message="AmazeCC API failed\nUniCC fallback also failed\nFailed to fetch"
        onDismiss={vi.fn()}
      />,
    );

    await waitFor(() => {
      expect(pingSpy).toHaveBeenCalled();
    });

    await waitFor(() => {
      expect(screen.getByText(/VTOP is Down/i)).toBeDefined();
    });

    expect(screen.getByText(/did not respond/i)).toBeDefined();
    expect(screen.getByRole("link", { name: /check vtop/i })).toBeDefined();
  });

  it("cancels sync mid-flight and displays full-screen VTOP is Down when vtopcc is detected down", async () => {
    const pingSpy = vi.spyOn(vtopHealth, "pingVtopDirectly").mockResolvedValue(false);
    const closeSpy = vi.spyOn(syncSession, "closeSyncSession");

    render(
      <SyncNotification
        active={true}
        progress={35}
        outcome={null}
        message="Connecting...\nAmazeCC API failed\nFailed to fetch"
        onDismiss={vi.fn()}
      />,
    );

    await waitFor(() => {
      expect(pingSpy).toHaveBeenCalled();
    });

    await waitFor(() => {
      expect(closeSpy).toHaveBeenCalledWith(4000, "error");
    });

    await waitFor(() => {
      expect(screen.getByText(/VTOP is Down/i)).toBeDefined();
    });

    // Verify it occupies full screen: Retry Sync and Check VTOP buttons present
    expect(screen.getByRole("link", { name: /check vtop/i })).toBeDefined();
    expect(screen.getByRole("button", { name: /retry sync/i })).toBeDefined();
  });

  it("directly displays bold 'VTOP is Down' without diagnostics chevron and allows user dismissal", async () => {
    const onDismiss = vi.fn();
    render(
      <SyncNotification
        active={true}
        progress={0}
        outcome="error"
        message="VTOP is down (vtopcc.vit.ac.in unreachable) — sync cancelled"
        onDismiss={onDismiss}
      />,
    );

    // Directly shows bold VTOP is Down
    expect(screen.getByText("VTOP is Down")).toBeDefined();
    expect(screen.getAllByText(/vtopcc\.vit\.ac\.in/i).length).toBeGreaterThan(0);

    // Diagnostics chevron and log accordion are completely omitted
    expect(screen.queryByText(/Error Log & Diagnostics/i)).toBeNull();
    expect(screen.queryByRole("button", { name: /diagnostics/i })).toBeNull();

    // User can dismiss the error directly
    const dismissBtn = screen.getByRole("button", { name: /dismiss/i });
    expect(dismissBtn).toBeDefined();
    fireEvent.click(dismissBtn);
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });
});
