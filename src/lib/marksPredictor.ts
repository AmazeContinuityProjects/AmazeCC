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
  theoryStats: ComponentStats | null;
  labStats: ComponentStats | null;
  projectStats: ComponentStats | null;
  estimatedGrade: {
    letter: string;
    color: string;
    bg: string;
    border: string;
    description: string;
  };
  ceilingGrade: {
    letter: string;
    color: string;
  };
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
    description: "Standard Theory: CAT-1 (15%), CAT-2 (15%), 3 Digital Assignments / Quizzes (10% each), FAT (40%)",
    items: [
      { title: "CAT - I", maxMark: 50, weightagePercent: 15 },
      { title: "CAT - II", maxMark: 50, weightagePercent: 15 },
      { title: "Digital Assignment - 1", maxMark: 10, weightagePercent: 10 },
      { title: "Digital Assignment - 2", maxMark: 10, weightagePercent: 10 },
      { title: "Digital Assignment - 3", maxMark: 10, weightagePercent: 10 },
      { title: "Final Assessment Test (FAT)", maxMark: 100, weightagePercent: 40 },
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
      { title: "Digital Assignment - 1", maxMark: 10, weightagePercent: 10 },
      { title: "Digital Assignment - 2", maxMark: 10, weightagePercent: 10 },
      { title: "Quiz - I", maxMark: 10, weightagePercent: 5 },
      { title: "Quiz - II", maxMark: 10, weightagePercent: 5 },
      { title: "Final Assessment Test (FAT)", maxMark: 100, weightagePercent: 40 },
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
      { title: "Lab Final Assessment Test (FAT)", maxMark: 50, weightagePercent: 40 },
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
      { title: "Lab Final Assessment Test (FAT)", maxMark: 50, weightagePercent: 40 },
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
      { title: "Lab Final Assessment Test (FAT)", maxMark: 50, weightagePercent: 40 },
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
      { title: "Final Assessment Test", maxMark: 50, weightagePercent: 40 },
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

// Estimate Letter Grade from percentage / weighted score
export const estimateGrade = (
  score: number
): {
  letter: string;
  color: string;
  bg: string;
  border: string;
  description: string;
} => {
  const rounded = Math.round(score * 100) / 100;
  if (rounded >= 90) {
    return {
      letter: "S",
      color: "text-emerald-600 dark:text-emerald-400",
      bg: "bg-emerald-500/10 dark:bg-emerald-500/20",
      border: "border-emerald-500/30",
      description: "Outstanding (10 Grade Points)",
    };
  }
  if (rounded >= 80) {
    return {
      letter: "A",
      color: "text-teal-600 dark:text-teal-400",
      bg: "bg-teal-500/10 dark:bg-teal-500/20",
      border: "border-teal-500/30",
      description: "Excellent (9 Grade Points)",
    };
  }
  if (rounded >= 70) {
    return {
      letter: "B",
      color: "text-blue-600 dark:text-blue-400",
      bg: "bg-blue-500/10 dark:bg-blue-500/20",
      border: "border-blue-500/30",
      description: "Very Good (8 Grade Points)",
    };
  }
  if (rounded >= 60) {
    return {
      letter: "C",
      color: "text-indigo-600 dark:text-indigo-400",
      bg: "bg-indigo-500/10 dark:bg-indigo-500/20",
      border: "border-indigo-500/30",
      description: "Good (7 Grade Points)",
    };
  }
  if (rounded >= 50) {
    return {
      letter: "D",
      color: "text-purple-600 dark:text-purple-400",
      bg: "bg-purple-500/10 dark:bg-purple-500/20",
      border: "border-purple-500/30",
      description: "Average (6 Grade Points)",
    };
  }
  if (rounded >= 40) {
    return {
      letter: "E",
      color: "text-amber-600 dark:text-amber-400",
      bg: "bg-amber-500/10 dark:bg-amber-500/20",
      border: "border-amber-500/30",
      description: "Pass (5 Grade Points)",
    };
  }
  return {
    letter: "F",
    color: "text-rose-600 dark:text-rose-400",
    bg: "bg-rose-500/10 dark:bg-rose-500/20",
    border: "border-rose-500/30",
    description: "Fail (0 Grade Points)",
  };
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
}): CoursePredictionResult => {
  const hasTheory = theoryAssessments.length > 0;
  const hasLab = labAssessments.length > 0;
  const hasProject = projectAssessments.length > 0;
  const isEmbedded = (hasTheory && hasLab) || courseType.toLowerCase().includes("embedded");

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

  const estimatedGrade = estimateGrade(currentScoredScaled + potentialPendingScaled);
  const ceilingGrade = estimateGrade(maxPossibleScaled);

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
    potentialPendingScaled,
    pointsLostScaled,
    maxPossibleScaled,
    theoryStats,
    labStats,
    projectStats,
    estimatedGrade,
    ceilingGrade,
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
  const meetsVITMinimumCutoff = rawScore >= (0.40 * fatMaxMark);

  let feasibility: TargetFATSolverResult["feasibility"] = "moderate";
  let feasibilityMessage = "";

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
      title: component === "lab" ? "Lab Final Assessment Test (FAT)" : "Final Assessment Test (FAT)",
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
