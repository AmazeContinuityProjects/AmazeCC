/**
 * Single source of truth for AmazeCC Faculty Reviews
 * Evaluation criteria, question definitions, scoring weights, and Bayesian aggregation config.
 * Strict Rule: VIT Chennai evaluation structure differentiation:
 *  - Lab: Midterms, PATs, FATs, lab records/observations
 *  - Theory: DAs, CATs, FATs, quizzes
 *  - Embedded: Theory + Lab (CATs, DAs, PATs, FAT)
 */

export const schemaVersion = "1.0.0";
export const SCHEMA_VERSION = "1.0.0";

export type ReviewTrack = "teaching" | "project";
export type CourseComponent = "Theory" | "Lab" | "Embedded";
export type GradeBucket = "high" | "mid" | "low";

export interface QualityQuestionConfig {
  id: string;
  question: string;
  minAnchor: string; // 1 rating label
  maxAnchor: string; // 5 rating label
  weight: number;
  conditional?: {
    field: "component";
    matches: CourseComponent[];
  };
  allowNA?: boolean;
}

export interface StyleSpectrumConfig {
  id: string;
  question: string;
  minAnchor: string; // 1 label
  midAnchor?: string; // 3 label (ideal for pace)
  maxAnchor: string; // 5 label
}

export interface TrackReviewConfig {
  schemaVersion?: string;
  track: ReviewTrack;
  title: string;
  qualityQuestions: QualityQuestionConfig[];
  styleQuestions: StyleSpectrumConfig[];
  tags: {
    green: readonly string[];
    red: readonly string[];
    maxGreen: number;
    maxRed: number;
  };
  contextFields: {
    projectTypes?: readonly string[];
    teamSizes?: readonly string[];
    howAssigned?: readonly string[];
    outcomes?: readonly string[];
  };
}

export const TEACHING_CONFIG: TrackReviewConfig = {
  schemaVersion: "1.0.0",
  track: "teaching",
  title: "Teaching",
  qualityQuestions: [
    {
      id: "T_CLARITY",
      question: "How well did they explain concepts so you actually understood?",
      minAnchor: "Left me confused",
      maxAnchor: "Crystal clear",
      weight: 20,
    },
    {
      id: "T_DOUBTS",
      question: "How approachable and respectful were they when you had doubts?",
      minAnchor: "Avoided doubts",
      maxAnchor: "Always happy to help",
      weight: 12,
    },
    {
      id: "T_ALIGN",
      question: "How well did classes prepare you for CATs and FAT?",
      minAnchor: "Barely related",
      maxAnchor: "Exactly what was asked",
      weight: 14,
    },
    {
      id: "T_FAIR",
      question: "How fair and transparent was the marking (CAT, DA, quizzes, records)?",
      minAnchor: "Felt arbitrary",
      maxAnchor: "Fair and clear",
      weight: 14,
    },
    {
      id: "T_REGULAR",
      question: "How regular and punctual were they (classes held, on time, no constant cancellations)?",
      minAnchor: "Very irregular",
      maxAnchor: "Always regular",
      weight: 10,
    },
    {
      id: "T_ENGAGE",
      question: "How engaging were the classes, worth attending even if attendance were optional?",
      minAnchor: "Skippable",
      maxAnchor: "Worth every class",
      weight: 8,
    },
    {
      id: "T_MATERIAL",
      question: "How useful and organised were notes, slides and LMS material?",
      minAnchor: "Poor or missing",
      maxAnchor: "Excellent",
      weight: 4,
    },
    {
      id: "T_AGAIN",
      question: "Would you pick them again in FFCS?",
      minAnchor: "Definitely not",
      maxAnchor: "Definitely yes",
      weight: 18,
    },
    {
      id: "T_LAB",
      question: "How well did they guide you through lab work and experiments?",
      minAnchor: "Left us on our own",
      maxAnchor: "Very hands-on and helpful",
      weight: 10,
      conditional: {
        field: "component",
        matches: ["Lab", "Embedded"],
      },
    },
  ],
  styleQuestions: [
    {
      id: "S_PACE",
      question: "Pace of covering the syllabus",
      minAnchor: "Too slow",
      midAnchor: "Just right",
      maxAnchor: "Too fast",
    },
    {
      id: "S_ATTEND",
      question: "Attendance strictness",
      minAnchor: "Very relaxed",
      midAnchor: "Moderate",
      maxAnchor: "Very strict",
    },
    {
      id: "S_MARKS",
      question: "Generosity with internal marks",
      minAnchor: "Stingy",
      midAnchor: "Balanced",
      maxAnchor: "Generous",
    },
    {
      id: "S_WORKLOAD",
      question: "Workload (DAs, assignments, extras)",
      minAnchor: "Very light",
      midAnchor: "Moderate",
      maxAnchor: "Very heavy",
    },
    {
      id: "S_PAPER",
      question: "Difficulty of CAT/FAT papers",
      minAnchor: "Very easy",
      midAnchor: "Fair",
      maxAnchor: "Very tough",
    },
  ],
  tags: {
    green: [
      // Theory & General
      "Explains with examples",
      "Shares great notes",
      "Great for doubts",
      "Fair marking",
      "Relaxed vibe",
      "Good for exam prep",
      "Cares about students",
      "Engaging lectures",
      // Lab & Practical specific
      "Explains experiments clearly",
      "Helpful with practical doubts",
      "Fair marking on PATs & FAT",
      "Relaxed lab vibe",
      "Good for PAT & Lab FAT prep",
      "Hands-on guidance",
      "Clear lab manuals",
      // Embedded specific
      "Good for CAT, PAT & FAT prep",
    ],
    red: [
      // Theory & General
      "Rushes the syllabus",
      "Strict attendance",
      "Heavy DA load",
      "Tough papers",
      "Unclear grading",
      "Cancels classes often",
      "Reads from slides",
      "Hard to approach",
      // Lab & Practical specific
      "Rushes through experiments",
      "Heavy lab record load",
      "Tough practical exams",
      "Unclear practical grading",
      "Cancels lab sessions often",
      "Leaves students on their own",
      "Hard to approach in lab",
      // Embedded specific
      "Heavy DA & lab record load",
    ],
    maxGreen: 999,
    maxRed: 999,
  },
  contextFields: {},
};

