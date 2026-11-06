import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import posthog from "posthog-js";
import {
  identifyPostHogUser,
  resetPostHogUser,
  trackScreenView,
  trackModalOpen,
  trackModalInteraction,
  trackModalAction,
  trackModalClose,
  submitPostHogFeedback,
  trackCustomEvent,
  isFeatureEnabled,
  isRegistrationNumber,
  aliasPostHogUser,
  getPostHogUserIdentifiers,
  resolveModalInfo,
  resolveScreenFeature,
  trackFeatureUsage,
} from "../lib/posthog";

vi.mock("posthog-js", () => {
  const ph = {
    identify: vi.fn(),
    reset: vi.fn(),
    capture: vi.fn(),
    register: vi.fn(),
    unregister: vi.fn(),
    alias: vi.fn(),
    isFeatureEnabled: vi.fn(() => true),
    onFeatureFlags: vi.fn(),
    get_distinct_id: vi.fn(() => "test-user-123"),
    get_session_id: vi.fn(() => "test-session-456"),
    __loaded: true,
  };
  return {
    default: ph,
    ...ph,
  };
});

describe("posthog integration utilities", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env = {
      ...originalEnv,
      NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN: "phc_test_token",
      NEXT_PUBLIC_POSTHOG_HOST: "https://shoot.amazecc.com",
    };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("identifies user with distinctId and properties", () => {
    identifyPostHogUser("21BCE0001", { campus: "chennai", theme: "dark" });
    expect(posthog.identify).toHaveBeenCalledWith("21BCE0001", {
      campus: "chennai",
      theme: "dark",
    });
  });

  it("resets user on logout", () => {
    resetPostHogUser();
    expect(posthog.reset).toHaveBeenCalled();
  });

  it("tracks screen views and registers super properties", () => {
    trackScreenView("attendance", "calendar", { mode: "preview" });

    expect(posthog.register).toHaveBeenCalledWith({
      current_screen: "attendance",
      current_subtab: "calendar",
    });

    expect(posthog.capture).toHaveBeenCalledWith(
      "screen_view",
      expect.objectContaining({
        screen_name: "attendance",
        sub_tab: "calendar",
        mode: "preview",
      }),
    );

    expect(posthog.capture).toHaveBeenCalledWith(
      "$pageview",
      expect.objectContaining({
        page_title: "attendance - calendar",
        screen_name: "attendance",
      }),
    );
  });

  it("tracks modal opens and registers active modal super property", () => {
    trackModalOpen("ffcs-settings", { depth: 1 });

    expect(posthog.register).toHaveBeenCalledWith({
      current_modal: "ffcs-settings",
    });

    expect(posthog.capture).toHaveBeenCalledWith(
      "modal_opened",
      expect.objectContaining({
        modal_id: "ffcs-settings",
        depth: 1,
      }),
    );
  });

  it("tracks modal interactions", () => {
    trackModalInteraction("ffcs-settings", "tab_switch", { tab: "clashes" });

    expect(posthog.capture).toHaveBeenCalledWith(
      "modal_interaction",
      expect.objectContaining({
        modal_id: "ffcs-settings",
        action: "tab_switch",
        tab: "clashes",
      }),
    );
  });

  it("tracks modal actions", () => {
    trackModalAction("qbank-upload", "submit_paper", { subject: "CSE1001" });

    expect(posthog.capture).toHaveBeenCalledWith(
      "modal_action",
      expect.objectContaining({
        modal_id: "qbank-upload",
        action_name: "submit_paper",
        subject: "CSE1001",
      }),
    );
  });

  it("tracks modal closes and restores previous modal or unregisters", () => {
    trackModalClose("ffcs-settings", {
      duration_ms: 1500,
      interacted: true,
      interaction_count: 3,
      parentModalId: "dashboard-palette",
    });

    expect(posthog.capture).toHaveBeenCalledWith(
      "modal_closed",
      expect.objectContaining({
        modal_id: "ffcs-settings",
        duration_ms: 1500,
        interacted: true,
      }),
    );

    expect(posthog.register).toHaveBeenCalledWith({
      current_modal: "dashboard-palette",
    });

    trackModalClose("dashboard-palette", { parentModalId: null });
    expect(posthog.unregister).toHaveBeenCalledWith("current_modal");
  });

  it("submits user feedback into PostHog custom events and native surveys", () => {
    const success = submitPostHogFeedback({
      category: "feature",
      rating: 5,
      message: "Please add notifications for cancelled classes!",
      contact: "student@vit.ac.in",
      metadata: { activeTab: "attendance" },
    });

    expect(success).toBe(true);
    expect(posthog.capture).toHaveBeenCalledWith(
      "feedback_submitted",
      expect.objectContaining({
        feedback_category: "feature",
        feedback_rating: 5,
        feedback_message: "Please add notifications for cancelled classes!",
        feedback_contact: "student@vit.ac.in",
        distinct_id: "test-user-123",
      }),
    );

    expect(posthog.capture).toHaveBeenCalledWith(
      "$survey_sent",
      expect.objectContaining({
        $survey_id: "amazecc_user_feedback",
        $survey_response: "Please add notifications for cancelled classes!",
        $survey_response_rating: 5,
        $survey_response_category: "feature",
      }),
    );
  });

  it("checks feature flags safely", () => {
    expect(isFeatureEnabled("beta-ffcs-v2")).toBe(true);
    expect(posthog.isFeatureEnabled).toHaveBeenCalledWith("beta-ffcs-v2");
  });

  it("captures custom events", () => {
    trackCustomEvent("custom_experiment", { variant: "A" });
    expect(posthog.capture).toHaveBeenCalledWith("custom_experiment", { variant: "A" });
  });

  it("categorizes modals into feature buckets and resolves friendly names", () => {
    const roomInspector = resolveModalInfo("room-inspector");
    expect(roomInspector).toEqual({
      modal_id: "room-inspector",
      modal_name: "Free Classroom Room Inspector",
      feature_category: "free_classrooms",
    });

    const ffcsAuto = resolveModalInfo("ffcs-auto-generator");
    expect(ffcsAuto).toEqual({
      modal_id: "ffcs-auto-generator",
      modal_name: "FFCS Auto Timetable Generator",
      feature_category: "ffcs_generator",
    });

    const taskEdit = resolveModalInfo("task-edit-sheet");
    expect(taskEdit).toEqual({
      modal_id: "task-edit-sheet",
      modal_name: "Task Create & Edit Sheet",
      feature_category: "tasks",
    });

    const qbankUpload = resolveModalInfo("qbank-upload");
    expect(qbankUpload).toEqual({
      modal_id: "qbank-upload",
      modal_name: "Upload Paper to QBank",
      feature_category: "qbank",
    });

    const dynamicPredictor = resolveModalInfo("predictor-add-fat");
    expect(dynamicPredictor.feature_category).toBe("marks_predictor");
    expect(dynamicPredictor.modal_name).toContain("FAT");
  });

  it("resolves screen and subtab features accurately", () => {
    expect(resolveScreenFeature("attendance", "calendar")).toEqual({
      feature_category: "attendance",
      feature_name: "Attendance Tracker",
    });

    expect(resolveScreenFeature("tools", "scanner")).toEqual({
      feature_category: "paper_scanner",
      feature_name: "Paper Scanner",
    });

    expect(resolveScreenFeature("tools", "free-rooms")).toEqual({
      feature_category: "free_classrooms",
      feature_name: "Free Classrooms",
    });

    expect(resolveScreenFeature("ffcs", "generator")).toEqual({
      feature_category: "ffcs_generator",
      feature_name: "FFCS Generator",
    });
  });

  it("tracks explicit feature usage and enriches modal opens with feature category", () => {
    trackFeatureUsage("free_classrooms", "filter_rooms", { block: "SJT" });
    expect(posthog.capture).toHaveBeenCalledWith("feature_used", {
      feature_category: "free_classrooms",
      action: "filter_rooms",
      block: "SJT",
    });

    trackModalOpen("room-inspector");
    expect(posthog.capture).toHaveBeenCalledWith(
      "modal_opened",
      expect.objectContaining({
        modal_id: "room-inspector",
        modal_name: "Free Classroom Room Inspector",
        feature_category: "free_classrooms",
      }),
    );
    expect(posthog.capture).toHaveBeenCalledWith(
      "feature_used",
      expect.objectContaining({
        feature_category: "free_classrooms",
        action: "modal_opened",
        target: "room-inspector",
      }),
    );
  });

  describe("registration number vs enrollment number resolution", () => {
    it("distinguishes registration numbers with branch codes from numeric enrollment numbers", () => {
      expect(isRegistrationNumber("25BLC1081")).toBe(true);
      expect(isRegistrationNumber("21BCE0001")).toBe(true);
      expect(isRegistrationNumber("25MID1139")).toBe(true);
      expect(isRegistrationNumber("22MIS1234")).toBe(true);
      expect(isRegistrationNumber("22BCE10456")).toBe(true);

      // Pure numeric application / enrollment numbers should not be treated as registration numbers
      expect(isRegistrationNumber("20626703")).toBe(false);
      expect(isRegistrationNumber("2025001264")).toBe(false);
      expect(isRegistrationNumber("")).toBe(false);
      expect(isRegistrationNumber(null)).toBe(false);
      expect(isRegistrationNumber(undefined)).toBe(false);
    });

    it("prioritizes registration number 25BLC1081 over enrollment number 20626703", () => {
      window.localStorage.clear();
      window.localStorage.setItem(
        "profile",
        JSON.stringify({
          registerNo: "25BLC1081",
          applicationNumber: "20626703",
        }),
      );

      const identity = getPostHogUserIdentifiers({
        authorizedID: "20626703",
        username: "20626703",
      });

      expect(identity).not.toBeNull();
      expect(identity?.distinctId).toBe("25BLC1081");
      expect(identity?.registrationNumber).toBe("25BLC1081");
      expect(identity?.enrollmentNumber).toBe("20626703");
    });

    it("identifies by username when username is already a registration number", () => {
      window.localStorage.clear();
      const identity = getPostHogUserIdentifiers({
        authorizedID: "20626703",
        username: "25BLC1081",
      });

      expect(identity?.distinctId).toBe("25BLC1081");
      expect(identity?.registrationNumber).toBe("25BLC1081");
    });

    it("falls back to enrollment number if no registration number has been assigned yet", () => {
      window.localStorage.clear();
      const identity = getPostHogUserIdentifiers({
        authorizedID: "20626703",
      });

      expect(identity?.distinctId).toBe("20626703");
      expect(identity?.registrationNumber).toBeUndefined();
      expect(identity?.enrollmentNumber).toBe("20626703");
    });

    it("aliases distinct identities in PostHog safely", () => {
      aliasPostHogUser("25BLC1081", "20626703");
      expect(posthog.alias).toHaveBeenCalledWith("25BLC1081", "20626703");
    });
  });
});
