"use client";

import posthog from "posthog-js";
import { getActiveRegNumber } from "./social/identity";
import { getCachedRegisterNumber } from "./introSong/gate";

/**
 * Checks whether PostHog project credentials are present and runtime is client-side.
 */
export function isPostHogConfigured(): boolean {
  return Boolean(
    typeof window !== "undefined" &&
    process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN &&
    process.env.NEXT_PUBLIC_POSTHOG_HOST,
  );
}

/**
 * Checks whether the PostHog client library has finished initializing.
 */
export function isPostHogLoaded(): boolean {
  return isPostHogConfigured() && Boolean((posthog as unknown as { __loaded?: boolean }).__loaded);
}

/**
 * Test whether an identifier matches the standard VIT registration number format (e.g. 25BLC1081, 21BCE0001).
 * Typically: 2 digits (admission year) + 2-5 uppercase letters (branch/school) + 3-5 digits (sequence).
 * Purely numeric IDs (e.g. 20626703, 2025001264) are application/enrollment numbers, not registration numbers.
 */
export function isRegistrationNumber(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const trimmed = value.trim().toUpperCase();
  return /^[0-9]{2}[A-Z]{2,5}[0-9]{3,5}$/.test(trimmed);
}

/**
 * Merge two distinct identities in PostHog (e.g. linking enrollment number 20626703 to registration number 25BLC1081).
 */
export function aliasPostHogUser(alias: string, original?: string): void {
  if (!isPostHogConfigured() || !alias) return;
  try {
    (posthog as unknown as { alias?: (alias: string, original?: string) => void }).alias?.(alias, original);
  } catch (err) {
    console.debug("[PostHog alias]", err);
  }
}

export interface PostHogUserIdentity {
  distinctId: string;
  registrationNumber?: string;
  enrollmentNumber?: string;
}

/**
 * Resolves the user's primary registration number for PostHog identification.
 * Prioritizes actual registration numbers (like 25BLC1081) across profile, payments,
 * attendance, credentials, and active atoms over purely numeric enrollment numbers (like 20626703).
 */
export function getPostHogUserIdentifiers(options?: {
  authorizedID?: string | null;
  username?: string | null;
  activeReg?: string | null;
}): PostHogUserIdentity | null {
  const regCandidates: string[] = [];
  const enrollmentCandidates: string[] = [];

  const addCandidate = (val: unknown) => {
    if (typeof val === "string") {
      const trimmed = val.trim().toUpperCase();
      if (!trimmed || trimmed === "DEMO" || trimmed === "DEMO123") return;
      if (isRegistrationNumber(trimmed)) {
        if (!regCandidates.includes(trimmed)) regCandidates.push(trimmed);
      } else if (/^\d{6,12}$/.test(trimmed)) {
        if (!enrollmentCandidates.includes(trimmed)) enrollmentCandidates.push(trimmed);
      } else if (/^[0-9]{2}[A-Z]+[0-9]+$/.test(trimmed)) {
        // Less strict fallback for variant registration numbers
        if (!regCandidates.includes(trimmed)) regCandidates.push(trimmed);
      }
    }
  };

  // 1. Explicitly provided arguments (e.g. from React atoms)
  if (options?.activeReg) addCandidate(options.activeReg);
  if (options?.username) addCandidate(options.username);
  if (options?.authorizedID) addCandidate(options.authorizedID);

  // 2. Cached payments payload (authoritative source for registerNo in VTOP)
  try {
    addCandidate(getCachedRegisterNumber());
  } catch {}

  // 3. Active reg number derived from profile/attendance
  try {
    addCandidate(getActiveRegNumber());
  } catch {}

  // 4. Inspect localStorage directly if in browser environment
  if (typeof window !== "undefined") {
    try {
      const profileRaw = window.localStorage.getItem("profile");
      if (profileRaw) {
        const p = JSON.parse(profileRaw);
        if (p && typeof p === "object") {
          addCandidate(p.registerNo);
          addCandidate(p.registerNumber);
          addCandidate(p.regNo);
          addCandidate(p.regNumber);
          addCandidate(p.applicationNumber);
        }
      }
    } catch {}

    try {
      const attRaw = window.localStorage.getItem("attendance");
      if (attRaw) {
        const a = JSON.parse(attRaw);
        const info = a?.studentInfo;
        if (info && typeof info === "object") {
          addCandidate(info.registerNo);
          addCandidate(info.registerNumber);
          addCandidate(info.regNo);
          addCandidate(info.regNumber);
          addCandidate(info.applicationNumber);
        }
      }
    } catch {}

    try {
      const idsRaw = window.localStorage.getItem("IDs");
      if (idsRaw) {
        const ids = JSON.parse(idsRaw);
        addCandidate(ids?.VtopUsername);
      }
    } catch {}
  }

  const primaryReg = regCandidates[0];
  const primaryEnrollment = enrollmentCandidates[0];

  if (primaryReg) {
    return {
      distinctId: primaryReg,
      registrationNumber: primaryReg,
      enrollmentNumber: primaryEnrollment,
    };
  }

  if (primaryEnrollment) {
    return {
      distinctId: primaryEnrollment,
      enrollmentNumber: primaryEnrollment,
    };
  }

  return null;
}

