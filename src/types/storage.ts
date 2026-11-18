/**
 * LocalStorage Schema Definitions for AmazeCC.
 *
 * Provides an exhaustive, strongly typed specification for all keys written or read
 * from `window.localStorage` by AmazeCC across all modules and subpages.
 */

import type { PaymentReceiptsData, PaymentWalletData, PaymentsDuesData } from "./payments";
import type { BusRoute, TransportData } from "./transport";
import type { EventHubRegistration } from "./data/eventhub";
import type { AllGradesRes } from "./data/allgrades";
import type { ExamItem } from "./data/schedule";
import type { CourseItem as MarksCourseItem } from "./data/marks";
import type { attendanceItem } from "./data/attendance";
import type { ParsedCourse, TimetableState } from "../lib/ffcsTypes";
import type { BusyMap, SocialIdentity, SocialPeer, SocialStoredGrant } from "../lib/social/types";
import type { UnifiedUserIdentity } from "./auth";
import type { UnifiedSemesterAcademics } from "./academics";
import type { UnifiedSemesterMarks } from "./marks";
import type { UnifiedCampusServices } from "./campus";
import type { UnifiedEventsAndNotices } from "./events";
import type { UnifiedAppSettings } from "./appSettings";

// ============================================================================
// Module Specific Payloads
// ============================================================================

export interface CabShareSeatOptions {
  requested?: number;
  available?: number;
}

export interface CabShareTrip {
  trip_id: number;
  reg_number: string;
  from_hub_id: number;
  hub_id: number;
  travel_date: string;
  preferred_time: string;
  tolerance_hours: number;
  seat_options: CabShareSeatOptions;
  gender_preference: string;
  notes?: string;
  hub_name: string;
  from_hub_name?: string;
  name?: string;
  owner_name?: string;
  owner_phone?: string;
  status: "active" | "cancelled" | "completed" | string;
  requests?: any[];
  local_only?: boolean;
}

export interface CabShareUser {
  reg_number: string;
  name: string;
  phone_number: string;
  gender?: string;
}

export interface FFCSSettings {
  rankingMode: "none" | "balanced" | "faculty" | "time" | string;
  defaultSortBy: string;
  exportFormat: "png" | "pdf";
  separateCourseListExport: boolean;
  rankingPriorityOrder: string[];
  facultyMetricWeights: {
    wPct: number;
    lecture: number;
    da: number;
    vibe: number;
    [key: string]: number;
  };
  facultyScoreFilters: {
    minWPct: number;
    minLecture: number;
    minDa: number;
    minVibe: number;
    [key: string]: number;
  };
  minHalfDays: number;
  resultCap: number;
  removeHardResultLimit: boolean;
  showTour: boolean;
  showVerticalTimetableBesideWidgets: boolean;
  showGeneratorOptionPane: boolean;
}

export interface FFCSCourseLock {
  code: string;
  title?: string;
  allowedSlots: string[];
  allowedFaculty: string[];
}

export interface AttendanceStorageData {
  semester: string;
  attendance: attendanceItem[];
  timestamp?: number;
}

export interface ExamScheduleStorageData {
  semester: string;
  Schedule: {
    FAT: ExamItem[];
    CAT1: ExamItem[];
    CAT2: ExamItem[];
    [examName: string]: ExamItem[];
  };
  success: boolean;
}

export interface AssessmentMarksStat {
  count: number;
  mean: number;
  sd: number;
  component: "theory" | "lab";
  title: string;
}

export interface ClassMarksStats {
  count: number;
  mean: number;
  sd: number;
  assessments: Record<string, AssessmentMarksStat>;
}

export type CohortMarksStats = Record<string, ClassMarksStats>;

export interface StudentProfile {
  name?: string;
  registerNumber?: string;
  registrationNumber?: string;
  programme?: string;
  school?: string;
  campus?: string;
  email?: string;
  phone?: string;
  mobile?: string;
  gender?: string;
  photo?: string;
  bloodGroup?: string;
  [key: string]: any;
}

export interface WhoAmIResponse {
  name: string;
  regNo: string;
  email?: string;
  phone?: string;
  branch?: string;
  school?: string;
  campus?: string;
  photo?: string;
  [key: string]: any;
}

export interface SupportTicket {
  id: string;
  ticket_number: number;
  status: "open" | "resolved" | "pending" | string;
  unread_count: number;
  last_message: string;
  last_message_at: string;
  message_count: number;
  created_at: string;
}

