"use client";

import type { LucideIcon } from "lucide-react";
import {
  BookOpen,
  Building,
  Bus,
  Calendar,
  CalendarCheck,
  CarTaxiFront,
  CheckSquare,
  Coffee,
  Compass,
  CreditCard,
  Database,
  DoorOpen,
  GraduationCap,
  Home,
  Info,
  Layers,
  LayoutGrid,
  Library,
  LogOut,
  Rss,
  ScanLine,
  Sparkles,
  User,
  UserCheck,
  UserSearch,
  Users,
  UsersRound,
  Wrench,
  MoreHorizontal,
} from "lucide-react";
import { navigateToFFCSPlanner } from "@/lib/ffcsNavigation";

export type SubtabKey = "academics" | "tools" | "hostel" | "attendance" | "profile" | "more" | "transport";

export type NavTarget =
  | { kind: "tab"; tab: string }
  | { kind: "tabSub"; tab: string; subtabKey: SubtabKey; subtab: string }
  | { kind: "external"; onSelect: () => void }
  | { kind: "panel"; panel: "academics" | "hostel" }
  | { kind: "action"; onSelect: (ctx: NavContext) => void };

export type NavContext = {
  selectTab: (tab: string) => void;
  setActiveSubTab?: (v: string) => void;
  setActiveAttendanceSubTab?: (v: string) => void;
  setActiveToolsSubTab?: (v: string) => void;
  setHostelActiveSubTab?: (v: string) => void;
  setActiveProfileSubTab?: (v: string) => void;
  setActiveMoreSubTab?: (v: string) => void;
  setActiveDayscholarSubTab?: (v: string) => void;
  handleLogOutRequest?: () => void;
  setIsFeedbackOpen?: (v: boolean) => void;
  setGradesDisplayIsOpen?: (v: boolean) => void;
  isHosteller?: boolean | null;
  residentialStatus?: string | null;
  [key: string]: any;
};

export type ModuleEntry = {
  id: string;
  label: string;
  description?: string;
  keywords?: string[];
  icon: LucideIcon;
  group: string;
  searchGroup?: string;
  paletteCategory?: string;
  paletteIcon?: string;
  target: NavTarget;
  surfaces: {
    sidebar?: boolean | "drill-in";
    sidebarGroup?: "study" | "campus" | "tools" | "account";
    appLibraryPrimary?: boolean;
    appLibrarySearch?: boolean;
    commandPalette?: boolean;
  };
  /** Shared/common availability across nav surfaces (sidebar, app library, search). Defaults to true. */
  enabled?: boolean;
  visibleWhen?: (ctx: NavContext) => boolean;
  pinnable?: boolean;
  pinId?: string;
  pinLabel?: string;
  isExpandable?: boolean;
};

const hostelVisible = (ctx: NavContext) => ctx.isHosteller === true || ctx.residentialStatus === "hosteller";

