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
  hideMobileHeader?: boolean;
  reloadAllData?: boolean;
  isSidebarCollapsed?: boolean;
  residentialStatus?: "hosteller" | "dayscholar";
  friendlyName?: string;
  syncProfileData?: boolean;
  syncArrearData?: boolean;
  syncExamData?: boolean;
  syncAdditionalData?: boolean;
  syncCourseOptionChange?: boolean;
  syncExcRegistration?: boolean;
  syncMinorHonour?: boolean;
  syncCourseCompletion?: boolean;
  syncWishlist?: boolean;
  syncAdditionalLearning?: boolean;
  syncProject?: boolean;
  syncProjectCourse?: boolean;
  pinnedNavTabs?: string[];
  defaultAcademicsTab?: string;
  autoSyncInterval?: string;
  lowDataMode?: boolean;
  soundEnabled?: boolean;
  smartMessFilter?: boolean;
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
  hideMobileHeader: false,
  reloadAllData: false,
  isSidebarCollapsed: false,
  residentialStatus: "hosteller",
  friendlyName: "",
  syncProfileData: true,
  syncArrearData: true,
  syncExamData: true,
  syncAdditionalData: true,
  syncCourseOptionChange: true,
  syncExcRegistration: true,
  syncMinorHonour: true,
  syncCourseCompletion: true,
  syncWishlist: true,
  syncAdditionalLearning: true,
  syncProject: true,
  syncProjectCourse: true,
  pinnedNavTabs: ["academics", "attendance"],
  defaultAcademicsTab: "overview",
  autoSyncInterval: "manual",
  lowDataMode: false,
  soundEnabled: true,
  smartMessFilter: false,
};

export const settingsAtom = atom<Settings>(defaultSettings);
