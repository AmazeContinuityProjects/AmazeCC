/**
 * Canonical Attendance Math & Margins.
 *
 * Single source of truth for:
 * - Current attendance percentage (properly rounded)
 * - Safe bunks remaining before dropping below threshold
 * - Classes needed to recover if currently below threshold
 * - Accounting for standard 2-hour lab sessions
 */

export interface AttendanceMargin {
  /** Attended classes / sessions */
  attended: number;
  /** Total classes / sessions conducted */
  total: number;
  /** Current calculated attendance percentage, e.g. 78.5 */
  currentPct: number;
  /** Number of upcoming classes/sessions the student can safely miss */
  canMiss: number;
  /** Number of upcoming consecutive classes the student must attend to reach threshold */
  classesNeeded: number;
  /** Whether the current percentage meets or exceeds the target threshold */
  isSafe: boolean;
  /** The target percentage used (e.g. 75, 80, 85) */
  targetPct: number;
}

/**
 * Calculates attendance margin and recovery count with exact precision.
 * Handles lab sessions (where each session is typically 2 hours).
 */
export function calculateAttendanceMargin(
  attended: number,
  total: number,
  thresholdPct = 75,
  isLab = false,
): AttendanceMargin {
  const safeAttended = Math.max(0, attended || 0);
  const safeTotal = Math.max(0, total || 0);

  if (safeTotal === 0) {
    return {
      attended: 0,
      total: 0,
      currentPct: 100,
      canMiss: 0,
      classesNeeded: 0,
      isSafe: true,
      targetPct: thresholdPct,
    };
  }

  const currentPct = Math.round((safeAttended / safeTotal) * 1000) / 10;
  const targetFraction = Math.max(0.01, Math.min(0.99, thresholdPct / 100));

  let canMiss = 0;
  let classesNeeded = 0;
  const isSafe = currentPct >= thresholdPct;

  if (isSafe) {
    // Formula: floor((attended - threshold * total) / threshold)
    const rawBunks = Math.floor((safeAttended - targetFraction * safeTotal) / targetFraction);
    canMiss = Math.max(0, rawBunks);
    // If lab sessions are conducted in 2-hour blocks, dividing by 2 gives the number of practical sessions
    if (isLab && canMiss > 0) {
      canMiss = Math.floor(canMiss / 2);
    }
  } else {
    // Formula: ceil((threshold * total - attended) / (1 - threshold))
    const rawNeeded = Math.ceil((targetFraction * safeTotal - safeAttended) / (1 - targetFraction));
    classesNeeded = Math.max(0, rawNeeded);
    if (isLab && classesNeeded > 0) {
      classesNeeded = Math.ceil(classesNeeded / 2);
    }
  }

  return {
    attended: safeAttended,
    total: safeTotal,
    currentPct,
    canMiss,
    classesNeeded,
    isSafe,
    targetPct: thresholdPct,
  };
}
