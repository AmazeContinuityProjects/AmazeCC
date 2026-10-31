import {
  REVIEWS_CONFIG,
  TEACHING_CONFIG,
  PROJECT_CONFIG,
  getEffectiveQuestionWeights,
  type ReviewTrack,
  type CourseComponent,
} from "../config/reviewQuestions";
import type {
  FacultyCatalogItem,
  FacultyProfileSnapshot,
  TrackAggregateProfile,
  QuestionStat,
  StyleStat,
  TagStat,
  ManifestData,
} from "../types";
import type { SnapshotStore } from "../store/SnapshotStore";

export interface RawReviewRow {
  id: string;
  student_hash: string;
  faculty_id: string;
  track: ReviewTrack;
  course_code: string | null;
  semester: string | null;
  project_term: string | null;
  verified: boolean;
  answers: Record<string, number>;
  tags_green: string[];
  tags_red: string[];
  context: Record<string, unknown>;
  grade_bucket: string | null;
  created_at: string;
}

export interface FacultyRow {
  id: string;
  employee_id: string | null;
  name: string;
  name_norm: string;
  school: string | null;
  designation: string | null;
  image_url: string | null;
  status: "official" | "merged" | "hidden";
  merged_into: string | null;
  vitfac_id: string | null;
}

export async function computeSha256(content: string): Promise<string> {
  const enc = new TextEncoder();
  const data = enc.encode(content);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Calculates per-review overall quality score using normalized weights.
 */
export function calculateReviewQualityScore(
  track: ReviewTrack,
  answers: Record<string, number>,
  component?: CourseComponent
): number | null {
  const weights = getEffectiveQuestionWeights(track, component);
  let totalWeightedScore = 0;
  let totalWeight = 0;

  for (const [qId, weight] of Object.entries(weights)) {
    const val = answers[qId];
    if (typeof val === "number" && val >= 1 && val <= 5) {
      totalWeightedScore += val * weight;
      totalWeight += weight;
    }
  }

  if (totalWeight === 0) return null;
  return totalWeightedScore / totalWeight; // Scale 1.0 to 5.0
}

/**
 * Computes the recency weight for a review.
 */
export function calculateReviewWeight(review: RawReviewRow): number {
  let baseWeight = 1.0;
  if (review.track === "teaching") {
    baseWeight = review.verified
      ? REVIEWS_CONFIG.aggregation.verifiedTeachingWeight
      : REVIEWS_CONFIG.aggregation.unverifiedTeachingWeight;
  } else {
    baseWeight = review.verified
      ? REVIEWS_CONFIG.aggregation.verifiedProjectWeight
      : REVIEWS_CONFIG.aggregation.unverifiedProjectWeight;
  }

  // Recency decay: estimated by age of review if semester integer isn't available
  const ageMs = Date.now() - new Date(review.created_at).getTime();
  const semesterApproxMs = 180 * 24 * 60 * 60 * 1000; // ~6 months per semester
  const semestersAgo = Math.max(0, ageMs / semesterApproxMs);
  const decay = Math.pow(0.5, semestersAgo / REVIEWS_CONFIG.aggregation.recencyDecayHalflifeSemesters);

  return baseWeight * decay;
}

/**
 * Aggregate reviews for a specific track and optional course_code.
 */
export function aggregateTrackReviews(
  track: ReviewTrack,
  course_code: string,
  reviews: RawReviewRow[]
): TrackAggregateProfile {
  const config = track === "teaching" ? TEACHING_CONFIG : PROJECT_CONFIG;
  const n_reviews = reviews.length;
  const n_verified = reviews.filter((r) => r.verified).length;

  if (n_reviews === 0) {
    return {
      track,
      course_code,
      n_reviews: 0,
      n_verified: 0,
      grade: null,
      is_early: false,
      per_question: {},
      style: {},
      top_tags_green: [],
      top_tags_red: [],
    };
  }

  // 1. Calculate weighted review scores
  interface ScoredReview {
    score: number;
    weight: number;
    review: RawReviewRow;
  }

  const scored: ScoredReview[] = [];
  for (const r of reviews) {
    const component = (r.context?.component as CourseComponent) || undefined;
    const score = calculateReviewQualityScore(track, r.answers, component);
    if (score !== null) {
      scored.push({
        score,
        weight: calculateReviewWeight(r),
        review: r,
      });
    }
  }

  // 2. Outlier trimming: when n >= 20, trim top 5% and bottom 5%
  let activePool = scored;
  if (scored.length >= REVIEWS_CONFIG.aggregation.outlierTrimMinReviews) {
    const sorted = [...scored].sort((a, b) => a.score - b.score);
    const trimCount = Math.floor(
      sorted.length * REVIEWS_CONFIG.aggregation.outlierTrimPercent
    );
    activePool = sorted.slice(trimCount, sorted.length - trimCount);
  }

  // 3. Raw weighted mean & effective review count
  let sumWeighted = 0;
  let n_eff = 0;
  for (const s of activePool) {
    sumWeighted += s.score * s.weight;
    n_eff += s.weight;
  }

  const rawMean = n_eff > 0 ? sumWeighted / n_eff : 0;

  // 4. Bayesian shrinkage
  const m = REVIEWS_CONFIG.aggregation.bayesianPriorCount;
  const C =
    track === "teaching"
      ? REVIEWS_CONFIG.aggregation.defaultGlobalMeanTeaching
      : REVIEWS_CONFIG.aggregation.defaultGlobalMeanProject;

  const shrunk = (n_eff / (n_eff + m)) * rawMean + (m / (n_eff + m)) * C;

  const meetsThreshold = n_reviews >= REVIEWS_CONFIG.aggregation.minReviewsToShowGrade;
  const is_early =
    meetsThreshold && n_reviews <= REVIEWS_CONFIG.aggregation.earlyBadgeMaxReviews;
  const finalGrade = meetsThreshold ? Math.round(shrunk * 100) / 100 : null;

  // 5. Per-question averages and distributions
  const per_question: Record<string, QuestionStat> = {};
  for (const q of config.qualityQuestions) {
    let qSum = 0;
    let qWeightSum = 0;
    const dist: [number, number, number, number, number] = [0, 0, 0, 0, 0];
    let countAnswers = 0;

    for (const s of reviews) {
      const ans = s.answers[q.id];
      if (typeof ans === "number" && ans >= 1 && ans <= 5) {
        const w = calculateReviewWeight(s);
        qSum += ans * w;
        qWeightSum += w;
        dist[Math.round(ans) - 1]++;
        countAnswers++;
      }
    }

    if (qWeightSum > 0) {
      const avg = Math.round((qSum / qWeightSum) * 10) / 10;
      per_question[q.id] = {
        avg,
        ...(countAnswers >= REVIEWS_CONFIG.aggregation.minReviewsForDistribution
          ? { dist }
          : {}),
      };
    }
  }

  // 6. Style spectrums
  const style: Record<string, StyleStat> = {};
  for (const s of config.styleQuestions) {
    let sSum = 0;
    let sWeightSum = 0;
    const dist: [number, number, number, number, number] = [0, 0, 0, 0, 0];
    let countAnswers = 0;

    for (const r of reviews) {
      const ans = r.answers[s.id];
      if (typeof ans === "number" && ans >= 1 && ans <= 5) {
        const w = calculateReviewWeight(r);
        sSum += ans * w;
        sWeightSum += w;
        dist[Math.round(ans) - 1]++;
        countAnswers++;
      }
    }

    if (sWeightSum > 0) {
      const avg = Math.round((sSum / sWeightSum) * 10) / 10;
      style[s.id] = {
        avg,
        ...(countAnswers >= REVIEWS_CONFIG.aggregation.minReviewsForDistribution
          ? { dist }
          : {}),
      };
    }
  }

  // 7. Top tags (only show tags with >= 3 votes)
  const greenCounts: Record<string, number> = {};
  const redCounts: Record<string, number> = {};

  for (const r of reviews) {
    for (const tag of r.tags_green || []) {
      if (config.tags.green.includes(tag)) {
        greenCounts[tag] = (greenCounts[tag] || 0) + 1;
      }
    }
    for (const tag of r.tags_red || []) {
      if (config.tags.red.includes(tag)) {
        redCounts[tag] = (redCounts[tag] || 0) + 1;
      }
    }
  }

  const minVotes = REVIEWS_CONFIG.aggregation.minVotesToShowTag;
  const top_tags_green: TagStat[] = Object.entries(greenCounts)
    .filter(([_, count]) => count >= minVotes)
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count);

  const top_tags_red: TagStat[] = Object.entries(redCounts)
    .filter(([_, count]) => count >= minVotes)
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count);

  return {
    track,
    course_code,
    n_reviews,
    n_verified,
    grade: finalGrade,
    is_early,
    per_question,
    style,
    top_tags_green,
    top_tags_red,
  };
}

