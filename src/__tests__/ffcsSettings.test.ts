import { beforeEach, describe, expect, it } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import { FFCSSettingsDefaults, sanitizeFFCSSettings, useFFCSSettings } from "../lib/ffcsSettings";
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
    expect(sanitizeFFCSSettings({ rankingMode: 42, defaultSortBy: "nope" })).toEqual(FFCSSettingsDefaults);
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
    expect(sanitizeFFCSSettings({ showVerticalTimetableBesideWidgets: true }).showVerticalTimetableBesideWidgets).toBe(
      true,
    );
    expect(sanitizeFFCSSettings({ showVerticalTimetableBesideWidgets: "yes" }).showVerticalTimetableBesideWidgets).toBe(
      false,
    );
  });

  it("shows the generator option pane by default and sanitizes its preference", () => {
    expect(FFCSSettingsDefaults.showGeneratorOptionPane).toBe(true);
    expect(sanitizeFFCSSettings({ showGeneratorOptionPane: false }).showGeneratorOptionPane).toBe(false);
    expect(sanitizeFFCSSettings({ showGeneratorOptionPane: "yes" }).showGeneratorOptionPane).toBe(true);
  });

  it("defaults the curriculum/grade integration on and only accepts a real boolean off", () => {
    // On by default: a student who never opened the sheet still gets the
    // curriculum labels and grade rules in their pickers.
    expect(FFCSSettingsDefaults.integrateCurriculumAndGrades).toBe(true);
    expect(sanitizeFFCSSettings({}).integrateCurriculumAndGrades).toBe(true);
    expect(sanitizeFFCSSettings({ integrateCurriculumAndGrades: false }).integrateCurriculumAndGrades).toBe(false);
    // Anything that is not a boolean falls back to the default, not to off —
    // silently losing the student's data integration would be a bug.
    expect(sanitizeFFCSSettings({ integrateCurriculumAndGrades: "yes" }).integrateCurriculumAndGrades).toBe(true);
    expect(sanitizeFFCSSettings({ integrateCurriculumAndGrades: 0 }).integrateCurriculumAndGrades).toBe(true);
  });

  it("defaults separate course-list image downloads off and sanitizes the toggle", () => {
    expect(FFCSSettingsDefaults.separateCourseListExport).toBe(false);
    expect(sanitizeFFCSSettings({ separateCourseListExport: true }).separateCourseListExport).toBe(true);
    expect(sanitizeFFCSSettings({ separateCourseListExport: "yes" }).separateCourseListExport).toBe(false);
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
    // The ceiling is the engine's own 30K: the widest a capped run can be
    // asked for, with only the per-run Unlimited switch above it.
    expect(sanitizeFFCSSettings({ resultCap: 1 }).resultCap).toBe(10);
    expect(sanitizeFFCSSettings({ resultCap: 99999 }).resultCap).toBe(30000);
    expect(sanitizeFFCSSettings({ resultCap: 30000 }).resultCap).toBe(30000);
    expect(sanitizeFFCSSettings({ resultCap: 250 }).resultCap).toBe(250);
  });

  it("defaults the result cap to the full 30K depth", () => {
    // Generation is uncapped-by-default now: thirty thousand is the engine's
    // own ceiling, and only the per-run Unlimited switch goes above it.
    expect(FFCSSettingsDefaults.resultCap).toBe(30000);
    // A record with no cap at all (hand-edited, or from a much older
    // schema) reads as the default too, never as a silent 50.
    expect(sanitizeFFCSSettings({}).resultCap).toBe(30000);
  });

  it("upgrades a stored fifty — the old shipped default — to 30K exactly once", () => {
    // Every pre-30K record holds a 50 whether or not its student ever opened
    // the cap picker (any other settings save wrote the whole record), so an
    // unstamped 50 is the old default riding along and gets the new one.
    expect(sanitizeFFCSSettings({ ...FFCSSettingsDefaults, revision: 1, resultCap: 50 }).resultCap).toBe(30000);
    // Once the record carries the current stamp, a 50 was picked with the
    // new defaults in view — the student wants fifty, and fifty is kept.
    expect(sanitizeFFCSSettings({ ...FFCSSettingsDefaults, resultCap: 50 }).resultCap).toBe(50);
    // Deliberate non-default caps were never ambiguous; they survive
    // unstamped too.
    expect(sanitizeFFCSSettings({ resultCap: 250 }).resultCap).toBe(250);
  });

  it("defaults All Subjects Mode on and only accepts a real boolean off", () => {
    // ON is this planner's original contract: every selected course must fit.
    expect(FFCSSettingsDefaults.allSubjectsMode).toBe(true);
    expect(sanitizeFFCSSettings({ allSubjectsMode: false }).allSubjectsMode).toBe(false);
    // A wrong-typed value falls back rather than silently switching modes —
    // "off" changes what a run means, so it must be asked for explicitly.
    expect(sanitizeFFCSSettings({ allSubjectsMode: "false" }).allSubjectsMode).toBe(true);
  });

  it("defaults the Vitfac integration on and only accepts a real boolean off", () => {
    // ON is the shipped experience: review scores, photos, and profile links.
    expect(FFCSSettingsDefaults.vitfacIntegration).toBe(true);
    expect(sanitizeFFCSSettings({ vitfacIntegration: false }).vitfacIntegration).toBe(false);
    // Wrong-typed → default. "Off" stops every Vitfac request outright, so it
    // has to be asked for with a real boolean, never coerced into by accident.
    expect(sanitizeFFCSSettings({ vitfacIntegration: "false" }).vitfacIntegration).toBe(true);
  });
});

describe("useFFCSSettings", () => {
  beforeEach(() => store.clear());

  it("reads what was persisted once mounted", async () => {
    store.setItem("ffcs_settings", JSON.stringify({ ...FFCSSettingsDefaults, defaultSortBy: "halfdays" }));

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