/**
 * Associate events with a verified user identity and persist person properties.
 * Also registers `registration_number` as a super property on all future events.
 */
export function identifyPostHogUser(distinctId: string, properties?: Record<string, unknown>): void {
  if (!isPostHogConfigured() || !distinctId) return;
  try {
    posthog.identify(distinctId, properties);
    const reg = (properties?.registration_number as string) || distinctId;
    posthog.register({
      registration_number: reg,
    });
  } catch (err) {
    console.debug("[PostHog identify]", err);
  }
}

/**
 * Clear the current user identity and super properties on sign out.
 */
export function resetPostHogUser(): void {
  if (!isPostHogConfigured()) return;
  try {
    posthog.unregister("registration_number");
    posthog.unregister("current_modal");
    posthog.unregister("current_modal_name");
    posthog.reset();
  } catch (err) {
    console.debug("[PostHog reset]", err);
  }
}

let lastRegisteredScreenFeature: string = "home";

/**
 * Metadata dictionary mapping internal modal / overlay IDs to their human-friendly
 * names and high-level feature categories for analytics and dashboards.
 */
const MODAL_METADATA_MAP: Record<string, { name: string; feature: string }> = {
  // FFCS Generator & Automated workflows
  "ffcs-auto-generator": { name: "FFCS Auto Timetable Generator", feature: "ffcs_generator" },
  "ffcs-generator-run-summary": { name: "Generation Run Summary", feature: "ffcs_generator" },
  "ffcs-generator-view-mode-modal": { name: "Generator View Mode", feature: "ffcs_generator" },
  "ffcs-generator-slot-faculty": { name: "Generator Slot Faculty Swap", feature: "ffcs_generator" },
  "generator-target-locker": { name: "Target Courses Locker", feature: "ffcs_generator" },
  "ffcs-generator-variant-search": { name: "Generator Variant Search", feature: "ffcs_generator" },
  "ffcs-dash-details": { name: "Generator Dashboard Details", feature: "ffcs_generator" },
  "ffcs-gap-details": { name: "Generator Gap Details", feature: "ffcs_generator" },

  // FFCS Planner & Course Selection
  "ffcs-target-courses": { name: "Target Courses Selection", feature: "ffcs_planner" },
  "ffcs-settings": { name: "FFCS Planner Settings", feature: "ffcs_planner" },
  "ffcs-layout-mode-modal": { name: "FFCS Layout Mode", feature: "ffcs_planner" },
  "ffcs-faculty-priority-modal": { name: "Faculty Priority", feature: "ffcs_planner" },
  "ffcs-faculty-schedule": { name: "Faculty Schedule Modal", feature: "ffcs_planner" },
  "ffcs-friend-timetable": { name: "Friend Timetable View", feature: "ffcs_planner" },
  "ffcs-paste-registered-courses": { name: "Paste Registered Courses", feature: "ffcs_planner" },
  "ffcs-social-matrix": { name: "Social Timetable Matrix", feature: "ffcs_planner" },
  "ffcs-dossier": { name: "FFCS Dossier View", feature: "ffcs_planner" },
  "ffcs-guided-flow": { name: "FFCS Guided Timetable Flow", feature: "ffcs_planner" },
  "ffcs-tour": { name: "FFCS Feature Tour", feature: "ffcs_planner" },
  "ffcs-friends": { name: "FFCS Friends Subpage", feature: "ffcs_planner" },
  "ffcs-name-friend": { name: "Name Friend Modal", feature: "ffcs_planner" },
  "vitfac-review-sheet": { name: "VIT Faculty Reviews", feature: "ffcs_planner" },
  "ffcs-mobile-widget": { name: "FFCS Mobile Widget", feature: "ffcs_planner" },
  "ffcs-clash-details": { name: "FFCS Clash Details", feature: "ffcs_planner" },
  "ffcs-weekly-rhythm-details": { name: "FFCS Weekly Rhythm Details", feature: "ffcs_planner" },
  "ffcs-shortcuts": { name: "FFCS Keyboard Shortcuts", feature: "ffcs_planner" },
  "ffcs-guide": { name: "FFCS Guide Modal", feature: "ffcs_planner" },
  "ffcs-course-search": { name: "FFCS Course Search", feature: "ffcs_planner" },
  "ffcs-slot-search": { name: "FFCS Slot Search", feature: "ffcs_planner" },
  "ffcs-timetable-select": { name: "FFCS Timetable Select", feature: "ffcs_planner" },
  "ffcs-variant-search": { name: "FFCS Variant Search", feature: "ffcs_planner" },
  "ffcs-manual-linker": { name: "FFCS Manual Slot Linker", feature: "ffcs_planner" },
  "ffcs-final-list-notice": { name: "FFCS Final List Notice", feature: "ffcs_planner" },
  "ffcs-share-options": { name: "FFCS Share Options", feature: "ffcs_planner" },
  "ffcs-integrate-data": { name: "FFCS Integrate Data", feature: "ffcs_planner" },
  "ffcs-share-link-format": { name: "FFCS Share Link Format", feature: "ffcs_planner" },
  "ffcs-course-list-picker": { name: "FFCS Course List Picker", feature: "ffcs_planner" },
  "ffcs-course-list-import": { name: "FFCS Course List Import", feature: "ffcs_planner" },

  // Attendance & Classes
  "calendar-day-detail": { name: "Calendar Day Detail", feature: "attendance" },
  "attendance-date-notes-compact": { name: "Attendance Date Notes (Compact)", feature: "attendance" },
  "attendance-date-notes-wide": { name: "Attendance Date Notes (Wide)", feature: "attendance" },
  "moodle-connect": { name: "Moodle Connect Sheet", feature: "attendance" },

  // Academics, Grades & Exams
  "grades-breakdown": { name: "Grades Breakdown & GPA", feature: "academics" },
  "course-subpage": { name: "Course Detail Subpage", feature: "academics" },
  "course-subpage-tab": { name: "Course Detail Tab", feature: "academics" },
  "class-details-inspector": { name: "Class Details Inspector", feature: "academics" },
  "timetable-slot-detail": { name: "Timetable Slot Detail", feature: "academics" },
  "home-timetable": { name: "Weekly Timetable Sheet", feature: "academics" },
  "download-exam-modal": { name: "Download Exam Schedule", feature: "academics" },

  // Marks Predictor & CGPA
  "predictor-tour": { name: "Marks Predictor Tour", feature: "marks_predictor" },
  "predictor-reset-all": { name: "Reset All Course Marks", feature: "marks_predictor" },
  "predictor-delete-course": { name: "Delete Course Prediction", feature: "marks_predictor" },
  "predictor-custom-course": { name: "Add Custom Course Prediction", feature: "marks_predictor" },

  // Tasks & Productivity
  "task-edit-sheet": { name: "Task Create & Edit Sheet", feature: "tasks" },
  "moodle-import-modal": { name: "Moodle Assignments Import", feature: "tasks" },

  // Tools: Scanner, Free Rooms, QBank, etc.
  "paper-scanner-settings": { name: "Paper Scanner Settings", feature: "paper_scanner" },
  "paper-scanner-detail": { name: "Paper Scanner Document Detail", feature: "paper_scanner" },
  "scanner-add-page-sheet": { name: "Scanner Add Page Sheet", feature: "paper_scanner" },
  "room-inspector": { name: "Free Classroom Room Inspector", feature: "free_classrooms" },
  "widget-room-inspector": { name: "Widget Free Classroom Inspector", feature: "free_classrooms" },
  "qbank-upload": { name: "Upload Paper to QBank", feature: "qbank" },

  // Social & Friend Timetables
  "social-share-handle": { name: "Share Timetable Handle", feature: "social" },
  "social-scan-peer": { name: "Scan Friend QR Handle", feature: "social" },
  "social-add-peer": { name: "Add Friend by Handle", feature: "social" },
  "social-peer-sheet": { name: "Friend Timetable Sheet", feature: "social" },
  "social-common-slots": { name: "Common Free Slots Finder", feature: "social" },
  "social-cell-detail": { name: "Social Timetable Cell Detail", feature: "social" },
  "group-members": { name: "Social Group Members Sheet", feature: "social" },

  // Campus Services, Hostel & Transport
  "club-details": { name: "Club Details Sheet", feature: "events_and_clubs" },
  "eventhub-status": { name: "EventHub Status Sheet", feature: "events_and_clubs" },
  "eventhub-pwa": { name: "EventHub PWA Sheet", feature: "events_and_clubs" },
  "bus-detail": { name: "Bus Routes & Schedule Sheet", feature: "bus_finder" },
  "cabshare-pending": { name: "Cab Share Requests Sheet", feature: "cab_share" },
  "hostel-apply-leave": { name: "Hostel Leave Application Sheet", feature: "hostel" },
  "library-catalog": { name: "Library Catalog Search", feature: "library" },
  "receipt-detail": { name: "Payment Receipt Detail", feature: "payments" },
  "new-circulars": { name: "Campus Circulars Sheet", feature: "circulars" },

  // Settings, Profile, Feedback & Navigation
  "profile-section": { name: "Profile Details Section", feature: "profile" },
  "profile-ept-schedule": { name: "Profile EPT Schedule", feature: "profile" },
  "profile-reg-schedule": { name: "Profile Registration Schedule", feature: "profile" },
  "profile-bank-info": { name: "Profile Bank Info", feature: "profile" },
  "profile-dayboarder": { name: "Profile Dayboarder Info", feature: "profile" },
  "credential-editor-sheet": { name: "Credentials Editor Sheet", feature: "settings" },
  "sync-mode-editor": { name: "Sync Mode Configuration Sheet", feature: "settings" },
  "sync-progress": { name: "Sync Progress Sheet", feature: "settings" },
  "feedback-sheet": { name: "User Feedback Sheet", feature: "feedback" },
  "feedback-status-sheet": { name: "Feedback Status Sheet", feature: "feedback" },
  "command-palette": { name: "Command Palette", feature: "navigation" },
  "shortcuts-help-sheet": { name: "Keyboard Shortcuts Sheet", feature: "navigation" },
  "app-library": { name: "App Library Drawer", feature: "navigation" },
};