export const PROJECT_CONFIG: TrackReviewConfig = {
  schemaVersion: "1.0.0",
  track: "project",
  title: "Project Guide",
  qualityQuestions: [
    {
      id: "P_AVAIL",
      question: "How easy was it to get time with them for meetings and reviews?",
      minAnchor: "Nearly impossible",
      maxAnchor: "Always available",
      weight: 18,
    },
    {
      id: "P_FEEDBACK",
      question: "How constructive, specific, and actionable was their feedback?",
      minAnchor: "Vague or unhelpful",
      maxAnchor: "Very insightful",
      weight: 16,
    },
    {
      id: "P_SUPPORT",
      question: "How supportive were they when the project hit technical dead-ends?",
      minAnchor: "Left on our own",
      maxAnchor: "Helped find solutions",
      weight: 14,
    },
    {
      id: "P_FAIR",
      question: "How fair was their internal grading relative to your effort and results?",
      minAnchor: "Felt unfair",
      maxAnchor: "Fair and transparent",
      weight: 18,
    },
    {
      id: "P_CLARITY",
      question: "How clear were milestones and expectations?",
      minAnchor: "Vague",
      maxAnchor: "Very clear",
      weight: 8,
    },
    {
      id: "P_GROWTH",
      question:
        "How much did they support your growth beyond the project (publications, recommendations, contacts, opportunities)?",
      minAnchor: "Not at all",
      maxAnchor: "A great deal",
      weight: 8,
      allowNA: true,
    },
    {
      id: "P_AGAIN",
      question: "Would you choose them as your guide again?",
      minAnchor: "Definitely not",
      maxAnchor: "Definitely yes",
      weight: 18,
    },
  ],
  styleQuestions: [
    {
      id: "PS_AUTONOMY",
      question: "Working style",
      minAnchor: "Hand-holding",
      maxAnchor: "Fully independent",
    },
    {
      id: "PS_DEMAND",
      question: "Expectations and workload",
      minAnchor: "Light",
      maxAnchor: "Very demanding",
    },
    {
      id: "PS_DEADLINE",
      question: "Deadline flexibility",
      minAnchor: "Rigid",
      maxAnchor: "Flexible",
    },
  ],
  tags: {
    green: [
      "Very supportive",
      "Open to student ideas",
      "Great for publications",
      "Well connected",
      "Clear milestones",
      "Gives real ownership",
    ],
    red: [
      "Hard to reach",
      "Last-minute changes",
      "Vague guidance",
      "Over-demanding",
      "Slow to review drafts",
      "Micromanages",
    ],
    maxGreen: 999,
    maxRed: 999,
  },
  contextFields: {
    projectTypes: [
      "Mini project",
      "Project I",
      "Project II",
      "Capstone",
      "Multidisciplinary Project (MDP)",
      "Interdisciplinary Project (IDP)",
      "Research with faculty",
      "Summer internship",
    ],
    teamSizes: ["Solo", "2", "3+"],
    howAssigned: ["Allotted to me", "I chose them", "Don't recall"],
    outcomes: [
      "Paper published",
      "Paper submitted",
      "Patent filed",
      "Won hackathon or competition",
      "Deployed or used",
      "None",
    ],
  },
};

