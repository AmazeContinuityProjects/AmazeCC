import {
  ABSOLUTE_GRADE_BOUNDARIES,
  buildGradeBoundaries,
  gradeAt,
  isRelativeGrading,
  type GradedBoundary,
  type ClassStats,
} from "./gradeBoundaries";

export type AssessmentComponentType = "theory" | "lab" | "project" | "softskill";

export interface PredictorAssessment {
  id: string;
  title: string;
  maxMark: number;
  weightagePercent: number;
  scoredMark: number | null; // null if pending/unrecorded
  status?: string; // "Present", "Absent", "Pending", "Simulated"
  isSimulated?: boolean;
  component: "theory" | "lab" | "project";
}

export interface RegimenPreset {
  id: string;
  name: string;
  category: AssessmentComponentType;
  description: string;
  component: "theory" | "lab" | "project";
  items: Array<{
    title: string;
    maxMark: number;
    weightagePercent: number;
  }>;
}

export interface ComponentStats {
  component: "theory" | "lab" | "project";
  credits: number;
  totalWeightConfigured: number;
  scoredWeight: number;
  pendingWeight: number;
  lostWeight: number;
  maxPossibleWeight: number;
  completedAssessmentsCount: number;
  pendingAssessmentsCount: number;
  totalAssessmentsCount: number;
  assessments: Array<{
    id: string;
    title: string;
    maxMark: number;
    weightagePercent: number;
    scoredMark: number | null;
    scoredWeight: number;
    lostWeight: number;
    percentage: number;
    isPending: boolean;
    isSimulated: boolean;
  }>;
}

export interface CoursePredictionResult {
  courseCode: string;
  courseTitle: string;
  courseType: string;
  isEmbedded: boolean;
  theoryCredits: number;
  labCredits: number;
  totalCredits: number;
  currentScoredScaled: number; // 0 - 100 scaled to course
  potentialPendingScaled: number;
  pointsLostScaled: number; // Deficit in total course marks
  maxPossibleScaled: number; // 100 - pointsLostScaled
  /**
   * The current pace, extended to semester's end: earned weight over released
   * weight — the same normalisation `normalisedPct` performs for the marks
   * subpage's grade ladder. Independence from the released fraction is the
   * point: pace does not improve merely because more of the semester arrived.
   */
  pacePct: number;
  /**
   * The standing the grade-insights ladder shows: earned weight over the
   * weight the course has assigned so far — scored, lost, and every pending
   * row that already carries a weightage — the same scaling the marks
   * subpage's "Grade boundaries" section applies before reading its band.
   * The unpublished final exam stays out on purpose: VTOP reports no
   * weightage for it until it happens, so the subpage's ladder never divides
   * by it, and this scale must not either (the 40% pin at the feed's edge is
   * for the solver's reachability, not for this read).
   */
  currentStandingPct: number;
  /**
   * Grade if the current performance continues. Null before any mark is
   * recorded: a pace cannot be read from a course with nothing released, and
   * calling a zero-pace course an "F" would fail a student for test days that
   * have not happened yet.
   */
  optimalGrade: {
    letter: string;
    /** Key into TONE_BADGE / TONE_TEXT — never a class string (R8). */
    tone: string;
    description: string;
  } | null;
  /**
   * The best grade still reachable, assuming every remaining assessment is
   * scored at its maximum. `100 − points lost` is a hard ceiling: weight
   * already forfeited stays forfeited however the rest of the term goes.
   * Under a curve the ceiling is read against the class ladder, not the
   * fixed one — the same ladder the marks subpage shows.
   */
  maximisableGrade: {
    letter: string;
    /** Key into TONE_BADGE / TONE_TEXT — never a class string (R8). */
    tone: string;
    description: string;
  };
  /**
   * The ladder these letters were read from. Relative-graded courses with
   * class statistics get the shifted ladder; everything else gets the fixed
   * one. Carried on the result so the hero and per-half grades reuse the
   * identical ladder instead of re-deriving one that can drift from it.
   */
  boundaries: GradedBoundary[];
  /** True when the letters above were read against a class curve. */
  isCurved: boolean;
  theoryStats: ComponentStats | null;
  labStats: ComponentStats | null;
  projectStats: ComponentStats | null;
  riskLevel: "safe" | "moderate" | "critical" | "warning";
}