/**
 * Builds the complete profile snapshot for a faculty member.
 */
export function buildFacultyProfileSnapshot(
  faculty: FacultyRow,
  facultyReviews: RawReviewRow[]
): FacultyProfileSnapshot {
  const teachingReviews = facultyReviews.filter((r) => r.track === "teaching");
  const projectReviews = facultyReviews.filter((r) => r.track === "project");

  const teachingGlobal =
    teachingReviews.length > 0
      ? aggregateTrackReviews("teaching", "", teachingReviews)
      : null;

  const projectGlobal =
    projectReviews.length > 0
      ? aggregateTrackReviews("project", "", projectReviews)
      : null;

  // Group teaching reviews by course_code
  const teaching_by_course: Record<string, TrackAggregateProfile> = {};
  const coursesSet = new Set<string>();

  for (const r of teachingReviews) {
    if (r.course_code) {
      coursesSet.add(r.course_code.toUpperCase());
    }
  }

  for (const course of coursesSet) {
    const courseReviews = teachingReviews.filter(
      (r) => r.course_code && r.course_code.toUpperCase() === course
    );
    teaching_by_course[course] = aggregateTrackReviews(
      "teaching",
      course,
      courseReviews
    );
  }

  if (teachingGlobal) {
    teachingGlobal.courses = Array.from(coursesSet);
  }

  // Deterministic updated_at: latest review timestamp, or 1970-01-01
  let latestIso = "1970-01-01T00:00:00.000Z";
  for (const r of facultyReviews) {
    if (r.created_at && r.created_at > latestIso) {
      latestIso = r.created_at;
    }
  }

  return {
    schemaVersion: "1.0.0",
    faculty: {
      id: faculty.id,
      employee_id: faculty.employee_id,
      name: faculty.name,
      school: faculty.school,
      designation: faculty.designation,
      image_url: faculty.image_url,
      vitfac_id: faculty.vitfac_id,
    },
    teaching: teachingGlobal,
    project: projectGlobal,
    teaching_by_course,
    updated_at: latestIso,
  };
}

