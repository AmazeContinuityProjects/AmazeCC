import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { computeCoursePrediction, type PredictorAssessment } from "../lib/marksPredictor";
import TargetGradeSolver from "../components/custom/exams/marks-predictor/TargetGradeSolver";
import AssessmentMarkSheet from "../components/custom/exams/marks-predictor/AssessmentMarkSheet";

/**
 * The target card's two gates, the FAT's freeze, and the mark sheet's lock.
 *
 * Req 1: the solve speaks only once every non-FAT assessment carries a
 * mark; a VTOP-posted FAT removes the card from the page entirely.
 *
 * The FAT itself is frozen at zero — a tile in the card, never an editor,
 * and no "Edit anyway" past its lock in the sheet.
 *
 * Req 4: any other faculty-posted mark opens locked, with one explicit way
 * past it — "Edit anyway" — after which the banner keeps saying the value
 * is a what-if.
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

function renderSolver(theoryAssessments: PredictorAssessment[]) {
  return render(<TargetGradeSolver prediction={predictionFor(theoryAssessments)} />);
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

  it("removes the whole card once VTOP posts the FAT", () => {
    // Published (not simulated) → a fact: nothing left to aim at, so the
    // card leaves the page entirely.
    const { container } = renderSolver(theory(40, 32, 72));

    expect(container.textContent).toBe("");
    expect(screen.queryByText(/required in fat/i)).toBeNull();
  });
});

/* ------------------------------------------------------------------ */
/* The FAT is frozen at zero: a tile, never an editor, and no card     */
/* once VTOP posts it                                                  */
/* ------------------------------------------------------------------ */

describe("FAT freeze", () => {
  it("keeps the FAT at zero with no way to change it", () => {
    renderSolver(theory(40, 32, null));

    expect(screen.getByText(/counted as 0 — frozen/i)).toBeTruthy();
    expect(screen.queryByText(/tap to set/i)).toBeNull();
    // The slot is a tile, not a button — there is nothing to tap.
    expect(screen.queryByRole("button", { name: /fat/i })).toBeNull();
  });

  it("ignores a reader's old what-if — the card still counts zero", () => {
    renderSolver(theory(40, 32, 61, true));

    expect(screen.getByText(/counted as 0 — frozen/i)).toBeTruthy();
    expect(screen.queryByText(/what-if 61/i)).toBeNull();
    expect(screen.getByText(/required in fat/i)).toBeTruthy();
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

/* ------------------------------------------------------------------ */
/* The FAT sheet: frozen at zero — no edit, no override                */
/* ------------------------------------------------------------------ */

const fatAsm = {
  ...postedAsm,
  id: "t3",
  title: "FAT",
  scoredMark: null,
  percentage: 0,
  isPending: true,
  scoredWeight: 0,
  lostWeight: 40,
};

describe("FAT sheet freeze", () => {
  it("locks an unposted FAT with no way to type a mark", () => {
    render(<AssessmentMarkSheet asm={fatAsm} tone="blue" onClose={() => {}} onUpdateScoredMark={vi.fn()} />);

    expect(screen.getByText(/the fat is frozen at 0/i)).toBeTruthy();
    const input = screen.getByLabelText("Mark for FAT") as HTMLInputElement;
    expect(input.disabled).toBe(true);
    expect(screen.queryByRole("button", { name: /edit anyway/i })).toBeNull();
  });

  it("keeps a posted FAT read-only — no Edit anyway past the lock", () => {
    render(
      <AssessmentMarkSheet
        asm={{ ...fatAsm, scoredMark: 72, percentage: 72, isPending: false }}
        tone="blue"
        onClose={() => {}}
        onUpdateScoredMark={vi.fn()}
      />,
    );

    expect(screen.getByText(/faculty posted/i)).toBeTruthy();
    expect(screen.queryByRole("button", { name: /edit anyway/i })).toBeNull();
    const input = screen.getByLabelText("Mark for FAT") as HTMLInputElement;
    expect(input.disabled).toBe(true);
  });
});
