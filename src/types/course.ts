/**
 * Canonical Course Types for AmazeCC.
 *
 * Provides unified, normalized course definitions that harmonize disparate representations:
 * Attendance, Marks, FFCS Generator, Timetable, Social Grid, and Exams.
 */

import type { NormalizedFaculty } from "./faculty";

export type CourseComponentType =
  "Theory Only" | "Lab Only" | "Embedded Theory" | "Embedded Lab" | "Project" | "Soft Skills" | "Other";

export interface CourseAttendanceHistoryEntry {
  date: string;
  status: "Present" | "Absent" | "On Duty" | string;
  slot?: string;
  remarks?: string;
}

export interface CourseAttendanceSummary {
  attendedClasses: number;
  totalClasses: number;
  attendancePercentage: number;
  attendancePercentageFormatted: string; // e.g. "90.00%"
  history: CourseAttendanceHistoryEntry[];
  registrationDate?: string;
  lastAttendanceDate?: string;
}

export interface CourseAssessmentItem {
  slNo?: string;
  title: string;
  maxMark: number;
  weightagePercent: number;
  scoredMark: number | null;
  weightageMark: number | null;
  status: string;
  component?: "theory" | "lab";
}

export interface CourseMarksSummary {
  classNbr?: string;
  courseMode?: string;
  courseSystem?: string;
  assessments: CourseAssessmentItem[];
  totalScored?: number;
  totalMax?: number;
  totalWeightage?: number;
}

export interface CourseExamSlot {
  examName: "CAT1" | "CAT2" | "FAT" | string;
  examDate: string;
  examSession: string;
  reportingTime: string;
  examTime: string;
  venue: string;
  seatLocation: string;
  seatNo: string;
}

export interface CourseExamSummary {
  cat1?: CourseExamSlot;
  cat2?: CourseExamSlot;
  fat?: CourseExamSlot;
  otherExams?: CourseExamSlot[];
}

export interface CourseFFCSMetadata {
  color?: string;
  batch?: string;
  linkId?: string;
  isLocked?: boolean;
  allowedSlots?: string[];
  allowedFaculty?: string[];
}

/**
 * Normalized Course Model.
 * Represents a course across all features in AmazeCC with consistent property names,
 * normalized types, and unified faculty and slot structures.
 */
export interface NormalizedCourse {
  /** Clean unique identifier: classId if available, or `${baseCode}-${slots.join('_')}` */
  id: string;

  /** Standardized course code, uppercase (e.g. "BACSE102(L)", "BCSE101E") */
  code: string;

  /** Sanitized base course code without component suffix (e.g. "BACSE102", "BCSE101") */
  baseCode: string;

  /** Full normalized title (e.g. "Problem Solving Using Java") */
  title: string;

  /** Canonical component type */
  componentType: CourseComponentType;

  /** Quick discriminator flags */
  isLab: boolean;
  isTheory: boolean;
  isProject: boolean;

  /** Academic credit value */
  credits: number | null;

  /** LTPJC distribution string (e.g. "3 0 2 0 4") */
  ltpjc: string | null;

  /** Academic taxonomy category (e.g. "Programme Core", "University Core") */
  category: string | null;

  /** VTOP registration class ID (e.g. "CH2026270100046") */
  classId: string | null;

  /** Associated class IDs (for merged theory + lab offerings) */
  classIds: string[];

  /** All assigned slots as an array of normalized slot tokens (e.g. ["L31", "L32", "L37", "L38"]) */
  slots: string[];

  /** Unified slot string for display (e.g. "L31+L32+L37+L38") */
  slotDisplay: string;

  /** Classroom or laboratory venue (e.g. "AB1-402", "SJT-311") */
  venue: string | null;

  /** Normalized faculty details */
  faculty: NormalizedFaculty;

  /** Semester token if known (e.g. "CH20262701") */
  semesterId: string | null;

  /** Feature-specific sub-payloads attached when available */
  attendance?: CourseAttendanceSummary;
  marks?: CourseMarksSummary;
  exam?: CourseExamSummary;
  ffcs?: CourseFFCSMetadata;
}