export interface TargetFATSolverResult {
  targetScore: number;
  targetGrade: string;
  currentScoreWithoutFAT: number;
  requiredFATWeight: number;
  fatWeightagePercent: number;
  fatMaxMark: number;
  requiredFATRawScore: number;
  requiredFATPercentage: number;
  isAchievable: boolean;
  isAlreadyAchieved: boolean;
  meetsVITMinimumCutoff: boolean; // VIT requires at least 40% in FAT (i.e. 40/100 or 16/40 wt)
  feasibility: "secured" | "easy" | "moderate" | "tough" | "miracle" | "impossible";
  feasibilityMessage: string;
}

// ── Built-in Presets for VIT Assessment Regimens ──
export const PRESET_REGIMENS: RegimenPreset[] = [
  {
    id: "theory-standard",
    name: "Theory: 2 CATs + 3 DAs + FAT (Standard)",
    category: "theory",
    component: "theory",
    description: "Standard Theory: CAT-1 (15%), CAT-2 (15%), 3 DAs / Quizzes (10% each), FAT (40%)",
    items: [
      { title: "CAT - I", maxMark: 50, weightagePercent: 15 },
      { title: "CAT - II", maxMark: 50, weightagePercent: 15 },
      { title: "DA - 1", maxMark: 10, weightagePercent: 10 },
      { title: "DA - 2", maxMark: 10, weightagePercent: 10 },
      { title: "DA - 3", maxMark: 10, weightagePercent: 10 },
      { title: "FAT", maxMark: 100, weightagePercent: 40 },
    ],
  },
  {
    id: "theory-quizzes",
    name: "Theory: 2 CATs + 2 DAs + 2 Quizzes + FAT",
    category: "theory",
    component: "theory",
    description: "CAT-1 (15%), CAT-2 (15%), DA-1 (10%), DA-2 (10%), Quiz-1 (5%), Quiz-2 (5%), FAT (40%)",
    items: [
      { title: "CAT - I", maxMark: 50, weightagePercent: 15 },
      { title: "CAT - II", maxMark: 50, weightagePercent: 15 },
      { title: "DA - 1", maxMark: 10, weightagePercent: 10 },
      { title: "DA - 2", maxMark: 10, weightagePercent: 10 },
      { title: "Quiz - I", maxMark: 10, weightagePercent: 5 },
      { title: "Quiz - II", maxMark: 10, weightagePercent: 5 },
      { title: "FAT", maxMark: 100, weightagePercent: 40 },
    ],
  },
  {
    id: "lab-10-continuous",
    name: "Lab: 10 Continuous Experiments + FAT (60/40)",
    category: "lab",
    component: "lab",
    description: "Standard Lab: 10 Lab Continuous Evaluation / Assignments (6% each = 60%) + Lab FAT (40%)",
    items: [
      { title: "Lab Experiment - 1", maxMark: 100, weightagePercent: 6 },
      { title: "Lab Experiment - 2", maxMark: 100, weightagePercent: 6 },
      { title: "Lab Experiment - 3", maxMark: 100, weightagePercent: 6 },
      { title: "Lab Experiment - 4", maxMark: 100, weightagePercent: 6 },
      { title: "Lab Experiment - 5", maxMark: 100, weightagePercent: 6 },
      { title: "Lab Experiment - 6", maxMark: 100, weightagePercent: 6 },
      { title: "Lab Experiment - 7", maxMark: 100, weightagePercent: 6 },
      { title: "Lab Experiment - 8", maxMark: 100, weightagePercent: 6 },
      { title: "Lab Experiment - 9", maxMark: 100, weightagePercent: 6 },
      { title: "Lab Experiment - 10", maxMark: 100, weightagePercent: 6 },
      { title: "Lab FAT", maxMark: 50, weightagePercent: 40 },
    ],
  },
  {
    id: "lab-4-pats",
    name: "Lab: 4 PATs (10+15+15+10) + Record (10) + FAT (40)",
    category: "lab",
    component: "lab",
    description: "Periodic Assessment Tests (50%) + Continuous Record/Viva (10%) + Lab FAT (40%)",
    items: [
      { title: "PAT - I", maxMark: 50, weightagePercent: 10 },
      { title: "PAT - II", maxMark: 50, weightagePercent: 15 },
      { title: "PAT - III", maxMark: 50, weightagePercent: 15 },
      { title: "PAT - IV", maxMark: 50, weightagePercent: 10 },
      { title: "Assignment & Record Completion", maxMark: 100, weightagePercent: 10 },
      { title: "Lab FAT", maxMark: 50, weightagePercent: 40 },
    ],
  },
  {
    id: "lab-5-cycle",
    name: "Lab: 5 Assessments (12% each) + FAT (40%)",
    category: "lab",
    component: "lab",
    description: "5 Modular Assessments / Experiments (12% each = 60%) + Lab FAT (40%)",
    items: [
      { title: "Assessment - 1", maxMark: 10, weightagePercent: 12 },
      { title: "Assessment - 2", maxMark: 10, weightagePercent: 12 },
      { title: "Assessment - 3", maxMark: 10, weightagePercent: 12 },
      { title: "Assessment - 4", maxMark: 10, weightagePercent: 12 },
      { title: "Assessment - 5", maxMark: 10, weightagePercent: 12 },
      { title: "Lab FAT", maxMark: 50, weightagePercent: 40 },
    ],
  },
  {
    id: "project-jcomp",
    name: "Project / J-Component (3 Reviews + Report)",
    category: "project",
    component: "project",
    description: "Review-1 (20%), Review-2 (30%), Final Project Review & Viva (50%)",
    items: [
      { title: "Project Review - I", maxMark: 50, weightagePercent: 20 },
      { title: "Project Review - II", maxMark: 50, weightagePercent: 30 },
      { title: "Final Review, Report & Viva", maxMark: 100, weightagePercent: 50 },
    ],
  },
  {
    id: "softskills-sts",
    name: "Soft Skills / STS (2 Assessments + 2 CATs + Final)",
    category: "softskill",
    component: "theory",
    description: "Assessment-1 (15%), Assessment-2 (15%), CAT-1 (15%), CAT-2 (15%), Final Test (40%)",
    items: [
      { title: "Assessment - 1", maxMark: 15, weightagePercent: 15 },
      { title: "Assessment - 2", maxMark: 15, weightagePercent: 15 },
      { title: "CAT - I", maxMark: 30, weightagePercent: 15 },
      { title: "CAT - II", maxMark: 30, weightagePercent: 15 },
      { title: "FAT", maxMark: 50, weightagePercent: 40 },
    ],
  },
];

