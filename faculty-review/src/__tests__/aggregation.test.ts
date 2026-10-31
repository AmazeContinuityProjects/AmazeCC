import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  aggregateTrackReviews,
  buildFacultyProfileSnapshot,
  runAggregationAndSnapshotSync,
  calculateReviewQualityScore,
  type RawReviewRow,
  type FacultyRow,
} from "../aggregation/engine";
import { InMemorySnapshotStore } from "../store/SnapshotStore";
import { REVIEWS_CONFIG } from "../config/reviewQuestions";

describe("Worker Aggregation Engine & Diffing", () => {
  let store: InMemorySnapshotStore;

  const sampleFaculty: FacultyRow = {
    id: "f1111111-1111-1111-1111-111111111111",
    employee_id: "10090",
    name: "Dr. Anitha S",
    name_norm: "anithas",
    school: "SENSE",
    designation: "Associate Professor",
    image_url: null,
    status: "official",
    merged_into: null,
    vitfac_id: "MTAwOTA=",
  };

  function createSampleReview(overrides: Partial<RawReviewRow> = {}): RawReviewRow {
    return {
      id: "r1111111-1111-1111-1111-111111111111",
      student_hash: "hash_student_1",
      faculty_id: sampleFaculty.id,
      track: "teaching",
      course_code: "BCSE101E",
      semester: "CH20262701",
      project_term: null,
      verified: true,
      answers: {
        T_CLARITY: 5,
        T_DOUBTS: 5,
        T_ALIGN: 4,
        T_FAIR: 5,
        T_REGULAR: 5,
        T_ENGAGE: 4,
        T_MATERIAL: 4,
        T_AGAIN: 5,
        S_PACE: 3,
        S_ATTEND: 3,
        S_MARKS: 4,
        S_WORKLOAD: 2,
        S_PAPER: 3,
      },
      tags_green: ["Explains with examples", "Great for doubts"],
      tags_red: [],
      context: { component: "Theory" },
      grade_bucket: "high",
      created_at: new Date().toISOString(),
      ...overrides,
    };
  }

  beforeEach(() => {
    store = new InMemorySnapshotStore();
  });

  it("calculates weighted quality score accurately according to config", () => {
    const review = createSampleReview();
    const score = calculateReviewQualityScore("teaching", review.answers, "Theory");
    expect(score).not.toBeNull();
    // With all answers >= 4 and mostly 5, score should be ~4.74 / 5.0
    expect(score).toBeGreaterThan(4.5);
    expect(score).toBeLessThanOrEqual(5.0);
  });

  it("displays early grade when below full confidence threshold (< 8 effective reviews)", () => {
    const singleReview = [createSampleReview()];
    const aggregate = aggregateTrackReviews("teaching", "", singleReview);
    expect(aggregate.n_reviews).toBe(1);
    expect(aggregate.grade).not.toBeNull();
    expect(aggregate.is_early).toBe(true);
  });

  it("displays Early badge for review count between 3 and 7", () => {
    const fiveReviews = Array.from({ length: 5 }, (_, i) =>
      createSampleReview({ id: `r-${i}`, student_hash: `student-${i}` })
    );
    const aggregate = aggregateTrackReviews("teaching", "", fiveReviews);
    expect(aggregate.n_reviews).toBe(5);
    expect(aggregate.grade).not.toBeNull();
    expect(aggregate.is_early).toBe(true);
  });

  it("displays normal grade (no Early badge) when review count >= 8", () => {
    const eightReviews = Array.from({ length: 8 }, (_, i) =>
      createSampleReview({ id: `r-${i}`, student_hash: `student-${i}` })
    );
    const aggregate = aggregateTrackReviews("teaching", "", eightReviews);
    expect(aggregate.n_reviews).toBe(8);
    expect(aggregate.grade).not.toBeNull();
    expect(aggregate.is_early).toBe(false);
  });

  it("hides 5-bar distributions when review count < 5 (k-anonymity safeguard)", () => {
    const fourReviews = Array.from({ length: 4 }, (_, i) =>
      createSampleReview({ id: `r-${i}`, student_hash: `student-${i}` })
    );
    const aggregate = aggregateTrackReviews("teaching", "", fourReviews);
    expect(aggregate.per_question.T_CLARITY.dist).toBeUndefined();
  });

  it("shows 5-bar distributions when review count >= 5", () => {
    const fiveReviews = Array.from({ length: 5 }, (_, i) =>
      createSampleReview({ id: `r-${i}`, student_hash: `student-${i}` })
    );
    const aggregate = aggregateTrackReviews("teaching", "", fiveReviews);
    expect(aggregate.per_question.T_CLARITY.dist).toBeDefined();
    expect(aggregate.per_question.T_CLARITY.dist?.length).toBe(5);
  });

  it("filters out tags with fewer than 3 votes", () => {
    const twoReviewsWithTag = [
      createSampleReview({ id: "r-1", student_hash: "s-1", tags_green: ["Explains with examples"] }),
      createSampleReview({ id: "r-2", student_hash: "s-2", tags_green: ["Explains with examples"] }),
    ];
    const agg = aggregateTrackReviews("teaching", "", twoReviewsWithTag);
    // 2 votes < min 3 votes
    expect(agg.top_tags_green.length).toBe(0);

    const threeReviewsWithTag = [
      ...twoReviewsWithTag,
      createSampleReview({ id: "r-3", student_hash: "s-3", tags_green: ["Explains with examples"] }),
    ];
    const agg2 = aggregateTrackReviews("teaching", "", threeReviewsWithTag);
    expect(agg2.top_tags_green.length).toBe(1);
    expect(agg2.top_tags_green[0].tag).toBe("Explains with examples");
    expect(agg2.top_tags_green[0].count).toBe(3);
  });

  it("performs zero KV writes when data has not changed (strict diffing test)", async () => {
    const reviews = [createSampleReview()];
    // Run 1: Initial publication
    const res1 = await runAggregationAndSnapshotSync(store, [sampleFaculty], reviews);
    expect(res1.writtenKeys.length).toBeGreaterThan(0);
    expect(res1.writtenKeys).toContain("catalog.json");
    expect(res1.writtenKeys).toContain(`profile/${sampleFaculty.id}.json`);

    // Run 2: Exact same data - MUST PERFORM ZERO WRITES
    const res2 = await runAggregationAndSnapshotSync(store, [sampleFaculty], reviews);
    expect(res2.writtenKeys.length).toBe(0);
    expect(res2.skippedKeys.length).toBeGreaterThan(0);
  });

  it("still performs zero writes one cron interval (10 min) later when no data changed", async () => {
    vi.useFakeTimers();
    try {
      vi.setSystemTime(new Date("2026-11-02T10:00:00.000Z"));
      const reviews = [
        createSampleReview({ id: "r-a", created_at: "2026-10-01T09:00:00.000Z" }),
        createSampleReview({ id: "r-b", student_hash: "s-b", verified: false, created_at: "2026-09-10T09:00:00.000Z" }),
      ];
      const res1 = await runAggregationAndSnapshotSync(store, [sampleFaculty], reviews);
      expect(res1.writtenKeys.length).toBeGreaterThan(0);

      vi.setSystemTime(new Date("2026-11-02T10:10:00.000Z"));
      const res2 = await runAggregationAndSnapshotSync(store, [sampleFaculty], reviews);
      expect(res2.writtenKeys).toEqual([]);
    } finally {
      vi.useRealTimers();
    }
  });

  it("writes ONLY the changed profile snapshot and catalog when 1 profile updates", async () => {
    const faculty2: FacultyRow = {
      ...sampleFaculty,
      id: "f2222222-2222-2222-2222-222222222222",
      name: "Prof. John Doe",
      name_norm: "johndoe",
      employee_id: "20050",
    };

    const reviews = [createSampleReview({ faculty_id: sampleFaculty.id })];

    // Initial sync with 2 faculties
    await runAggregationAndSnapshotSync(store, [sampleFaculty, faculty2], reviews);

    // Now add a review ONLY for faculty2
    const updatedReviews = [
      ...reviews,
      createSampleReview({
        id: "r-new",
        student_hash: "s-new",
        faculty_id: faculty2.id,
      }),
    ];

    const res = await runAggregationAndSnapshotSync(
      store,
      [sampleFaculty, faculty2],
      updatedReviews
    );

    // Must write catalog and profile 2, but skip profile 1!
    expect(res.writtenKeys).toContain("catalog.json");
    expect(res.writtenKeys).toContain(`profile/${faculty2.id}.json`);
    expect(res.skippedKeys).toContain(`profile/${sampleFaculty.id}.json`);
  });
});