export const moduleRegistry: ModuleEntry[] = [
  // --- Study / main ---
  {
    id: "home",
    label: "Home",
    icon: Home,
    group: "Study",
    paletteCategory: "Navigation",
    paletteIcon: "🏠",
    target: { kind: "tab", tab: "home" },
    surfaces: { sidebar: true, sidebarGroup: "study", commandPalette: true },
    pinnable: true,
    pinLabel: "Home",
  },
  {
    id: "attendance-calendar",
    label: "Timetable Calendar",
    description: "Academic calendar & timetable events",
    icon: Calendar,
    group: "Study",
    searchGroup: "Study",
    paletteCategory: "Attendance",
    paletteIcon: "📅",
    target: { kind: "tabSub", tab: "attendance", subtabKey: "attendance", subtab: "calendar" },
    surfaces: {
      sidebar: true,
      sidebarGroup: "study",
      appLibraryPrimary: true,
      appLibrarySearch: true,
      commandPalette: true,
    },
    pinnable: true,
    pinId: "attendance",
    pinLabel: "Timetable Calendar",
    keywords: ["calendar", "timetable", "attendance"],
  },
  {
    id: "academics",
    label: "Academics",
    description: "My courses, marks, curriculum & grades",
    icon: GraduationCap,
    group: "Study",
    searchGroup: "Study",
    paletteCategory: "Navigation",
    paletteIcon: "📚",
    target: { kind: "tabSub", tab: "academics", subtabKey: "academics", subtab: "courses-simplified" },
    surfaces: {
      sidebar: true,
      sidebarGroup: "study",
      appLibraryPrimary: true,
      appLibrarySearch: true,
      commandPalette: true,
    },
    pinnable: true,
    pinId: "academics",
    pinLabel: "Academics",
    isExpandable: true,
  },
  {
    id: "academics-panel",
    label: "Academics",
    icon: GraduationCap,
    group: "Study",
    target: { kind: "panel", panel: "academics" },
    surfaces: { appLibraryPrimary: true },
    isExpandable: true,
  },

  // Academics drill-in
  {
    id: "academics-courses",
    label: "My Courses & Marks",
    description: "Course marks & assessments overview",
    icon: Sparkles,
    group: "Academics",
    searchGroup: "Academics",
    paletteCategory: "Academics",
    paletteIcon: "📊",
    target: { kind: "tabSub", tab: "academics", subtabKey: "academics", subtab: "courses-simplified" },
    surfaces: { sidebar: "drill-in", appLibrarySearch: true, commandPalette: true },
    keywords: ["academics overview", "course dashboard", "my courses", "marks"],
  },
  {
    id: "academics-schedule",
    label: "Exam Schedule",
    description: "CAT, FAT & lab exam timetables & venues",
    icon: Calendar,
    group: "Academics",
    searchGroup: "Academics",
    paletteCategory: "Academics",
    paletteIcon: "📅",
    target: { kind: "tabSub", tab: "academics", subtabKey: "academics", subtab: "schedule" },
    surfaces: { sidebar: "drill-in", appLibrarySearch: true, commandPalette: true },
  },
  {
    id: "academics-grades",
    label: "Grade History",
    description: "All semester grades & CGPA",
    icon: GraduationCap,
    group: "Academics",
    searchGroup: "Academics",
    paletteCategory: "Academics",
    paletteIcon: "🎓",
    target: { kind: "tabSub", tab: "academics", subtabKey: "academics", subtab: "grades" },
    surfaces: { sidebar: "drill-in", appLibrarySearch: true, commandPalette: true },
  },
  {
    id: "academics-curriculum",
    label: "Curriculum",
    description: "Course curriculum & structure",
    icon: BookOpen,
    group: "Academics",
    searchGroup: "Academics",
    paletteCategory: "Academics",
    paletteIcon: "📜",
    target: { kind: "tabSub", tab: "academics", subtabKey: "academics", subtab: "curriculum" },
    surfaces: { sidebar: "drill-in", appLibrarySearch: true, commandPalette: true },
  },

  // Campus
  {
    id: "payments",
    label: "Payments",
    description: "Dues, receipts & wallet",
    icon: CreditCard,
    group: "Campus",
    searchGroup: "Campus",
    paletteCategory: "Navigation",
    paletteIcon: "💳",
    target: { kind: "tab", tab: "payments" },
    surfaces: {
      sidebar: true,
      sidebarGroup: "campus",
      appLibraryPrimary: true,
      appLibrarySearch: true,
      commandPalette: true,
    },
    pinnable: true,
    pinLabel: "Payments",
  },
  {
    id: "libraries",
    label: "Libraries",
    description: "Search books & library account",
    icon: Library,
    group: "Campus",
    searchGroup: "Campus",
    paletteCategory: "Navigation",
    paletteIcon: "📖",
    target: { kind: "tab", tab: "libraries" },
    surfaces: {
      sidebar: true,
      sidebarGroup: "campus",
      appLibraryPrimary: true,
      appLibrarySearch: true,
      commandPalette: true,
    },
    pinnable: true,
    pinLabel: "Libraries",
  },
  {
    id: "transport",
    label: "Transport",
    description: "Bus routes, stops & placements",
    icon: Bus,
    group: "Campus",
    searchGroup: "Campus",
    paletteCategory: "Navigation",
    paletteIcon: "🚏",
    target: { kind: "tab", tab: "transport" },
    surfaces: {
      sidebar: true,
      sidebarGroup: "campus",
      appLibraryPrimary: true,
      appLibrarySearch: true,
      commandPalette: true,
    },
    pinnable: true,
    pinLabel: "Transport",
  },
  {
    id: "events",
    label: "Event Hub",
    description: "Registered events & campus activities",
    icon: Calendar,
    group: "Campus",
    searchGroup: "Campus",
    paletteCategory: "Campus",
    paletteIcon: "🎉",
    target: { kind: "tab", tab: "events" },
    surfaces: {
      sidebar: true,
      sidebarGroup: "campus",
      appLibraryPrimary: true,
      appLibrarySearch: true,
      commandPalette: true,
    },
    pinnable: true,
    pinLabel: "Event Hub",
  },
  {
    id: "clubs",
    label: "Club Hub",
    description: "Discover student clubs & chapters",
    icon: LayoutGrid,
    group: "Campus",
    searchGroup: "Campus",
    paletteCategory: "Campus",
    paletteIcon: "🏛️",
    target: { kind: "tab", tab: "clubs" },
    surfaces: {
      sidebar: true,
      sidebarGroup: "campus",
      appLibraryPrimary: true,
      appLibrarySearch: true,
      commandPalette: true,
    },
    pinnable: true,
    pinLabel: "Club Hub",
  },
  {
    id: "community",
    label: "Announcements",
    description: "Announcements from clubs & chapters",
    icon: Rss,
    group: "Campus",
    searchGroup: "Campus",
    paletteCategory: "Campus",
    paletteIcon: "📣",
    target: { kind: "tab", tab: "community" },
    surfaces: {
      sidebar: true,
      sidebarGroup: "campus",
      appLibraryPrimary: true,
      appLibrarySearch: true,
      commandPalette: true,
    },
    pinnable: true,
    pinLabel: "Announcements",
    keywords: ["community feed"],
  },
  {
    id: "free-class",
    label: "Free Classrooms",
    description: "Find an empty classroom or lab",
    icon: DoorOpen,
    group: "Campus",
    searchGroup: "Campus",
    paletteCategory: "Campus",
    paletteIcon: "🏫",
    target: { kind: "tab", tab: "free-class" },
    surfaces: {
      sidebar: true,
      sidebarGroup: "campus",
      appLibraryPrimary: true,
      appLibrarySearch: true,
      commandPalette: true,
    },
    pinnable: true,
    pinLabel: "Free Classrooms",
    keywords: ["free classroom", "search free classrooms"],
  },
  {
    id: "faculty-schedule",
    label: "Faculty Schedule",
    description: "See any faculty member's full weekly classes",
    icon: UserSearch,
    group: "Campus",
    searchGroup: "Campus",
    paletteCategory: "Campus",
    paletteIcon: "📅",
    target: { kind: "tab", tab: "faculty-schedule" },
    surfaces: {
      sidebar: true,
      sidebarGroup: "campus",
      appLibraryPrimary: true,
      appLibrarySearch: true,
      commandPalette: true,
    },
    pinnable: true,
    pinLabel: "Faculty Schedule",
    keywords: ["find faculty schedule"],
  },
  {
    id: "friend-finder",
    label: "Find Classmates",
    description: "Find classmates and shared schedules",
    icon: UsersRound,
    group: "Campus",
    searchGroup: "Campus",
    paletteCategory: "Campus",
    paletteIcon: "👥",
    target: { kind: "tab", tab: "friend-finder" },
    surfaces: {
      sidebar: true,
      sidebarGroup: "campus",
      appLibraryPrimary: true,
      appLibrarySearch: true,
      commandPalette: true,
    },
    pinnable: true,
    pinLabel: "Find Classmates",
  },
  {
    id: "hostel",
    label: "Hostel Hub",
    description: "Mess, laundry & leave",
    icon: Home,
    group: "Campus",
    paletteCategory: "Navigation",
    paletteIcon: "🏠",
    target: { kind: "tabSub", tab: "hostel", subtabKey: "hostel", subtab: "overview" },
    surfaces: { sidebar: true, sidebarGroup: "campus", commandPalette: true },
    isExpandable: true,
    visibleWhen: hostelVisible,
  },
  {
    id: "hostel-panel",
    label: "Hostel Hub",
    icon: Home,
    group: "Campus",
    target: { kind: "panel", panel: "hostel" },
    surfaces: { appLibraryPrimary: true },
    isExpandable: true,
    visibleWhen: hostelVisible,
  },

  // Hostel
  {
    id: "hostel-overview",
    label: "Hostel Overview",
    icon: Building,
    group: "Hostel",
    searchGroup: "Hostel",
    paletteCategory: "Hostel",
    paletteIcon: "🏠",
    target: { kind: "tabSub", tab: "hostel", subtabKey: "hostel", subtab: "overview" },
    surfaces: { sidebar: "drill-in", appLibrarySearch: true, commandPalette: true },
    visibleWhen: hostelVisible,
  },
  {
    id: "hostel-mess",
    label: "Mess Menu",
    description: "Mess menu, feedback & details",
    icon: Coffee,
    group: "Hostel",
    searchGroup: "Hostel",
    paletteCategory: "Hostel",
    paletteIcon: "🍽️",
    target: { kind: "tabSub", tab: "hostel", subtabKey: "hostel", subtab: "mess" },
    surfaces: { sidebar: "drill-in", appLibrarySearch: true, commandPalette: true },
    visibleWhen: hostelVisible,
  },
  {
    id: "hostel-laundry",
    label: "Laundry",
    description: "Laundry service status",
    icon: Wrench,
    group: "Hostel",
    searchGroup: "Hostel",
    paletteCategory: "Hostel",
    paletteIcon: "👕",
    target: { kind: "tabSub", tab: "hostel", subtabKey: "hostel", subtab: "laundry" },
    surfaces: { sidebar: "drill-in", appLibrarySearch: true, commandPalette: true },
    visibleWhen: hostelVisible,
  },
  {
    id: "hostel-leave",
    label: "Leave / Gatepass",
    description: "Leave applications & history",
    icon: Compass,
    group: "Hostel",
    searchGroup: "Hostel",
    paletteCategory: "Hostel",
    paletteIcon: "✈️",
    target: { kind: "tabSub", tab: "hostel", subtabKey: "hostel", subtab: "leave" },
    surfaces: { sidebar: "drill-in", appLibrarySearch: true, commandPalette: true },
    visibleWhen: hostelVisible,
    keywords: ["leave", "gatepass"],
  },
  {
    id: "hostel-counselling",
    label: "Counselling",
    description: "Hostel counselling sessions",
    icon: User,
    group: "Hostel",
    searchGroup: "Hostel",
    paletteCategory: "Hostel",
    paletteIcon: "🤝",
    target: { kind: "tabSub", tab: "hostel", subtabKey: "hostel", subtab: "counselling" },
    surfaces: { sidebar: "drill-in", appLibrarySearch: true, commandPalette: true },
    visibleWhen: hostelVisible,
  },

  // Tools
  {
    id: "ffcs",
    label: "FFCS Planner",
    description: "Plan and compare schedules",
    icon: Compass,
    group: "Tools",
    searchGroup: "Tools",
    paletteCategory: "Tools",
    paletteIcon: "🗓️",
    target: { kind: "external", onSelect: () => navigateToFFCSPlanner() },
    surfaces: {
      sidebar: true,
      sidebarGroup: "tools",
      appLibraryPrimary: true,
      appLibrarySearch: true,
      commandPalette: true,
    },
  },
  {
    id: "paper-scanner",
    label: "Paper Scanner",
    description: "Scan pages to PDF and extract their text",
    icon: ScanLine,
    group: "Tools",
    searchGroup: "Tools",
    paletteCategory: "Tools",
    paletteIcon: "📷",
    target: { kind: "tab", tab: "paper-scanner" },
    surfaces: {
      sidebar: true,
      sidebarGroup: "tools",
      appLibraryPrimary: true,
      appLibrarySearch: true,
      commandPalette: true,
    },
    pinnable: true,
    pinLabel: "Paper Scanner",
  },
  {
    id: "student-report",
    label: "Student Report",
    icon: GraduationCap,
    group: "Tools",
    searchGroup: "Tools",
    paletteCategory: "Tools",
    paletteIcon: "📄",
    target: { kind: "tab", tab: "student-report" },
    surfaces: {
      sidebar: true,
      sidebarGroup: "tools",
      appLibraryPrimary: true,
      appLibrarySearch: true,
      commandPalette: true,
    },
  },
  {
    id: "tools",
    label: "Tools & Utilities Hub",
    description: "Question bank, faculty, social & more",
    icon: Layers,
    group: "Tools",
    searchGroup: "Tools",
    paletteCategory: "Navigation",
    paletteIcon: "🛠️",
    target: { kind: "tabSub", tab: "tools", subtabKey: "tools", subtab: "overview" },
    surfaces: {
      sidebar: true,
      sidebarGroup: "tools",
      appLibraryPrimary: true,
      appLibrarySearch: true,
      commandPalette: true,
    },
    isExpandable: true,
    pinnable: true,
    pinId: "tools",
    pinLabel: "Tools",
  },
  {
    id: "tools-overview",
    label: "Tools Hub",
    description: "Overview of tools & utilities",
    icon: Layers,
    group: "Tools",
    searchGroup: "Tools",
    paletteCategory: "Tools",
    paletteIcon: "🧰",
    target: { kind: "tabSub", tab: "tools", subtabKey: "tools", subtab: "overview" },
    surfaces: { sidebar: "drill-in", appLibraryPrimary: true, appLibrarySearch: true, commandPalette: true },
  },
  {
    id: "tools-qbank",
    label: "Question Bank",
    description: "Previous year papers & extracted questions",
    icon: Database,
    group: "Tools",
    searchGroup: "Tools",
    paletteCategory: "Tools",
    paletteIcon: "🗂️",
    target: { kind: "tabSub", tab: "tools", subtabKey: "tools", subtab: "qbank" },
    surfaces: { sidebar: "drill-in", appLibraryPrimary: true, appLibrarySearch: true, commandPalette: true },
  },
  {
    id: "tools-faculty",
    label: "Faculty Explorer",
    description: "Search for faculty contact & information",
    icon: UserCheck,
    group: "Tools",
    searchGroup: "Tools",
    paletteCategory: "Tools",
    paletteIcon: "👨‍🏫",
    target: { kind: "tabSub", tab: "tools", subtabKey: "tools", subtab: "faculty-info" },
    surfaces: { sidebar: "drill-in", appLibraryPrimary: true, appLibrarySearch: true, commandPalette: true },
    keywords: ["search faculty directory"],
  },
  {
    id: "tools-social",
    label: "Timetable Sharing",
    description: "Events, friends & timetables",
    icon: Users,
    group: "Tools",
    searchGroup: "Tools",
    paletteCategory: "Tools",
    paletteIcon: "👥",
    target: { kind: "tabSub", tab: "tools", subtabKey: "tools", subtab: "social" },
    surfaces: { sidebar: "drill-in", appLibraryPrimary: true, appLibrarySearch: true, commandPalette: true },
    keywords: ["social timetable sharing"],
  },
  {
    id: "tools-cabshare",
    label: "Cab Share",
    description: "Find & share cab rides",
    icon: CarTaxiFront,
    group: "Tools",
    searchGroup: "Tools",
    paletteCategory: "Tools",
    paletteIcon: "🚕",
    target: { kind: "tabSub", tab: "tools", subtabKey: "tools", subtab: "cabshare" },
    surfaces: { sidebar: "drill-in", appLibraryPrimary: true, appLibrarySearch: true, commandPalette: true },
    pinnable: true,
    pinId: "cabshare",
    pinLabel: "Cab Share",
  },
  {
    id: "cabshare",
    label: "Cab Share",
    description: "Find & share cab rides",
    icon: CarTaxiFront,
    group: "Campus",
    paletteCategory: "Navigation",
    paletteIcon: "🚕",
    target: { kind: "tab", tab: "cabshare" },
    surfaces: { commandPalette: true },
    pinnable: true,
    pinId: "cabshare",
    pinLabel: "Cab Share",
  },
  {
    id: "tools-tasks",
    label: "Tasks & Schedule",
    description: "View and manage homework, tests & weekly study chunks",
    icon: CheckSquare,
    group: "Tools",
    searchGroup: "Tools",
    paletteCategory: "Tools",
    paletteIcon: "✅",
    target: { kind: "tabSub", tab: "tools", subtabKey: "tools", subtab: "tasks" },
    surfaces: { sidebar: "drill-in", appLibraryPrimary: true, appLibrarySearch: true, commandPalette: true },
  },
  {
    id: "tools-marks-predictor",
    label: "Marks Predictor & Simulator",
    description: "Simulate test marks, weightage lost & FAT targets",
    icon: Sparkles,
    group: "Tools",
    paletteCategory: "Tools",
    paletteIcon: "📊",
    target: { kind: "tabSub", tab: "tools", subtabKey: "tools", subtab: "marks-predictor" },
    surfaces: { commandPalette: true },
  },
  {
    id: "tool-od-hours",
    label: "OD Hours",
    description: "View on-duty hours breakdown",
    icon: CalendarCheck,
    group: "Tools",
    paletteCategory: "Tools",
    paletteIcon: "⏰",
    target: { kind: "tabSub", tab: "attendance", subtabKey: "attendance", subtab: "od" },
    surfaces: { commandPalette: true },
  },
  {
    id: "attendance-circulars",
    label: "Attendance Circulars",
    description: "Circulars related to attendance",
    icon: Calendar,
    group: "Attendance",
    paletteCategory: "Attendance",
    paletteIcon: "📢",
    target: { kind: "tabSub", tab: "attendance", subtabKey: "attendance", subtab: "circulars" },
    surfaces: { commandPalette: true },
  },
  {
    id: "acad-circulars",
    label: "Academic Circulars",
    description: "View academic circulars & notices",
    icon: Calendar,
    group: "Academics",
    paletteCategory: "Academics",
    paletteIcon: "📢",
    target: { kind: "tabSub", tab: "attendance", subtabKey: "attendance", subtab: "circulars" },
    surfaces: { commandPalette: true },
  },
  {
    id: "acad-timetable",
    label: "Timetable & Schedule",
    description: "Exam schedule & timetable",
    icon: Calendar,
    group: "Academics",
    paletteCategory: "Academics",
    paletteIcon: "🗓️",
    target: { kind: "tabSub", tab: "academics", subtabKey: "academics", subtab: "course-dashboard" },
    surfaces: { commandPalette: true },
  },
  {
    id: "ds-bus-finder",
    label: "Bus Finder",
    description: "Find your bus route & stops",
    icon: Bus,
    group: "Transport",
    paletteCategory: "Transport",
    paletteIcon: "🚍",
    target: { kind: "tab", tab: "transport" },
    surfaces: { commandPalette: true },
  },
  {
    id: "ds-transport-reg",
    label: "Transport Registration",
    description: "Register for transport services",
    icon: Bus,
    group: "Transport",
    paletteCategory: "Transport",
    paletteIcon: "🚏",
    target: { kind: "tab", tab: "transport" },
    surfaces: { commandPalette: true },
  },
  {
    id: "tr-bus-routes",
    label: "Bus Routes",
    description: "Browse all bus routes, stops & contacts",
    icon: Bus,
    group: "Transport",
    paletteCategory: "Transport",
    paletteIcon: "🚌",
    target: { kind: "tab", tab: "transport" },
    surfaces: { commandPalette: true },
  },
  {
    id: "tr-placements",
    label: "Vehicle Placements",
    description: "5 PM & 6 PM vehicle placement info",
    icon: Bus,
    group: "Transport",
    paletteCategory: "Transport",
    paletteIcon: "🚍",
    target: { kind: "tab", tab: "transport" },
    surfaces: { commandPalette: true },
  },
  {
    id: "help-feedback",
    label: "Send Feedback",
    description: "Share thoughts, report bugs, or request features",
    icon: Info,
    group: "Help & Feedback",
    paletteCategory: "Help & Feedback",
    paletteIcon: "💬",
    target: { kind: "action", onSelect: (ctx) => ctx.setIsFeedbackOpen?.(true) },
    surfaces: { commandPalette: true },
  },
  {
    id: "help-bug",
    label: "Report a Bug",
    description: "Report an issue, broken button, or glitch",
    icon: Info,
    group: "Help & Feedback",
    paletteCategory: "Help & Feedback",
    paletteIcon: "🐞",
    target: { kind: "action", onSelect: (ctx) => ctx.setIsFeedbackOpen?.(true) },
    surfaces: { commandPalette: true },
  },
  {
    id: "tool-grades-modal",
    label: "Grades Details Modal",
    description: "Open detailed grade breakdown",
    icon: GraduationCap,
    group: "Tools",
    paletteCategory: "Tools",
    paletteIcon: "📊",
    target: { kind: "action", onSelect: (ctx) => ctx.setGradesDisplayIsOpen?.(true) },
    surfaces: { commandPalette: true },
  },
  {
    id: "tool-feedback-status",
    label: "Feedback Status",
    description: "Check course feedback submission status",
    icon: Info,
    group: "Tools",
    paletteCategory: "Tools",
    paletteIcon: "💬",
    target: { kind: "tab", tab: "profile" },
    surfaces: { commandPalette: true },
  },

  // Account
  {
    id: "profile",
    label: "Settings & Profile",
    description: "View your profile and personal info",
    icon: User,
    group: "Account",
    searchGroup: "Account",
    paletteCategory: "Navigation",
    paletteIcon: "👤",
    target: { kind: "tabSub", tab: "profile", subtabKey: "profile", subtab: "settings" },
    surfaces: {
      sidebar: true,
      sidebarGroup: "account",
      appLibraryPrimary: true,
      appLibrarySearch: true,
      commandPalette: true,
    },
    pinnable: true,
    pinLabel: "Profile",
  },
  {
    id: "about",
    label: "About & Resources",
    description: "About AmazeCC and resources",
    icon: Info,
    group: "Account",
    searchGroup: "Account",
    paletteCategory: "Account",
    paletteIcon: "ℹ️",
    target: { kind: "tab", tab: "about" },
    surfaces: {
      sidebar: true,
      sidebarGroup: "account",
      appLibraryPrimary: true,
      appLibrarySearch: true,
      commandPalette: true,
    },
  },
  {
    id: "more",
    label: "More",
    description: "Events, social & schedules",
    icon: MoreHorizontal,
    group: "Account",
    paletteCategory: "Navigation",
    paletteIcon: "➕",
    target: { kind: "tab", tab: "more" },
    surfaces: { commandPalette: true },
    pinnable: true,
    pinLabel: "More",
  },
  {
    id: "feedback",
    label: "Feedback and Bug Report Page",
    description: "Open dedicated PostHog support page with DOM session replay and ticket history",
    icon: Info,
    group: "Help & Feedback",
    paletteCategory: "Help & Feedback",
    paletteIcon: "⚡",
    target: { kind: "tab", tab: "feedback" },
    surfaces: { commandPalette: true },
  },
  {
    id: "logout",
    label: "Logout",
    icon: LogOut,
    group: "Account",
    searchGroup: "Account",
    target: { kind: "action", onSelect: (ctx) => ctx.handleLogOutRequest?.() },
    surfaces: { appLibraryPrimary: true, appLibrarySearch: true },
  },
];

