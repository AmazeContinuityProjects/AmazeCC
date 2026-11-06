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
 */
export function identifyPostHogUser(distinctId: string, properties?: Record<string, unknown>): void {
  if (!isPostHogConfigured() || !distinctId) return;
  try {
    posthog.identify(distinctId, properties);
  } catch (err) {
    console.debug("[PostHog identify]", err);
  }
}

/**
 * Clear the current user identity on sign out.
 */
export function resetPostHogUser(): void {
  if (!isPostHogConfigured()) return;
  try {
    posthog.reset();
  } catch (err) {
    console.debug("[PostHog reset]", err);
  }
}

/**
 * Tracks a screen, tab or subtab transition.
 * Sets `current_screen` and `current_subtab` super properties so subsequent
 * clicks, logs, and errors inherit the active view context.
 */
export function trackScreenView(screenName: string, subTab?: string, properties?: Record<string, unknown>): void {
  if (!isPostHogConfigured() || !screenName) return;
  try {
    const payload = {
      screen_name: screenName,
      sub_tab: subTab || undefined,
      url: typeof window !== "undefined" ? window.location.href : undefined,
      pathname: typeof window !== "undefined" ? window.location.pathname : undefined,
      ...properties,
    };

    // Register super properties across all subsequent events
    posthog.register({
      current_screen: screenName,
      current_subtab: subTab || "",
    });

    posthog.capture("screen_view", payload);
    posthog.capture("$pageview", {
      $current_url: window.location.href,
      page_title: `${screenName}${subTab ? ` - ${subTab}` : ""}`,
      ...payload,
    });
  } catch (err) {
    console.debug("[PostHog trackScreenView]", err);
  }
}

/**
 * Records that an overlay modal or bottom sheet was opened.
 * Also binds `current_modal` to PostHog's super properties.
 */
export function trackModalOpen(modalId: string, metadata?: Record<string, unknown>): void {
  if (!isPostHogConfigured() || !modalId) return;
  try {
    posthog.register({ current_modal: modalId });
    posthog.capture("modal_opened", {
      modal_id: modalId,
      timestamp: Date.now(),
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
    posthog.capture("modal_interaction", {
      modal_id: modalId,
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
    posthog.capture("modal_action", {
      modal_id: modalId,
      action_name: actionName,
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
    posthog.capture("modal_closed", {
      modal_id: modalId,
      ...metadata,
    });

    if (metadata?.parentModalId) {
      posthog.register({ current_modal: metadata.parentModalId });
    } else {
      posthog.unregister("current_modal");
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
