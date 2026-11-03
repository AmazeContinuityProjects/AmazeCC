import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { computeCoursePrediction, type PredictorAssessment } from "../lib/marksPredictor";
import TargetGradeSolver from "../components/custom/exams/marks-predictor/TargetGradeSolver";
import AssessmentMarkSheet from "../components/custom/exams/marks-predictor/AssessmentMarkSheet";

/**
 * The target card's two gates and the mark sheet's lock.
 *
 * Req 1/2: the solve speaks only once every non-FAT assessment carries a
 * mark, and a VTOP-posted FAT is a read-out rather than a requirement.
 *
 * Req 4: a faculty-posted mark opens locked, with one explicit way past it —
 * "Edit anyway" — after which the banner keeps saying the value is a what-if.
 */

afterEach(() => {
  cleanup();
});

/* ------------------------------------------------------------------ */
/* Fixtures                                                            */
/* ------------------------------------------------------------------ */

const theory = (
  catI: number | null,
  catII: number | null,
  fat: number | null,
  fatSimulated = false,
): PredictorAssessment[] => [
  { id: "t1", title: "CAT - I", maxMark: 50, weightagePercent: 15, scoredMark: catI, component: "theory" },
  { id: "t2", title: "CAT - II", maxMark: 50, weightagePercent: 15, scoredMark: catII, component: "theory" },
  {
    id: "t3",
    title: "FAT",
    maxMark: 100,
    weightagePercent: 40,
    scoredMark: fat,
    isSimulated: fatSimulated,
    component: "theory",
  },
];

const predictionFor = (theoryAssessments: PredictorAssessment[]) =>
  computeCoursePrediction({
    courseCode: "BCSE1001",
    courseTitle: "Problem Solving",
    courseType: "Theory Only",
    theoryAssessments,
  });

function renderSolver(theoryAssessments: PredictorAssessment[], onOpenFatMark?: () => void) {
  return render(<TargetGradeSolver prediction={predictionFor(theoryAssessments)} onOpenFatMark={onOpenFatMark} />);
}

/* ------------------------------------------------------------------ */
/* Req 1: the solve stays hidden until only the FAT is left            */
/* ------------------------------------------------------------------ */

describe("target card gate", () => {
  it("hides the required-in-FAT answer while any other assessment is blank", () => {
    renderSolver(theory(40, null, null));

    expect(screen.getByText(/assign a mark to every other assessment first/i)).toBeTruthy();
    expect(screen.queryByText(/required in fat/i)).toBeNull();
  });

  it("shows the solve once every other assessment carries a mark", () => {
    renderSolver(theory(40, 32, null));

    expect(screen.getByText(/required in fat/i)).toBeTruthy();
    expect(screen.queryByText(/assign a mark to every other assessment first/i)).toBeNull();
  });

  it("replaces the solve with a read-out once VTOP posts the FAT", () => {
    // Published (not simulated) → a fact, not a variable.
    renderSolver(theory(40, 32, 72));

    expect(screen.getByText(/fat graded/i)).toBeTruthy();
    expect(screen.queryByText(/required in fat/i)).toBeNull();
    expect(screen.getByText(/posted 72 \(72%\) — faculty mark, locked/i)).toBeTruthy();
  });
});

/* ------------------------------------------------------------------ */
/* Req 2: the FAT slot is the ungraded row's home                      */
/* ------------------------------------------------------------------ */

describe("FAT slot", () => {
  it("invites a what-if while no mark exists, and opens the sheet on tap", () => {
    const onOpenFatMark = vi.fn();
    renderSolver(theory(40, 32, null), onOpenFatMark);

    const slot = screen.getByText(/no mark yet — tap to set what you expect/i);
    fireEvent.click(slot.closest("button")!);
    expect(onOpenFatMark).toHaveBeenCalledTimes(1);
  });

  it("shows the reader's what-if, not a posted fact", () => {
    renderSolver(theory(40, 32, 61, true));

    expect(screen.getByText(/what-if 61 \(61%\) — tap to change/i)).toBeTruthy();
    expect(screen.queryByText(/posted 61/i)).toBeNull();
  });
});

/* ------------------------------------------------------------------ */
/* Req 4: posted marks open locked                                     */
/* ------------------------------------------------------------------ */

const postedAsm = {
  id: "t1",
  title: "CAT - I",
  maxMark: 50,
  weightagePercent: 15,
  component: "theory",
  scoredMark: 42,
  percentage: 84,
  isPending: false,
  isSimulated: false,
  scoredWeight: 12.6,
  lostWeight: 2.4,
};

function renderSheet(onUpdate = vi.fn()) {
  const view = render(
    <AssessmentMarkSheet asm={postedAsm} tone="blue" onClose={() => {}} onUpdateScoredMark={onUpdate} />,
  );
  return { ...view, onUpdate };
}

describe("mark sheet lock", () => {
  it("locks a faculty-posted mark, with no editing until overridden", () => {
    const { onUpdate } = renderSheet();

    expect(screen.getByText(/this mark is locked/i)).toBeTruthy();
    const input = screen.getByLabelText("Mark for CAT - I") as HTMLInputElement;
    expect(input.disabled).toBe(true);

    // The chips are editing too — they do not slip past the lock.
    const chip = screen.getByRole("button", { name: "80%" }) as HTMLButtonElement;
    expect(chip.disabled).toBe(true);
    expect(onUpdate).not.toHaveBeenCalled();
  });

  it("lets the reader past with one explicit Edit anyway", () => {
    const { onUpdate } = renderSheet();

    fireEvent.click(screen.getByRole("button", { name: /edit anyway/i }));

    // Banner flips to the what-if wording; the inputs come back.
    expect(screen.queryByText(/this mark is locked/i)).toBeNull();
    expect(screen.getByText(/editing as a what-if/i)).toBeTruthy();
    const input = screen.getByLabelText("Mark for CAT - I") as HTMLInputElement;
    expect(input.disabled).toBe(false);

    fireEvent.change(input, { target: { value: "30" } });
    expect(onUpdate).toHaveBeenCalledWith("t1", 30, true);
  });

  it("leaves a reader-entered what-if editable — no lock on simulated marks", () => {
    render(
      <AssessmentMarkSheet
        asm={{ ...postedAsm, scoredMark: 30, isSimulated: true }}
        tone="blue"
        onClose={() => {}}
        onUpdateScoredMark={vi.fn()}
      />,
    );

    expect(screen.queryByText(/this mark is locked/i)).toBeNull();
    expect(screen.queryByRole("button", { name: /edit anyway/i })).toBeNull();
    const input = screen.getByLabelText("Mark for CAT - I") as HTMLInputElement;
    expect(input.disabled).toBe(false);
  });
});