export const quickPinTabs = [
  { id: "attendance", label: "Timetable Calendar" },
  { id: "academics", label: "Academics" },
  { id: "payments", label: "Payments" },
  { id: "libraries", label: "Libraries" },
  { id: "free-class", label: "Free Classrooms" },
  { id: "faculty-schedule", label: "Faculty Schedule" },
  { id: "paper-scanner", label: "Paper Scanner" },
  { id: "events", label: "Event Hub" },
  { id: "clubs", label: "Club Hub" },
  { id: "community", label: "Announcements" },
  { id: "cabshare", label: "Cab Share" },
  { id: "transport", label: "Transport" },
  { id: "more", label: "More" },
  { id: "profile", label: "Profile" },
  { id: "credentials", label: "Credentials" },
];

export function getModuleRegistry(ctx: NavContext = {} as NavContext): ModuleEntry[] {
  return moduleRegistry.filter((e) => e.enabled !== false && (!e.visibleWhen || e.visibleWhen(ctx)));
}

export function getCommonNavEntries(ctx: NavContext = {} as NavContext): ModuleEntry[] {
  // Common/shared enabled entries across sidebar and app library surfaces.
  return getModuleRegistry(ctx).filter(
    (e) =>
      e.surfaces.sidebar === true ||
      e.surfaces.sidebar === "drill-in" ||
      e.surfaces.appLibraryPrimary ||
      e.surfaces.appLibrarySearch,
  );
}

