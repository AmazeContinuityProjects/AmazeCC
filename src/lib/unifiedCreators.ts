/**
 * Universal Builders & Normalizers for Unified Domain Types in AmazeCC.
 *
 * Provides pure, deterministic creators that consolidate disparate localStorage
 * items and API responses into clean, strongly typed domain models.
 */

import type { UnifiedUserIdentity } from "@/types/auth";
import type { UnifiedSemesterAcademics, UnifiedExamSchedule } from "@/types/academics";
import type { UnifiedCourseMarkSummary, UnifiedSemesterMarks } from "@/types/marks";
import type { UnifiedFFCSState } from "@/types/ffcs";
import type { UnifiedCampusServices } from "@/types/campus";
import type { UnifiedEventsAndNotices } from "@/types/events";
import type { UnifiedSocialContext } from "@/types/social";
import type { UnifiedAppSettings } from "@/types/appSettings";
import { normalizeCourseList } from "@/lib/courseNormalizer";
import type { CourseExamSlot } from "@/types/course";

/**
 * Builds a UnifiedUserIdentity from disparate identity fragments.
 */
export function createUnifiedIdentity(params: {
  profile?: any;
  whoami?: any;
  rawIds?: any;
  friendlyName?: string | null;
  session?: any;
  customImages?: Record<string, string> | null;
}): UnifiedUserIdentity {
  const { profile, whoami, rawIds, friendlyName, session, customImages } = params;

  // Resolve registration number
  let regNumber = "";
  if (typeof rawIds === "string") {
    regNumber = rawIds;
  } else if (rawIds?.VtopUsername) {
    regNumber = rawIds.VtopUsername;
  } else if (whoami?.regNo) {
    regNumber = whoami.regNo;
  } else if (profile?.registerNumber || profile?.registrationNumber) {
    regNumber = profile.registerNumber || profile.registrationNumber;
  }

  // Resolve student name
  const name = whoami?.name || profile?.name || profile?.studentName || regNumber;

  return {
    regNumber: regNumber.trim().toUpperCase(),
    name: name.trim(),
    friendlyName: (friendlyName || "").trim(),
    programme: profile?.programme || whoami?.branch,
    school: profile?.school || whoami?.school,
    campus: profile?.campus || whoami?.campus,
    email: whoami?.email || profile?.email,
    phone: whoami?.phone || profile?.phone || profile?.mobile,
    gender: profile?.gender,
    photo: whoami?.photo || profile?.photo,
    bloodGroup: profile?.bloodGroup,
    session: session || undefined,
    customImages: customImages || undefined,
    updatedAt: Date.now(),
  };
}

/**
 * Builds UnifiedSemesterAcademics from attendance, schedule, and grade payloads.
 */
export function createUnifiedAcademics(params: {
  attendanceData?: any;
  scheduleData?: any;
  gradesData?: any;
  isFrozen?: boolean;
  saturdayOverride?: string;
}): UnifiedSemesterAcademics {
  const { attendanceData, scheduleData, gradesData, isFrozen = false, saturdayOverride } = params;

  const semesterId = attendanceData?.semester || scheduleData?.semester || "";
  const rawList = attendanceData?.attendance || [];
  const courses = normalizeCourseList(rawList);

  let totalAttended = 0;
  let totalConducted = 0;

  for (const c of courses) {
    if (c.attendance) {
      totalAttended += c.attendance.attendedClasses;
      totalConducted += c.attendance.totalClasses;
    }
  }

  const overallPct = totalConducted > 0 ? Math.round((totalAttended / totalConducted) * 10000) / 100 : 0;

  // Normalize exam schedule
  const examSchedule: UnifiedExamSchedule = {
    fat: [],
    cat1: [],
    cat2: [],
    other: [],
  };

  const rawExams = scheduleData?.Schedule || {};
  const mapExam = (item: any, name: string): CourseExamSlot => ({
    examName: name,
    examDate: item.examDate || "",
    examSession: item.examSession || "",
    reportingTime: item.reportingTime || "",
    examTime: item.examTime || "",
    venue: item.venue || "",
    seatLocation: item.seatLocation || "",
    seatNo: item.seatNo || "",
  });

  if (Array.isArray(rawExams.FAT)) {
    examSchedule.fat = rawExams.FAT.map((item: any) => mapExam(item, "FAT"));
  }
  if (Array.isArray(rawExams.CAT1)) {
    examSchedule.cat1 = rawExams.CAT1.map((item: any) => mapExam(item, "CAT1"));
  }
  if (Array.isArray(rawExams.CAT2)) {
    examSchedule.cat2 = rawExams.CAT2.map((item: any) => mapExam(item, "CAT2"));
  }

  return {
    semesterId,
    courses,
    totalAttendedClasses: totalAttended,
    totalConductedClasses: totalConducted,
    overallAttendancePercentage: overallPct,
    overallAttendanceFormatted: `${overallPct.toFixed(2)}%`,
    examSchedule,
    grades: gradesData || undefined,
    cgpa: gradesData?.cgpaDetails?.cgpa,
    isFrozen,
    saturdayOverride,
    lastSyncedAt: Date.now(),
  };
}