/**
 * Resolves feature category and human-friendly name for a given modal ID.
 */
export function resolveModalInfo(modalId: string): {
  modal_id: string;
  modal_name: string;
  feature_category: string;
} {
  if (MODAL_METADATA_MAP[modalId]) {
    return {
      modal_id: modalId,
      modal_name: MODAL_METADATA_MAP[modalId].name,
      feature_category: MODAL_METADATA_MAP[modalId].feature,
    };
  }

  // Handle dynamic prefix patterns
  if (modalId.startsWith("predictor-add-")) {
    const comp = modalId.replace("predictor-add-", "").toUpperCase();
    return {
      modal_id: modalId,
      modal_name: `Add Assessment Component (${comp})`,
      feature_category: "marks_predictor",
    };
  }
  if (modalId.startsWith("predictor-regimen-")) {
    const code = modalId.replace("predictor-regimen-", "").toUpperCase();
    return {
      modal_id: modalId,
      modal_name: `Assessment Regimen (${code})`,
      feature_category: "marks_predictor",
    };
  }
  if (modalId.startsWith("predictor-mark-")) {
    return {
      modal_id: modalId,
      modal_name: "Assessment Mark Entry",
      feature_category: "marks_predictor",
    };
  }
  if (modalId.startsWith("tab-help-")) {
    const tab = modalId.replace("tab-help-", "");
    return {
      modal_id: modalId,
      modal_name: `Tab Help (${tab})`,
      feature_category: "help",
    };
  }

  // Formatted fallback
  const formattedName = modalId
    .split("-")
    .map((w) => (w.length > 0 ? w[0].toUpperCase() + w.slice(1) : ""))
    .join(" ");

  const inferredFeature = modalId.startsWith("ffcs")
    ? "ffcs_planner"
    : modalId.startsWith("social")
      ? "social"
      : modalId.startsWith("profile")
        ? "profile"
        : "general";

  return {
    modal_id: modalId,
    modal_name: formattedName,
    feature_category: inferredFeature,
  };
}