// Helper: Safely parse numbers
export const safeNumber = (val: any, fallback = 0): number => {
  const n = Number(val);
  return Number.isFinite(n) ? n : fallback;
};

// Helper: Normalize weightage array to ensure sum === 100
export const normalizeWeights = (
  items: Array<{ weightagePercent: number; [key: string]: any }>
): Array<{ weightagePercent: number; [key: string]: any }> => {
  if (!items || items.length === 0) return items;
  const total = items.reduce((sum, item) => sum + safeNumber(item.weightagePercent), 0);
  if (total <= 0) return items;

  let runningSum = 0;
  return items.map((item, idx) => {
    if (idx === items.length - 1) {
      const remaining = Math.max(0, 100 - runningSum);
      return { ...item, weightagePercent: Math.round(remaining * 100) / 100 };
    }
    const scaled = Math.round(((item.weightagePercent / total) * 100) * 100) / 100;
    runningSum += scaled;
    return { ...item, weightagePercent: scaled };
  });
};

// Compute single component stats (Theory, Lab, or Project)
export const computeComponentStats = (
  assessments: PredictorAssessment[],
  component: "theory" | "lab" | "project",
  credits = 1
): ComponentStats => {
  let totalWeightConfigured = 0;
  let scoredWeight = 0;
  let pendingWeight = 0;
  let lostWeight = 0;
  let completedCount = 0;
  let pendingCount = 0;

  const processedAssessments = assessments.map((asm) => {
    const maxMark = Math.max(0.1, safeNumber(asm.maxMark, 100));
    const weightagePercent = safeNumber(asm.weightagePercent, 0);
    totalWeightConfigured += weightagePercent;

    const isPending = asm.scoredMark === null || asm.scoredMark === undefined;
    const isSimulated = Boolean(asm.isSimulated);

    let asmScoredWeight = 0;
    let asmLostWeight = 0;
    let percentage = 0;

    if (isPending) {
      pendingWeight += weightagePercent;
      pendingCount++;
    } else {
      const scored = Math.max(0, Math.min(safeNumber(asm.scoredMark, 0), maxMark));
      percentage = Math.min(100, Math.max(0, (scored / maxMark) * 100));
      asmScoredWeight = (percentage / 100) * weightagePercent;
      asmLostWeight = Math.max(0, weightagePercent - asmScoredWeight);

      scoredWeight += asmScoredWeight;
      lostWeight += asmLostWeight;
      completedCount++;
    }

    return {
      id: asm.id,
      title: asm.title,
      maxMark,
      weightagePercent,
      scoredMark: asm.scoredMark,
      scoredWeight: Math.round(asmScoredWeight * 100) / 100,
      lostWeight: Math.round(asmLostWeight * 100) / 100,
      percentage: Math.round(percentage * 10) / 10,
      isPending,
      isSimulated,
    };
  });

  const maxPossibleWeight = Math.max(0, totalWeightConfigured - lostWeight);

  return {
    component,
    credits: Math.max(0.5, credits),
    totalWeightConfigured: Math.round(totalWeightConfigured * 100) / 100,
    scoredWeight: Math.round(scoredWeight * 100) / 100,
    pendingWeight: Math.round(pendingWeight * 100) / 100,
    lostWeight: Math.round(lostWeight * 100) / 100,
    maxPossibleWeight: Math.round(maxPossibleWeight * 100) / 100,
    completedAssessmentsCount: completedCount,
    pendingAssessmentsCount: pendingCount,
    totalAssessmentsCount: assessments.length,
    assessments: processedAssessments,
  };
};

