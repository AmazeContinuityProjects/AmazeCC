import { atomWithStorage } from "jotai/utils";
import { storage } from "@/lib/storage";
import config from "../../config.json";

export type Settings = {
  decimalValues: boolean;
  CGPAHidden: boolean;
  attendancePercentageOrString: "percentage" | "str";
  currSemesterID: string;
  calendarType: "ALL" | "ALL02" | "ALL03" | "ALL05" | "ALL06" | "ALL08" | "ALL11" | "WEI";
  isDayscholarWithBus: boolean;
  targetAttendance?: number;
  showGpa?: boolean;
  showProfilePhoto?: boolean;
  blurGrades?: boolean;
  /** Blur grades, attendance, marks and fees app-wide (screen sharing, showing your phone). */
  privacyMode?: boolean;
  colorPalette?: string;
  customPalette?: {
    accent: string;
    background: string;
    surface: string;
  };
  /**
   * The card interior the surfaces carry: `false` (default) paints every card
   * with the grade-insights gray (the surface at full strength, via the
   * `.card-surface` class), `true` restores the classic translucent zinc glass
   * with its backdrop blur. Purely a "look" pref, so it defaults to the new
   * gray.
   */
  cardSurfaceZinc?: boolean;
  hideHomeSearchBar?: boolean;
  reloadAllData?: boolean;
  isSidebarCollapsed?: boolean;
  residentialStatus?: "hosteller" | "dayscholar";
  friendlyName?: string;
  syncProfileData?: boolean;
  syncAdditionalData?: boolean;
  syncExcRegistration?: boolean;
  syncMinorHonour?: boolean;
  syncCourseCompletion?: boolean;
  defaultSyncMode?: string;
  pinnedNavTabs?: string[];
  defaultAcademicsTab?: string;
  autoSyncInterval?: string;
  lowDataMode?: boolean;
  soundEnabled?: boolean;
  smartMessFilter?: boolean;
  timetablePillStyle?: "compact" | "detailed";
  /**
   * Which timetable grid to draw. "auto" means vertical under 768px (the
   * mobile heatmap) and the full horizontal grid above it.
   */
  timetableViewMode?: "auto" | "vertical" | "horizontal" | "classic";
  /**
   * How much the vertical grid puts in a cell. "compact" shows the slot only and
   * sizes the table to the viewport; "full" adds the course code and scrolls
   * sideways when seven days will not fit.
   */
  timetableCellDensity?: "full" | "compact";
  /**
   * Whether a density was ever picked by the user. Absent = pristine, which is
   * the only way `useTimetableViewMode` can tell a phone's compact default from
   * the old `"full"` default that existing installs already have persisted
   * verbatim in their settings blob. Stamped on the first pick, in-grid or here.
   */
  timetableDensityTouched?: boolean;
  interfaceChosen?: boolean;

  // Push Notifications Settings & Feature Options
  pushNotificationsEnabled?: boolean;
  notifyLowAttendance?: boolean;
  notifyClassReminders?: boolean;
  notifyExamAlerts?: boolean;
  notifyMessServing?: boolean;
  notifyAssignments?: boolean;
  notifyCirculars?: boolean;
  notifyHostelLeave?: boolean;
  notifyBusUpdates?: boolean;
  notifyLibraryBooks?: boolean;
  notifyMarksRelease?: boolean;
  classReminderLeadMinutes?: number;
  pushSoundEnabled?: boolean;
  pushVibrationEnabled?: boolean;
  pushQuietHoursEnabled?: boolean;
  pushQuietHoursStart?: string;
  pushQuietHoursEnd?: string;
  customVapidKey?: string;

  // Tasks & Pomodoro Settings
  tasksInlineOnHome?: boolean;
  taskPomodoroFocus?: number;
  taskPomodoroBreak?: number;
  taskPomodoroRounds?: number;
  taskDefaultReminderMinutes?: number;
};

export type settings = Settings;