/**
 * Resolves feature category and readable name for a tab and subtab.
 */
export function resolveScreenFeature(
  screenName: string,
  subTab?: string,
): {
  feature_category: string;
  feature_name: string;
} {
  const normScreen = (screenName || "").toLowerCase().trim();
  const normSub = (subTab || "").toLowerCase().trim();

  if (normScreen === "tools") {
    if (normSub.includes("scanner")) return { feature_category: "paper_scanner", feature_name: "Paper Scanner" };
    if (normSub.includes("free-rooms") || normSub.includes("classroom")) {
      return { feature_category: "free_classrooms", feature_name: "Free Classrooms" };
    }
    if (normSub.includes("paper") || normSub.includes("qbank")) {
      return { feature_category: "qbank", feature_name: "Question Paper Bank" };
    }
    if (normSub.includes("cgpa") || normSub.includes("marks")) {
      return { feature_category: "marks_predictor", feature_name: "Marks Predictor" };
    }
    if (normSub.includes("librar")) return { feature_category: "library", feature_name: "Library Catalog" };
    if (normSub.includes("cab")) return { feature_category: "cab_share", feature_name: "Cab Share" };
    return { feature_category: "tools", feature_name: "Campus Tools" };
  }

  if (normScreen === "ffcs") {
    if (normSub.includes("generator") || normSub.includes("auto")) {
      return { feature_category: "ffcs_generator", feature_name: "FFCS Generator" };
    }
    return { feature_category: "ffcs_planner", feature_name: "FFCS Planner" };
  }

  if (normScreen === "attendance") return { feature_category: "attendance", feature_name: "Attendance Tracker" };
  if (normScreen === "academics") return { feature_category: "academics", feature_name: "Academics & Grades" };
  if (normScreen === "tasks") return { feature_category: "tasks", feature_name: "Task Manager" };
  if (normScreen === "social") return { feature_category: "social", feature_name: "Social Timetables" };
  if (normScreen === "hostel") return { feature_category: "hostel", feature_name: "Hostel & Leaves" };
  if (normScreen === "events" || normScreen === "clubs")
    return { feature_category: "events_and_clubs", feature_name: "Events & Clubs" };
  if (normScreen === "dayscholar") return { feature_category: "bus_finder", feature_name: "Bus Finder" };
  if (normScreen === "profile" || normScreen === "settings")
    return { feature_category: "profile", feature_name: "Profile & Settings" };
  if (normScreen === "about") return { feature_category: "about", feature_name: "About" };

  return { feature_category: normScreen || "general", feature_name: screenName || "General" };
}