/**
 * Grades for one blended course's half — the sub-total the hero shows under
 * the parent, the way the marks subpage scores the theory half and the lab
 * half each out of 100 on their own.
 *
 * Same two readings as the course-level pair, restricted to a component's
 * own weight: `pace` is earned over released within the half, `maximisable`
 * is what the half could still earn at full marks on its remaining weight.
 * Null pace before the half has any recorded assessment — a half that has
 * not happened yet is not a failing half.
 */
export const estimateComponentGrades = (
  stats: ComponentStats,
  boundaries?: GradedBoundary[]
) => {
  const released = stats.scoredWeight + stats.lostWeight;
  const pacePct =
    released > 0 ? Math.round((stats.scoredWeight / released) * 10000) / 100 : 0;
  // The half is scored on its own 0–100 ladder ("out of 100 on its own" — grade
  // history records the same convention), so its configured weight is the
  // ladder total: a lab half worth 60 points maxes at 100%, not at 60.
  const maximisablePct =
    stats.totalWeightConfigured > 0
      ? Math.round((stats.maxPossibleWeight / stats.totalWeightConfigured) * 10000) / 100
      : 0;
  return {
    pacePct,
    optimal: released > 0 ? estimateGrade(pacePct, boundaries) : null,
    maximisablePct,
    maximisable: estimateGrade(maximisablePct, boundaries),
  };
};