export const REVIEWS_CONFIG = {
  teaching: TEACHING_CONFIG,
  project: PROJECT_CONFIG,
  aggregation: {
    bayesianPriorCount: 8, // m = 8
    defaultGlobalMeanTeaching: 3.65, // C
    defaultGlobalMeanProject: 3.75, // C
    minReviewsToShowGrade: 1, // Show early score starting from 1 verified review
    earlyBadgeMaxReviews: 7, // 1 to 7 shows "Early Data"
    minReviewsForDistribution: 5,
    minVotesToShowTag: 3,
    outlierTrimMinReviews: 20,
    outlierTrimPercent: 0.05, // 5% top and bottom
    verifiedTeachingWeight: 1.0,
    unverifiedTeachingWeight: 0.5,
    verifiedProjectWeight: 1.0,
    unverifiedProjectWeight: 0.7,
    recencyDecayHalflifeSemesters: 4, // 0.5 ^ (semesters_ago / 4)
  },
  limits: {
    editWindowDays: 14,
    maxProjectReviewsPerYear: 3,
    maxKvWritesPerRun: 50,
  },
} as const;

/**
 * Returns question weights normalized so they sum to 100.
 */
export function getEffectiveQuestionWeights(
  track: ReviewTrack,
  component?: CourseComponent,
  includedNAIds: string[] = []
): Record<string, number> {
  const config = track === "teaching" ? TEACHING_CONFIG : PROJECT_CONFIG;
  const applicable = config.qualityQuestions.filter((q) => {
    if (includedNAIds.includes(q.id)) return false;
    if (q.conditional) {
      if (q.conditional.field === "component") {
        if (!component || !q.conditional.matches.includes(component)) {
          return false;
        }
      }
    }
    return true;
  });

  const sumWeights = applicable.reduce((acc, q) => acc + q.weight, 0);
  const result: Record<string, number> = {};
  for (const q of applicable) {
    result[q.id] = (q.weight / sumWeights) * 100;
  }
  return result;
}

/**
 * Resolves question wording strictly matching VIT marking criteria by component:
 *  - Lab: Midterms, PATs, FATs, lab records/observations
 *  - Theory: DAs, CATs, FATs, quizzes
 *  - Embedded: CATs, DAs, PATs, FAT
 */
