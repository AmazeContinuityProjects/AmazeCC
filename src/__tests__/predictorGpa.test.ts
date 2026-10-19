import { describe, expect, it } from "vitest";
import { predictGpa, type GpaCourse } from "../lib/predictorGpa";
import type { CGPA } from "../types/data/marks";

/**
 * The predictor's headline GPA pair, as numbers.
 *
 * Two readings share one roster, and the math has to keep them apart:
 * optimal aggregates only pace-graded credits, maximisable aggregates the
 * absolute ceilings, and neither may charge an unpredictable course against
 * the average. Cumulative figures are anchored to the published CGPA over
 * the credits it was earned on — never invented from nothing.
 */

const course = (
  credits: number,
  optimal: string | null = "A",
  maximisable: string | null = "A"
): GpaCourse => ({ credits, optimal, maximisable });

const cumulative = (cgpa: string, creditsEarned: string): CGPA => ({
  cgpa,
  creditsEarned,
});

describe("predictGpa — the two sgpa readings", () => {
  it("weights optimal grades by credits", () => {
    // (9×4 + 10×1) / 5 = 9.2
    const out = predictGpa([course(4, "A", "S"), course(1, "S", "S")]);
    expect(out.optimalSgpa).toBe(9.2);
    expect(out.optimalCredits).toBe(5);
  });

  it("weights maximisable grades over their own origin", () => {
    // optimal: (9×4)/4 = 9; maximisable: (10×4)/4 = 10
    const out = predictGpa([course(4, "A", "S")]);
    expect(out.optimalSgpa).toBe(9);
    expect(out.maximisableSgpa).toBe(10);
  });

  it("excludes a course from optimal while its pace is unreadable — it is not failed for test days not yet held", () => {
    const out = predictGpa([course(4, null, "S"), course(3, "C", "C")]);
    // optimal over the pace-grade course only: 7×3/3 = 7
    expect(out.optimalSgpa).toBe(7);
    expect(out.optimalCredits).toBe(3);
    // maximisable still counts the unpredictable course
    expect(out.maximisableSgpa).toBe(8.71); // (10×4 + 7×3) / 7 = 8.7142…
    expect(out.maximisableCredits).toBe(7);
  });

  it("counts an F at zero points but keeps its credits — a fail is a grade", () => {
    const out = predictGpa([course(4, "F", "F"), course(2, "S", "S")]);
    expect(out.optimalSgpa).toBe(3.33); // (0×4 + 10×2) / 6
    expect(out.desirableCgpa).toBeNull(); // no anchor yet
  });

  it("leaves invalid or zero credits out of every weight", () => {
    const out = predictGpa([course(0, "S", "S"), course(-2, "A", "A"), course(3, "B", "B")]);
    expect(out.optimalSgpa).toBe(8);
    expect(out.optimalCredits).toBe(3);
    expect(out.semesterCredits).toBe(3);
  });

  it("rounds to 2 decimals", () => {
    // (9×2 + 8×5) / 7 = 8.2857… → 8.29
    const out = predictGpa([course(2, "A", "A"), course(5, "B", "B")]);
    expect(out.optimalSgpa).toBe(8.29);
    expect(out.maximisableSgpa).toBe(8.29);
  });

  it("reports zero sgpa when neither reading has gradeable courses", () => {
    const out = predictGpa([course(3, null, null)]);
    expect(out.optimalSgpa).toBe(0);
    expect(out.maximisableSgpa).toBe(0);
    expect(out.optimalCredits).toBe(0);
    expect(out.maximisableCredits).toBe(0);
  });
});

describe("predictGpa — the two cgpa projections", () => {
  it("projects both readings separately onto the anchor", () => {
    const out = predictGpa(
      [course(3, "A", "S")],
      cumulative("8.00", "90")
    );
    // optimal: (90×8 + 3×9) / 93 = 8.0322… → 8.03
    expect(out.optimalCgpa).toBe(8.03);
    // most desirable: (90×8 + 3×10) / 93 = 8.0645… → 8.06
    expect(out.desirableCgpa).toBe(8.06);
    expect(out.desirableCgpa! >= out.optimalCgpa!).toBe(true);
  });

  it("never lets the maximisable reading fall below the anchor-free semester", () => {
    const out = predictGpa([course(3, "B", "S")], cumulative("5.00", "10"));
    // optimal (90×?…) — (10×5 + 3×8)/13 = 5.69; desirable (10×5 + 3×10)/13 = 6.15
    expect(out.optimalCgpa).toBe(5.69);
    expect(out.desirableCgpa).toBe(6.15);
  });

  it("falls back to the anchor untouched when a reading has no graded credits", () => {
    const out = predictGpa(
      [course(3, null, null)],
      cumulative("7.50", "88")
    );
    expect(out.optimalCgpa).toBe(7.5);
    expect(out.optimalCgpaIsAnchor).toBe(true);
    expect(out.desirableCgpa).toBe(7.5);
    expect(out.desirableCgpaIsAnchor).toBe(true);
  });

  it("is null without a published anchor — not zero wearing the label", () => {
    const out = predictGpa([course(3, "A", "S")], null);
    expect(out.optimalCgpa).toBeNull();
    expect(out.desirableCgpa).toBeNull();
  });

  it("is null when the anchor carries no credits to weight", () => {
    const out = predictGpa([course(3, "A", "A")], cumulative("8.60", "0"));
    expect(out.optimalCgpa).toBeNull();
    expect(out.desirableCgpa).toBeNull();
  });

  it("reads the string fields VTOP actually publishes", () => {
    const out = predictGpa(
      [course(3, "S", "S")],
      cumulative("8.10", "20")
    );
    // (20×8.1 + 3×10) / 23 = 8.347…
    expect(out.optimalCgpa).toBe(8.35);
    expect(out.desirableCgpa).toBe(8.35);
  });
});