// Letter metadata: tone + copy per grade, read once via gradeAt.
const GRADE_META: Record<
  GradedBoundary["grade"],
  { tone: string; description: string }
> = {
  S: { tone: "emerald", description: "Outstanding (10 Grade Points)" },
  A: { tone: "cyan", description: "Excellent (9 Grade Points)" },
  B: { tone: "blue", description: "Very Good (8 Grade Points)" },
  C: { tone: "indigo", description: "Good (7 Grade Points)" },
  D: { tone: "violet", description: "Average (6 Grade Points)" },
  E: { tone: "amber", description: "Pass (5 Grade Points)" },
  F: { tone: "red", description: "Fail (0 Grade Points)" },
};

// Estimate Letter Grade from percentage / weighted score.
// The letter comes from the shared `gradeBoundaries` ladder: callers without
// curves get the fixed ladder (the historic behaviour), callers holding class
// statistics pass the shifted one so a "67% → A" curve reads the same on the
// marks page and the predictor.
export const estimateGrade = (
  score: number,
  boundaries?: GradedBoundary[]
): {
  letter: string;
  tone: string;
  description: string;
} => {
  const letter = gradeAt(score, boundaries ?? ABSOLUTE_GRADE_BOUNDARIES);
  const meta = GRADE_META[letter as GradedBoundary["grade"]] ?? GRADE_META.F;
  return { letter, ...meta };
};