export interface CustomSyncStep {
  op: string;
  args?: Record<string, any>;
  background?: boolean;
}

export interface CustomSyncMode {
  id: string;
  label: string;
  description: string;
  builtIn: boolean;
  steps: CustomSyncStep[];
}

export interface SocialTimetableCache {
  identity: {
    handle: string;
    displayName: string;
    publishedAt: string;
    semesterId: string;
  };
  visibility: "full" | "coarse";
  stale: boolean;
  busyMap: BusyMap;
}

export interface SocialGroupMember {
  handle: string;
  name: string;
  role?: string;
}

export interface SocialGroup {
  id: string;
  name: string;
  members: SocialGroupMember[];
  createdAt: string;
}

export interface CircularItem {
  name: string;
  url?: string;
  date?: string;
  children?: CircularItem[];
}

export interface CircularsResponse {
  success: boolean;
  title: string;
  circulars: CircularItem[];
}

export interface RegistrationScheduleResponse {
  success: boolean;
  title: string;
  selectOptions?: Record<string, any>;
  tables?: any[];
  keyValuePairs?: {
    userName?: string;
    date?: string;
    fromTime?: string;
    toTime?: string;
    [key: string]: any;
  };
  formFields?: Record<string, any>;
  hiddenFields?: Record<string, any>;
  messages?: any;
}

export interface FFCSFeedbackStatusResponse {
  success: boolean;
  semesterId: string;
  title: string;
  semesters: any[];
  feedbackTable: Array<{
    feedbackType: string;
    midSemester: string;
    teeSemester: string;
  }>;
}

export interface CourseCompletionResponse {
  success: boolean;
  semesters: Record<string, any>;
}

export interface GitHubChangelogCache {
  commits: Array<{
    sha: string;
    commit: {
      message: string;
      author: { name: string; date: string };
    };
    html_url: string;
  }>;
  fetchedAt: number;
}

export interface CredentialVaultSession {
  activeSessionId: string;
  unlockedAt: number;
  expiresAt: number;
}

// ============================================================================
// LocalStorage Schema Registry
// ============================================================================

/**
 * Static mapping of fixed known keys in localStorage to their parsed values.
 */
export interface StaticLocalStorageSchema {
  // Auth & Identity
  IDs: string;
  username: string;
  password: string;
  profile: StudentProfile;
  cache_whoami: WhoAmIResponse;
  friendlyName: string;
  profileImages: Record<string, string>;
  demoMode: "true" | "false";
  amaze_oidc_id_token: string;
  amaze_oidc_access_token: string;
  cred_vault_session: CredentialVaultSession;
  cache_credentials: Record<string, any>;

  // Academics & Records
  attendance: AttendanceStorageData;
  schedule: ExamScheduleStorageData;
  marks: MarksCourseItem[];
  marksFrozenV1: string[];
  marksTokensV1: Record<string, string>;
  marksStats: CohortMarksStats;
  marksSyncBackfillV1: "true" | "false";
  marksSyncBackfillV2: "true" | "false";
  allGrades: AllGradesRes;
  allgradesdata: AllGradesRes;
  allGradesData: AllGradesRes;
  grades: any;
  "cache_course-completion": CourseCompletionResponse;
  wastedODsTracker: Record<string, any>;
  notesTracker: Record<string, any>;
  uniCC_notes_tracker: Record<string, any>;
  uni_cc_gpa_goal: { target: number } | number | string;
  saturday_timetable_override: string;
  course_dashboard_target: string;
  course_dashboard_tab: string;

  // FFCS
  ffcs_settings: FFCSSettings;
  ffcs_courseLocks: FFCSCourseLock[];
  ffcs_layout_mode: "guided" | "modern" | "classic";
  ffcs_dismiss_faculty_guide: "true" | "false";
  ffcs_friendGroups: any[];
  ffcs_timetables: TimetableState[];
  ffcs_activeTimetableId: string;
  ffcs_dashboard_widgets: string[];
  ffcs_raw_courses: ParsedCourse[];
  cache_ffcs_feedback_status: FFCSFeedbackStatusResponse;
  cache_ffcs_feedback: Record<string, any>;

  // Social & Friends
  social_groups_v1: SocialGroup[];
  friends_schedules: Record<string, any>;
  friend_finder_source: string;

