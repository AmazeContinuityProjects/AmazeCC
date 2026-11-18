import { describe, it, expect, vi } from "vitest";
import { render, act } from "@testing-library/react";
import { useState } from "react";
import { createTapTracker, getSectionRootTab, sectionHomeFor } from "@/lib/sectionHome";
import CourseDashboard from "@/components/custom/exams/CourseDashboard";

describe("mobile bottom nav double tap linkers", () => {
  it("reliably maps credentials double tap to profile root tab", () => {
    const setters = {
      setActiveProfileSubTab: vi.fn(),
    };
    const subtab = sectionHomeFor("credentials", setters);
    const rootTab = getSectionRootTab("credentials");

    expect(subtab).toBe("credentials");
    expect(setters.setActiveProfileSubTab).toHaveBeenCalledWith("credentials");
    expect(rootTab).toBe("profile");
    expect(rootTab).not.toBe("credentials");
  });

  it("resets academics to courses-simplified subtab and academics root tab", () => {
    const setters = {
      setActiveSubTab: vi.fn(),
    };
    const subtab = sectionHomeFor("academics", setters);
    const rootTab = getSectionRootTab("academics");

    expect(subtab).toBe("courses-simplified");
    expect(setters.setActiveSubTab).toHaveBeenCalledWith("courses-simplified");
    expect(rootTab).toBe("academics");
  });

  it("resets hostel to overview subtab and hostel root tab", () => {
    const setters = {
      setHostelActiveSubTab: vi.fn(),
    };
    const subtab = sectionHomeFor("hostel", setters);
    const rootTab = getSectionRootTab("hostel");

    expect(subtab).toBe("overview");
    expect(setters.setHostelActiveSubTab).toHaveBeenCalledWith("overview");
    expect(rootTab).toBe("hostel");
  });

  it("handles double tap sequence with createTapTracker for credentials", () => {
    const tracker = createTapTracker(350);
    const setters = {
      setActiveProfileSubTab: vi.fn(),
    };
    const selectTab = vi.fn();

    // First tap
    const first = tracker.tap("credentials", { wasActive: false });
    expect(first.kind).toBe("single");
    selectTab("profile");
    setters.setActiveProfileSubTab("credentials");

    // Second tap within window
    const second = tracker.tap("credentials", { wasActive: true });
    expect(second.kind).toBe("home");

    const home = sectionHomeFor("credentials", setters);
    const targetTab = getSectionRootTab("credentials");
    selectTab(targetTab);

    expect(home).toBe("credentials");
    expect(targetTab).toBe("profile");
    expect(selectTab).toHaveBeenLastCalledWith("profile");
    expect(selectTab).not.toHaveBeenCalledWith("credentials");
  });

  it("CourseDashboard resets selected course and clears target on resetKey increment", () => {
    const onClearTarget = vi.fn();
    const setActiveSubTab = vi.fn();
    const loginToVTOP = vi.fn().mockResolvedValue({} as any);

    function TestWrapper() {
      const [resetKey, setResetKey] = useState(0);
      return (
        <div>
          <button onClick={() => setResetKey((k) => k + 1)}>Double Tap</button>
          <CourseDashboard
            marksData={{}}
            attendanceData={{}}
            loginToVTOP={loginToVTOP}
            setActiveSubTab={setActiveSubTab}
            targetCourseCode="CSE1001"
            onClearTarget={onClearTarget}
            resetKey={resetKey}
          />
        </div>
      );
    }

    const { getByText, queryByText } = render(<TestWrapper />);

    // Initially, targeted course is displayed
    expect(queryByText(/CSE1001/i)).toBeTruthy();

    // Trigger double tap (increments resetKey)
    act(() => {
      getByText("Double Tap").click();
    });

    // Course detail should now be dismissed, returning to root landing view
    expect(onClearTarget).toHaveBeenCalled();
  });
});