// Compute Course Level Prediction (Combining Theory + Lab if Embedded)
export const computeCoursePrediction = ({
  courseCode,
  courseTitle,
  courseType,
  theoryAssessments = [],
  labAssessments = [],
  projectAssessments = [],
  theoryCredits = 3,
  labCredits = 1,
  projectCredits = 0,
  courseSystem,
  classStats = null,
}: {
  courseCode: string;
  courseTitle: string;
  courseType: string;
  theoryAssessments?: PredictorAssessment[];
  labAssessments?: PredictorAssessment[];
  projectAssessments?: PredictorAssessment[];
  theoryCredits?: number;
  labCredits?: number;
  projectCredits?: number;
  /**
   * The course's grading system as VTOP publishes it ("ACE" or otherwise).
   * Omitted by legacy callers — they keep the fixed ladder. When provided and
   * the course type is curve-eligible, class statistics shift the ladder the
   * same way the marks subpage's grade insights does.
   */
  courseSystem?: string | null;
  /** `marksStats[classNbr].overall` — the class distribution behind a curve. */
  classStats?: ClassStats | null;
}): CoursePredictionResult => {
  const hasTheory = theoryAssessments.length > 0;
  const hasLab = labAssessments.length > 0;
  const hasProject = projectAssessments.length > 0;
  const isEmbedded = (hasTheory && hasLab) || courseType.toLowerCase().includes("embedded");

  // One ladder per prediction. `courseSystem === undefined` means the caller
  // predates grading context — absolute, exactly as before. Passing a real
  // system opts into the relative shift when the course type qualifies, and
  // missing class statistics fall back to absolute (nothing to curve around).
  const relativeEligible =
    courseSystem !== undefined && isRelativeGrading(courseSystem ?? null, courseType);
  const boundaries = buildGradeBoundaries(classStats ?? null, relativeEligible);
  // Shifted only when statistics actually fed the curve — the fallback path
  // returns the fixed ladder unchanged.
  const isCurved = relativeEligible && boundaries !== ABSOLUTE_GRADE_BOUNDARIES;

  const theoryStats = hasTheory ? computeComponentStats(theoryAssessments, "theory", theoryCredits) : null;
  const labStats = hasLab ? computeComponentStats(labAssessments, "lab", labCredits) : null;
  const projectStats = hasProject ? computeComponentStats(projectAssessments, "project", projectCredits) : null;

  let totalCredits = 0;
  let weightedScoredSum = 0;
  let weightedPendingSum = 0;
  let weightedLostSum = 0;

  if (theoryStats) {
    const cred = isEmbedded ? theoryCredits : 1;
    totalCredits += cred;
    weightedScoredSum += theoryStats.scoredWeight * cred;
    weightedPendingSum += theoryStats.pendingWeight * cred;
    weightedLostSum += theoryStats.lostWeight * cred;
  }

  if (labStats) {
    const cred = isEmbedded ? labCredits : 1;
    totalCredits += cred;
    weightedScoredSum += labStats.scoredWeight * cred;
    weightedPendingSum += labStats.pendingWeight * cred;
    weightedLostSum += labStats.lostWeight * cred;
  }

  if (projectStats) {
    const cred = isEmbedded ? projectCredits : 1;
    totalCredits += cred;
    weightedScoredSum += projectStats.scoredWeight * cred;
    weightedPendingSum += projectStats.pendingWeight * cred;
    weightedLostSum += projectStats.lostWeight * cred;
  }

  const effectiveCredits = Math.max(1, totalCredits);
  const currentScoredScaled = Math.round((weightedScoredSum / effectiveCredits) * 100) / 100;
  const potentialPendingScaled = Math.round((weightedPendingSum / effectiveCredits) * 100) / 100;
  const pointsLostScaled = Math.round((weightedLostSum / effectiveCredits) * 100) / 100;
  const maxPossibleScaled = Math.max(0, Math.round((100 - pointsLostScaled) * 100) / 100);

  // Optimal = the pace extended over everything still to come. Released weight
  // is the weight with a recorded outcome (scored + lost): pace is earned over
  // that, so a thundering 40% before the first CAT stays 40% however many
  // assessments VTOP has yet to release. Zero released weight → no pace.
  const releasedWeight = currentScoredScaled + pointsLostScaled;
  const pacePct =
    releasedWeight > 0
      ? Math.round((currentScoredScaled / releasedWeight) * 10000) / 100
      : 0;

  const optimalGrade = releasedWeight > 0 ? estimateGrade(pacePct, boundaries) : null;
  // Maximisable assumes every pending weight is earned in full; the permanent
  // deficit caps it. Curved courses read the ceiling against their class
  // ladder — the same one the marks subpage renders.
  const maximisableGrade = estimateGrade(maxPossibleScaled, boundaries);

  // The final-exam rows VTOP has not weighted yet. The title read mirrors the
  // scope's `isFinalExamAssessment`; the scope of this file is imported BY
  // that component, so reaching back would be circular.
  const PENDING_FINAL_RE = /fat|final assessment/i;
  const pendingFinalWeight = (list: PredictorAssessment[]) =>
    list.reduce(
      (sum, asm) =>
        asm.scoredMark == null && PENDING_FINAL_RE.test(asm.title)
          ? sum + Math.max(0, safeNumber(asm.weightagePercent, 0))
          : sum,
      0
    );
  let finalReservedSum = 0;
  if (theoryStats) {
    finalReservedSum += pendingFinalWeight(theoryAssessments) * (isEmbedded ? theoryCredits : 1);
  }
  if (labStats) {
    finalReservedSum += pendingFinalWeight(labAssessments) * (isEmbedded ? labCredits : 1);
  }
  if (projectStats) {
    finalReservedSum += pendingFinalWeight(projectAssessments) * (isEmbedded ? projectCredits : 1);
  }
  const finalReservedScaled = Math.round((finalReservedSum / effectiveCredits) * 100) / 100;

  // The insights ladder's standing: earned over every weight the course has
  // assigned — the marks subpage's exact denominator (`normalisedPct` over
  // the weightage the feed reports). Its pending final-exam weight is not
  // assigned yet (VTOP reports zero there until the exam), so it leaves the
  // denominator; pending rows that do carry a weightage stay in it — user-
  // authored ones included, diluting the read like any listed weight would.
  const assignedWeight = releasedWeight + Math.max(0, potentialPendingScaled - finalReservedScaled);
  const currentStandingPct =
    assignedWeight > 0
      ? Math.round((currentScoredScaled / assignedWeight) * 10000) / 100
      : 0;

  let riskLevel: "safe" | "moderate" | "critical" | "warning" = "safe";
  if (pointsLostScaled > 40) riskLevel = "critical";
  else if (pointsLostScaled > 20) riskLevel = "warning";
  else if (pointsLostScaled > 10) riskLevel = "moderate";

  return {
    courseCode,
    courseTitle,
    courseType,
    isEmbedded,
    theoryCredits: Math.max(0, theoryCredits),
    labCredits: Math.max(0, labCredits),
    totalCredits: effectiveCredits,
    currentScoredScaled,
    currentStandingPct,
    potentialPendingScaled,
    pointsLostScaled,
    maxPossibleScaled,
    theoryStats,
    labStats,
    projectStats,
    pacePct,
    optimalGrade,
    maximisableGrade,
    boundaries,
    isCurved,
    riskLevel,
  };
};

