import { describe, expect, it, vi } from "vitest";
import {
  createTapTracker,
  DOUBLE_TAP_MS,
  hasSectionHome,
  NO_HOME_TABS,
  SECTION_HOME,
  sectionHomeFor,
  SINGLE_SCREEN_TABS,
} from "@/lib/sectionHome";

function spySetters() {
  return {
    setActiveAttendanceSubTab: vi.fn(),
    setActiveSubTab: vi.fn(),
    setActiveToolsSubTab: vi.fn(),
    setActiveDayscholarSubTab: vi.fn(),
    setActiveMoreSubTab: vi.fn(),
    setActiveProfileSubTab: vi.fn(),
  };
}

describe("sectionHomeFor", () => {
  it("routes each section to the sub-screen its atom defaults to", () => {
    // These mirror `uiAtoms.ts`; a mismatch means the two lists have drifted.
    expect(SECTION_HOME).toMatchObject({
      academics: "courses-simplified",
      tools: "overview",
      transport: "finder",
      more: "social",
      profile: "settings",
    });
  });

  it("sends Attendance to the calendar, like a single tap already does", () => {
    const s = spySetters();
    expect(sectionHomeFor("attendance", s)).toBe("calendar");
    expect(s.setActiveAttendanceSubTab).toHaveBeenCalledWith("calendar");
  });

  it("resets Academics to its home through the Academics setter", () => {
    const s = spySetters();
    expect(sectionHomeFor("academics", s)).toBe("courses-simplified");
    expect(s.setActiveSubTab).toHaveBeenCalledWith("courses-simplified");
    expect(s.setActiveToolsSubTab).not.toHaveBeenCalled();
  });

  it("resets Tools through the Tools setter and never through Academics", () => {
    const s = spySetters();
    expect(sectionHomeFor("tools", s)).toBe("overview");
    expect(s.setActiveToolsSubTab).toHaveBeenCalledWith("overview");
    expect(s.setActiveSubTab).not.toHaveBeenCalled();
  });

  it("does not let the two sections reset each other", () => {
    const academic = spySetters();
    sectionHomeFor("academics", academic);
    expect(academic.setActiveToolsSubTab).not.toHaveBeenCalled();

    const tools = spySetters();
    sectionHomeFor("tools", tools);
    expect(tools.setActiveSubTab).not.toHaveBeenCalled();
  });

  it("covers every section that has sub-screens", () => {
    const s = spySetters();
    for (const tab of ["attendance", "academics", "tools", "transport", "more", "profile"]) {
      expect(sectionHomeFor(tab, s)).toBe(SECTION_HOME[tab]);
    }
  });

  it("returns null for single-screen tabs so the tap just does its normal job", () => {
    const s = spySetters();
    for (const tab of SINGLE_SCREEN_TABS) {
      expect(sectionHomeFor(tab, s)).toBeNull();
    }
    expect(Object.values(s).every((fn) => !fn.mock.calls.length)).toBe(true);
  });

  it("returns null for toggle icons", () => {
    const s = spySetters();
    for (const tab of NO_HOME_TABS) {
      expect(sectionHomeFor(tab, s)).toBeNull();
    }
  });

  it("tolerates a section whose setter was not passed", () => {
    expect(() => sectionHomeFor("tools", {})).not.toThrow();
    expect(sectionHomeFor("tools", {})).toBe("overview");
  });

  it("treats an unknown tab as having no home", () => {
    expect(sectionHomeFor("nope", spySetters())).toBeNull();
  });
});

describe("hasSectionHome", () => {
  it("is true only for sections with a sub-screen", () => {
    expect(hasSectionHome("academics")).toBe(true);
    expect(hasSectionHome("credentials")).toBe(true);
    for (const tab of [...SINGLE_SCREEN_TABS, ...NO_HOME_TABS]) {
      expect(hasSectionHome(tab)).toBe(false);
    }
  });
});

describe("createTapTracker", () => {
  it("does not treat one tap as a double tap", () => {
    const t = createTapTracker();
    expect(t.tap("academics", { now: 0 }).kind).toBe("single");
  });

  it("treats two quick taps on one icon as a double tap", () => {
    const t = createTapTracker();
    t.tap("academics", { now: 0 });
    expect(t.tap("academics", { now: 120 }).kind).toBe("home");
  });

  it("treats two slow taps as two single taps", () => {
    const t = createTapTracker();
    expect(t.tap("academics", { now: 0 }).kind).toBe("single");
    expect(t.tap("academics", { now: DOUBLE_TAP_MS + 1 }).kind).toBe("single");
  });

  it("accepts a tap exactly on the window boundary", () => {
    const t = createTapTracker();
    t.tap("academics", { now: 0 });
    expect(t.tap("academics", { now: DOUBLE_TAP_MS }).kind).toBe("home");
  });

  it("fires home once for a triple tap", () => {
    const t = createTapTracker();
    t.tap("academics", { now: 0 });
    expect(t.tap("academics", { now: 100 }).kind).toBe("home");
    expect(t.tap("academics", { now: 200 }).kind).toBe("single");
  });

  it("keeps different icons on separate windows", () => {
    const t = createTapTracker();
    t.tap("academics", { now: 0 });
    t.tap("tools", { now: 50 });
    expect(t.tap("tools", { now: 100 }).kind).toBe("home");
  });

  it("forgets an id on reset so the next tap starts fresh", () => {
    const t = createTapTracker();
    t.tap("academics", { now: 0 });
    t.reset("academics");
    expect(t.tap("academics", { now: 10 }).kind).toBe("single");
  });

  it("forgets everything on clear", () => {
    const t = createTapTracker();
    t.tap("academics", { now: 0 });
    t.clear();
    expect(t.tap("academics", { now: 10 }).kind).toBe("single");
  });

  it("honours a custom window", () => {
    const t = createTapTracker(1000);
    t.tap("tools", { now: 0 });
    expect(t.tap("tools", { now: 900 }).kind).toBe("home");
  });

  describe("collapseFirstTap", () => {
    it("is set when the first tap came from another section", () => {
      // You were in Academics and double-tapped Tools: the first tap already
      // committed `tools:<stale subtab>` and wrote it to history.
      const t = createTapTracker();
      const first = t.tap("tools", { now: 0, wasActive: false });
      expect(first.kind).toBe("single");
      const second = t.tap("tools", { now: 100, wasActive: true });
      expect(second).toEqual({ kind: "home", collapseFirstTap: true });
    });

    it("is clear when the first tap was already on that section", () => {
      // You were deep in `tools:qbank` and double-tapped Tools: the first tap
      // changed nothing, so there is no intermediate entry to fold into.
      const t = createTapTracker();
      t.tap("tools", { now: 0, wasActive: true });
      const second = t.tap("tools", { now: 100, wasActive: true });
      expect(second).toEqual({ kind: "home", collapseFirstTap: false });
    });

    it("reads the first tap's active state, not the second tap's", () => {
      // After the first tap React re-renders and the item is now active, so a
      // tracker that sampled on every tap would wrongly report "no collapse".
      const t = createTapTracker();
      t.tap("tools", { now: 0, wasActive: false });
      const second = t.tap("tools", { now: 80, wasActive: true });
      expect(second.kind).toBe("home");
      if (second.kind === "home") expect(second.collapseFirstTap).toBe(true);
    });

    it("defaults wasActive to false, so a bare caller still collapses", () => {
      const t = createTapTracker();
      t.tap("tools", { now: 0 });
      const second = t.tap("tools", { now: 60 });
      expect(second.kind).toBe("home");
      if (second.kind === "home") expect(second.collapseFirstTap).toBe(true);
    });
  });
});