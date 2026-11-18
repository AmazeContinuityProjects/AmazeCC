/**
 * Reactive Unified Domain Atoms for AmazeCC.
 *
 * Provides reactive, derived atoms that consume base atoms and storage fragments,
 * outputting strongly typed unified domain models across the app.
 */

import { atom } from "jotai";
import { credentialsAtom } from "./authAtoms";
import {
  attendanceDataAtom,
  marksDataAtom,
  marksStatsAtom,
  scheduleDataAtom,
  allGradesDataAtom,
  registeredEventsAtom,
} from "./dataAtoms";
import {
  createUnifiedIdentity,
  createUnifiedAcademics,
  createUnifiedMarks,
  createUnifiedCampusServices,
  createUnifiedEventsAndNotices,
  createUnifiedAppSettings,
} from "@/lib/unifiedCreators";
import { getTypedStorageItem } from "@/lib/storage";
import type { UnifiedUserIdentity } from "@/types/auth";
import type { UnifiedSemesterAcademics } from "@/types/academics";
import type { UnifiedSemesterMarks } from "@/types/marks";
import type { UnifiedCampusServices } from "@/types/campus";
import type { UnifiedEventsAndNotices } from "@/types/events";
import type { UnifiedAppSettings } from "@/types/appSettings";

/**
 * Reactively provides the unified identity of the student.
 */
export const unifiedIdentityAtom = atom<UnifiedUserIdentity>((get) => {
  const creds = get(credentialsAtom);
  const profile = getTypedStorageItem("profile");
  const whoami = getTypedStorageItem("cache_whoami");
  const friendlyName = getTypedStorageItem("friendlyName");
  const session = getTypedStorageItem("cred_vault_session");
  const customImages = getTypedStorageItem("profileImages");

  const identity = createUnifiedIdentity({
    rawIds: creds?.VtopUsername ? creds : getTypedStorageItem("IDs"),
    profile,
    whoami,
    friendlyName,
    session,
    customImages,
  });

  if (identity.regNumber || identity.name) {
    return identity;
  }
  const cached = getTypedStorageItem("amz_unified_identity");
  return cached || identity;
});

/**
 * Reactively provides the unified academic state (attendance, schedule, grades).
 */
export const unifiedAcademicsAtom = atom<UnifiedSemesterAcademics>((get) => {
  const attendanceData = get(attendanceDataAtom);
  const scheduleData = get(scheduleDataAtom);
  const gradesData = get(allGradesDataAtom);
  const saturdayOverride = getTypedStorageItem("saturday_timetable_override") || undefined;

  const academics = createUnifiedAcademics({
    attendanceData,
    scheduleData,
    gradesData,
    saturdayOverride,
  });

  if (academics.courses.length > 0) {
    return academics;
  }
  const cached = getTypedStorageItem("amz_unified_academics");
  return cached || academics;
});

/**
 * Reactively provides the unified marks and cohort curves summary.
 */
export const unifiedMarksAtom = atom<UnifiedSemesterMarks>((get) => {
  const rawMarksObj = get(marksDataAtom) as { courses?: any[]; cgpa?: any } | null;
  const rawStats = get(marksStatsAtom);
  const frozenTokens = getTypedStorageItem("marksFrozenV1") || [];
  const backfillV2 = getTypedStorageItem("marksSyncBackfillV2") === "true";

  const rawCourses = Array.isArray(rawMarksObj?.courses) ? rawMarksObj.courses : [];

  const marks = createUnifiedMarks({
    semesterId: get(attendanceDataAtom)?.semesterId || "",
    rawMarks: rawCourses,
    marksStats: rawStats as Record<string, any>,
    marksFrozenTokens: frozenTokens,
    hasBackfillV2: backfillV2,
  });

  if (Object.keys(marks.courses).length > 0) {
    return marks;
  }
  const cached = getTypedStorageItem("amz_unified_marks");
  return cached || marks;
});

/**
 * Reactively provides the unified campus services (CabShare, transport, payments).
 */
export const unifiedCampusServicesAtom = atom<UnifiedCampusServices>(() => {
  const cabUser = getTypedStorageItem("cabshare_user");
  const cabTrips = getTypedStorageItem("cabshare_local_trips") || [];
  const busRoutes = getTypedStorageItem("cache_buses") || [];
  const transportData = getTypedStorageItem("transportData");
  const busPromptDismissed = getTypedStorageItem("busPromptDismissed") === "true";
  const paymentsDues = getTypedStorageItem("payments_dues");
  const paymentReceipts = getTypedStorageItem("cache_payment-receipts");
  const paymentWallet = getTypedStorageItem("cache_wallet");

  const campus = createUnifiedCampusServices({
    cabUser,
    cabTrips,
    busRoutes,
    transportData,
    busPromptDismissed,
    paymentsDues,
    paymentReceipts,
    paymentWallet,
  });

  if (campus.transport.busRoutes.length > 0 || campus.cabShare.trips.length > 0 || campus.payments.dues) {
    return campus;
  }
  const cached = getTypedStorageItem("amz_unified_campus");
  return cached || campus;
});

/**
 * Reactively provides registered events and circular notices.
 */
export const unifiedEventsAndNoticesAtom = atom<UnifiedEventsAndNotices>((get) => {
  const registeredEvents = get(registeredEventsAtom);
  const circulars = getTypedStorageItem("cache_circulars")?.circulars || [];
  const registrationSchedule = getTypedStorageItem("cache_registration_schedule");

  const events = createUnifiedEventsAndNotices({
    registeredEvents,
    circulars,
    registrationSchedule,
  });

  if (events.registeredEvents.length > 0 || events.circulars.length > 0) {
    return events;
  }
  const cached = getTypedStorageItem("amz_unified_events");
  return cached || events;
});

/**
 * Reactively provides application preferences, diagnostics, and support tickets.
 */
export const unifiedAppSettingsAtom = atom<UnifiedAppSettings>(() => {
  const theme = (getTypedStorageItem("theme") as "light" | "dark" | "system") || "system";
  const phDebug = getTypedStorageItem("ph_debug");
  const appIcon = getTypedStorageItem("app-icon") || "default";
  const activityTreeYears = getTypedStorageItem("activityTree") || [];
  const supportTickets = getTypedStorageItem("amazecc_support_tickets") || [];
  const customSyncModes = getTypedStorageItem("sync_custom_modes_v1") || [];
  const changelog = getTypedStorageItem("github_changelog_cache");
  const hasSelectedInterface = getTypedStorageItem("has_selected_interface");
  const isPushPromptDismissed = getTypedStorageItem("push_prompt_dismissed");

  return createUnifiedAppSettings({
    theme,
    phDebug,
    appIcon,
    activityTreeYears,
    supportTickets,
    customSyncModes,
    changelog,
    hasSelectedInterface,
    isPushPromptDismissed,
  });
});
