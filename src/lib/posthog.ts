"use client";

import posthog from "posthog-js";
import { getActiveDisplayName, getActiveRegNumber } from "./activeIdentity";
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
 * Ensures the PostHog client SDK is initialized with AmazeCC project tokens.
 * By default, background session recording is explicitly DISABLED (`disable_session_recording: true`)
 * to conserve battery and protect student privacy.
 * Recording only captures DOM events on-demand when the user enables trigger recording.
 */
export function initPostHogClient(): boolean {
  if (typeof window === "undefined") return false;
  const token = process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN;
  const host = process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://shoot.amazecc.com";
  if (!token) return false;

  const ph = posthog as unknown as { __loaded?: boolean };
  if (ph.__loaded) return true;

  try {
    posthog.init(token, {
      api_host: host,
      ui_host: "https://us.posthog.com",
      capture_pageview: false,
      capture_pageleave: true,
      disable_session_recording: true,
      autocapture: false,
      persistence: "localStorage+cookie",
    });
    return true;
  } catch (err) {
    console.debug("[PostHog init]", err);
    return false;
  }
}

// Auto-initialize when running in browser
if (typeof window !== "undefined") {
  try {
    initPostHogClient();
  } catch {}
}

/**
 * Checks whether the PostHog client library has finished initializing.
 */
export function isPostHogLoaded(): boolean {
  if (typeof window !== "undefined" && !Boolean((posthog as unknown as { __loaded?: boolean }).__loaded)) {
    initPostHogClient();
  }
  return isPostHogConfigured() && Boolean((posthog as unknown as { __loaded?: boolean }).__loaded);
}

/**
 * Test whether an identifier matches the standard VIT registration number format (e.g. 25BLC1081, 21BCE0001).
 * Typically: 2 digits (admission year) + 2-5 letters (branch/school) + 3-5 digits (sequence).
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
  /**
   * The reader's name as VTOP knows it — the `name` field on the student
   * profile segment (`localStorage.profile`, written by ProfilePage and the
   * sync engine from `/api/student`; the demo payload spells it
   * `studentName`). Sent as a *person property* so the PostHog person reads
   * as a student rather than as a bare registration number. Never an
   * identifier: the distinct id stays the registration number, so a name — or
   * a rename — cannot split one person into two.
   */
  name?: string;
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

  // The name rides along with whichever identifier won, so both return paths
  // below carry it. `getActiveDisplayName()` reads the same profile blob the
  // identity walk above already inspected — it is the canonical reader for the
  // two live spellings (`name` / `studentName`).
  const name = getActiveDisplayName() || undefined;

  if (primaryReg) {
    return {
      distinctId: primaryReg,
      registrationNumber: primaryReg,
      enrollmentNumber: primaryEnrollment,
      name,
    };
  }

  if (primaryEnrollment) {
    return {
      distinctId: primaryEnrollment,
      enrollmentNumber: primaryEnrollment,
      name,
    };
  }

  return null;
}

/**
 * Associate events with a verified user identity and persist person properties.
 * Also registers `registration_number` as a super property on all future events.
 *
 * The reader's name is folded in here too (caller-supplied `name` wins, the
 * profile segment is the fallback) so no caller can identify a person without
 * also labelling them.
 */
export function identifyPostHogUser(distinctId: string, properties?: Record<string, unknown>): void {
  if (!isPostHogConfigured() || !distinctId) return;
  try {
    const given = typeof properties?.name === "string" ? properties.name.trim() : "";
    const name = given || getActiveDisplayName();
    posthog.identify(distinctId, name ? { ...properties, name } : properties);
    const reg = (properties?.registration_number as string) || distinctId;
    posthog.register(name ? { registration_number: reg, name } : { registration_number: reg });
  } catch (err) {
    console.debug("[PostHog identify]", err);
  }
}

/**
 * Push the reader's VTOP name onto the person PostHog already knows, and onto
 * every event after it.
 *
 * The identify pass runs on hydration/sync, but the student profile segment
 * can land *after* it: ProfilePage refetching `/api/student` writes the blob
 * without changing anything Main's identify effect depends on, so the name
 * would otherwise never reach the person. Called at that write instead. The
 * distinct id does not move — only the label does.
 *
 * @param name Defaults to the name currently sitting in the profile segment.
 */
export function updatePostHogPersonName(name: string = getActiveDisplayName()): void {
  const trimmed = typeof name === "string" ? name.trim() : "";
  if (!trimmed || !isPostHogLoaded()) return;
  try {
    posthog.people.set({ name: trimmed });
    posthog.register({ name: trimmed });
  } catch (err) {
    console.debug("[PostHog person name]", err);
  }
}