/**
 * Builds UnifiedSemesterMarks from marks arrays, cohort curves, and frozen tokens.
 */
export function createUnifiedMarks(params: {
  semesterId: string;
  rawMarks?: any[];
  marksStats?: Record<string, any>;
  marksFrozenTokens?: string[];
  hasBackfillV2?: boolean;
}): UnifiedSemesterMarks {
  const { semesterId, rawMarks = [], marksStats = {}, marksFrozenTokens = [], hasBackfillV2 = false } = params;

  const courses: Record<string, UnifiedCourseMarkSummary> = {};

  let totalScored = 0;
  let totalMax = 0;

  for (const raw of rawMarks) {
    const classId = String(raw.classNbr || raw.classId || "");
    const courseCode = String(raw.courseCode || "")
      .trim()
      .toUpperCase();
    const courseTitle = String(raw.courseTitle || "").trim();

    const assessments = Array.isArray(raw.assessments)
      ? raw.assessments.map((a: any) => ({
          slNo: a.slNo,
          title: a.title || "",
          maxMark: Number(a.maxMark) || 0,
          weightagePercent: Number(a.weightagePercent) || 0,
          scoredMark:
            a.scoredMark !== null && a.scoredMark !== undefined && a.scoredMark !== "" ? Number(a.scoredMark) : null,
          weightageMark:
            a.weightageMark !== null && a.weightageMark !== undefined && a.weightageMark !== ""
              ? Number(a.weightageMark)
              : null,
          status: a.status || "",
          component: a.component,
        }))
      : [];

    let courseScored = 0;
    let courseMax = 0;
    let courseWeightScored = 0;
    let courseWeightMax = 0;

    for (const a of assessments) {
      if (a.scoredMark !== null) courseScored += a.scoredMark;
      courseMax += a.maxMark;
      if (a.weightageMark !== null) courseWeightScored += a.weightageMark;
      courseWeightMax += a.weightagePercent;
    }

    totalScored += courseWeightScored;
    totalMax += courseWeightMax;

    // Filter frozen tokens belonging to this course
    const courseFrozen = marksFrozenTokens.filter((t) => t.startsWith(`${classId}::`));
    const isFrozen = courseFrozen.some((t) => t.includes("overall"));

    courses[classId || courseCode] = {
      classId,
      courseCode,
      courseTitle,
      courseType: raw.courseType,
      assessments,
      totalScored: courseScored,
      totalMax: courseMax,
      totalWeightageScored: courseWeightScored,
      totalWeightageMax: courseWeightMax,
      cohortStats: marksStats[classId] || undefined,
      frozenTokens: courseFrozen,
      isFrozen,
    };
  }

  return {
    semesterId,
    courses,
    overallScoredWeightage: totalScored,
    overallMaxWeightage: totalMax,
    hasBackfillV2,
    lastSyncedAt: Date.now(),
  };
}

