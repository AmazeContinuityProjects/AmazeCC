/**
 * Unified Attendance & Academics Domain Types for AmazeCC.
 *
 * Unifies real-time attendance, snapshot attendance, exam schedules, and grades.
 */

import type { NormalizedCourse, CourseExamSlot } from "./course";
import type { AllGradesRes } from "./data/allgrades";

export interface UnifiedExamSchedule {
  fat: CourseExamSlot[];
  cat1: CourseExamSlot[];
  cat2: CourseExamSlot[];
  other: CourseExamSlot[];
}

export interface UnifiedSemesterAcademics {
  /** Semester code (e.g. "CH20262701") */
  semesterId: string;
  /** Normalized courses with attached attendance records */
  courses: NormalizedCourse[];
  /** Aggregate attended classes across all courses */
  totalAttendedClasses: number;
  /** Aggregate total conducted classes across all courses */
  totalConductedClasses: number;
  /** Computed overall attendance percentage (0 - 100) */
  overallAttendancePercentage: number;
  /** Formatted overall attendance string (e.g. "89.50%") */
  overallAttendanceFormatted: string;
  /** CAT1, CAT2, and FAT exam schedule */
  examSchedule: UnifiedExamSchedule;
  /** Official historical grades and CGPA if available */
  grades?: AllGradesRes;
  /** Registered CGPA */
  cgpa?: string;
  /** True if this is a historical frozen snapshot */
  isFrozen: boolean;
  /** Saturday timetable override if set (e.g. "MON", "TUE") */
  saturdayOverride?: string;
  /** Cache timestamp */
  lastSyncedAt?: number;
}
