import { beforeEach, describe, expect, it } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import {
  FFCSSettingsDefaults,
  sanitizeFFCSSettings,
  useFFCSSettings,
} from "../lib/ffcsSettings";
import { installLocalStorage } from "./helpers/localStorage";

/**
 * Settings are data, and data gets edited by hands and by older app versions:
 * a hand-typed value, a schema bump that adds a field, an app update that
 * renames one. The sanitizer's contract — fall back per *field*, never throw,
 * never reset what is still valid — is the part worth pinning, plus the hook's
 * load-after-mount (storage does not exist during SSR, and guessing on first
 * paint would flash wrong values at everyone with a saved preference).
 */

const store = installLocalStorage();

describe("sanitizeFFCSSettings", () => {
  it("builds a whole record from defaults when the input is garbage", () => {
    expect(sanitizeFFCSSettings("junk")).toEqual(FFCSSettingsDefaults);
    expect(sanitizeFFCSSettings(null)).toEqual(FFCSSettingsDefaults);
    expect(sanitizeFFCSSettings({ rankingMode: 42, defaultSortBy: "nope" })).toEqual(
      FFCSSettingsDefaults
    );
  });

  it("falls back per field, keeping what is still valid", () => {
    const s = sanitizeFFCSSettings({
      defaultSortBy: "social",
      rankingMode: "Early Finish",
      minHalfDays: 99, // out of range → clamped, not defaulted
      showTour: "yes", // wrong type → defaulted
    });
    expect(s.defaultSortBy).toBe("social");
    expect(s.rankingMode).toBe("Early Finish");
    expect(s.minHalfDays).toBe(12);
    expect(s.showTour).toBe(FFCSSettingsDefaults.showTour);
  });

  it("accepts the explicit no-profile choice as its own value", () => {
    expect(sanitizeFFCSSettings({ rankingMode: "none" }).rankingMode).toBe("none");
  });

  it("defaults the wide-screen side-by-side timetable layout to off", () => {
    expect(FFCSSettingsDefaults.showVerticalTimetableBesideWidgets).toBe(false);
    expect(
      sanitizeFFCSSettings({ showVerticalTimetableBesideWidgets: true })
        .showVerticalTimetableBesideWidgets
    ).toBe(true);
    expect(
      sanitizeFFCSSettings({ showVerticalTimetableBesideWidgets: "yes" })
        .showVerticalTimetableBesideWidgets
    ).toBe(false);
  });

  it("shows the generator option pane by default and sanitizes its preference", () => {
    expect(FFCSSettingsDefaults.showGeneratorOptionPane).toBe(true);
    expect(sanitizeFFCSSettings({ showGeneratorOptionPane: false }).showGeneratorOptionPane).toBe(
      false
    );
    expect(
      sanitizeFFCSSettings({ showGeneratorOptionPane: "yes" }).showGeneratorOptionPane
    ).toBe(true);
  });

  it("defaults separate course-list image downloads off and sanitizes the toggle", () => {
    expect(FFCSSettingsDefaults.separateCourseListExport).toBe(false);
    expect(sanitizeFFCSSettings({ separateCourseListExport: true }).separateCourseListExport).toBe(
      true
    );
    expect(
      sanitizeFFCSSettings({ separateCourseListExport: "yes" }).separateCourseListExport
    ).toBe(false);
  });

  it("sanitizes ranking priority order, faculty weights, and review thresholds independently", () => {
    const settings = sanitizeFFCSSettings({
      rankingPriorityOrder: ["faculty", "faculty", "unknown"],
      facultyMetricWeights: { wPct: 10, lecture: -1 },
      facultyScoreFilters: { minWPct: 75, minLecture: 7 },
      defaultSortBy: "faculty",
    });

    expect(settings.rankingPriorityOrder).toEqual(["faculty", "profile", "sort", "time"]);
    expect(settings.facultyMetricWeights).toEqual({
      wPct: 5,
      lecture: 0,
      da: FFCSSettingsDefaults.facultyMetricWeights.da,
      vibe: FFCSSettingsDefaults.facultyMetricWeights.vibe,
    });
    expect(settings.facultyScoreFilters).toEqual({
      minWPct: 75,
      minLecture: 5,
      minDa: 0,
      minVibe: 0,
    });
    expect(settings.defaultSortBy).toBe("faculty");
  });

  it("clamps the result cap into the range the sheet offers", () => {
    expect(sanitizeFFCSSettings({ resultCap: 1 }).resultCap).toBe(10);
    expect(sanitizeFFCSSettings({ resultCap: 99999 }).resultCap).toBe(1000);
    expect(sanitizeFFCSSettings({ resultCap: 250 }).resultCap).toBe(250);
  });

  it("keeps removal of the unlimited search safety ceiling off unless opted in", () => {
    expect(FFCSSettingsDefaults.removeHardResultLimit).toBe(false);
    expect(sanitizeFFCSSettings({ removeHardResultLimit: true }).removeHardResultLimit).toBe(true);
    expect(sanitizeFFCSSettings({ removeHardResultLimit: "yes" }).removeHardResultLimit).toBe(false);
  });
});

describe("useFFCSSettings", () => {
  beforeEach(() => store.clear());

  it("reads what was persisted once mounted", async () => {
    store.setItem(
      "ffcs_settings",
      JSON.stringify({ ...FFCSSettingsDefaults, defaultSortBy: "halfdays" })
    );

    const { result } = renderHook(() => useFFCSSettings());

    // renderHook flushes effects before returning, so the post-mount value is
    // what can actually be observed here; the load-after-mount ordering is
    // what makes the SSR default safe, not something this environment shows.
    await waitFor(() => expect(result.current.settings.defaultSortBy).toBe("halfdays"));
  });

  it("starts from defaults when nothing is stored", () => {
    const { result } = renderHook(() => useFFCSSettings());
    expect(result.current.settings).toEqual(FFCSSettingsDefaults);
  });

  it("persists each update, sanitized", async () => {
    const { result } = renderHook(() => useFFCSSettings());

    act(() => result.current.update("exportFormat", "png"));
    act(() => result.current.update("minHalfDays", 3));
    act(() => result.current.update("showVerticalTimetableBesideWidgets", true));
    act(() => result.current.update("separateCourseListExport", true));

    expect(result.current.settings.exportFormat).toBe("png");
    expect(result.current.settings.minHalfDays).toBe(3);
    expect(result.current.settings.showVerticalTimetableBesideWidgets).toBe(true);
    expect(result.current.settings.separateCourseListExport).toBe(true);
    await waitFor(() => {
      const stored = JSON.parse(store.getItem("ffcs_settings")!);
      expect(stored.exportFormat).toBe("png");
      expect(stored.minHalfDays).toBe(3);
      expect(stored.showVerticalTimetableBesideWidgets).toBe(true);
      expect(stored.separateCourseListExport).toBe(true);
    });
  });

  it("reset clears the key and returns to defaults", async () => {
    const { result } = renderHook(() => useFFCSSettings());
    act(() => result.current.update("resultCap", 250));

    act(() => result.current.reset());

    expect(result.current.settings).toEqual(FFCSSettingsDefaults);
    await waitFor(() => expect(store.getItem("ffcs_settings")).toBeNull());
  });
});