/**
 * Builds UnifiedFFCSState from settings, course locks, layout modes, and catalog rows.
 */
export function createUnifiedFFCSState(params: {
  settings: any;
  layoutMode?: "guided" | "modern" | "classic";
  courseLocks?: any[];
  catalogCourses?: any[];
  timetables?: any[];
  activeTimetableId?: string;
  isFacultyGuideDismissed?: boolean;
  friendGroups?: any[];
}): UnifiedFFCSState {
  return {
    settings: params.settings || {},
    layoutMode: params.layoutMode || "guided",
    courseLocks: params.courseLocks || [],
    availableCourses: normalizeCourseList(params.catalogCourses || []),
    timetables: params.timetables || [],
    activeTimetableId: params.activeTimetableId,
    isFacultyGuideDismissed: Boolean(params.isFacultyGuideDismissed),
    friendGroups: params.friendGroups || [],
  };
}

/**
 * Builds UnifiedCampusServices from CabShare, transport, and payment payloads.
 */
export function createUnifiedCampusServices(params: {
  cabUser?: any;
  cabTrips?: any[];
  busRoutes?: any[];
  transportData?: any;
  busPromptDismissed?: boolean;
  paymentsDues?: any;
  paymentReceipts?: any;
  paymentWallet?: any;
  hostel?: any;
}): UnifiedCampusServices {
  return {
    cabShare: {
      user: params.cabUser,
      trips: params.cabTrips || [],
    },
    transport: {
      busRoutes: params.busRoutes || [],
      userRegistration: params.transportData,
      isPromptDismissed: Boolean(params.busPromptDismissed),
    },
    payments: {
      dues: params.paymentsDues,
      receipts: params.paymentReceipts?.receipts || [],
      wallet: params.paymentWallet || { ledgerINR: [], ledgerUSD: [] },
    },
    hostel: params.hostel,
  };
}

/**
 * Builds UnifiedEventsAndNotices from registered events, circulars, and schedules.
 */
export function createUnifiedEventsAndNotices(params: {
  registeredEvents?: any[];
  circulars?: any[];
  registrationSchedule?: any;
}): UnifiedEventsAndNotices {
  return {
    registeredEvents: params.registeredEvents || [],
    circulars: params.circulars || [],
    registrationSchedule: params.registrationSchedule,
    updatedAt: Date.now(),
  };
}

/**
 * Builds UnifiedSocialContext from social identity, peers, peer timetables, and grants.
 */
export function createUnifiedSocialContext(params: {
  regNumber: string;
  identity?: any;
  peers?: any[];
  groups?: any[];
  peerTimetables?: Record<string, any>;
  grants?: any[];
}): UnifiedSocialContext {
  return {
    regNumber: params.regNumber,
    identity: params.identity,
    peers: params.peers || [],
    groups: params.groups || [],
    peerTimetables: params.peerTimetables || {},
    grants: params.grants || [],
  };
}

/**
 * Builds UnifiedAppSettings from theme, diagnostic, tickets, and changelog caches.
 */
export function createUnifiedAppSettings(params: {
  theme?: "light" | "dark" | "system";
  phDebug?: boolean | string;
  appIcon?: string;
  activityTreeYears?: number[];
  supportTickets?: any[];
  customSyncModes?: any[];
  changelog?: any;
  hasSelectedInterface?: boolean | string;
  isPushPromptDismissed?: boolean | string;
}): UnifiedAppSettings {
  return {
    theme: params.theme || "system",
    phDebug: params.phDebug === true || params.phDebug === "true",
    appIcon: params.appIcon || "default",
    activityTreeYears: params.activityTreeYears || [],
    supportTickets: params.supportTickets || [],
    customSyncModes: params.customSyncModes || [],
    changelog: params.changelog,
    hasSelectedInterface: params.hasSelectedInterface === true || params.hasSelectedInterface === "true",
    isPushPromptDismissed: params.isPushPromptDismissed === true || params.isPushPromptDismissed === "true",
  };
}
