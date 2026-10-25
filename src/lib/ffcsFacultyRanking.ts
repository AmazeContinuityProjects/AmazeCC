import type { AddedCourse, ParsedCourse } from "@/components/custom/exams/FFCS/types";

function normalizeFacultyName(name: string): string {
  return name
    .toLowerCase()
    .replace(/^(dr|prof|mr|mrs|ms)\.?\s+/i, "")
    .replace(/[^a-z0-9]/g, "");
}

export type FacultyMetric = "wPct" | "lecture" | "da" | "vibe";

export interface FacultyRating {
  wPct: number | null;
  lecture: number | null;
  da: number | null;
  vibe: number | null;
  reviews: number;
}

export type FacultyRatingLookup = Record<string, FacultyRating>;

export interface FacultyMetricWeights {
  wPct: number;
  lecture: number;
  da: number;
  vibe: number;
}

export interface FacultyScoreFilters {
  minWPct: number;
  minLecture: number;
  minDa: number;
  minVibe: number;
}

export interface FacultyCourseScore {
  code: string;
  faculty: string;
  rating: FacultyRating | null;
}

export interface FacultyRankingSummary {
  averageWPct: number | null;
  averageLecture: number | null;
  averageDa: number | null;
  averageVibe: number | null;
  facultyScore: number | null;
  ratedFacultyCount: number;
  unratedFacultyCount: number;
  totalFacultyCount: number;
  courses: FacultyCourseScore[];
}

export const DEFAULT_FACULTY_METRIC_WEIGHTS: Readonly<FacultyMetricWeights> = Object.freeze({
  wPct: 4,
  lecture: 2,
  da: 2,
  vibe: 2,
});

export const DEFAULT_FACULTY_SCORE_FILTERS: Readonly<FacultyScoreFilters> = Object.freeze({
  minWPct: 0,
  minLecture: 0,
  minDa: 0,
  minVibe: 0,
});

export function facultyRatingKeys(person: {
  employeeId?: string | null;
  faculty?: string | null;
}): string[] {
  const keys: string[] = [];
  const employeeId = person.employeeId?.trim();
  const normalizedName = person.faculty ? normalizeFacultyName(person.faculty) : "";
  if (employeeId) keys.push(`id:${employeeId}`);
  if (normalizedName) keys.push(`name:${normalizedName}`);
  return keys;
}

function boundedScore(value: unknown, max: number): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return Math.max(0, Math.min(max, value));
}

/** Produces only plain data so the result can cross the generator worker boundary. */
export function buildFacultyRatingLookup(
  masterCourses: readonly ParsedCourse[],
  lookup: (person: { employeeId?: string | null; faculty?: string | null }) => FacultyRating | null
): FacultyRatingLookup {
  const result: FacultyRatingLookup = {};
  for (const course of masterCourses) {
    const rating = lookup({ employeeId: course.ERP_ID, faculty: course.FACULTY });
    if (!rating) continue;
    const safeRating: FacultyRating = {
      wPct: boundedScore(rating.wPct, 100),
      lecture: boundedScore(rating.lecture, 5),
      da: boundedScore(rating.da, 5),
      vibe: boundedScore(rating.vibe, 5),
      reviews: Math.max(0, Math.floor(Number.isFinite(rating.reviews) ? rating.reviews : 0)),
    };
    for (const key of facultyRatingKeys({ employeeId: course.ERP_ID, faculty: course.FACULTY })) {
      result[key] = safeRating;
    }
  }
  return result;
}

function ratingForCourse(
  course: Pick<AddedCourse, "employeeId" | "faculty">,
  lookup: FacultyRatingLookup
): FacultyRating | null {
  for (const key of facultyRatingKeys(course)) {
    if (lookup[key]) return lookup[key];
  }
  return null;
}

function weightedAverage(values: Array<{ value: number | null; weight: number }>): number | null {
  const present = values.filter(
    (entry): entry is { value: number; weight: number } =>
      entry.value !== null && entry.weight > 0
  );
  const totalWeight = present.reduce((sum, entry) => sum + entry.weight, 0);
  if (!totalWeight) return null;
  return present.reduce((sum, entry) => sum + entry.value * entry.weight, 0) / totalWeight;
}

export function facultyRankingSummary(
  courses: readonly AddedCourse[],
  lookup: FacultyRatingLookup,
  metricWeights: FacultyMetricWeights = DEFAULT_FACULTY_METRIC_WEIGHTS
): FacultyRankingSummary {
  const unique = new Map<string, FacultyCourseScore>();
  const courseScores = courses.map((course) => {
    const keys = facultyRatingKeys(course);
    const identity = keys[0] ?? `name:${normalizeFacultyName(course.faculty)}`;
    const score = { code: course.code, faculty: course.faculty, rating: ratingForCourse(course, lookup) };
    if (!unique.has(identity)) unique.set(identity, score);
    return score;
  });

  const faculty = Array.from(unique.values());
  const rated = faculty.filter((person) => person.rating !== null);
  const weightFor = (rating: FacultyRating) => Math.max(1, Math.min(rating.reviews, 20));
  const valuesFor = (metric: keyof FacultyRating) =>
    rated.map((person) => ({
      value: person.rating![metric] as number | null,
      weight: weightFor(person.rating!),
    }));
  const averageWPct = weightedAverage(valuesFor("wPct"));
  const averageLecture = weightedAverage(valuesFor("lecture"));
  const averageDa = weightedAverage(valuesFor("da"));
  const averageVibe = weightedAverage(valuesFor("vibe"));
  const metrics: Array<[keyof FacultyMetricWeights, number | null, number]> = [
    ["wPct", averageWPct === null ? null : averageWPct / 100, metricWeights.wPct],
    ["lecture", averageLecture === null ? null : averageLecture / 5, metricWeights.lecture],
    ["da", averageDa === null ? null : averageDa / 5, metricWeights.da],
    ["vibe", averageVibe === null ? null : averageVibe / 5, metricWeights.vibe],
  ];
  const available = metrics.filter(
    (metric): metric is [keyof FacultyMetricWeights, number, number] =>
      metric[1] !== null && Number.isFinite(metric[1]) && metric[2] > 0
  );
  const totalWeight = available.reduce((sum, metric) => sum + metric[2], 0);
  const ratingAverage = totalWeight
    ? (100 * available.reduce((sum, metric) => sum + metric[1] * metric[2], 0)) / totalWeight
    : null;
  const coverage = faculty.length ? rated.length / faculty.length : 0;

  return {
    averageWPct,
    averageLecture,
    averageDa,
    averageVibe,
    facultyScore: ratingAverage === null ? null : ratingAverage * coverage,
    ratedFacultyCount: rated.length,
    unratedFacultyCount: faculty.length - rated.length,
    totalFacultyCount: faculty.length,
    courses: courseScores,
  };
}

/** An active minimum is checked against every rated faculty member in the week. */
export function passesFacultyScoreFilters(
  summary: FacultyRankingSummary,
  filters: FacultyScoreFilters
): boolean {
  if (summary.ratedFacultyCount === 0) return true;
  const required: Array<[keyof FacultyScoreFilters, keyof FacultyRating]> = [
    ["minWPct", "wPct"],
    ["minLecture", "lecture"],
    ["minDa", "da"],
    ["minVibe", "vibe"],
  ];
  for (const person of summary.courses) {
    if (!person.rating) continue;
    for (const [filterKey, scoreKey] of required) {
      const minimum = filters[filterKey];
      const score = person.rating[scoreKey];
      if (minimum > 0 && score !== null && score < minimum) return false;
    }
  }
  return true;
}
