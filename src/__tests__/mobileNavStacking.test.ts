import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

/**
 * The mobile bottom nav must sit below every overlay surface.
 *
 * The option-picker portal paints at `z-50` and BottomSheet at `z-55`/`z-60`. When
 * the nav pill sat at `z-55` it floated *above* open pickers on mobile: staying bright
 * and tappable under the dim, swallowing outside-taps meant to dismiss, and covering
 * popups that extended into its region. Sheets must stay above the nav; the nav must
 * stay above page content. That ordering is `content < 40 < overlays`, and this test
 * exists so the next `z-` tweak breaks loudly instead of silently re-burying pickers.
 */
const NAV_SOURCE = readFileSync(
  path.join(
    path.dirname(fileURLToPath(import.meta.url)),
    "../components/custom/header/NavigationTabs.tsx"
  ),
  "utf8"
);

function pillClass(): string {
  const at = NAV_SOURCE.indexOf("mobile-bottom-nav-bar");
  if (at === -1) throw new Error("mobile nav pill marker not found");
  return NAV_SOURCE.slice(Math.max(0, at - 600), at);
}

function zValues(classChunk: string): number[] {
  const out: number[] = [];
  for (const m of classChunk.matchAll(/z-(?:\[(\d+)\]|(\d+))/g)) {
    out.push(Number(m[1] ?? m[2]));
  }
  return out;
}

describe("mobile bottom nav stacking", () => {
  it("paints below the option-picker portal (z-50)", () => {
    const zs = zValues(pillClass());
    expect(zs.length).toBeGreaterThan(0);
    for (const z of zs) expect(z).toBeLessThan(50);
  });

  it("still paints above unindexed page content", () => {
    const zs = zValues(pillClass());
    for (const z of zs) expect(z).toBeGreaterThan(0);
  });
});