// Target FAT Solver: Determines required FAT mark out of 100 (or maxMark)
export const solveTargetFAT = ({
  targetScore,
  currentScoredScaled,
  fatWeightagePercent = 40,
  fatMaxMark = 100,
  theoryCredits = 3,
  labCredits = 1,
  isEmbedded = false,
  component = "theory",
  otherComponentWeighted = 0,
}: {
  targetScore: number;
  currentScoredScaled: number;
  fatWeightagePercent?: number;
  fatMaxMark?: number;
  theoryCredits?: number;
  labCredits?: number;
  isEmbedded?: boolean;
  component?: "theory" | "lab";
  otherComponentWeighted?: number;
}): TargetFATSolverResult => {
  const targetGradeObj = estimateGrade(targetScore);
  const totalCredits = isEmbedded ? (theoryCredits + labCredits) : 1;
  const compCredits = component === "theory" ? theoryCredits : labCredits;
  const otherCredits = component === "theory" ? labCredits : theoryCredits;

  // If embedded: targetScore = (compCredits * compWeighted + otherCredits * otherComponentWeighted) / totalCredits
  // => compCredits * compWeighted = (targetScore * totalCredits) - (otherCredits * otherComponentWeighted)
  let requiredCompWeighted = targetScore;
  if (isEmbedded && totalCredits > 0) {
    const requiredTotalPoints = targetScore * totalCredits;
    const otherPoints = otherCredits * otherComponentWeighted;
    requiredCompWeighted = (requiredTotalPoints - otherPoints) / compCredits;
  }

  // Deficit needed from FAT
  const currentCompWeightedWithoutFAT = currentScoredScaled;
  const deficitWeight = requiredCompWeighted - currentCompWeightedWithoutFAT;

  // Required raw score in FAT
  const rawScore = (deficitWeight / Math.max(0.1, fatWeightagePercent)) * fatMaxMark;
  const requiredPercentage = (rawScore / fatMaxMark) * 100;

  const isAlreadyAchieved = deficitWeight <= 0;
  const isAchievable = rawScore <= fatMaxMark;
  
  // VIT FAT Minimum Passing Criteria: Student must score at least 40% in FAT (i.e. 40/100 or 20/50 or 16/40 wt)
  const meetsVITMinimumCutoff = rawScore >= 0.4 * fatMaxMark;

  let feasibility: TargetFATSolverResult["feasibility"];
  let feasibilityMessage: string;

  if (isAlreadyAchieved) {
    feasibility = "secured";
    feasibilityMessage = `Target already secured! Even with 0 in FAT, you have achieved ${targetScore}%.`;
  } else if (!isAchievable) {
    feasibility = "impossible";
    feasibilityMessage = `Mathematically out of reach. Max possible score is ${(100 - (targetScore - currentScoredScaled)).toFixed(1)}%.`;
  } else if (rawScore > 0.90 * fatMaxMark) {
    feasibility = "miracle";
    feasibilityMessage = `Miracle required: You need ${rawScore.toFixed(1)} / ${fatMaxMark} (${requiredPercentage.toFixed(0)}%) in FAT.`;
  } else if (rawScore > 0.75 * fatMaxMark) {
    feasibility = "tough";
    feasibilityMessage = `Tough challenge: You need ${rawScore.toFixed(1)} / ${fatMaxMark} (${requiredPercentage.toFixed(0)}%) in FAT.`;
  } else if (rawScore > 0.50 * fatMaxMark) {
    feasibility = "moderate";
    feasibilityMessage = `Achievable with solid prep: You need ${rawScore.toFixed(1)} / ${fatMaxMark} (${requiredPercentage.toFixed(0)}%) in FAT.`;
  } else {
    feasibility = "easy";
    feasibilityMessage = `Comfortable target: You need ${Math.max(0, rawScore).toFixed(1)} / ${fatMaxMark} (${Math.max(0, requiredPercentage).toFixed(0)}%) in FAT.`;
  }

  return {
    targetScore,
    targetGrade: targetGradeObj.letter,
    currentScoreWithoutFAT: Math.round(currentCompWeightedWithoutFAT * 100) / 100,
    requiredFATWeight: Math.max(0, Math.round(deficitWeight * 100) / 100),
    fatWeightagePercent,
    fatMaxMark,
    requiredFATRawScore: Math.max(0, Math.round(rawScore * 100) / 100),
    requiredFATPercentage: Math.max(0, Math.round(requiredPercentage * 10) / 10),
    isAchievable,
    isAlreadyAchieved,
    meetsVITMinimumCutoff,
    feasibility,
    feasibilityMessage,
  };
};