export const defaultSettings: Settings = {
  decimalValues: false,
  CGPAHidden: false,
  attendancePercentageOrString: "percentage",
  currSemesterID: config.semesterIDs[config.semesterIDs.length - 2],
  calendarType: "ALL",
  isDayscholarWithBus: false,
  targetAttendance: 75,
  showGpa: false,
  showProfilePhoto: true,
  blurGrades: false,
  privacyMode: false,
  colorPalette: "default",
  cardSurfaceZinc: false,
  customPalette: {
    accent: "#0ea5e9",
    background: "#f8fafc",
    surface: "#ffffff",
  },
  hideHomeSearchBar: false,
  reloadAllData: false,
  isSidebarCollapsed: false,
  residentialStatus: "hosteller",
  friendlyName: "",
  syncProfileData: true,
  syncAdditionalData: true,
  syncExcRegistration: true,
  syncMinorHonour: true,
  syncCourseCompletion: true,
  defaultSyncMode: "quick",
  pinnedNavTabs: ["academics", "attendance"],
  defaultAcademicsTab: "overview",
  autoSyncInterval: "manual",
  lowDataMode: false,
  soundEnabled: true,
  smartMessFilter: false,
  timetablePillStyle: "compact",
  timetableViewMode: "auto",
  timetableCellDensity: "full",

  // Default Push Notification Preferences
  pushNotificationsEnabled: true,
  notifyLowAttendance: true,
  notifyClassReminders: true,
  notifyExamAlerts: true,
  notifyMessServing: true,
  notifyAssignments: true,
  notifyCirculars: true,
  notifyHostelLeave: true,
  notifyBusUpdates: true,
  notifyLibraryBooks: true,
  notifyMarksRelease: true,
  classReminderLeadMinutes: 15,
  pushSoundEnabled: true,
  pushVibrationEnabled: true,
  pushQuietHoursEnabled: false,
  pushQuietHoursStart: "22:00",
  pushQuietHoursEnd: "07:00",
  customVapidKey: "",

  // Default Tasks Preferences
  tasksInlineOnHome: true,
  taskPomodoroFocus: 25,
  taskPomodoroBreak: 5,
  taskPomodoroRounds: 4,
  taskDefaultReminderMinutes: 30,
};

/**
 * Storage adapter for the settings blob. The `getItem` merge IS the migration
 * shim: a blob persisted before a field existed lacks that field and picks up
 * the default — the guarantee the old boot line
 * `setSettings({ ...defaultSettings, ...raw })` gave, now applied on every
 * read instead of only at boot. A corrupt or absent blob degrades to defaults.
 */
const settingsStorage = {
  getItem(_key: string, initialValue: Settings): Settings {
    try {
      const raw = localStorage.getItem("settings");
      if (!raw) return initialValue;
      return { ...initialValue, ...JSON.parse(raw) };
    } catch {
      return initialValue;
    }
  },
  setItem(_key: string, value: Settings): void {
    try {
      localStorage.setItem("settings", JSON.stringify(value));
    } catch {
      /* quota / private mode: the in-memory value still takes effect */
    }
  },
  removeItem(_key: string): void {
    try {
      localStorage.removeItem("settings");
    } catch {
      /* ditto */
    }
  },
};

/**
 * Persisted settings. `atomWithStorage` writes on every `setSettings`, which
 * retires the hand-rolled `localStorage.setItem("settings", ...)` that two
 * dozen call sites used to repeat inside their updaters.
 *
 * Deliberately NOT `getOnInit`: the first render starts from
 * `defaultSettings` — what the server rendered, so no hydration mismatch —
 * and the atom picks up the stored value when its first subscriber mounts,
 * the same post-paint timing the old bootstrap effect had.
 */
export const settingsAtom = atomWithStorage<Settings>("settings", defaultSettings, settingsStorage);

/**
 * The persisted settings blob, parsed once per call. `{}` when absent or
 * corrupt. Read stored settings through this instead of re-implementing
 * `localStorage.getItem("settings")` + `JSON.parse` — a dozen components used
 * to carry their own copy of that block and they drift.
 */
export function readSettings(): Partial<Settings> {
  return (storage.settings.get() || {}) as Partial<Settings>;
}

/**
 * The attendance percentage the user is aiming at, or `fallback` when unset.
 *
 * Mirrors the per-component copies this replaced exactly: a stored-but-falsy
 * `targetAttendance` falls through to the fallback, and a stored non-numeric
 * value stays non-numeric (`NaN >= threshold` is `false`, which is how the
 * callers have always painted it).
 */
export function getTargetAttendancePct(fallback = 75): number {
  const value = readSettings().targetAttendance;
  return value ? Number(value) : fallback;
}
