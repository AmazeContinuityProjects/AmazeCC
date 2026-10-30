import { describe, it, expect } from "vitest";
import {
  schemaVersion,
  SCHEMA_VERSION,
  TEACHING_CONFIG,
  PROJECT_CONFIG,
  CANONICAL_REVIEW_QUESTIONS,
  getEffectiveQuestionWeights,
} from "../config/reviewQuestions";

describe("AmazeCC Shared Reviews Schema & Contract Specification", () => {
  describe("Canonical Schema Versioning (R1 Contract Specification)", () => {
    it("exports canonical schemaVersion strictly equal to '1.0.0'", () => {
      expect(schemaVersion).toBe("1.0.0");
      expect(SCHEMA_VERSION).toBe("1.0.0");
    });

    it("embodies schemaVersion in TEACHING_CONFIG and PROJECT_CONFIG", () => {
      expect(TEACHING_CONFIG.schemaVersion).toBe("1.0.0");
      expect(PROJECT_CONFIG.schemaVersion).toBe("1.0.0");
    });

    it("provides CANONICAL_REVIEW_QUESTIONS matching schemaVersion '1.0.0'", () => {
      expect(CANONICAL_REVIEW_QUESTIONS.schemaVersion).toBe("1.0.0");
      expect(CANONICAL_REVIEW_QUESTIONS.teaching.track).toBe("teaching");
      expect(CANONICAL_REVIEW_QUESTIONS.project.track).toBe("project");
    });
  });

  describe("Question Criteria & Scoring Contracts", () => {
    it("enforces that Theory quality questions weights sum exactly to 100", () => {
      const theoryQuestions = TEACHING_CONFIG.qualityQuestions.filter(
        (q) => !q.conditional
      );
      const totalWeight = theoryQuestions.reduce((sum, q) => sum + q.weight, 0);
      expect(totalWeight).toBe(100);
    });

    it("enforces that Project Guide quality questions weights sum exactly to 100", () => {
      const totalWeight = PROJECT_CONFIG.qualityQuestions.reduce(
        (sum, q) => sum + q.weight,
        0
      );
      expect(totalWeight).toBe(100);
    });

    it("correctly re-normalizes weights for Lab / Embedded components via getEffectiveQuestionWeights", () => {
      const theoryWeights = getEffectiveQuestionWeights("teaching", "Theory");
      const theorySum = Object.values(theoryWeights).reduce((a, b) => a + b, 0);
      expect(Math.round(theorySum)).toBe(100);
      expect(theoryWeights["T_LAB"]).toBeUndefined();

      const labWeights = getEffectiveQuestionWeights("teaching", "Lab");
      const labSum = Object.values(labWeights).reduce((a, b) => a + b, 0);
      expect(Math.round(labSum)).toBe(100);
      expect(labWeights["T_LAB"]).toBeGreaterThan(0);

      const embeddedWeights = getEffectiveQuestionWeights("teaching", "Embedded");
      const embeddedSum = Object.values(embeddedWeights).reduce((a, b) => a + b, 0);
      expect(Math.round(embeddedSum)).toBe(100);
      expect(embeddedWeights["T_LAB"]).toBeGreaterThan(0);
    });

    it("guarantees absolute absence of free-text fields in question definitions", () => {
      const allQuestions = [
        ...TEACHING_CONFIG.qualityQuestions,
        ...PROJECT_CONFIG.qualityQuestions,
        ...TEACHING_CONFIG.styleQuestions,
        ...PROJECT_CONFIG.styleQuestions,
      ];

      for (const q of allQuestions) {
        expect(q).not.toHaveProperty("comment");
        expect(q).not.toHaveProperty("freeText");
        expect(q).not.toHaveProperty("feedback");
        expect(q).not.toHaveProperty("text");
      }
    });
  });

  describe("Public Snapshot Contracts", () => {
    it("validates Catalog Snapshot JSON schema adherence", () => {
      const sampleCatalogSnapshot = {
        schemaVersion: "1.0.0",
        faculty: [
          {
            id: "b49bf45d-b417-4044-a91b-53e5ad109a79",
            employee_id: "10234",
            name: "Dr. Anusooya G",
            name_norm: "anusooya g",
            school: "SCOPE",
            designation: "Associate Professor",
            image_url: null,
            vitfac_id: "vitfac_anusooya",
            teaching_grade: 4.25,
            teaching_reviews: 12,
            teaching_verified_ratio: 0.92,
            project_grade: null,
            project_reviews: 0,
            updated_at: "2026-10-30T12:00:00.000Z",
          },
        ],
        updated_at: "2026-10-30T12:00:00.000Z",
      };

      expect(sampleCatalogSnapshot.schemaVersion).toBe("1.0.0");
      expect(Array.isArray(sampleCatalogSnapshot.faculty)).toBe(true);
      expect(typeof sampleCatalogSnapshot.updated_at).toBe("string");

      const item = sampleCatalogSnapshot.faculty[0];
      expect(typeof item.id).toBe("string");
      expect(typeof item.name).toBe("string");
      expect(typeof item.name_norm).toBe("string");
      expect(typeof item.teaching_reviews).toBe("number");
      expect(typeof item.teaching_verified_ratio).toBe("number");
    });

    it("validates Faculty Profile Snapshot JSON schema adherence", () => {
      const sampleProfileSnapshot = {
        schemaVersion: "1.0.0",
        faculty: {
          id: "b49bf45d-b417-4044-a91b-53e5ad109a79",
          employee_id: "10234",
          name: "Dr. Anusooya G",
          school: "SCOPE",
          designation: "Associate Professor",
          image_url: null,
          vitfac_id: "vitfac_anusooya",
        },
        teaching: {
          track: "teaching",
          course_code: "",
          n_reviews: 12,
          n_verified: 11,
          grade: 4.25,
          is_early: false,
          per_question: {
            T_CLARITY: { avg: 4.3, dist: [0, 1, 2, 4, 5] },
          },
          style: {
            S_PACE: { avg: 3.1 },
          },
          top_tags_green: [{ tag: "Explains with examples", count: 8 }],
          top_tags_red: [{ tag: "Strict attendance", count: 4 }],
          courses: ["CSE1001", "CSE2005"],
        },
        project: null,
        teaching_by_course: {},
        updated_at: "2026-10-30T12:00:00.000Z",
      };

      expect(sampleProfileSnapshot.schemaVersion).toBe("1.0.0");
      expect(sampleProfileSnapshot.faculty.id).toBeDefined();
      expect(sampleProfileSnapshot.teaching).toBeDefined();
      expect(sampleProfileSnapshot.teaching?.grade).toBe(4.25);
      expect(sampleProfileSnapshot.teaching?.is_early).toBe(false);
    });

    it("validates Ingest Submission Message schema adherence", () => {
      const sampleIngestMessage = {
        schemaVersion: "1.0.0",
        idempotencyKey: "hash123:fac456:teaching:CSE1001:FALL2026:",
        student_hash: "hash123",
        faculty_id: "fac456",
        track: "teaching",
        course_code: "CSE1001",
        semester: "FALL2026",
        project_term: null,
        verified: true,
        answers: { T_CLARITY: 5, T_DOUBTS: 4, T_MARKING: 4, T_PACE: 3 },
        tags_green: ["Explains with examples", "Fair marking"],
        tags_red: ["Strict attendance"],
        context: { attendance_percentage: 85 },
        grade_bucket: "high",
        timestamp: Date.now(),
      };

      expect(sampleIngestMessage.schemaVersion).toBe("1.0.0");
      expect(sampleIngestMessage.idempotencyKey).toContain("hash123");
      expect(sampleIngestMessage.track).toBe("teaching");
      expect(typeof sampleIngestMessage.answers).toBe("object");
      expect(Array.isArray(sampleIngestMessage.tags_green)).toBe(true);
      expect(Array.isArray(sampleIngestMessage.tags_red)).toBe(true);
    });
  });
});
