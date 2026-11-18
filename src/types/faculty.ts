/**
 * Canonical Faculty Types for AmazeCC.
 *
 * Provides unified, normalized faculty models across the entire application:
 * Timetables, Attendance, FFCS, Marks, Social, and Exams.
 */

export interface FacultyRating {
  wPct: number | null;
  lecture: number | null;
  da: number | null;
  vibe: number | null;
  reviews: number;
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

export interface ParsedFacultyInfo {
  cleanName: string;
  employeeId?: string;
  school?: string;
  department?: string;
}

/**
 * Normalized representation of a faculty member.
 * Eliminates inconsistent delimiters ("12345 - DR. NAME - SCOPE" vs "50772 NAME SAS"),
 * provides clean names, titles, initials, employee IDs, and rating metadata.
 */
export interface NormalizedFaculty {
  /** Original raw string as reported by VTOP or CSV */
  raw: string;
  /** Cleaned display name without titles or IDs (e.g., "NATHIYA N", "JOHN DOE") */
  name: string;
  /** Honorific / Title if present (e.g., "DR.", "PROF.", "MR.", "MS.") */
  title: string | null;
  /** VIT Employee ERP ID if available (e.g., "50772", "12345") */
  employeeId: string | null;
  /** School abbreviation if identified (e.g., "SCOPE", "SAS", "SELECT") */
  school: string | null;
  /** Department or specific center if present */
  department: string | null;
  /** Computed uppercase 2-letter initials for avatars (e.g., "NN", "JD") */
  initials: string;
  /** Faculty review and crowd ratings if available */
  rating: FacultyRating | null;
}
