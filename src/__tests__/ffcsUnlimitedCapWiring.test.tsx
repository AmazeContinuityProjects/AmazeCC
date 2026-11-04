import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import FFCSGuidedSelector from "../components/custom/exams/FFCS/components/FFCSGuidedSelector";
import {
  FFCSGeneratorSubpage,
  type FFCSGeneratorSubpageProps,
} from "../components/custom/exams/FFCS/FFCSGeneratorSubpage";
import type { GenerateParams, GenerationHandle } from "../components/custom/exams/FFCS/logic/generator";
import type { ParsedCourse, TimetableState } from "@/lib/ffcsTypes";
import { closeTopOverlayFromPop } from "../lib/overlayStack";
import { FFCSSettingsDefaults } from "../lib/ffcsSettings";
import { clearSessionPreferences } from "../lib/ffcsGeneratorSessionPrefs";
import { installLocalStorage } from "./helpers/localStorage";

const storage = installLocalStorage();

/**
 * The 30K cap and the Unlimited switch, as the solver actually receives them.
 *
 * The screens' copy and pills are pinned by their own render suites; what no
 * other test can see is the wire between the two — the `GenerateParams` that
 * leave each screen. That contract changed shape:
 *
 * - 30,000 is a first-class *capped* choice (a `resultCap` of 30_000, no
 *   `noLimit`), no longer a number only the engine's safety ceiling knew;
 * - the per-run Unlimited switch now carries the opt-out itself
 *   (`removeHardResultLimit: true`), where it used to leave the 30K engine
 *   ceiling in place unless a separate Planner Settings toggle was flipped.
 *
 * The engine is mocked at the worker boundary — exactly the seam
 * `useGenerationRun` drives — so these pin what each screen *asks for*, not
 * how a 30K-deep walk behaves (which `ffcs-generate-stream.test.ts` owns).
 */

const startGeneration = vi.fn();

vi.mock("../components/custom/exams/FFCS/logic/generator", () => ({
  startGeneration: (...args: unknown[]) => startGeneration(...args),
}));

// Both screens await the live Vitfac catalog before solving. Reviews are
// irrelevant to the params under test, so the load answers instantly.
vi.mock("@/lib/vitfacService", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../lib/vitfacService")>()),
  loadVitfacRankingData: vi.fn().mockResolvedValue({ available: false, ratings: {} }),
}));

const oneTimetable: TimetableState[] = [{ id: "tt-1", name: "Option 1", courses: [] }] as TimetableState[];

const nextRunSettles = () =>
  startGeneration.mockImplementation(() => {
    const handle: GenerationHandle = {
      result: Promise.resolve({ kind: "ok", timetables: oneTimetable, capped: false }),
      cancel: vi.fn(),
    };
    return handle;
  });

/** The params of the single run a screen performed. */
const runParams = (): GenerateParams => {
  expect(startGeneration).toHaveBeenCalledTimes(1);
  return startGeneration.mock.calls[0][0] as GenerateParams;
};

// Top-level, so it runs before each describe's `nextRunSettles` hook: the
// call ledger starts empty for every test. Clearing after the fact (in
// `afterEach`) is not enough — `vi.restoreAllMocks()` there can leave a
// phantom 0-arg entry behind, which would make a single-run test look like
// it ran twice.
beforeEach(() => startGeneration.mockClear());

afterEach(async () => {
  // The overlay stack is module-global; a leaked entry makes the next
  // system-back assertion pass for the wrong reason. Unmount first: a
  // page-like overlay can consume back internally and re-push its entry,
  // which spins the drain loop forever while the component is still live.
  cleanup();
  let guard = 0;
  while (closeTopOverlayFromPop() && guard++ < 25) {
    await act(async () => {});
  }
  storage.clear();
  clearSessionPreferences();
  vi.restoreAllMocks();
});

/* ── guided selector ───────────────────────────────────────────────────── */

const masterCourses: ParsedCourse[] = [
  {
    CODE: "BCSE101",
    TITLE: "Data Structures",
    TYPE: "Embedded Theory",
    CREDITS: "4",
    SLOT: "A1+TA1+TAA1",
    ROOM: "SJT-101",
    FACULTY: "DR. ALICE",
  },
  {
    CODE: "BCSE102",
    TITLE: "Algorithms",
    TYPE: "TH",
    CREDITS: "3",
    SLOT: "B1+TB1",
    ROOM: "TT-201",
    FACULTY: "DR. BOB",
  },
] as ParsedCourse[];

/** Walk the guided flow to Screen 3, where the cap pills live. */
const reachCapPicker = () => {
  render(
    <FFCSGuidedSelector
      masterCourses={masterCourses}
      activeTimetable={{ id: "tt-0", name: "Target", courses: [] } as TimetableState}
      allTimetables={[]}
      onAddCourse={vi.fn()}
      onToggleBlockSlot={vi.fn()}
    />,
  );
  fireEvent.click(screen.getByText("Auto-Generate Timetable"));
  fireEvent.click(screen.getByRole("button", { name: /Continue to Timetable Selection/i }));
  fireEvent.click(screen.getByRole("button", { name: /Continue to Course Strategy/i }));
  fireEvent.click(screen.getByText("Normally Add Courses in List"));
  fireEvent.click(screen.getByRole("button", { name: /Continue to Course Selection/i }));
  fireEvent.click(screen.getByText("Algorithms"));
  fireEvent.click(screen.getByRole("button", { name: /Configure Slots & Faculty \(1\)/i }));
  fireEvent.click(screen.getByRole("button", { name: /Continue to Class Timings/i }));
  fireEvent.click(screen.getByRole("button", { name: /Continue to Day & Slot Blocking/i }));
  fireEvent.click(screen.getByRole("button", { name: /Continue to Half-Days & Limits/i }));
};

