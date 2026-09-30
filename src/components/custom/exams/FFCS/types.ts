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

export interface GenCourseSelection {
  code: string;
  offerings: string[];
}

export type SlotMap = {
  [day: string]: string;
};

export type TimetablePeriod = {
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
  offerings?: string[]; // array of 'FACULTY|SLOT|ROOM'
}


