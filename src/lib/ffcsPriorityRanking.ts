export interface StudentPriorities {
  scoringWell: number; // 0 to 5 weight
  learningDeeply: number;
  lightWorkload: number;
  relaxedAttendance: number;
  examPrep: number;
}

export const DEFAULT_STUDENT_PRIORITIES: Readonly<StudentPriorities> = Object.freeze({
  scoringWell: 0,
  learningDeeply: 0,
  lightWorkload: 0,
  relaxedAttendance: 0,
  examPrep: 0,
});

export interface FacultyPriorityMetrics {
  clarity?: number | null; // T_CLARITY
  fairMarking?: number | null; // T_FAIR
  examAlign?: number | null; // T_ALIGN
  engagement?: number | null; // T_ENGAGE
  attendancePace?: number | null; // S_ATTEND (1 relaxed -> 5 strict)
  workload?: number | null; // S_WORKLOAD (1 light -> 5 heavy)
  marksGenerosity?: number | null; // S_MARKS (1 stingy -> 5 generous)
}

/**
 * Calculates a customized priority score (0 - 100) for a faculty member.
 */
export function calculateFacultyPriorityScore(
  baseGrade: number | null,
  metrics: FacultyPriorityMetrics,
  priorities: StudentPriorities
): number | null {
  if (baseGrade === null) return null;

  const totalPriorityWeight =
    priorities.scoringWell +
    priorities.learningDeeply +
    priorities.lightWorkload +
    priorities.relaxedAttendance +
    priorities.examPrep;

  if (totalPriorityWeight === 0) {
    // No active priorities: return standard base grade scaled to 100
    return Math.round(((baseGrade - 1.0) / 4.0) * 100);
  }

  let accumulated = 0;
  let weightsUsed = 0;

  // 1. Scoring well: high fair marking and generosity
  if (priorities.scoringWell > 0) {
    const markScore = metrics.marksGenerosity ?? (metrics.fairMarking ?? baseGrade);
    accumulated += (markScore / 5.0) * priorities.scoringWell;
    weightsUsed += priorities.scoringWell;
  }

  // 2. Learning deeply: high clarity and engagement
  if (priorities.learningDeeply > 0) {
    const learnScore = metrics.clarity ?? baseGrade;
    accumulated += (learnScore / 5.0) * priorities.learningDeeply;
    weightsUsed += priorities.learningDeeply;
  }

  // 3. Light workload: lighter workload (inverted 5 - workload + 1)
  if (priorities.lightWorkload > 0) {
    const loadScore = metrics.workload ? Math.max(1, 6 - metrics.workload) : 3;
    accumulated += (loadScore / 5.0) * priorities.lightWorkload;
    weightsUsed += priorities.lightWorkload;
  }

  // 4. Relaxed attendance: relaxed attendance spectrum (inverted: 1 relaxed -> 5, 5 strict -> 1)
  if (priorities.relaxedAttendance > 0) {
    const attendScore = metrics.attendancePace ? Math.max(1, 6 - metrics.attendancePace) : 3;
    accumulated += (attendScore / 5.0) * priorities.relaxedAttendance;
    weightsUsed += priorities.relaxedAttendance;
  }

  // 5. Exam prep: high CAT/FAT alignment
  if (priorities.examPrep > 0) {
    const prepScore = metrics.examAlign ?? baseGrade;
    accumulated += (prepScore / 5.0) * priorities.examPrep;
    weightsUsed += priorities.examPrep;
  }

  const priorityFraction = weightsUsed > 0 ? accumulated / weightsUsed : (baseGrade - 1.0) / 4.0;
  // Blend 60% priority score + 40% base quality grade
  const blended = 0.6 * priorityFraction + 0.4 * ((baseGrade - 1.0) / 4.0);
  return Math.round(Math.max(0, Math.min(100, blended * 100)));
}

/**
 * Re-ranks a list of faculty candidates according to the student's priorities.
 */
export function rerankFacultyCandidates<T extends { baseGrade: number | null; metrics: FacultyPriorityMetrics }>(
  candidates: T[],
  priorities: StudentPriorities
): (T & { priorityScore: number | null })[] {
  return candidates
    .map((c) => ({
      ...c,
      priorityScore: calculateFacultyPriorityScore(c.baseGrade, c.metrics, priorities),
    }))
    .sort((a, b) => (b.priorityScore ?? 0) - (a.priorityScore ?? 0));
}
