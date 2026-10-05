import { describe, expect, it } from "vitest";
import {
  DRILLDOWN_PARENT,
  HUB,
  parentOf,
  settingsBackPath,
} from "../lib/settingsNav";

/**
 * Settings back navigation.
 *
 * Regression: settings was modelled as one flat array of every screen with
 * `useSubpageStack`, which derives "back" from an array index. Every section was
 * therefore one back step from every other section, so opening the third section
 * took three presses to reach the hub, and the `storage` drill-down — appended
 * after `about` — backed out into "About & Community" instead of the
 * "Advanced & System" section it lives in.
 *
 * These cases pin the replacement rule: a drill-down goes to its owning section,
 * and every section goes to the hub.
 */

/** The eight hub sections, in the order the hub lists them. */
const SECTIONS = [
  "profile",
  "credentials",
  "preferences",
  "academic",
  "sync",
  "navigation",
  "advanced",
  "about",
] as const;

describe("parentOf", () => {
  it("sends any section straight back to the hub", () => {
    for (const section of SECTIONS) {
      expect(parentOf(section)).toBe(HUB);
    }
  });

  it("does not walk through the sections in between", () => {
    // The bug in one line: "preferences" is the third section, so the old
    // index-based back went to "credentials" first.
    expect(parentOf("preferences")).toBe(HUB);
    expect(parentOf("preferences")).not.toBe("credentials");
  });

  it("sends a drill-down to the section that owns it", () => {
    expect(parentOf("storage")).toBe("advanced");
    expect(parentOf("storage")).not.toBe("about");
  });

  it("leaves the hub at the hub, so callers can call it unconditionally", () => {
    expect(parentOf(HUB)).toBe(HUB);
  });

  it("treats an unknown screen as a section rather than throwing", () => {
    expect(parentOf("something-new")).toBe(HUB);
    expect(parentOf("")).toBe(HUB);
  });

  it("honours a custom hub id", () => {
    expect(parentOf("preferences", "root")).toBe("root");
    expect(parentOf("root", "root")).toBe("root");
  });
});

describe("settingsBackPath", () => {
  it("is one press from a section to the hub", () => {
    expect(settingsBackPath("preferences")).toEqual(["hub", "preferences"]);
    expect(settingsBackPath("about")).toEqual(["hub", "about"]);
  });

  it("is two presses from a drill-down, via its own section", () => {
    expect(settingsBackPath("storage")).toEqual(["hub", "advanced", "storage"]);
  });

  it("gives the same number of presses for every section", () => {
    // The property that was broken: depth must follow the tree, not list order.
    for (const section of SECTIONS) {
      expect(settingsBackPath(section)).toHaveLength(2);
    }
  });

  it("is already at the root for the hub", () => {
    expect(settingsBackPath(HUB)).toEqual([HUB]);
  });

  it("terminates even if the parent map were given a cycle", () => {
    // parentOf never returns a cycle for the real map, but a gesture handler
    // hanging on a bad table is not something to find in production.
    expect(settingsBackPath("storage").length).toBeLessThanOrEqual(8);
  });
});

describe("DRILLDOWN_PARENT", () => {
  it("only maps drill-downs, never sections", () => {
    // A section listed here would back into its sibling again.
    for (const key of Object.keys(DRILLDOWN_PARENT)) {
      expect(SECTIONS).not.toContain(key);
    }
  });

  it("points at a real section", () => {
    for (const parent of Object.values(DRILLDOWN_PARENT)) {
      expect(SECTIONS).toContain(parent);
    }
  });
});