  // Campus Services
  cabshare_local_trips: CabShareTrip[];
  cabshare_user: CabShareUser;
  cache_buses: BusRoute[];
  transportData: TransportData;
  busPromptDismissed: "true" | "false";
  "cache_payment-receipts": PaymentReceiptsData;
  payments_receipts: PaymentReceiptsData;
  uni_cc_payment_receipts: PaymentReceiptsData;
  cache_wallet: PaymentWalletData;
  payments_wallet: PaymentWalletData;
  uni_cc_wallet: PaymentWalletData;
  payments_dues: PaymentsDuesData;
  uni_cc_payments_dues: PaymentsDuesData;
  cache_payments: any;
  registeredEvents: EventHubRegistration[];
  hostel: any;
  cache_circulars: CircularsResponse;
  cache_registration_schedule: RegistrationScheduleResponse;
  "cache_registration-schedule": RegistrationScheduleResponse;
  cache_library_due: any;
  cache_acknowledgement: any;
  cache_ept_schedule: any;

  // System & Settings
  theme: "light" | "dark" | "system";
  has_selected_interface: "true" | "false";
  ph_debug: "true" | "false";
  "app-icon": string;
  "calendar-active-index": string | number;
  activityTree: number[];
  settings: any;
  amazecc_api_pref: string;
  amazecc_custom_api_url: string;
  amazecc_active_api_url: string;
  amazecc_feedback_email: string;
  amazecc_feedback_personal_email: string;
  amazecc_support_tickets: SupportTicket[];
  sync_custom_modes_v1: CustomSyncMode[];
  github_changelog_cache: GitHubChangelogCache;
  hasSeenPushPrompt: "true" | "false";
  push_prompt_dismissed: "true" | "false";
  lastPushPromptTimestamp: string;
  pwaInstallCardDismissed: "true" | "false";
  customHomework: any;
  lastSeenCommitHash: string;
  lastSeenSurveyDate: string;
  fresherWelcomeDismissed: "true" | "false";
  introDone: "true" | "false";
  paperScannerSettings: any;
  faculty_schedule_target_name: string;
  faculty_schedule_target_erp: string;
  faculty_schedule_source: string;

  // Third Party Integrations
  koha_card: string;
  koha_password: string;
  koha_patron_pages: any;
  moodle_username: string;
  moodle_password: string;
  moodleData: any[];
  vitol_username: string;
  vitol_password: string;
  vitol_site: string;
  qcmData: any;

  // Unified Domain Models (Direct Local Storage Persistence)
  amz_unified_identity: UnifiedUserIdentity;
  amz_unified_academics: UnifiedSemesterAcademics;
  amz_unified_marks: UnifiedSemesterMarks;
  amz_unified_campus: UnifiedCampusServices;
  amz_unified_events: UnifiedEventsAndNotices;
  amz_unified_settings: UnifiedAppSettings;
}

/**
 * Dynamic pattern keys in localStorage.
 */
export type DynamicStoragePattern =
  | `frozen_att_${string}`
  | `frozen_marks_${string}`
  | `social_identity_v1_${string}`
  | `social_peers_v1_${string}`
  | `social_peer_tt_v1_${string}`
  | `social_grants_v1_${string}`
  | `ffcs_raw_courses_${string}`
  | `amaze_friend_finder_cache_${string}`
  | `seenSurvey_${string}`
  | `intro_song_${string}`;

export type LocalStorageKey = keyof StaticLocalStorageSchema | DynamicStoragePattern | string;

/**
 * Resolves the typed parsed value for any storage key.
 */
export type StorageValue<K extends string> = K extends keyof StaticLocalStorageSchema
  ? StaticLocalStorageSchema[K]
  : K extends `frozen_att_${string}`
    ? AttendanceStorageData
    : K extends `frozen_marks_${string}`
      ? MarksCourseItem[]
      : K extends `social_identity_v1_${string}`
        ? SocialIdentity
        : K extends `social_peers_v1_${string}`
          ? SocialPeer[]
          : K extends `social_peer_tt_v1_${string}`
            ? SocialTimetableCache
            : K extends `social_grants_v1_${string}`
              ? SocialStoredGrant[]
              : K extends `ffcs_raw_courses_${string}`
                ? ParsedCourse[]
                : K extends `seenSurvey_${string}`
                  ? "true" | "false"
                  : any;
