/**
 * Unified Marks & Cohort Statistics Domain Types for AmazeCC.
 *
 * Unifies frozen assessment states, mark hashes, marks synchronizer flags, and
 * cohort statistical distributions.
 */

import type { CourseAssessmentItem } from "./course";
import type { ClassMarksStats } from "./storage";

export interface UnifiedCourseMarkSummary {
  classId: string;
  courseCode: string;
  courseTitle: string;
  courseType?: string;
  assessments: CourseAssessmentItem[];
  totalScored: number;
  totalMax: number;
  totalWeightageScored: number;
  totalWeightageMax: number;
  /** Cohort benchmark statistics from the curves distribution endpoint */
  cohortStats?: ClassMarksStats;
  /** Set of token hashes representing frozen marks */
  frozenTokens: string[];
  /** Whether the course marks are frozen */
  isFrozen: boolean;
}

export interface UnifiedSemesterMarks {
  semesterId: string;
  courses: Record<string, UnifiedCourseMarkSummary>;
  overallScoredWeightage: number;
  overallMaxWeightage: number;
  hasBackfillV2: boolean;
  lastSyncedAt?: number;
}
