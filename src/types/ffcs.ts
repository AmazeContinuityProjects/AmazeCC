/**
 * Unified FFCS Domain Types for AmazeCC.
 *
 * Unifies generator tuning parameters, course locks, layout modes, catalog offerings,
 * and user timetables.
 */

import type { NormalizedCourse } from "./course";
import type { FFCSSettings, FFCSCourseLock } from "./storage";
import type { TimetableState } from "../lib/ffcsTypes";

export interface UnifiedFFCSState {
  /** FFCS generator preference settings */
  settings: FFCSSettings;
  /** UI presentation mode */
  layoutMode: "guided" | "modern" | "classic";
  /** Explicit student constraints (locked slots, preferred faculty) */
  courseLocks: FFCSCourseLock[];
  /** Catalog courses available for selection in the generator */
  availableCourses: NormalizedCourse[];
  /** Saved and generated timetables */
  timetables: TimetableState[];
  /** Active selected timetable ID */
  activeTimetableId?: string;
  /** Whether the introductory faculty guide was dismissed */
  isFacultyGuideDismissed: boolean;
  /** Friend groups integrated with FFCS */
  friendGroups?: any[];
}