/**
 * Clear the current user identity and super properties on sign out.
 */
export function resetPostHogUser(): void {
  if (!isPostHogConfigured()) return;
  try {
    posthog.unregister("registration_number");
    posthog.unregister("name");
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
  // The "social" sub-tab now hosts timetable sharing; the id is kept so analytics series stay continuous.
  if (normScreen === "social") return { feature_category: "social", feature_name: "Share Timetable" };
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

// ─────────────────────────────────────────────────────────────────────────────
// PostHog Support & Conversations API + Dynamic Session Recording
// ─────────────────────────────────────────────────────────────────────────────

export interface PostHogConversationMessage {
  id: string;
  ticket_id?: string;
  content: string;
  created_at: string;
  is_customer?: boolean;
  sender?: {
    name?: string;
    email?: string;
    avatar_url?: string;
  };
}

export interface PostHogConversationTicket {
  id: string;
  subject?: string;
  status: "open" | "closed" | "pending" | string;
  created_at: string;
  updated_at?: string;
  unread_count?: number;
  last_message?: string;
  metadata?: Record<string, unknown>;
}

export interface PostHogConversationsClient {
  isAvailable: () => boolean;
  sendMessage: (
    message: string,
    userTraits?: Record<string, unknown>,
    newTicket?: boolean,
  ) => Promise<{ ticket_id: string; message_id?: string; [key: string]: unknown }>;
  getTickets: (options?: {
    status?: "open" | "closed" | "resolved" | string;
    limit?: number;
    offset?: number;
  }) => Promise<{ tickets: PostHogConversationTicket[]; total?: number }>;
  getMessages: (ticketId?: string, after?: string) => Promise<{ messages: PostHogConversationMessage[] }>;
  markAsRead: (ticketId?: string) => Promise<void>;
  requestRestoreLink: (email: string) => Promise<{ success?: boolean; [key: string]: unknown }>;
}

/**
 * Starts PostHog session recording dynamically (e.g. user enabled bug diagnostics).
 * Lightly attaches to reactive DOM mutations without burdening mobile hardware.
 */
let recordingTriggerStartTime: number | null = null;

export function startPostHogSessionRecording(overrideSampling: boolean = true): boolean {
  initPostHogClient();
  if (!isPostHogConfigured()) return false;
  try {
    recordingTriggerStartTime = Date.now();
    const ph = posthog as unknown as {
      startSessionRecording?: (options?: { sampling?: boolean }) => void;
      sessionRecording?: { startRecording?: () => void; isRecording?: () => boolean };
    };
    if (typeof ph.startSessionRecording === "function") {
      ph.startSessionRecording(overrideSampling ? { sampling: true } : undefined);
      return true;
    }
    if (typeof ph.sessionRecording?.startRecording === "function") {
      ph.sessionRecording.startRecording();
      return true;
    }
    return false;
  } catch (err) {
    console.debug("[PostHog startSessionRecording]", err);
    return false;
  }
}

/**
 * Stops PostHog session recording.
 */
export function stopPostHogSessionRecording(): void {
  recordingTriggerStartTime = null;
  if (!isPostHogConfigured()) return;
  try {
    const ph = posthog as unknown as {
      stopSessionRecording?: () => void;
      sessionRecording?: { stopRecording?: () => void };
    };
    ph.stopSessionRecording?.();
    ph.sessionRecording?.stopRecording?.();
  } catch (err) {
    console.debug("[PostHog stopSessionRecording]", err);
  }
}

/**
 * Returns timestamp when trigger recording was started.
 */
export function getPostHogSessionRecordingStartTime(): number | null {
  return recordingTriggerStartTime;
}

/**
 * Checks whether session recording is actively running.
 */
export function isPostHogSessionRecordingActive(): boolean {
  if (!isPostHogConfigured()) return false;
  try {
    const ph = posthog as unknown as {
      sessionRecording?: { isRecording?: () => boolean };
    };
    return Boolean(ph.sessionRecording?.isRecording?.());
  } catch {
    return false;
  }
}

/**
 * Resolves the active session replay URL if recording is ongoing.
 */
export function getPostHogSessionReplayUrl(): string | null {
  if (!isPostHogConfigured()) return null;
  try {
    const ph = posthog as unknown as {
      get_session_replay_url?: (options?: { withTimestamp?: boolean }) => string;
    };
    const sdkUrl = ph.get_session_replay_url?.({ withTimestamp: true });
    if (typeof sdkUrl === "string" && sdkUrl.trim().length > 0) {
      return sdkUrl;
    }

    // Direct fallback using active session ID and PostHog project ID
    const sessionId = getPostHogSessionId();
    if (sessionId) {
      const projectId = process.env.NEXT_PUBLIC_POSTHOG_PROJECT_ID || process.env.POSTHOG_PROJECT_ID || "712727";
      return "https://us.posthog.com/project/" + projectId + "/replay/" + sessionId;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Resolves the active PostHog session ID.
 */
export function getPostHogSessionId(): string | null {
  if (!isPostHogConfigured()) return null;
  try {
    const ph = posthog as unknown as { get_session_id?: () => string };
    return ph.get_session_id?.() || null;
  } catch {
    return null;
  }
}

/**
 * Resolves the active PostHog distinct ID.
 */
export function getPostHogDistinctId(): string | null {
  if (!isPostHogConfigured()) return null;
  try {
    const ph = posthog as unknown as { get_distinct_id?: () => string };
    return ph.get_distinct_id?.() || null;
  } catch {
    return null;
  }
}

/**
 * Safely accesses the PostHog Conversations API if enabled in project settings.
 */
export function getPostHogConversations(): PostHogConversationsClient | null {
  if (!isPostHogConfigured()) return null;
  try {
    const ph = posthog as unknown as { conversations?: PostHogConversationsClient };
    if (ph.conversations && typeof ph.conversations.sendMessage === "function") {
      return ph.conversations;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Checks if the PostHog Conversations Direct API is currently available.
 */
export function isPostHogConversationsAvailable(): boolean {
  const client = getPostHogConversations();
  if (!client) return false;
  try {
    return typeof client.isAvailable === "function" ? client.isAvailable() : true;
  } catch {
    return false;
  }
}

/**
 * Sends a message/ticket via PostHog Conversations API or falls back to standard events.
 */
export async function sendPostHogSupportTicket(data: {
  message: string;
  category: string;
  rating?: number;
  contact?: string;
  name?: string;
  includeSessionRecording?: boolean;
  metadata?: Record<string, unknown>;
  newTicket?: boolean;
}): Promise<{ success: boolean; ticketId?: string; fallback?: boolean }> {
  if (!isPostHogConfigured()) return { success: false };

  // 1. If session recording was requested, activate it immediately with forced sampling
  if (data.includeSessionRecording) {
    startPostHogSessionRecording(true);
  }

  // 2. Attach personal/contact email and name to PostHog Person so Support dashboard links replies
  if (data.contact) {
    try {
      posthog.people.set({
        email: data.contact,
        contact_email: data.contact,
        ...(data.metadata?.personal_email ? { personal_email: data.metadata.personal_email } : {}),
        ...(data.metadata?.college_email ? { college_email: data.metadata.college_email } : {}),
        ...(data.name ? { name: data.name } : {}),
      });
    } catch {}
  }

  const replayUrl = data.includeSessionRecording ? getPostHogSessionReplayUrl() : null;
  const sessionId = getPostHogSessionId();
  const canonicalId = resolveCanonicalDistinctId();
  const currentPhId = getPostHogDistinctId();

  // If canonicalId is a real registration number and PostHog currently holds an application number,
  // alias and re-identify so PostHog permanently switches the session to the registration number.
  if (isRegistrationNumber(canonicalId) && currentPhId && currentPhId !== canonicalId) {
    try {
      aliasPostHogUser(canonicalId, currentPhId);
      identifyPostHogUser(canonicalId, {
        registration_number: canonicalId,
        reg_number: canonicalId,
        application_number: currentPhId,
      });
    } catch {}
  }

  // Also ensure HMAC identity verification is synced if secret is available
  try {
    await syncPostHogIdentityVerification(canonicalId);
  } catch {}

  // Explicitly embed session recording link into the ticket markdown body so support agents see it directly in chat
  let ticketMessage = data.message;
  if (data.includeSessionRecording && replayUrl && !ticketMessage.includes("Session Recording")) {
    ticketMessage = `${ticketMessage}\n\n🎥 **Session Recording**: [View Replay in PostHog](${replayUrl})`;
  }

  const client = getPostHogConversations();
  if (client) {
    try {
      const response = await client.sendMessage(
        ticketMessage,
        {
          name: data.name,
          email: data.contact,
          feedback_category: data.category,
          feedback_rating: data.rating,
          session_replay_url: replayUrl,
          $session_recording_url: replayUrl,
          session_id: sessionId,
          $session_id: sessionId,
          recording_opt_in: Boolean(data.includeSessionRecording),
          distinct_id: canonicalId,
          registration_number: canonicalId,
          ...data.metadata,
        },
        data.newTicket ?? true,
      );
      return { success: true, ticketId: response?.ticket_id };
    } catch (err) {
      console.warn("[PostHog conversations.sendMessage fallback]", err);
    }
  }

  // Fallback to standard feedback event + survey signal
  const eventSuccess = submitPostHogFeedback({
    category: data.category,
    rating: data.rating,
    message: ticketMessage,
    contact: data.contact,
    metadata: {
      session_replay_url: replayUrl,
      $session_recording_url: replayUrl,
      session_id: sessionId,
      $session_id: sessionId,
      recording_opt_in: Boolean(data.includeSessionRecording),
      ...data.metadata,
    },
  });

  return { success: eventSuccess, fallback: true };
}

/**
 * Requests an email recovery link from PostHog to restore conversations across devices.
 */
export async function requestPostHogConversationRestore(email: string): Promise<boolean> {
  const client = getPostHogConversations();
  if (!client || typeof client.requestRestoreLink !== "function") return false;
  try {
    const res = await client.requestRestoreLink(email);
    return res?.success !== false;
  } catch (err) {
    console.error("[PostHog requestRestoreLink]", err);
    return false;
  }
}

/**
 * Applies identity verification for cross-device conversation persistence.
 */
export function applyPostHogIdentityVerification(distinctId: string, identityHash: string): void {
  if (!isPostHogConfigured() || !distinctId || !identityHash) return;
  try {
    const projectToken = process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN || "";
    const host = process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://shoot.amazecc.com";
    posthog.init(projectToken, {
      api_host: host,
      identity_distinct_id: distinctId,
      identity_hash: identityHash,
    } as any);
  } catch (err) {
    console.error("[PostHog applyIdentityVerification]", err);
  }
}

/**
 * Resolves the true registration number as the canonical PostHog distinct ID,
 * prioritizing registration numbers (e.g. 21BCE0001) over numeric application numbers (e.g. 2024001234).
 */
export function resolveCanonicalDistinctId(): string {
  const reg = getActiveRegNumber();
  if (reg && isRegistrationNumber(reg)) {
    return reg.toUpperCase().trim();
  }

  const identity = getPostHogUserIdentifiers();
  if (identity?.registrationNumber && isRegistrationNumber(identity.registrationNumber)) {
    return identity.registrationNumber.toUpperCase().trim();
  }

  const current = getPostHogDistinctId();
  if (current) return current;

  if (identity?.distinctId) return identity.distinctId;
  return "anonymous";
}

/**
 * Computes HMAC-SHA256 hash for PostHog Identity Verification using Web Crypto API.
 */
export async function computePostHogIdentityHash(secret: string, distinctId: string): Promise<string> {
  if (!secret || !distinctId || typeof window === "undefined" || !window.crypto?.subtle) {
    return "";
  }
  try {
    const enc = new TextEncoder();
    const key = await window.crypto.subtle.importKey(
      "raw",
      enc.encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"],
    );
    const signature = await window.crypto.subtle.sign("HMAC", key, enc.encode(distinctId));
    return Array.from(new Uint8Array(signature))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  } catch (err) {
    console.error("[PostHog computeIdentityHash]", err);
    return "";
  }
}

/**
 * Resolves identity verification hash securely.
 * The raw secret must NEVER be exposed in client code (NEXT_PUBLIC_*).
 * If a backend signing endpoint exists, it fetches the signature safely from the server;
 * otherwise it keeps the secret secure and relies on email restoration across browsers.
 */
export async function syncPostHogIdentityVerification(distinctId: string): Promise<string> {
  if (!distinctId || typeof window === "undefined") return "";

  try {
    const apiBase = process.env.NEXT_PUBLIC_API_URL || "";
    if (apiBase) {
      const res = await fetch(`${apiBase}/support/identity-hash?distinct_id=${encodeURIComponent(distinctId)}`);
      if (res.ok) {
        const data = await res.json();
        if (data?.identity_hash) {
          applyPostHogIdentityVerification(distinctId, data.identity_hash);
          return data.identity_hash;
        }
      }
    }
  } catch {}

  return "";
}

export { posthog };
