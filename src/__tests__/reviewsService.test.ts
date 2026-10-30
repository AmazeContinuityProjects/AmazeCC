import { describe, it, expect } from "vitest";
import {
  calculateFacultyPriorityScore,
  rerankFacultyCandidates,
  DEFAULT_STUDENT_PRIORITIES,
  type StudentPriorities,
  type FacultyPriorityMetrics,
} from "../lib/ffcsPriorityRanking";
import {
  TEACHING_CONFIG,
  PROJECT_CONFIG,
} from "../config/reviewQuestions";

describe("AmazeCC First-Party Reviews & FFCS Adapter", () => {
  describe("reviewQuestions config constraints", () => {
    it("strictly defines quality questions with 1..5 scale and weights", () => {
      expect(TEACHING_CONFIG.qualityQuestions.length).toBeGreaterThanOrEqual(4);
      expect(PROJECT_CONFIG.qualityQuestions.length).toBeGreaterThanOrEqual(3);

      for (const q of TEACHING_CONFIG.qualityQuestions) {
        expect(q.weight).toBeGreaterThan(0);
        expect(q.minAnchor).toBeDefined();
        expect(q.maxAnchor).toBeDefined();
      }

      for (const q of PROJECT_CONFIG.qualityQuestions) {
        expect(q.weight).toBeGreaterThan(0);
        expect(q.minAnchor).toBeDefined();
        expect(q.maxAnchor).toBeDefined();
      }
    });

    it("has zero free-text fields across all question and tag configs", () => {
      // Ensure no property allows string comments, notes, or open text
      const allQuestions = [
        ...TEACHING_CONFIG.qualityQuestions,
        ...PROJECT_CONFIG.qualityQuestions,
        ...TEACHING_CONFIG.styleQuestions,
        ...PROJECT_CONFIG.styleQuestions,
      ];

      for (const q of allQuestions) {
        expect((q as any).allowFreeText).toBeUndefined();
        expect((q as any).comment).toBeUndefined();
        expect((q as any).textPrompt).toBeUndefined();
      }

      // Ensure all tags are pre-approved fixed strings
      const allTags = [
        ...TEACHING_CONFIG.tags.green,
        ...TEACHING_CONFIG.tags.red,
        ...PROJECT_CONFIG.tags.green,
        ...PROJECT_CONFIG.tags.red,
      ];
      for (const t of allTags) {
        expect(typeof t).toBe("string");
        expect(t.length).toBeGreaterThan(0);
      }
    });
  });

  describe("My Priorities Custom Re-Ranking", () => {
    const mockMetricsA: FacultyPriorityMetrics = {
      clarity: 4.5,
      fairMarking: 4.8,
      marksGenerosity: 4.5,
      attendancePace: 1.5, // very relaxed
      workload: 2.0, // light
      examAlign: 4.2,
    };

    const mockMetricsB: FacultyPriorityMetrics = {
      clarity: 4.9,
      fairMarking: 3.0,
      marksGenerosity: 2.0,
      attendancePace: 5.0, // very strict
      workload: 4.5, // heavy
      examAlign: 4.8,
    };

    it("calculates priority scores with balanced default weights", () => {
      const score = calculateFacultyPriorityScore(4.2, mockMetricsA, DEFAULT_STUDENT_PRIORITIES);
      expect(score).toBeGreaterThan(0);
      expect(score).toBeLessThanOrEqual(100);
    });

    it("weights generous scoring and relaxed attendance higher when prioritized", () => {
      const relaxedPriorities: StudentPriorities = {
        scoringWell: 5,
        relaxedAttendance: 5,
        lightWorkload: 5,
        learningDeeply: 1,
        examPrep: 1,
      };

      const scoreA = calculateFacultyPriorityScore(4.0, mockMetricsA, relaxedPriorities);
      const scoreB = calculateFacultyPriorityScore(4.0, mockMetricsB, relaxedPriorities);

      expect(scoreA).not.toBeNull();
      expect(scoreB).not.toBeNull();
      // Faculty A has relaxed attendance and high generosity, should score much higher than B
      expect(scoreA!).toBeGreaterThan(scoreB!);
    });

    it("orders faculty candidates correctly by custom priority score", () => {
      const facultyA = {
        id: "fac-a",
        name: "Lenient & Relaxed Faculty",
        baseGrade: 3.8,
        metrics: mockMetricsA,
      };

      const facultyB = {
        id: "fac-b",
        name: "Strict Deep-Learning Faculty",
        baseGrade: 4.2,
        metrics: mockMetricsB,
      };

      const relaxedPriorities: StudentPriorities = {
        scoringWell: 5,
        relaxedAttendance: 5,
        lightWorkload: 5,
        learningDeeply: 0,
        examPrep: 0,
      };

      const ranked = rerankFacultyCandidates([facultyB, facultyA], relaxedPriorities);
      expect(ranked[0].id).toBe("fac-a");
    });
  });
});