/**
 * Explicitly records feature engagement anywhere in the app.
 * Perfect for building feature popularity leaderboards and breakdowns in PostHog.
 */
export function trackFeatureUsage(featureCategory: string, action: string, properties?: Record<string, unknown>): void {
  if (!isPostHogConfigured() || !featureCategory) return;
  try {
    posthog.capture("feature_used", {
      feature_category: featureCategory,
      action,
      ...properties,
    });
  } catch (err) {
    console.debug("[PostHog trackFeatureUsage]", err);
  }
}

/**
 * Tracks a screen, tab or subtab transition.
 * Sets `current_screen`, `current_subtab`, and `current_feature` super properties so subsequent
 * clicks, logs, and errors inherit the active view context.
 */
export function trackScreenView(screenName: string, subTab?: string, properties?: Record<string, unknown>): void {
  if (!isPostHogConfigured() || !screenName) return;
  try {
    const featureInfo = resolveScreenFeature(screenName, subTab);
    lastRegisteredScreenFeature = featureInfo.feature_category;

    const payload = {
      screen_name: screenName,
      sub_tab: subTab || undefined,
      feature_category: featureInfo.feature_category,
      feature_name: featureInfo.feature_name,
      url: typeof window !== "undefined" ? window.location.href : undefined,
      pathname: typeof window !== "undefined" ? window.location.pathname : undefined,
      ...properties,
    };

    // Register super properties across all subsequent events
    posthog.register({
      current_screen: screenName,
      current_subtab: subTab || "",
    });
    posthog.register({
      current_feature: featureInfo.feature_category,
    });

    posthog.capture("screen_view", payload);
    posthog.capture("$pageview", {
      $current_url: typeof window !== "undefined" ? window.location.href : undefined,
      page_title: `${screenName}${subTab ? ` - ${subTab}` : ""}`,
      ...payload,
    });

    posthog.capture("feature_used", {
      feature_category: featureInfo.feature_category,
      feature_name: featureInfo.feature_name,
      action: "view_screen",
      target: subTab || screenName,
      ...properties,
    });
  } catch (err) {
    console.debug("[PostHog trackScreenView]", err);
  }
}