const runFromBlueprint = async () => {
  fireEvent.click(screen.getByRole("button", { name: /Review Generation Blueprint/i }));
  fireEvent.click(screen.getByRole("button", { name: /Generate Timetable Recommendations/i }));
  await waitFor(() => expect(startGeneration).toHaveBeenCalled());
};

describe("guided selector cap wiring", () => {
  beforeEach(() => nextRunSettles());

  it("defaults the cap to 30K and sends it to the solver as resultCap", async () => {
    reachCapPicker();

    // No pill was clicked: 30K is what the picker lands on, and the section
    // header reads the number in full.
    expect(screen.getByText("30,000 Timetables")).toBeDefined();

    await runFromBlueprint();

    const params = runParams();
    // Capped, not unlimited: 30K is a real search depth the student asked
    // for by default, and nothing about the run should read as a
    // ceiling-lifted one.
    expect(params.noLimit).toBe(false);
    expect(params.resultCap).toBe(30_000);
    expect(params.removeHardResultLimit).toBe(false);
  });

  it("makes Unlimited lift the 30K ceiling outright", async () => {
    reachCapPicker();

    fireEvent.click(screen.getByRole("button", { name: "Unlimited ✨" }));
    // No qualifier: the switch means no ceiling, so there is no "(30k max)"
    // left to append to the word.
    expect(screen.getByText("Unlimited")).toBeDefined();

    await runFromBlueprint();

    const params = runParams();
    expect(params.noLimit).toBe(true);
    // The switch carries the opt-out itself — without this, an unlimited run
    // silently keeps the engine's 30,000 ceiling and "Unlimited" would be a
    // lie told by the UI.
    expect(params.removeHardResultLimit).toBe(true);
    // No cap competes with the switch: the per-run choice is the newest one.
    expect(params.resultCap).toBeUndefined();
  });
});

/* ── generator subpage ─────────────────────────────────────────────────── */

const courseLock = { code: "BCSE101", title: "BCSE101 course", allowedSlots: [], allowedFaculty: [] };

const subpageProps = (over: Partial<FFCSGeneratorSubpageProps> = {}): FFCSGeneratorSubpageProps => ({
  onClose: vi.fn(),
  settings: FFCSSettingsDefaults,
  courseLocks: [courseLock],
  friends: [],
  socialScoreGroupMethod: "cumulative",
  friendGroups: [],
  masterCourses,
  blockedSlots: new Set<string>(),
  timetables: [{ id: "default", name: "Timetable 1", courses: [] }],
  setTimetables: vi.fn(),
  setActiveTimetableId: vi.fn(),
  error: null,
  setError: vi.fn(),
  successMsg: null,
  setSuccessMsg: vi.fn(),
  getGroupedCourses: () => [],
  generatorDisplayCourses: [{ code: "BCSE101", title: "Data Structures", types: [] as string[] }],
  semesterReportCourses: [],
  isLoadingCourses: false,
  theoryPeriods: [],
  labPeriods: [],
  toggleBlockSlot: vi.fn(),
  ...over,
});

/** The classic full form: every constraint row is on the page, not behind a section nav. */
const renderSubpage = (over: Partial<FFCSGeneratorSubpageProps> = {}) => {
  storage.setItem("ffcs_generator_view_mode", "classic");
  render(<FFCSGeneratorSubpage {...subpageProps(over)} />);
};

describe("generator subpage cap wiring", () => {
  beforeEach(() => nextRunSettles());

  it("defaults the cap segment to 30K and sends it to the solver as resultCap", async () => {
    renderSubpage();

    // Nothing was clicked: the 30K segment is the one already lit.
    expect(screen.getByRole("button", { name: "30K", pressed: true })).toBeTruthy();

    fireEvent.click(screen.getAllByRole("button", { name: /generate timetables/i })[0]);
    await waitFor(() => expect(startGeneration).toHaveBeenCalled());

    const params = runParams();
    expect(params.noLimit).toBe(false);
    expect(params.resultCap).toBe(30_000);
    expect(params.removeHardResultLimit).toBe(false);
  });

  it("makes Remove result cap lift the 30K ceiling outright", async () => {
    renderSubpage();

    const toggle = screen.getByRole("switch", { name: /Remove result cap/i });
    fireEvent.click(toggle);
    // The row explains the new meaning while it is on.
    expect(screen.getByText(/No cap — the search keeps every conflict-free option it finds\./)).toBeTruthy();

    fireEvent.click(screen.getAllByRole("button", { name: /generate timetables/i })[0]);
    await waitFor(() => expect(startGeneration).toHaveBeenCalled());

    const params = runParams();
    expect(params.noLimit).toBe(true);
    // Same contract as the guided selector: the switch itself lifts the
    // engine's 30,000 ceiling.
    expect(params.removeHardResultLimit).toBe(true);
  });
});
