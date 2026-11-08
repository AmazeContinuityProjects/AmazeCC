"use client";

import React, { useState, useEffect } from "react";
import { useAtom, useSetAtom } from "jotai";
import {
  isFeedbackModalOpenAtom,
  isBugRecordingActiveAtom,
  bugRecordingStartedAtAtom,
  hasBugRecordingClipAtom,
  bugRecordingDurationAtom,
  bugRecordingOriginAtom,
} from "@/store/uiAtoms";
import BottomSheet from "../shared/BottomSheet";
import {
  submitPostHogFeedback,
  sendPostHogSupportTicket,
  startPostHogSessionRecording,
  stopPostHogSessionRecording,
  getPostHogSessionReplayUrl,
  resolveCanonicalDistinctId,
} from "@/lib/posthog";
import { useDashboardNavigator } from "../dashboard/DashboardNavigator";
import { getActiveDisplayName } from "@/lib/activeIdentity";
import buildInfo from "@/data/buildInfo.json";
import {
  Bug,
  CheckCircle2,
  ChevronRight,
  ExternalLink,
  HeartHandshake,
  Lightbulb,
  MessageSquare,
  Send,
  Sparkles,
  Video,
} from "lucide-react";

type FeedbackCategory = "bug" | "feature" | "experience" | "other";

const CATEGORIES: {
  id: FeedbackCategory;
  label: string;
  icon: typeof Bug;
  desc: string;
  badgeClass: string;
}[] = [
  {
    id: "experience",
    label: "Experience",
    icon: Sparkles,
    desc: "Speed, design, UI feel",
    badgeClass: "text-warn bg-warn-soft border-warn/20",
  },
  {
    id: "feature",
    label: "Feature Request",
    icon: Lightbulb,
    desc: "Ideas for new tools",
    badgeClass: "text-indigo-500 bg-indigo-500/10 border-indigo-500/20",
  },
  {
    id: "bug",
    label: "Report Bug",
    icon: Bug,
    desc: "Glitch or broken button",
    badgeClass: "text-danger bg-danger-soft border-danger/20",
  },
  {
    id: "other",
    label: "Other",
    icon: MessageSquare,
    desc: "General thoughts",
    badgeClass: "text-ok bg-ok-soft border-ok/20",
  },
];

const RATINGS = [
  { value: 1, emoji: "😕", label: "Needs Work" },
  { value: 2, emoji: "😐", label: "Okay" },
  { value: 3, emoji: "🙂", label: "Good" },
  { value: 4, emoji: "😊", label: "Great" },
  { value: 5, emoji: "🤩", label: "Amazing!" },
];

