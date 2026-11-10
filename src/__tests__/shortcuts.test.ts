import { describe, expect, it } from "vitest";
import { createSequenceTracker, isTypingTarget, letterOf, NAV_SHORTCUTS, SEQUENCE_TIMEOUT_MS } from "../lib/shortcuts";

describe("letterOf", () => {
  it("reads the physical key, so macOS Option+H still means h", () => {
    expect(letterOf({ code: "KeyH", key: "˙" })).toBe("h");
    expect(letterOf({ code: "KeyA", key: "å" })).toBe("a");
  });
  it("falls back to key for non-letter codes", () => {
    expect(letterOf({ code: "Slash", key: "/" })).toBe("/");
  });
});

describe("g-sequence", () => {
  it("g then a letter jumps to that screen", () => {
    const t = createSequenceTracker(() => 0);
    expect(t.feed("g")).toBe("pending");
    expect(t.feed("a")).toMatchObject({ target: { tab: "attendance" } });
  });

  it("g g goes to grades", () => {
    const t = createSequenceTracker(() => 0);
    t.feed("g");
    expect(t.feed("g")).toMatchObject({ target: { tab: "academics", academicsSub: "grades" } });
  });

  it("expires after the timeout", () => {
    let now = 0;
    const t = createSequenceTracker(() => now);
    t.feed("g");
    now = SEQUENCE_TIMEOUT_MS + 1;
    expect(t.feed("a")).toBeNull();
  });

  it("single letters without g do nothing", () => {
    const t = createSequenceTracker(() => 0);
    expect(t.feed("a")).toBeNull();
  });
});

describe("shortcut table", () => {
  it("has no duplicate keys", () => {
    const keys = NAV_SHORTCUTS.map((s) => s.key);
    expect(new Set(keys).size).toBe(keys.length);
  });
});

describe("isTypingTarget", () => {
  it("treats inputs, textareas, selects and contenteditable as typing", () => {
    for (const tag of ["input", "textarea", "select"]) expect(isTypingTarget(document.createElement(tag))).toBe(true);
    const div = document.createElement("div");
    div.setAttribute("contenteditable", "true");
    expect(isTypingTarget(div)).toBe(true);
    expect(isTypingTarget(document.createElement("button"))).toBe(false);
  });
});