export function getComponentQuestion(
  questionId: string,
  defaultQuestion: string,
  component?: CourseComponent
): string {
  if (component === "Lab") {
    switch (questionId) {
      case "T_ALIGN":
        return "How well did lab sessions prepare you for Midterms, PATs, and Lab FAT?";
      case "T_FAIR":
        return "How fair and transparent was marking (Midterms, PATs, Lab FAT, records)?";
      case "T_REGULAR":
        return "How regular and punctual were lab sessions (held on time, experiments properly supervised)?";
      case "T_ENGAGE":
        return "How engaging and hands-on were the lab sessions?";
      case "T_MATERIAL":
        return "How useful and organised were lab manuals, guidelines, and experiment resources?";
      case "T_LAB":
        return "How well did they guide you through lab experiments and practical doubts?";
      case "S_PACE":
        return "Pace of lab experiments and syllabus";
      case "S_WORKLOAD":
        return "Workload (lab records, observation files, and practical prep)";
      case "S_PAPER":
        return "Difficulty of practical exams (PATs, Midterms, and Lab FAT)";
      default:
        return defaultQuestion;
    }
  }

  if (component === "Embedded") {
    switch (questionId) {
      case "T_ALIGN":
        return "How well did classes and labs prepare you for CATs, PATs, and FAT?";
      case "T_FAIR":
        return "How fair and transparent was the marking (CATs, DAs, PATs, lab records, FAT)?";
      case "T_REGULAR":
        return "How regular and punctual were lectures and lab sessions?";
      case "T_MATERIAL":
        return "How useful and organised were notes, lab manuals, and LMS material?";
      case "T_LAB":
        return "How well did they guide you through the lab component and practical tasks?";
      case "S_WORKLOAD":
        return "Workload (DAs, assignments, and lab records)";
      case "S_PAPER":
        return "Difficulty of theory & practical exams (CATs, PATs, FAT)";
      default:
        return defaultQuestion;
    }
  }

  // Default: Theory component
  switch (questionId) {
    case "T_ALIGN":
      return "How well did classes prepare you for CATs and FAT?";
    case "T_FAIR":
      return "How fair and transparent was the marking (CATs, DAs, quizzes)?";
    case "T_REGULAR":
      return "How regular and punctual were they (classes held, on time, no constant cancellations)?";
    case "T_MATERIAL":
      return "How useful and organised were notes, slides and LMS material?";
    case "S_WORKLOAD":
      return "Workload (DAs, assignments, extras)";
    case "S_PAPER":
      return "Difficulty of CAT/FAT exam papers";
    default:
      return defaultQuestion;
  }
}

/**
 * Returns pre-filtered tag options matching the student's enrolled course component.
 */
export function getComponentTags(component?: CourseComponent): {
  green: readonly string[];
  red: readonly string[];
} {
  if (component === "Lab") {
    return {
      green: [
        "Explains experiments clearly",
        "Helpful with practical doubts",
        "Fair marking on PATs & FAT",
        "Relaxed lab vibe",
        "Good for PAT & Lab FAT prep",
        "Cares about students",
        "Hands-on guidance",
        "Clear lab manuals",
      ],
      red: [
        "Rushes through experiments",
        "Strict attendance",
        "Heavy lab record load",
        "Tough practical exams",
        "Unclear practical grading",
        "Cancels lab sessions often",
        "Leaves students on their own",
        "Hard to approach in lab",
      ],
    };
  }

  if (component === "Embedded") {
    return {
      green: [
        "Explains with examples",
        "Shares great notes",
        "Great for doubts",
        "Fair marking",
        "Relaxed vibe",
        "Good for CAT, PAT & FAT prep",
        "Cares about students",
        "Engaging lectures",
      ],
      red: [
        "Rushes the syllabus",
        "Strict attendance",
        "Heavy DA & lab record load",
        "Tough papers",
        "Unclear grading",
        "Cancels classes often",
        "Reads from slides",
        "Hard to approach",
      ],
    };
  }

  // Theory default
  return {
    green: [
      "Explains with examples",
      "Shares great notes",
      "Great for doubts",
      "Fair marking",
      "Relaxed vibe",
      "Good for exam prep",
      "Cares about students",
      "Engaging lectures",
    ],
    red: [
      "Rushes the syllabus",
      "Strict attendance",
      "Heavy DA load",
      "Tough papers",
      "Unclear grading",
      "Cancels classes often",
      "Reads from slides",
      "Hard to approach",
    ],
  };
}

export interface CanonicalReviewQuestionsSchema {
  schemaVersion: "1.0.0";
  teaching: TrackReviewConfig;
  project: TrackReviewConfig;
}

export const CANONICAL_REVIEW_QUESTIONS: CanonicalReviewQuestionsSchema = {
  schemaVersion: "1.0.0",
  teaching: TEACHING_CONFIG,
  project: PROJECT_CONFIG,
};

