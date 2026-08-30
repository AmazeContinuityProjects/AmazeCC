import { describe, it, expect } from "vitest";
import {
  computeComponentStats,
  computeCoursePrediction,
  solveTargetFAT,
  estimateGrade,
  normalizeWeights,
  PRESET_REGIMENS,
  PredictorAssessment,
} from "../lib/marksPredictor";

describe("Marks Predictor Calculation Engine", () => {
  describe("computeComponentStats", () => {
    it("should accurately calculate scored weight, lost weight, and max possible for Theory", () => {
      const theoryAssessments: PredictorAssessment[] = [
        { id: "t1", title: "CAT - I", maxMark: 50, weightagePercent: 15, scoredMark: 40, component: "theory" },
        { id: "t2", title: "CAT - II", maxMark: 50, weightagePercent: 15, scoredMark: 45, component: "theory" },
        { id: "t3", title: "DA - 1", maxMark: 10, weightagePercent: 10, scoredMark: 10, component: "theory" },
        { id: "t4", title: "DA - 2", maxMark: 10, weightagePercent: 10, scoredMark: 8, component: "theory" },
        { id: "t5", title: "DA - 3", maxMark: 10, weightagePercent: 10, scoredMark: null, component: "theory" }, // pending
        { id: "t6", title: "FAT", maxMark: 100, weightagePercent: 40, scoredMark: null, component: "theory" }, // pending
      ];

      const stats = computeComponentStats(theoryAssessments, "theory", 3);

      // CAT 1: 40/50 * 15 = 12.0 scored, 3.0 lost
      // CAT 2: 45/50 * 15 = 13.5 scored, 1.5 lost
      // DA 1: 10/10 * 10 = 10.0 scored, 0 lost
      // DA 2: 8/10 * 10 = 8.0 scored, 2.0 lost
      // DA 3: Pending (10 wt)
      // FAT: Pending (40 wt)
      // Total Scored: 12 + 13.5 + 10 + 8 = 43.5
      // Total Lost: 3 + 1.5 + 0 + 2 = 6.5
      // Total Pending: 10 + 40 = 50.0
      // Max Possible: 100 - 6.5 = 93.5

      expect(stats.scoredWeight).toBe(43.5);
      expect(stats.lostWeight).toBe(6.5);
      expect(stats.pendingWeight).toBe(50);
      expect(stats.maxPossibleWeight).toBe(93.5);
      expect(stats.completedAssessmentsCount).toBe(4);
      expect(stats.pendingAssessmentsCount).toBe(2);
    });

    it("should handle 4 PATs and Lab Continuous Evaluation", () => {
      const patAssessments: PredictorAssessment[] = [
        { id: "p1", title: "PAT - I", maxMark: 50, weightagePercent: 10, scoredMark: 45, component: "lab" }, // 9/10 scored
        { id: "p2", title: "PAT - II", maxMark: 50, weightagePercent: 15, scoredMark: 40, component: "lab" }, // 12/15 scored
        { id: "p3", title: "PAT - III", maxMark: 50, weightagePercent: 15, scoredMark: 50, component: "lab" }, // 15/15 scored
        { id: "p4", title: "PAT - IV", maxMark: 50, weightagePercent: 10, scoredMark: null, component: "lab" }, // pending 10
        { id: "p5", title: "Record", maxMark: 100, weightagePercent: 10, scoredMark: 95, component: "lab" }, // 9.5/10 scored
        { id: "p6", title: "Lab FAT", maxMark: 50, weightagePercent: 40, scoredMark: null, component: "lab" }, // pending 40
      ];

      const stats = computeComponentStats(patAssessments, "lab", 1);
      // PAT 1: 9.0 scored, 1.0 lost
      // PAT 2: 12.0 scored, 3.0 lost
      // PAT 3: 15.0 scored, 0 lost
      // Record: 9.5 scored, 0.5 lost
      // Scored: 9 + 12 + 15 + 9.5 = 45.5
      // Lost: 1 + 3 + 0 + 0.5 = 4.5
      // Pending: 10 + 40 = 50.0
      // Max possible: 95.5

      expect(stats.scoredWeight).toBe(45.5);
      expect(stats.lostWeight).toBe(4.5);
      expect(stats.maxPossibleWeight).toBe(95.5);
    });
  });

  describe("computeCoursePrediction (Embedded Theory + Lab scaling)", () => {
    it("should compute credit-weighted combined marks for embedded courses (3 Theory + 1 Lab)", () => {
      const theoryAssessments: PredictorAssessment[] = [
        { id: "t1", title: "CAT - I", maxMark: 50, weightagePercent: 15, scoredMark: 40, component: "theory" }, // 12.0 scored, 3.0 lost
        { id: "t2", title: "CAT - II", maxMark: 50, weightagePercent: 15, scoredMark: 45, component: "theory" }, // 13.5 scored, 1.5 lost
        { id: "t3", title: "DA - 1", maxMark: 10, weightagePercent: 10, scoredMark: 10, component: "theory" }, // 10.0 scored
        { id: "t4", title: "DA - 2", maxMark: 10, weightagePercent: 10, scoredMark: 10, component: "theory" }, // 10.0 scored
        { id: "t5", title: "DA - 3", maxMark: 10, weightagePercent: 10, scoredMark: 10, component: "theory" }, // 10.0 scored
        { id: "t6", title: "FAT", maxMark: 100, weightagePercent: 40, scoredMark: 80, component: "theory" }, // 32.0 scored, 8.0 lost
      ];
      // Theory Scored: 12 + 13.5 + 10 + 10 + 10 + 32 = 87.5 / 100
      // Theory Lost: 3 + 1.5 + 8 = 12.5 / 100

      const labAssessments: PredictorAssessment[] = [
        { id: "l1", title: "Continuous", maxMark: 100, weightagePercent: 60, scoredMark: 95, component: "lab" }, // 57.0 scored, 3.0 lost
        { id: "l2", title: "Lab FAT", maxMark: 50, weightagePercent: 40, scoredMark: 45, component: "lab" }, // 36.0 scored, 4.0 lost
      ];
      // Lab Scored: 57 + 36 = 93.0 / 100
      // Lab Lost: 3 + 4 = 7.0 / 100

      const prediction = computeCoursePrediction({
        courseCode: "BCSE202E",
        courseTitle: "Data Structures",
        courseType: "Embedded Theory",
        theoryAssessments,
        labAssessments,
        theoryCredits: 3,
        labCredits: 1,
      });

      // Combined Scored = (3 * 87.5 + 1 * 93.0) / 4 = (262.5 + 93.0) / 4 = 355.5 / 4 = 88.88
      // Combined Lost = (3 * 12.5 + 1 * 7.0) / 4 = (37.5 + 7.0) / 4 = 44.5 / 4 = 11.125 -> 11.13
      // Max possible = 100 - 11.13 = 88.87 / 88.88

      expect(prediction.currentScoredScaled).toBeCloseTo(88.88, 1);
      expect(prediction.pointsLostScaled).toBeCloseTo(11.13, 1);
      expect(prediction.isEmbedded).toBe(true);
      expect(prediction.estimatedGrade.letter).toBe("A");
    });
  });

  describe("solveTargetFAT", () => {
    it("should calculate exact required FAT score for S grade (90%)", () => {
      // Current scored without FAT is 52.0 out of 60 internal weight
      const result = solveTargetFAT({
        targetScore: 90,
        currentScoredScaled: 52.0,
        fatWeightagePercent: 40,
        fatMaxMark: 100,
      });

      // Deficit needed from FAT = 90 - 52 = 38 wt points
      // Required raw score in FAT = (38 / 40) * 100 = 95.0 / 100
      expect(result.requiredFATWeight).toBe(38);
      expect(result.requiredFATRawScore).toBe(95);
      expect(result.isAchievable).toBe(true);
      expect(result.feasibility).toBe("miracle");
      expect(result.meetsVITMinimumCutoff).toBe(true);
    });

    it("should detect impossible target when deficit exceeds FAT weight", () => {
      // Current scored is 45.0, target is 90
      // Deficit is 45, but FAT is only 40 wt
      const result = solveTargetFAT({
        targetScore: 90,
        currentScoredScaled: 45.0,
        fatWeightagePercent: 40,
        fatMaxMark: 100,
      });

      expect(result.isAchievable).toBe(false);
      expect(result.feasibility).toBe("impossible");
    });

    it("should validate VIT 40% minimum passing cutoff in FAT", () => {
      // Current scored is 50.0, target is 55 (Pass/D grade)
      // Deficit is only 5 wt points (12.5/100 raw mark)
      // But VIT requires at least 40% in FAT (40/100 raw mark)
      const result = solveTargetFAT({
        targetScore: 55,
        currentScoredScaled: 50.0,
        fatWeightagePercent: 40,
        fatMaxMark: 100,
      });

      expect(result.requiredFATRawScore).toBe(12.5);
      expect(result.meetsVITMinimumCutoff).toBe(false); // 12.5 < 40
    });
  });

  describe("normalizeWeights", () => {
    it("should normalize an array of arbitrary weights to sum to 100", () => {
      const items = [
        { title: "CAT 1", weightagePercent: 20 },
        { title: "CAT 2", weightagePercent: 20 },
        { title: "FAT", weightagePercent: 60 },
      ];

      const normalized = normalizeWeights(items);
      const sum = normalized.reduce((acc, i) => acc + i.weightagePercent, 0);
      expect(sum).toBe(100);
    });

    it("should scale uneven weights to 100", () => {
      const items = [
        { title: "Quiz 1", weightagePercent: 15 },
        { title: "Quiz 2", weightagePercent: 15 },
        { title: "Assignment", weightagePercent: 20 },
      ]; // total 50

      const normalized = normalizeWeights(items);
      const sum = normalized.reduce((acc, i) => acc + i.weightagePercent, 0);
      expect(sum).toBe(100);
      expect(normalized[0].weightagePercent).toBe(30);
      expect(normalized[1].weightagePercent).toBe(30);
      expect(normalized[2].weightagePercent).toBe(40);
    });
  });

  describe("estimateGrade", () => {
    it("should return appropriate grade letter and styling for different score brackets", () => {
      expect(estimateGrade(95).letter).toBe("S");
      expect(estimateGrade(85).letter).toBe("A");
      expect(estimateGrade(75).letter).toBe("B");
      expect(estimateGrade(65).letter).toBe("C");
      expect(estimateGrade(55).letter).toBe("D");
      expect(estimateGrade(45).letter).toBe("E");
      expect(estimateGrade(35).letter).toBe("F");
    });
  });
});
