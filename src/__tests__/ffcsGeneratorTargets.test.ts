import { beforeEach, describe, expect, it, vi } from "vitest";
import { installLocalStorage } from "./helpers/localStorage";
import type { CourseLock } from "../components/custom/exams/FFCS/types";
import {
  FFCS_GENERATOR_TARGETS_KEY,
  loadGeneratorTargets,
  pruneGeneratorTargets,
  saveGeneratorTargets,
} from "../lib/ffcsGeneratorTargets";
import { loadSessionPreferences, saveSessionPreferences } from "../lib/ffcsGeneratorSessionPrefs";

// The pick store is localStorage and the seed store is sessionStorage; the
// repo stub supplies the first (jsdom ships without it) and each case
// resets both so no pick survives into the next one.
const storage = installLocalStorage();

const lock = (code: string): CourseLock => ({ code, title: code, allowedSlots: [], allowedFaculty: [] });

describe("pruneGeneratorTargets", () => {
  beforeEach(() => {
    storage.clear();
    saveSessionPreferences({});
  });

  it("drops remembered picks the catalogue no longer offers and keeps the rest", () => {
    saveGeneratorTargets([lock("BCSE101"), lock("GONE999")]);

    pruneGeneratorTargets(new Set(["BCSE101"]));

    expect(loadGeneratorTargets().map((target) => target.code)).toEqual(["BCSE101"]);
  });

  it("prunes the session-pref seed without disturbing the other preferences", () => {
    saveSessionPreferences({
      preference: "morning",
      resultCap: 42,
      targets: [lock("BCSE101"), lock("GONE999")],
    });

    pruneGeneratorTargets(new Set(["BCSE101"]));

    const prefs = loadSessionPreferences();
    expect(prefs.targets?.map((target) => target.code)).toEqual(["BCSE101"]);
    expect(prefs.preference).toBe("morning");
    expect(prefs.resultCap).toBe(42);
  });

  it("writes nothing while every pick still resolves", () => {
    saveGeneratorTargets([lock("BCSE101")]);
    saveSessionPreferences({ preference: "spread", targets: [lock("BCSE101")] });
    const setItem = vi.spyOn(storage, "setItem");

    pruneGeneratorTargets(new Set(["BCSE101", "OTHER201"]));

    expect(setItem).not.toHaveBeenCalled();
    setItem.mockRestore();
  });

  it("survives a corrupt pick store instead of throwing mid-switch", () => {
    storage.setItem(FFCS_GENERATOR_TARGETS_KEY, "{not json");

    expect(() => pruneGeneratorTargets(new Set(["BCSE101"]))).not.toThrow();
    expect(loadGeneratorTargets()).toEqual([]);
  });
});