/**
 * Executes aggregation and write-diffing snapshot publication.
 * Prompt section 11.2:
 * 1. Build each snapshot and compute SHA-256 hash.
 * 2. Keep manifest key mapping snapshot key to last-written hash.
 * 3. Write only snapshots whose hash changed.
 * 4. Enforce MAX_KV_WRITES_PER_RUN.
 * 5. If nothing changed, write nothing (0 KV writes).
 */
export async function runAggregationAndSnapshotSync(
  store: SnapshotStore,
  faculties: FacultyRow[],
  allReviews: RawReviewRow[],
  maxWrites = 50
): Promise<{ writtenKeys: string[]; skippedKeys: string[] }> {
  // 1. Load manifest
  const manifestRaw = await store.get("manifest");
  let manifest: ManifestData = { hashes: {}, last_updated: "" };
  if (manifestRaw) {
    try {
      manifest = JSON.parse(manifestRaw.body);
    } catch {}
  }

  const catalogItems: FacultyCatalogItem[] = [];
  const plannedSnapshots = new Map<string, string>(); // key -> jsonString

  // Group reviews by faculty_id
  const reviewsByFaculty = new Map<string, RawReviewRow[]>();
  for (const r of allReviews) {
    const list = reviewsByFaculty.get(r.faculty_id) || [];
    list.push(r);
    reviewsByFaculty.set(r.faculty_id, list);
  }

  // Build profile snapshot for each official faculty member
  for (const faculty of faculties) {
    if (faculty.status !== "official") continue;

    const reviews = reviewsByFaculty.get(faculty.id) || [];
    const profileSnapshot = buildFacultyProfileSnapshot(faculty, reviews);
    const profileJson = JSON.stringify(profileSnapshot);
    plannedSnapshots.set(`profile/${faculty.id}.json`, profileJson);

    // Build catalog item
    const teachingReviewsCount = profileSnapshot.teaching?.n_reviews || 0;
    const teachingVerifiedCount = profileSnapshot.teaching?.n_verified || 0;
    const projectReviewsCount = profileSnapshot.project?.n_reviews || 0;

    catalogItems.push({
      id: faculty.id,
      employee_id: faculty.employee_id,
      name: faculty.name,
      name_norm: faculty.name_norm,
      school: faculty.school,
      designation: faculty.designation,
      image_url: faculty.image_url,
      vitfac_id: faculty.vitfac_id,
      teaching_grade: profileSnapshot.teaching?.grade || null,
      teaching_reviews: teachingReviewsCount,
      teaching_verified_ratio:
        teachingReviewsCount > 0
          ? teachingVerifiedCount / teachingReviewsCount
          : 0,
      project_grade: profileSnapshot.project?.grade || null,
      project_reviews: projectReviewsCount,
      updated_at: profileSnapshot.updated_at,
    });
  }

  // Find latest update across catalog items
  let catalogLatestIso = "1970-01-01T00:00:00.000Z";
  for (const item of catalogItems) {
    if (item.updated_at && item.updated_at > catalogLatestIso) {
      catalogLatestIso = item.updated_at;
    }
  }

  // Build catalog snapshot
  const catalogJson = JSON.stringify({
    schemaVersion: "1.0.0",
    faculty: catalogItems,
    updated_at: catalogLatestIso,
  });
  plannedSnapshots.set("catalog.json", catalogJson);

  // 2. Compute hashes and identify changes
  const changedSnapshots: Array<{ key: string; body: string; hash: string }> = [];
  const skippedKeys: string[] = [];

  for (const [key, body] of plannedSnapshots.entries()) {
    const hash = await computeSha256(body);
    if (manifest.hashes[key] !== hash) {
      changedSnapshots.push({ key, body, hash });
    } else {
      skippedKeys.push(key);
    }
  }

  // 3. If nothing changed, perform 0 writes
  if (changedSnapshots.length === 0) {
    return { writtenKeys: [], skippedKeys };
  }

  // 4. Enforce write cap and prioritize catalog first, then profiles with reviews
  changedSnapshots.sort((a, b) => {
    if (a.key === "catalog.json") return -1;
    if (b.key === "catalog.json") return 1;
    const aHasReviews = !a.body.includes('"teaching":null') || !a.body.includes('"project":null');
    const bHasReviews = !b.body.includes('"teaching":null') || !b.body.includes('"project":null');
    if (aHasReviews && !bHasReviews) return -1;
    if (!aHasReviews && bHasReviews) return 1;
    return 0;
  });

  const allowedWrites = changedSnapshots.slice(0, maxWrites);
  const writtenKeys: string[] = [];

  for (const item of allowedWrites) {
    const etag = `"${item.hash.slice(0, 16)}"`;
    await store.put(item.key, item.body, etag);
    manifest.hashes[item.key] = item.hash;
    writtenKeys.push(item.key);
  }

  // Update manifest in same run
  manifest.last_updated = new Date().toISOString();
  const manifestBody = JSON.stringify(manifest);
  const manifestHash = await computeSha256(manifestBody);
  await store.put("manifest", manifestBody, `"${manifestHash.slice(0, 16)}"`);

  return { writtenKeys, skippedKeys };
}
