/**
 * The scoring contract comes from `lib/timetableMetrics` rather than being
 * written out here.
 *
 * It was hand-declared, and the hand-declaration had drifted: a producer in a
 * worker filled in six of the nine fields — omitting `gapsPerDay`, naming the
 * long-weekend flag `longWeekend` where this said `isLongWeekend`, and skipping
 * `bestFriendMatches` — and TypeScript did not notice, because that producer's
 * return type was inferred at an unannotated call site rather than checked
 * against this one. Deriving it makes that a compile error instead.
 */
export type { TimetableMetrics } from "@/lib/timetableMetrics";
import type { TimetableMetrics } from "@/lib/timetableMetrics";
import type { FacultyRankingSummary } from "@/lib/ffcsFacultyRanking";

export interface GenCourseSelection {
  code: string;
  offerings: string[];
}

export type SlotMap = {
  [day: string]: string;
};

export type TimetablePeriod = {
  slot?: string;
  start?: string;
  end?: string;
  lunch?: boolean;
  days?: SlotMap;
};

export type ParsedCourse = {
  CODE: string;
  TITLE: string;
  TYPE: string;
  CREDITS: string;
  ROOM: string;
  SLOT: string;
  FACULTY: string;
  ORIGINAL_CODE?: string;
  LINK_ID?: string;
  BATCH?: string;
  /** The registration list's class/section id, when the report carries one. */
  CLASS_ID?: string;
  /**
   * The employee id behind FACULTY.
   *
   * Names are not unique and can be spelled differently on different rows, so
   * the generator uses this when the report supplies it to identify an
   * offering and to keep one person's rows together.
   */
  ERP_ID?: string;
  /** The school that employs FACULTY, when the report carries it. */
  EMPLOYEE_SCHOOL?: string;
};

export interface ManualLink {
  CODE: string;
  TYPE: string;
  SLOT: string;
  ROOM: string;
  FACULTY: string;
  LINK_ID: string;
}

export type AddedCourse = {
  id: string;
  code: string;
  title: string;
  slots: string[];
  faculty: string;
  /** The faculty member's employee id, when the report carried one. */
  employeeId?: string;
  /** The registration-list class id, when this offering came from a report. */
  classId?: string;
  venue: string;
  credits: string;
  type: string;
  color: string;
  batch?: string;
};

export type TimetableState = {
  id: string;
  name: string;
  courses: AddedCourse[];
  metrics?: TimetableMetrics;
  variants?: TimetableState[];
  /**
   * The weighted ranking profile's verdict, out of 100.
   *
   * Optional because it is only computed when a student picks a ranking mode —
   * see `@/lib/ffcsRanking` for why it lives beside `metrics` rather than
   * inside it. Absent means "no profile was asked for", not "scored zero".
   */
  rankingScore?: number;
  /** Where the 100 points came from, for the breakdown panel. */
  rankingBreakdown?: Record<string, number>;
  /** Vitfac aggregate and per-course review details, when the catalog was available. */
  facultySummary?: FacultyRankingSummary;
  /** The four input scores combined to produce `rankingScore`. */
  rankingComponents?: {
    profile: number | null;
    faculty: number | null;
    sort: number | null;
    time: number | null;
  };
};

export interface Friend {
  id: string;
  name: string;
  timetables: TimetableState[];
}

export interface FriendGroup {
  id: string;
  name: string;
  friendIds: string[];
}

export interface CourseLock {
  code: string;
  title: string;
  allowedSlots: string[]; // empty array means all slots are allowed
  allowedFaculty: string[]; // empty array means all faculty are allowed
  /** Exact offerings, as `FACULTY|SLOT|ROOM` plus `|ERP_ID` when the report has one. */
  offerings?: string[];
}
