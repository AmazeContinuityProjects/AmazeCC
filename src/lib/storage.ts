import type { attendanceRes } from "@/types/data/attendance";
import type { AllGradesRes } from "@/types/data/allgrades";
import type { CourseItem } from "@/types/data/marks";

export const KEYS = {
  ATTENDANCE: "attendance",
  MARKS: "marks",
  GRADES: "grades",
  ALL_GRADES: "allGrades",
  SCHEDULE: "schedule",
  HOSTEL: "hostel",
  CALENDAR: "calender",
  PROFILE: "profile",
  PROFILE_IMAGES: "profileImages",
  USERNAME: "username",
  PASSWORD: "password",
  MOODLE_USERNAME: "moodle_username",
  MOODLE_PASSWORD: "moodle_password",
  IDS: "IDs",
  SETTINGS: "settings",
  DEMO_MODE: "demoMode",
  THEME: "theme",
  APP_ICON: "app-icon",
  FRIENDLY_NAME: "friendlyName",
  TRANSPORT_DATA: "transportData",
  REGISTERED_EVENTS: "registeredEvents",
  EVENT_HUB_SESSION: "eventHubSession",
  MOODLE_DATA: "moodleData",
  VITOL_DATA: "vitolData",
  ACTIVITY_TREE: "activityTree",
  HAS_SYNCED_MARKS_V2: "hasSyncedMarksV2",
  LAST_SEEN_CHANGELOG: "lastSeenChangelogVersion",
  HAS_SEEN_PUSH_PROMPT: "hasSeenPushPrompt",
  WASTED_ODS_TRACKER: "wastedODsTracker",
  UNICC_NOTES_TRACKER: "uniCC_notes_tracker",
  NOTES_TRACKER: "notesTracker",
  CUSTOM_HOMEWORK: "customHomework",
  GPA_GOAL: "uni_cc_gpa_goal",
  QCM_DATA: "qcmData",
  FRIENDS_SCHEDULES: "friends_schedules",
  FRIENDS_GROUPS: "friends_groups",
  KOHA_CARD: "koha_card",
  KOHA_PASSWORD: "koha_password",
  KOHA_DUES_TOTAL: "koha_dues_total",
  KOHA_DUES_COUNT: "koha_dues_count",
  KOHA_PATRON_PAGES: "koha_patron_pages",
  CABSHARE_USER: "cabshare_user",
  VITOL_USERNAME: "vitol_username",
  VITOL_PASSWORD: "vitol_password",
  VITOL_SITE: "vitol_site",
  FFCS_TIMETABLES: "ffcs_timetables",
  FFCS_ACTIVE_TIMETABLE_ID: "ffcs_activeTimetableId",
  FFCS_BLOCKED_SLOTS: "ffcs_blockedSlots",
  FFCS_FRIENDS: "ffcs_friends",
  FFCS_FRIEND_GROUPS: "ffcs_friendGroups",
  FFCS_SOCIAL_SCORE_METHOD: "ffcs_socialScoreGroupMethod",
  FFCS_COURSE_LOCKS: "ffcs_courseLocks",
  FFCS_MANUAL_LINKS: "ffcs_manual_links",
  FFCS_RAW_COURSES: "ffcs_raw_courses",
  CACHE_PREFIX: "cache_",
  FROZEN_ATT_PREFIX: "frozen_att_",
  FROZEN_MARKS_PREFIX: "frozen_marks_",
} as const;

function getItem<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function setItem<T>(key: string, value: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch { /* quota exceeded, silently fail */ }
}

function removeItem(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch { /* silently fail */ }
}