/**
 * Records that an overlay modal or bottom sheet was opened.
 * Also binds `current_modal`, `current_modal_name`, and `current_feature` to PostHog's super properties.
 */
export function trackModalOpen(modalId: string, metadata?: Record<string, unknown>): void {
  if (!isPostHogConfigured() || !modalId) return;
  try {
    const info = resolveModalInfo(modalId);

    // Call standalone for exact compatibility with existing assertions
    posthog.register({ current_modal: modalId });
    posthog.register({
      current_feature: info.feature_category,
      current_modal_name: info.modal_name,
    });

    posthog.capture("modal_opened", {
      modal_id: modalId,
      modal_name: info.modal_name,
      feature_category: info.feature_category,
      timestamp: Date.now(),
      ...metadata,
    });

    posthog.capture("feature_used", {
      feature_category: info.feature_category,
      feature_name: info.modal_name,
      action: "modal_opened",
      target: modalId,
      ...metadata,
    });
  } catch (err) {
    console.debug("[PostHog trackModalOpen]", err);
  }
}

/**
 * Records user interaction (touch, click, typing) inside an active modal.
 */
export function trackModalInteraction(modalId: string, action: string, metadata?: Record<string, unknown>): void {
  if (!isPostHogConfigured() || !modalId) return;
  try {
    const info = resolveModalInfo(modalId);
    posthog.capture("modal_interaction", {
      modal_id: modalId,
      modal_name: info.modal_name,
      feature_category: info.feature_category,
      action,
      ...metadata,
    });
  } catch (err) {
    console.debug("[PostHog trackModalInteraction]", err);
  }
}

/**
 * Records specific custom action performed within a modal (e.g. submit, export, filter).
 */
export function trackModalAction(modalId: string, actionName: string, properties?: Record<string, unknown>): void {
  if (!isPostHogConfigured() || !modalId) return;
  try {
    const info = resolveModalInfo(modalId);
    posthog.capture("modal_action", {
      modal_id: modalId,
      modal_name: info.modal_name,
      feature_category: info.feature_category,
      action_name: actionName,
      ...properties,
    });

    posthog.capture("feature_used", {
      feature_category: info.feature_category,
      feature_name: info.modal_name,
      action: actionName,
      target: modalId,
      ...properties,
    });
  } catch (err) {
    console.debug("[PostHog trackModalAction]", err);
  }
}

/**
 * Records that a modal was closed, including duration and interaction metrics.
 * Restores the previous modal in stack or unregisters the `current_modal` super property.
 */
export function trackModalClose(
  modalId: string,
  metadata?: {
    duration_ms?: number;
    interacted?: boolean;
    interaction_count?: number;
    parentModalId?: string | null;
    [key: string]: unknown;
  },
): void {
  if (!isPostHogConfigured() || !modalId) return;
  try {
    const info = resolveModalInfo(modalId);
    posthog.capture("modal_closed", {
      modal_id: modalId,
      modal_name: info.modal_name,
      feature_category: info.feature_category,
      ...metadata,
    });

    if (metadata?.parentModalId) {
      const parentInfo = resolveModalInfo(metadata.parentModalId);
      posthog.register({ current_modal: metadata.parentModalId });
      posthog.register({
        current_feature: parentInfo.feature_category,
        current_modal_name: parentInfo.modal_name,
      });
    } else {
      posthog.unregister("current_modal");
      posthog.unregister("current_modal_name");
      if (lastRegisteredScreenFeature) {
        posthog.register({ current_feature: lastRegisteredScreenFeature });
      }
    }
  } catch (err) {
    console.debug("[PostHog trackModalClose]", err);
  }
}

