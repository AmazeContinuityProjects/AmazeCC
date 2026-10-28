import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

/**
 * Mobile-friendliness fixes that live purely in CSS cannot be observed through
 * jsdom (it applies no styles), so a passing render suite says nothing about
 * them. These guards pin the rules that matter, plus the component markers they
 * coordinate through, so a well-meaning cleanup can't silently reintroduce:
 *
 * - iOS Safari zooming into every sub-16px focused field,
 * - dead-feeling taps (the blue tap highlight is removed globally),
 * - the floating nav pill being buried under FFCS's fixed bottom bars,
 * - icon buttons smaller than the 44px touch minimum losing their
 *   invisible hit-area expansion.
 */
const css = readFileSync(resolve(process.cwd(), "src/app/globals.css"), "utf8");

describe("globals.css mobile rules", () => {
  it("floors editable fields at 16px on touch devices (iOS focus-zoom)", () => {
    expect(css).toMatch(/@media \(pointer: coarse\)/);
    expect(css).toMatch(/font-size: 16px/);
    // Checkbox/radio/range/color are excluded — the floor must not resize them.
    expect(css).toMatch(/:not\(\[type="checkbox"\]\)[\s\S]*?textarea,[\s\S]*?select \{/);
  });

  it("keeps the floor scoped to touch so desktop typography is untouched", () => {
    // Exactly one 16px floor exists, and it is the media-scoped one — an
    // unconditional `input { font-size: 16px }` would change every desktop
    // field's designed size and shows up as a second match here.
    expect(css.match(/font-size: 16px/g)).toHaveLength(1);
    expect(css.indexOf("font-size: 16px")).toBeGreaterThan(css.indexOf("@media (pointer: coarse)"));
  });

  it("gives every tappable element pressed feedback when hover is unavailable", () => {
    expect(css).toMatch(/@media \(hover: none\)/);
    expect(css).toMatch(/:active \{\s*opacity: 0\.75;/);
  });

  it("keeps the 44px hit-area utility for small icon buttons", () => {
    expect(css).toMatch(/\.hit-expand::after \{[\s\S]*?inset: -0\.5rem;/);
  });

  it("coordinates the floating nav pill with embedded FFCS bottom bars", () => {
    // Both selectors must exist — the marker classes live on Dashboard.tsx
    // (dashboard-shell / dashboard-content) and on the FFCS bars
    // (ffcs-bottom-bar in FFCSTimetableTab + FFCSGeneratorSubpage).
    expect(css).toMatch(/\.dashboard-shell:has\(\.ffcs-bottom-bar\) \.mobile-bottom-nav-bar/);
    expect(css).toMatch(/\.dashboard-shell:has\(\.ffcs-bottom-bar\) \.dashboard-content/);
    expect(css).toMatch(/padding-bottom: calc\(9rem \+ env\(safe-area-inset-bottom, 0px\)\)/);
  });
});
