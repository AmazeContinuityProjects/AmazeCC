import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { computeCoursePrediction, type PredictorAssessment } from "../lib/marksPredictor";
import TargetGradeSolver from "../components/custom/exams/marks-predictor/TargetGradeSolver";

afterEach(() => cleanup());

const rows = (catI: number | null, catII: number | null): PredictorAssessment[] => [
  { id: "t1", title: "CAT - I", maxMark: 50, weightagePercent: 15, scoredMark: catI, component: "theory" },
  { id: "t2", title: "CAT - II", maxMark: 50, weightagePercent: 15, scoredMark: catII, component: "theory" },
  { id: "t3", title: "FAT", maxMark: 100, weightagePercent: 40, scoredMark: null, component: "theory" },
];

const prediction = (catI: number | null, catII: number | null) =>
  computeCoursePrediction({
    courseCode: "BCSE1001",
    courseTitle: "Problem Solving",
    courseType: "Theory Only",
    theoryAssessments: rows(catI, catII),
  });

describe("FAT needed per grade", () => {
  it("lists the FAT price of every letter once only the FAT is left", () => {
    // 12 + 9.6 = 21.6 secured. E (50) needs 28.4 of 40 wt → 71/100; C (60)
    // needs 38.4 → 96/100; B (70) is out of reach.
    render(<TargetGradeSolver prediction={prediction(40, 32)} />);
    expect(screen.getByText(/FAT needed per grade/i)).toBeTruthy();
    expect(screen.getByText("E · 71/100")).toBeTruthy();
    expect(screen.getByText("C · 96/100")).toBeTruthy();
    expect(screen.getByText("B · ✕")).toBeTruthy();
    expect(screen.getByText("S · ✕")).toBeTruthy();
  });

  it("is not shown while other assessments are still blank", () => {
    render(<TargetGradeSolver prediction={prediction(40, null)} />);
    expect(screen.queryByText(/FAT needed per grade/i)).toBeNull();
  });

  it("makes a letter the goal when tapped", () => {
    render(<TargetGradeSolver prediction={prediction(40, 32)} />);
    fireEvent.click(screen.getByRole("button", { name: /^C: 96 of 100$/ }));
    // The solve now answers for the C floor.
    expect(screen.getAllByText(/96\.0/).length).toBeGreaterThan(0);
  });
});