export default function FeedbackModal() {
  const [isOpen, setIsOpen] = useAtom(isFeedbackModalOpenAtom);
  const { activeTab, activeSubTab, setActiveTab } = useDashboardNavigator();

  const [category, setCategory] = useState<FeedbackCategory>("experience");
  const [rating, setRating] = useState<number>(5);
  const [message, setMessage] = useState("");
  const [contact, setContact] = useState("");
  const [recordSession, setRecordSession] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [ticketId, setTicketId] = useState<string | null>(null);

  // Global reproduction recording state
  const [, setIsBugRecordingActive] = useAtom(isBugRecordingActiveAtom);
  const [, setBugStartedAt] = useAtom(bugRecordingStartedAtAtom);
  const [hasClip, setHasClip] = useAtom(hasBugRecordingClipAtom);
  const [clipDuration, setClipDuration] = useAtom(bugRecordingDurationAtom);
  const setOrigin = useSetAtom(bugRecordingOriginAtom);

  useEffect(() => {
    if (!contact && typeof window !== "undefined") {
      try {
        const saved =
          window.localStorage.getItem("amazecc_feedback_email") ||
          window.localStorage.getItem("amazecc_feedback_personal_email");
        if (saved) setContact(saved);
      } catch {}
    }
  }, [contact, isOpen]);

  // When a clip was recorded, ensure recording is flagged on
  useEffect(() => {
    if (hasClip) {
      setRecordSession(true);
    }
  }, [hasClip]);

  if (!isOpen) return null;

  const handleClose = () => {
    // If user closes sheet while a recording was toggled on without submitting, stop recording
    if (recordSession && !hasClip) {
      stopPostHogSessionRecording();
      setRecordSession(false);
    }
    setIsOpen(false);
    // Reset after animation
    setTimeout(() => {
      setIsSubmitted(false);
      setMessage("");
      setCategory("experience");
      setRating(5);
      setTicketId(null);
    }, 250);
  };

  const handleStartReplicating = () => {
    setOrigin("modal");
    setRecordSession(true);
    startPostHogSessionRecording();
    setIsBugRecordingActive(true);
    setBugStartedAt(Date.now());
    setHasClip(false);
    // Close the sheet so the user can immediately interact with the screen behind it
    setIsOpen(false);
  };

  const handleDiscardClip = () => {
    stopPostHogSessionRecording();
    setHasClip(false);
    setClipDuration(0);
    setRecordSession(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim() || isSubmitting) return;

    setIsSubmitting(true);

    const sentiment = rating >= 4 ? "positive" : rating === 3 ? "neutral" : "negative";
    const userReg = resolveCanonicalDistinctId();
    const userName = getActiveDisplayName() || undefined;

    const fullMessage = [
      `**Category**: ${category.toUpperCase()}`,
      `**Rating**: ${rating}/5 (${sentiment})`,
      `**Message**: ${message.trim()}`,
      hasClip ? `**Reproduction Clip**: Recorded in-session (${clipDuration}s)` : "",
      userReg && userReg !== "anonymous" ? `**Student Reg**: ${userReg}` : "",
      `**Screen**: ${activeTab}${activeSubTab ? ` / ${activeSubTab}` : ""}`,
      `**Commit**: ${buildInfo.commitHash || "latest"}`,
    ]
      .filter(Boolean)
      .join("\n\n");

    const shouldAttachRecording = recordSession || hasClip;
    const replayUrl = shouldAttachRecording ? getPostHogSessionReplayUrl() : undefined;

    try {
      const result = await sendPostHogSupportTicket({
        category,
        rating,
        message: fullMessage,
        contact: contact.trim() || undefined,
        name: userName || (userReg !== "anonymous" ? userReg : undefined),
        includeSessionRecording: shouldAttachRecording,
        metadata: {
          activeTab,
          activeSubTab,
          appVersion: buildInfo.commitHash,
          url: typeof window !== "undefined" ? window.location.href : "",
          userAgent: typeof navigator !== "undefined" ? navigator.userAgent : "",
          sentiment,
          rating,
          recording_opt_in: shouldAttachRecording,
          reproduction_clip_duration_seconds: hasClip ? clipDuration : undefined,
          session_replay_url: replayUrl,
          personal_email: contact.trim() || undefined,
        },
      });

      if (contact.trim()) {
        try {
          window.localStorage.setItem("amazecc_feedback_email", contact.trim());
        } catch {}
      }

      // Stop recording automatically on submit so it never lingers
      stopPostHogSessionRecording();
      setIsBugRecordingActive(false);
      setHasClip(false);
      setClipDuration(0);

      if (result.ticketId) {
        setTicketId(result.ticketId);
        try {
          const raw = window.localStorage.getItem("amazecc_support_tickets");
          const list = raw ? JSON.parse(raw) : [];
          list.unshift({
            id: result.ticketId,
            subject: `${category.toUpperCase()}: ${message.trim().slice(0, 40)}`,
            status: "open",
            created_at: new Date().toISOString(),
            last_message: message.trim(),
          });
          window.localStorage.setItem("amazecc_support_tickets", JSON.stringify(list));
        } catch {}
      }

      setIsSubmitted(true);
    } catch (err) {
      console.error("[FeedbackModal handleSubmit]", err);
      submitPostHogFeedback({
        category,
        rating,
        sentiment,
        message: message.trim(),
        contact: contact.trim() || undefined,
      });
      setIsSubmitted(true);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <BottomSheet
      overlayId="feedback-sheet"
      onClose={handleClose}
      title="Share Feedback"
      subtitle="Help us build a better companion app for VIT"
      icon={<HeartHandshake className="w-5 h-5 text-indigo-500" />}
      maxWidth="max-w-md"
      trailing={
        <button
          type="button"
          onClick={() => {
            handleClose();
            setActiveTab("feedback");
          }}
          className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1 cursor-pointer mr-1"
          title="Open full feedback & bug report page"
        >
          <span>Full Page</span>
          <ExternalLink className="w-3.5 h-3.5" />
        </button>
      }
    >
      <div className="p-4 sm:p-5">
        {isSubmitted ? (
          <div className="py-8 text-center space-y-4">
            <div className="w-14 h-14 mx-auto rounded-full bg-ok-soft text-ok flex items-center justify-center">
              <CheckCircle2 className="w-8 h-8 animate-in zoom-in-75 duration-200" />
            </div>
            <div className="space-y-1">
              <h3 className="text-base font-semibold text-text-primary">Thank you for your feedback!</h3>
              <p className="text-xs text-text-muted max-w-xs mx-auto leading-relaxed">
                Your report has been logged into PostHog.
                {ticketId && (
                  <span className="block mt-1 font-mono font-semibold text-indigo-600 dark:text-indigo-400">
                    Ticket ID: #{ticketId}
                  </span>
                )}
              </p>
            </div>
            <button
              type="button"
              onClick={handleClose}
              className="mt-2 w-full py-2.5 rounded-sm bg-accent hover:bg-accent/90 text-background font-medium text-xs transition-transform cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
              Done
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Category selection */}
            <div>
              <label className="block text-[11px] font-semibold text-text-muted mb-2">
                What are you sharing?
              </label>
              <div className="grid grid-cols-2 gap-2">
                {CATEGORIES.map((cat) => {
                  const Icon = cat.icon;
                  const isSelected = category === cat.id;
                  return (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => setCategory(cat.id)}
                      className={`flex items-start gap-2.5 p-2.5 rounded-md border text-left transition-all cursor-pointer ${
                        isSelected
                          ? "border-indigo-500/60 bg-indigo-500/5 ring-1 ring-indigo-500/30"
                          : "border-border-muted bg-surface-secondary/50 hover:bg-surface-secondary"
                      }`}
                    >
                      <div className={`p-1.5 rounded-lg border ${cat.badgeClass}`}>
                        <Icon className="w-3.5 h-3.5" />
                      </div>
                      <div className="min-w-0">
                        <span className="block text-xs font-semibold text-text-primary leading-tight">{cat.label}</span>
                        <span className="block text-[11px] text-text-muted truncate mt-0.5">{cat.desc}</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Rating */}
            <div>
              <label className="block text-[11px] font-semibold text-text-muted mb-2">
                How is your experience?
              </label>
              <div className="flex items-center justify-between gap-1.5 p-1.5 rounded-md bg-surface-secondary/70 border border-border-muted">
                {RATINGS.map((r) => {
                  const isSelected = rating === r.value;
                  return (
                    <button
                      key={r.value}
                      type="button"
                      onClick={() => setRating(r.value)}
                      title={r.label}
                      className={`flex-1 py-1.5 rounded-lg flex flex-col items-center gap-0.5 transition-all cursor-pointer ${
                        isSelected
                          ? "bg-surface-primary text-text-primary shadow-sm scale-105 border border-border-muted"
                          : "text-text-muted hover:text-text-secondary opacity-80"
                      }`}
                    >
                      <span className="text-base leading-none">{r.emoji}</span>
                      <span className="text-[9.5px] font-semibold">{r.value}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Message Area */}
            <div>
              <label className="block text-[11px] font-semibold text-text-muted mb-1.5">
                Your message
              </label>
              <textarea
                required
                rows={4}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder={
                  category === "bug"
                    ? "What happened? Steps to reproduce the bug..."
                    : category === "feature"
                      ? "Describe your idea and how it would help you..."
                      : "Tell us what you love or what could be better..."
                }
                className="w-full rounded-md border border-border-muted bg-surface-secondary/60 p-3 text-xs text-text-primary placeholder:text-text-muted focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 resize-none transition-colors"
              />
            </div>

            {/* Contact Info (Optional) */}
            <div>
              <label className="block text-[11px] font-semibold text-text-muted mb-1.5">
                Personal Email <span className="font-normal opacity-70">(Optional, for developer replies)</span>
              </label>
              <input
                type="email"
                value={contact}
                onChange={(e) => setContact(e.target.value)}
                placeholder="your.personal@gmail.com"
                className="w-full rounded-md border border-border-muted bg-surface-secondary/60 px-3 py-2 text-xs text-text-primary placeholder:text-text-muted focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-colors"
              />
            </div>

            {/* ── SESSION REPRODUCTION RECORDING SECTION ── */}
            {hasClip ? (
              <div className="p-3 rounded-md border border-ok/30 bg-ok-soft flex items-center justify-between gap-2">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="p-2 rounded-md bg-ok-soft text-ok shrink-0">
                    <CheckCircle2 className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <span className="text-xs font-semibold text-ok block truncate">
                      Reproduction Clip Attached ({clipDuration}s)
                    </span>
                    <span className="text-[11px] text-text-muted block">
                      Virtual DOM replay ready to submit with ticket
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={handleStartReplicating}
                    className="px-2.5 py-1 rounded-lg border border-border-muted bg-surface hover:bg-surface-secondary text-[11px] font-semibold text-text-primary cursor-pointer"
                  >
                    Re-record
                  </button>
                  <button
                    type="button"
                    onClick={handleDiscardClip}
                    className="px-2.5 py-1 rounded-lg border border-danger/20 text-[11px] font-semibold text-danger hover:bg-danger-soft cursor-pointer"
                  >
                    Discard
                  </button>
                </div>
              </div>
            ) : (
              <div className="p-3.5 rounded-md border border-danger/25 bg-danger-soft space-y-2.5">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="p-1.5 rounded-lg bg-danger-soft text-danger shrink-0">
                      <Video className="w-4 h-4" />
                    </div>
                    <div>
                      <span className="text-xs font-semibold text-text-primary block leading-tight">
                        Record Bug Reproduction
                      </span>
                      <span className="text-[11px] text-text-muted block mt-0.5">
                        Records live virtual DOM while you navigate AmazeCC
                      </span>
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleStartReplicating}
                  className="w-full py-2.5 px-3 rounded-md bg-danger hover:bg-danger text-white text-xs font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer shadow-xs"
                >
                  <span className="w-2.5 h-2.5 rounded-full bg-surface animate-pulse" />
                  <span>Start Recording &amp; Replicate Glitch</span>
                </button>

                <p className="text-[11px] text-text-muted leading-relaxed">
                  Tapping record closes this modal and pins a floating indicator to the top of your screen. Replicate
                  the issue anywhere in the app, then tap <strong>&quot;Finish &amp; Review&quot;</strong> to return
                  with the clip attached. If you reload, it cancels automatically.
                </p>
              </div>
            )}

            {/* Diagnostic note */}
            <div className="flex items-center gap-1.5 text-[11px] text-text-muted">
              <span>
                Diagnostics: App #{buildInfo.commitHash} · Screen: {activeTab}
              </span>
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={isSubmitting || !message.trim()}
              className="w-full py-2.5 rounded-sm bg-accent hover:bg-accent/90 disabled:opacity-50 text-background font-medium text-xs flex items-center justify-center gap-2 transition-transform cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
              <Send className="w-3.5 h-3.5" />
              <span>{isSubmitting ? "Sending..." : "Submit to PostHog"}</span>
            </button>

            {/* Link to Full Page */}
            <button
              type="button"
              onClick={() => {
                handleClose();
                setActiveTab("feedback");
              }}
              className="text-[11px] text-indigo-600 dark:text-indigo-400 hover:underline flex items-center justify-center gap-1 w-full pt-1 cursor-pointer font-semibold"
            >
              <span>Need detailed diagnostics or ticket tracking? Open Full Bug Report Page</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </form>
        )}
      </div>
    </BottomSheet>
  );
}
