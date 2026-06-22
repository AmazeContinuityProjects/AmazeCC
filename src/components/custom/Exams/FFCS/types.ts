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
};

export type TimetableState = {
  id: string;
  name: string;
  courses: AddedCourse[];
  metrics?: {
    halfDays: number;
    gaps: number;
    gapsPerDay: Record<string, number>;
    gapDetails?: { day: string; startMin: number; endMin: number; durationMins: number }[];
    buildingDashes: number;
    dashDetails?: { fromClass: string; toClass: string; fromTime: string; toTime: string; day: string }[];
    socialScore: number;
    bestFriendMatches: string[];
    isLongWeekend: boolean;
  };
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