// Generate initial predictor assessments from live VTOP course data + default template
export const createPredictorAssessmentsFromVTOP = (
  course: any,
  component: "theory" | "lab" | "project"
): PredictorAssessment[] => {
  if (!course) return [];

  const rawAssessments = Array.isArray(course.assessments) ? course.assessments : [];
  if (rawAssessments.length === 0) {
    // Return standard preset
    const preset = component === "lab"
      ? PRESET_REGIMENS.find((p) => p.id === "lab-10-continuous")
      : PRESET_REGIMENS.find((p) => p.id === "theory-standard");

    return (preset?.items || []).map((item, idx) => ({
      id: `${component}-${idx + 1}`,
      title: item.title,
      maxMark: item.maxMark,
      weightagePercent: item.weightagePercent,
      scoredMark: null,
      status: "Pending",
      isSimulated: false,
      component,
    }));
  }

  // Parse existing assessments
  const parsed = rawAssessments.map((a: any, idx: number) => {
    const maxMark = safeNumber(a.maxMark, 100);
    const weightagePercent = safeNumber(a.weightagePercent, 10);
    const rawScored = a.scoredMark;
    const isPending = rawScored === null || rawScored === undefined || String(rawScored).trim() === "" || String(rawScored).trim() === "-";
    const scoredMark = isPending ? null : safeNumber(rawScored, 0);

    return {
      id: `${component}-vtop-${a.slNo || idx + 1}`,
      title: String(a.title || `Assessment ${idx + 1}`).trim(),
      maxMark,
      weightagePercent,
      scoredMark,
      status: a.status || (isPending ? "Pending" : "Present"),
      isSimulated: false,
      component,
    };
  });

  // Check if FAT is missing from VTOP data (frequently FAT is not listed in VTOP until scheduled)
  const hasFAT = parsed.some((p) => /FAT|Final Assessment|Final Test/i.test(p.title));
  const totalWeight = parsed.reduce((sum, p) => sum + p.weightagePercent, 0);

  if (!hasFAT && totalWeight < 100) {
    const missingWeight = Math.max(10, 100 - totalWeight);
    parsed.push({
      id: `${component}-auto-fat`,
      title: component === "lab" ? "Lab FAT" : "FAT",
      maxMark: component === "lab" ? 50 : 100,
      weightagePercent: missingWeight,
      scoredMark: null,
      status: "Pending",
      isSimulated: false,
      component,
    });
  }

  return parsed;
};