export interface UserFeedbackSubmission {
  category: "bug" | "feature" | "experience" | "other" | string;
  rating?: number; // 1 to 5
  message: string;
  contact?: string;
  sentiment?: "positive" | "neutral" | "negative";
  metadata?: Record<string, unknown>;
}

/**
 * Captures user feedback directly into PostHog events and PostHog Surveys ($survey_sent).
 */
export function submitPostHogFeedback(data: UserFeedbackSubmission): boolean {
  if (!isPostHogConfigured()) return false;
  try {
    const distinctId = (posthog as unknown as { get_distinct_id?: () => string }).get_distinct_id?.();
    const sessionId = (posthog as unknown as { get_session_id?: () => string }).get_session_id?.();

    const payload = {
      feedback_category: data.category,
      feedback_rating: data.rating,
      feedback_message: data.message,
      feedback_contact: data.contact?.trim() || "anonymous",
      feedback_sentiment: data.sentiment,
      distinct_id: distinctId,
      session_id: sessionId,
      ...data.metadata,
    };

    // 1. Custom event for fast filtering, dashboards, and funnels
    posthog.capture("feedback_submitted", payload);

    // 2. PostHog native survey signal so responses appear under Surveys in PostHog
    posthog.capture("$survey_sent", {
      $survey_id: "amazecc_user_feedback",
      $survey_name: "AmazeCC User Feedback",
      $survey_response: data.message,
      $survey_response_rating: data.rating,
      $survey_response_category: data.category,
      ...payload,
    });

    return true;
  } catch (err) {
    console.error("[PostHog submitFeedback]", err);
    return false;
  }
}

/**
 * Records a counter metric (values that increment).
 */
export function trackMetricCount(name: string, value: number = 1, options?: Record<string, unknown>): void {
  if (!isPostHogConfigured()) return;
  try {
    const ph = posthog as unknown as { metrics?: { count: (name: string, value?: number, options?: unknown) => void } };
    ph.metrics?.count(name, value, options);
  } catch (err) {
    console.debug("[PostHog metric count]", err);
  }
}

/**
 * Records a gauge metric (values that fluctuate up and down).
 */
export function trackMetricGauge(name: string, value: number, options?: Record<string, unknown>): void {
  if (!isPostHogConfigured()) return;
  try {
    const ph = posthog as unknown as { metrics?: { gauge: (name: string, value: number, options?: unknown) => void } };
    ph.metrics?.gauge(name, value, options);
  } catch (err) {
    console.debug("[PostHog metric gauge]", err);
  }
}

/**
 * Records a distribution/histogram metric (e.g. latency in ms, payload sizes).
 */
export function trackMetricHistogram(
  name: string,
  value: number,
  options?: { unit?: string; [key: string]: unknown },
): void {
  if (!isPostHogConfigured()) return;
  try {
    const ph = posthog as unknown as {
      metrics?: { histogram: (name: string, value: number, options?: unknown) => void };
    };
    ph.metrics?.histogram(name, value, options);
  } catch (err) {
    console.debug("[PostHog metric histogram]", err);
  }
}

/**
 * Dispatches a custom arbitrary event to PostHog.
 */
export function trackCustomEvent(eventName: string, properties?: Record<string, unknown>): void {
  if (!isPostHogConfigured()) return;
  try {
    posthog.capture(eventName, properties);
  } catch (err) {
    console.debug("[PostHog trackCustomEvent]", err);
  }
}

/**
 * Checks whether a feature flag is enabled in PostHog.
 */
export function isFeatureEnabled(flagKey: string): boolean {
  if (!isPostHogConfigured()) return false;
  try {
    return Boolean(posthog.isFeatureEnabled(flagKey));
  } catch {
    return false;
  }
}

/**
 * Listens for PostHog feature flag reloads.
 */
export function onFeatureFlags(callback: (flags: string[]) => void): void {
  if (!isPostHogConfigured()) return;
  try {
    posthog.onFeatureFlags(callback);
  } catch {}
}

export { posthog };
