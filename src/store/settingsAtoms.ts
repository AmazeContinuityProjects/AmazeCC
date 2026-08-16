import { atom } from "jotai";
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
  colorPalette?: string;
  customPalette?: {
    accent: string;
    background: string;
    surface: string;
  };
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
  pinnedNavTabs?: string[];
  defaultAcademicsTab?: string;
  autoSyncInterval?: string;
  lowDataMode?: boolean;
  soundEnabled?: boolean;
  smartMessFilter?: boolean;
  dashboardViewMode?: "simplified" | "classic";
  timetablePillStyle?: "compact" | "detailed";
  interfaceChosen?: boolean;
  defaultLandingTab?: "home" | "attendance" | "academics";

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
  colorPalette: "default",
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
  pinnedNavTabs: ["academics", "attendance"],
  defaultAcademicsTab: "overview",
  autoSyncInterval: "manual",
  lowDataMode: false,
  soundEnabled: true,
  smartMessFilter: false,
  dashboardViewMode: "simplified",
  timetablePillStyle: "compact",

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
};

export const settingsAtom = atom<Settings>(defaultSettings);