export function activateEntry(entry: ModuleEntry, ctx: NavContext) {
  const t = entry.target;
  switch (t.kind) {
    case "tab":
      ctx.selectTab(t.tab);
      return;
    case "tabSub":
      ctx.selectTab(t.tab);
      if (t.subtabKey === "academics") ctx.setActiveSubTab?.(t.subtab);
      else if (t.subtabKey === "tools") ctx.setActiveToolsSubTab?.(t.subtab);
      else if (t.subtabKey === "hostel") ctx.setHostelActiveSubTab?.(t.subtab);
      else if (t.subtabKey === "attendance") ctx.setActiveAttendanceSubTab?.(t.subtab);
      else if (t.subtabKey === "profile") ctx.setActiveProfileSubTab?.(t.subtab);
      else if (t.subtabKey === "more") ctx.setActiveMoreSubTab?.(t.subtab);
      else if (t.subtabKey === "transport") ctx.setActiveDayscholarSubTab?.(t.subtab);
      return;
    case "external":
      t.onSelect();
      return;
    case "action":
      t.onSelect(ctx);
      return;
    case "panel":
      return;
  }
}

export function getPinId(entry: ModuleEntry): string | null {
  if (!entry.pinnable) return null;
  return entry.pinId ?? entry.id;
}

export function getRegistryPaletteCommands(ctx: NavContext) {
  // Palette should list all registered navigable commands; visibility can be
  // handled by the command/action itself if needed.
  return moduleRegistry
    .filter((e) => e.surfaces.commandPalette)
    .map((e) => ({
      id: `registry-${e.id}`,
      label: e.label,
      description: e.description || `Open ${e.label}`,
      icon: e.paletteIcon || "•",
      category: e.paletteCategory || e.group || "Navigation",
      onSelect: () => activateEntry(e, ctx),
    }));
}