function getString(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function setString(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch { /* silently fail */ }
}

export const storage = {
  attendance: {
    get: () => getItem<attendanceRes>(KEYS.ATTENDANCE),
    set: (data: attendanceRes) => setItem(KEYS.ATTENDANCE, data),
    remove: () => removeItem(KEYS.ATTENDANCE),
  },
  marks: {
    get: () => getItem<{ courses?: CourseItem[]; cgpa?: unknown }>(KEYS.MARKS),
    set: (data: unknown) => setItem(KEYS.MARKS, data),
    remove: () => removeItem(KEYS.MARKS),
  },
  grades: {
    get: () => getItem<unknown>(KEYS.GRADES),
    set: (data: unknown) => setItem(KEYS.GRADES, data),
    remove: () => removeItem(KEYS.GRADES),
  },
  allGrades: {
    get: () => getItem<AllGradesRes>(KEYS.ALL_GRADES),
    set: (data: AllGradesRes) => setItem(KEYS.ALL_GRADES, data),
    remove: () => removeItem(KEYS.ALL_GRADES),
  },
  schedule: {
    get: () => getItem<unknown>(KEYS.SCHEDULE),
    set: (data: unknown) => setItem(KEYS.SCHEDULE, data),
    remove: () => removeItem(KEYS.SCHEDULE),
  },
  hostel: {
    get: () => getItem<unknown>(KEYS.HOSTEL),
    set: (data: unknown) => setItem(KEYS.HOSTEL, data),
    remove: () => removeItem(KEYS.HOSTEL),
  },
  calendar: {
    get: () => getItem<unknown>(KEYS.CALENDAR),
    set: (data: unknown) => setItem(KEYS.CALENDAR, data),
    remove: () => removeItem(KEYS.CALENDAR),
  },
  profile: {
    get: () => getItem<Record<string, unknown>>(KEYS.PROFILE),
    set: (data: Record<string, unknown>) => setItem(KEYS.PROFILE, data),
    remove: () => removeItem(KEYS.PROFILE),
  },
  profileImages: {
    get: () => getItem<unknown>(KEYS.PROFILE_IMAGES),
    set: (data: unknown) => setItem(KEYS.PROFILE_IMAGES, data),
    remove: () => removeItem(KEYS.PROFILE_IMAGES),
  },
  ids: {
    get: () => getItem<{ VtopUsername: string; VtopPassword: string; MoodleUsername: string; MoodlePassword: string }>(KEYS.IDS),
    set: (data: { VtopUsername: string; VtopPassword: string; MoodleUsername: string; MoodlePassword: string }) => setItem(KEYS.IDS, data),
    remove: () => removeItem(KEYS.IDS),
  },
  settings: {
    get: () => getItem<Record<string, unknown>>(KEYS.SETTINGS),
    set: (data: Record<string, unknown>) => setItem(KEYS.SETTINGS, data),
    remove: () => removeItem(KEYS.SETTINGS),
  },
  registeredEvents: {
    get: () => getItem<unknown[]>(KEYS.REGISTERED_EVENTS),
    set: (data: unknown[]) => setItem(KEYS.REGISTERED_EVENTS, data),
    remove: () => removeItem(KEYS.REGISTERED_EVENTS),
  },
  demoMode: {
    get: () => getString(KEYS.DEMO_MODE) === "true",
    set: (val: boolean) => setString(KEYS.DEMO_MODE, val ? "true" : "false"),
    remove: () => removeItem(KEYS.DEMO_MODE),
  },
  eventHubSession: {
    get: () => getString(KEYS.EVENT_HUB_SESSION),
    set: (val: string) => setString(KEYS.EVENT_HUB_SESSION, val),
    remove: () => removeItem(KEYS.EVENT_HUB_SESSION),
  },
  moodleData: {
    get: () => getItem<unknown[]>(KEYS.MOODLE_DATA),
    set: (data: unknown[]) => setItem(KEYS.MOODLE_DATA, data),
    remove: () => removeItem(KEYS.MOODLE_DATA),
  },
  vitolData: {
    get: () => getItem<unknown[]>(KEYS.VITOL_DATA),
    set: (data: unknown[]) => setItem(KEYS.VITOL_DATA, data),
    remove: () => removeItem(KEYS.VITOL_DATA),
  },
  transportData: {
    get: () => getItem<unknown>(KEYS.TRANSPORT_DATA),
    set: (data: unknown) => setItem(KEYS.TRANSPORT_DATA, data),
    remove: () => removeItem(KEYS.TRANSPORT_DATA),
  },
  username: {
    get: () => getString(KEYS.USERNAME),
    set: (val: string) => setString(KEYS.USERNAME, val),
    remove: () => removeItem(KEYS.USERNAME),
  },
  password: {
    get: () => getString(KEYS.PASSWORD),
    set: (val: string) => setString(KEYS.PASSWORD, val),
    remove: () => removeItem(KEYS.PASSWORD),
  },
  moodleUsername: {
    get: () => getString(KEYS.MOODLE_USERNAME),
    set: (val: string) => setString(KEYS.MOODLE_USERNAME, val),
    remove: () => removeItem(KEYS.MOODLE_USERNAME),
  },
  moodlePassword: {
    get: () => getString(KEYS.MOODLE_PASSWORD),
    set: (val: string) => setString(KEYS.MOODLE_PASSWORD, val),
    remove: () => removeItem(KEYS.MOODLE_PASSWORD),
  },
  friendlyName: {
    get: () => getString(KEYS.FRIENDLY_NAME),
    set: (val: string) => setString(KEYS.FRIENDLY_NAME, val),
    remove: () => removeItem(KEYS.FRIENDLY_NAME),
  },
  appIcon: {
    get: () => getString(KEYS.APP_ICON),
    set: (val: string) => setString(KEYS.APP_ICON, val),
    remove: () => removeItem(KEYS.APP_ICON),
  },
  theme: {
    get: () => getString(KEYS.THEME),
    set: (val: string) => setString(KEYS.THEME, val),
    remove: () => removeItem(KEYS.THEME),
  },
  hasSyncedMarksV2: {
    get: () => getString(KEYS.HAS_SYNCED_MARKS_V2) === "true",
    set: (val: boolean) => setString(KEYS.HAS_SYNCED_MARKS_V2, val ? "true" : "false"),
    remove: () => removeItem(KEYS.HAS_SYNCED_MARKS_V2),
  },
  lastSeenChangelog: {
    get: () => getString(KEYS.LAST_SEEN_CHANGELOG),
    set: (val: string) => setString(KEYS.LAST_SEEN_CHANGELOG, val),
    remove: () => removeItem(KEYS.LAST_SEEN_CHANGELOG),
  },
  hasSeenPushPrompt: {
    get: () => getString(KEYS.HAS_SEEN_PUSH_PROMPT) === "true",
    set: (val: boolean) => setString(KEYS.HAS_SEEN_PUSH_PROMPT, val ? "true" : "false"),
    remove: () => removeItem(KEYS.HAS_SEEN_PUSH_PROMPT),
  },
  wastedODsTracker: {
    get: () => getItem<Record<string, unknown>>(KEYS.WASTED_ODS_TRACKER),
    set: (data: Record<string, unknown>) => setItem(KEYS.WASTED_ODS_TRACKER, data),
    remove: () => removeItem(KEYS.WASTED_ODS_TRACKER),
  },
  gpaGoal: {
    get: () => getItem<unknown>(KEYS.GPA_GOAL),
    set: (data: unknown) => setItem(KEYS.GPA_GOAL, data),
    remove: () => removeItem(KEYS.GPA_GOAL),
  },
  qcmData: {
    get: () => getItem<unknown>(KEYS.QCM_DATA),
    set: (data: unknown) => setItem(KEYS.QCM_DATA, data),
    remove: () => removeItem(KEYS.QCM_DATA),
  },
  cache: {
    get: (name: string) => getItem<unknown>(KEYS.CACHE_PREFIX + name),
    set: (name: string, data: unknown) => setItem(KEYS.CACHE_PREFIX + name, data),
    remove: (name: string) => removeItem(KEYS.CACHE_PREFIX + name),
  },
  frozenAttendance: {
    get: (semesterId: string) => getItem<attendanceRes>(KEYS.FROZEN_ATT_PREFIX + semesterId),
    set: (semesterId: string, data: attendanceRes) => setItem(KEYS.FROZEN_ATT_PREFIX + semesterId, data),
    remove: (semesterId: string) => removeItem(KEYS.FROZEN_ATT_PREFIX + semesterId),
  },
  noteTracker: {
    get: () => getItem<Record<string, unknown>>(KEYS.UNICC_NOTES_TRACKER),
    set: (data: Record<string, unknown>) => setItem(KEYS.UNICC_NOTES_TRACKER, data),
    remove: () => removeItem(KEYS.UNICC_NOTES_TRACKER),
  },
  customHomework: {
    get: () => getItem<Record<string, unknown>>(KEYS.CUSTOM_HOMEWORK),
    set: (data: Record<string, unknown>) => setItem(KEYS.CUSTOM_HOMEWORK, data),
    remove: () => removeItem(KEYS.CUSTOM_HOMEWORK),
  },
  friendsSchedules: {
    get: () => getItem<unknown>(KEYS.FRIENDS_SCHEDULES),
    set: (data: unknown) => setItem(KEYS.FRIENDS_SCHEDULES, data),
    remove: () => removeItem(KEYS.FRIENDS_SCHEDULES),
  },
  friendsGroups: {
    get: () => getItem<unknown>(KEYS.FRIENDS_GROUPS),
    set: (data: unknown) => setItem(KEYS.FRIENDS_GROUPS, data),
    remove: () => removeItem(KEYS.FRIENDS_GROUPS),
  },
  kohaCard: {
    get: () => getString(KEYS.KOHA_CARD),
    set: (val: string) => setString(KEYS.KOHA_CARD, val),
    remove: () => removeItem(KEYS.KOHA_CARD),
  },
  kohaPassword: {
    get: () => getString(KEYS.KOHA_PASSWORD),
    set: (val: string) => setString(KEYS.KOHA_PASSWORD, val),
    remove: () => removeItem(KEYS.KOHA_PASSWORD),
  },
  ffcsTimetables: {
    get: () => getItem<unknown>(KEYS.FFCS_TIMETABLES),
    set: (data: unknown) => setItem(KEYS.FFCS_TIMETABLES, data),
    remove: () => removeItem(KEYS.FFCS_TIMETABLES),
  },
  ffcsActiveTimetableId: {
    get: () => getString(KEYS.FFCS_ACTIVE_TIMETABLE_ID),
    set: (val: string) => setString(KEYS.FFCS_ACTIVE_TIMETABLE_ID, val),
    remove: () => removeItem(KEYS.FFCS_ACTIVE_TIMETABLE_ID),
  },
  ffcsBlockedSlots: {
    get: () => getItem<unknown>(KEYS.FFCS_BLOCKED_SLOTS),
    set: (data: unknown) => setItem(KEYS.FFCS_BLOCKED_SLOTS, data),
    remove: () => removeItem(KEYS.FFCS_BLOCKED_SLOTS),
  },
  ffcsCourseLocks: {
    get: () => getItem<unknown>(KEYS.FFCS_COURSE_LOCKS),
    set: (data: unknown) => setItem(KEYS.FFCS_COURSE_LOCKS, data),
    remove: () => removeItem(KEYS.FFCS_COURSE_LOCKS),
  },
  ffcsRawCourses: {
    get: () => getItem<unknown>(KEYS.FFCS_RAW_COURSES),
    set: (data: unknown) => setItem(KEYS.FFCS_RAW_COURSES, data),
    remove: () => removeItem(KEYS.FFCS_RAW_COURSES),
  },
  ffcsManualLinks: {
    get: () => getItem<unknown>(KEYS.FFCS_MANUAL_LINKS),
    set: (data: unknown) => setItem(KEYS.FFCS_MANUAL_LINKS, data),
    remove: () => removeItem(KEYS.FFCS_MANUAL_LINKS),
  },
  vitolUsername: {
    get: () => getString(KEYS.VITOL_USERNAME),
    set: (val: string) => setString(KEYS.VITOL_USERNAME, val),
    remove: () => removeItem(KEYS.VITOL_USERNAME),
  },
  vitolPassword: {
    get: () => getString(KEYS.VITOL_PASSWORD),
    set: (val: string) => setString(KEYS.VITOL_PASSWORD, val),
    remove: () => removeItem(KEYS.VITOL_PASSWORD),
  },
  vitolSite: {
    get: () => getString(KEYS.VITOL_SITE),
    set: (val: string) => setString(KEYS.VITOL_SITE, val),
    remove: () => removeItem(KEYS.VITOL_SITE),
  },
  cabshareUser: {
    get: () => getItem<unknown>(KEYS.CABSHARE_USER),
    set: (data: unknown) => setItem(KEYS.CABSHARE_USER, data),
    remove: () => removeItem(KEYS.CABSHARE_USER),
  },
};

export function clearAllData(): void {
  try {
    const keep = new Set<string>([KEYS.USERNAME, KEYS.PASSWORD, KEYS.MOODLE_USERNAME, KEYS.MOODLE_PASSWORD, KEYS.IDS, KEYS.SETTINGS, KEYS.THEME, KEYS.FRIENDLY_NAME, KEYS.APP_ICON]);
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const key = localStorage.key(i);
      if (key && !keep.has(key)) {
        localStorage.removeItem(key);
      }
    }
  } catch { /* silently fail */ }
}
