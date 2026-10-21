import { describe, expect, it } from "vitest";
import { effectiveCellDensity } from "../components/custom/timetable/useTimetableViewMode";

/**
 * The resolver is the one place that decides what the vertical heatmap renders
 * at, and its rules are subtle enough that they must be asserted, not trusted:
 *
 *   - A phone defaults to compact until a density was picked anywhere — but
 *     the stored `timetableCellDensity` cannot be that signal, because every
 *     install that predates the phone default already persists the old
 *     `"full"` default verbatim. The pristine marker is the *absent* touched
 *     flag.
 *   - An explicit pick (`timetableDensityTouched: true`) must win on a phone
 *     too, or the in-grid toggle and the profile row would lie once.
 *   - A desktop keeps the stored/`"full"` default untouched by all of this.
 */
describe("effectiveCellDensity", () => {
  it("defaults a phone to compact even when the stored legacy default is full", () => {
    expect(effectiveCellDensity("full", undefined, true)).toBe("compact");
  });

  it("defaults a brand-new phone to compact with no stored value", () => {
    expect(effectiveCellDensity(undefined, undefined, true)).toBe("compact");
  });

  it("keeps the full default on a desktop, legacy stored value or not", () => {
    expect(effectiveCellDensity("full", undefined, false)).toBe("full");
    expect(effectiveCellDensity(undefined, undefined, false)).toBe("full");
  });

  it("lets an explicit choice win on a phone, full or compact", () => {
    expect(effectiveCellDensity("full", true, true)).toBe("full");
    expect(effectiveCellDensity("compact", true, true)).toBe("compact");
  });

  it("agrees with itself when a stored compact coexists with no touch", () => {
    expect(effectiveCellDensity("compact", undefined, true)).toBe("compact");
    expect(effectiveCellDensity("compact", undefined, false)).toBe("compact");
  });
});
