"use client";

import React, { useState, useEffect, useMemo, useTransition } from "react";
import { useAtom, useSetAtom } from "jotai";
import {
  isBugRecordingActiveAtom,
  bugRecordingStartedAtAtom,
  hasBugRecordingClipAtom,
  bugRecordingDurationAtom,
  bugRecordingOriginAtom,
} from "@/store/uiAtoms";
import {
  Bug,
  Lightbulb,
  Sparkles,
  MessageSquare,
  Send,
  CheckCircle2,
  Video,
  VideoOff,
  ShieldCheck,
  RefreshCw,
  Mail,
  Activity,
  Terminal,
  ExternalLink,
  ChevronRight,
  Info,
  Clock,
  Sparkle,
} from "lucide-react";
import {
  PageShell,
  SectionHeader,
  SegmentedControl,
  StatTile,
  ToneBadge,
  EmptyPanel,
  Switch,
  ListShell,
  ListRowText,
} from "../shared/primitives";
import { TILE, TILE_CARD, SEARCH_FIELD, CHIP } from "@/lib/uiTokens";
import {
  isPostHogConfigured,
  isPostHogConversationsAvailable,
  getPostHogConversations,
  sendPostHogSupportTicket,
  startPostHogSessionRecording,
  stopPostHogSessionRecording,
  isPostHogSessionRecordingActive,
  getPostHogSessionReplayUrl,
  getPostHogSessionId,
  getPostHogDistinctId,
  resolveCanonicalDistinctId,
  syncPostHogIdentityVerification,
  type PostHogConversationTicket,
  type PostHogConversationMessage,
} from "@/lib/posthog";
import { getActiveDisplayName, getActiveRegNumber } from "@/lib/activeIdentity";
import buildInfo from "@/data/buildInfo.json";

type ReportCategory = "bug" | "feature" | "experience" | "other";

const CATEGORIES: {
  id: ReportCategory;
  label: string;
  icon: typeof Bug;
  desc: string;
  badgeClass: string;
  tag: string;
}[] = [
  {
    id: "bug",
    label: "Bug Report",
    icon: Bug,
    desc: "Glitch, broken button, or calculation error",
    badgeClass: "text-rose-500 bg-rose-500/10 border-rose-500/20",
    tag: "Urgent Fix",
  },
  {
    id: "feature",
    label: "Feature Request",
    icon: Lightbulb,
    desc: "New tool ideas or workflow enhancements",
    badgeClass: "text-indigo-500 bg-indigo-500/10 border-indigo-500/20",
    tag: "Idea",
  },
  {
    id: "experience",
    label: "UI / UX Polish",
    icon: Sparkles,
    desc: "Haptics, themes, spacing, and animations",
    badgeClass: "text-amber-500 bg-amber-500/10 border-amber-500/20",
    tag: "Design",
  },
  {
    id: "other",
    label: "General Notes",
    icon: MessageSquare,
    desc: "Thoughts, suggestions, or quick questions",
    badgeClass: "text-emerald-500 bg-emerald-500/10 border-emerald-500/20",
    tag: "Feedback",
  },
];

const SEVERITIES = [
  { value: "minor", label: "Minor", desc: "Cosmetic or low impact" },
  { value: "normal", label: "Normal", desc: "Feature works with workaround" },
  { value: "critical", label: "Critical", desc: "Blocks normal app usage" },
];

export interface FeedbackReportPageProps {
  onBack?: () => void;
}

export default function FeedbackReportPage({ onBack }: FeedbackReportPageProps) {
  const [activeTab, setActiveTab] = useState<"report" | "tickets" | "diagnostics">("report");
  const [, startTransition] = useTransition();

  // Form state
  const [category, setCategory] = useState<ReportCategory>("bug");
  const [severity, setSeverity] = useState("normal");
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [stepsToReproduce, setStepsToReproduce] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [enableSessionRecording, setEnableSessionRecording] = useState(false);
  const [isRecordingLive, setIsRecordingLive] = useState(false);

  // Global bug reproduction recording state
  const [isBugRecordingActive, setIsBugRecordingActive] = useAtom(isBugRecordingActiveAtom);
  const [bugStartedAt, setBugStartedAt] = useAtom(bugRecordingStartedAtAtom);
  const [hasClip, setHasClip] = useAtom(hasBugRecordingClipAtom);
  const [clipDuration, setClipDuration] = useAtom(bugRecordingDurationAtom);
  const setOrigin = useSetAtom(bugRecordingOriginAtom);

  useEffect(() => {
    if (hasClip || isBugRecordingActive) {
      setEnableSessionRecording(true);
      setIsRecordingLive(isBugRecordingActive);
    }
  }, [hasClip, isBugRecordingActive]);

  // Submission state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submittedTicketId, setSubmittedTicketId] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Tickets / Conversations state
  const [tickets, setTickets] = useState<PostHogConversationTicket[]>([]);
  const [isLoadingTickets, setIsLoadingTickets] = useState(false);
  const [activeTicket, setActiveTicket] = useState<PostHogConversationTicket | null>(null);
  const [ticketMessages, setTicketMessages] = useState<PostHogConversationMessage[]>([]);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [replyMessage, setReplyMessage] = useState("");
  const [isSendingReply, setIsSendingReply] = useState(false);

  // System identities
  const userReg = useMemo(() => getActiveRegNumber() || "", []);
  const userName = useMemo(() => getActiveDisplayName() || "", []);
  const [distinctId, setDistinctId] = useState<string>(() => resolveCanonicalDistinctId());
  const [isIdentityVerified, setIsIdentityVerified] = useState(false);
  const sessionId = useMemo(() => getPostHogSessionId() || "none", []);

  // Persistent user email
  useEffect(() => {
    try {
      const saved = window.localStorage.getItem("amazecc_feedback_email");
      if (saved && !contactEmail) {
        setContactEmail(saved);
      }
    } catch {}
  }, []);

  const handleEmailChange = (val: string) => {
    setContactEmail(val);
    try {
      window.localStorage.setItem("amazecc_feedback_email", val.trim());
    } catch {}
  };

  // Sync canonical identity & HMAC verification
  useEffect(() => {
    const canonical = resolveCanonicalDistinctId();
    setDistinctId(canonical);
    syncPostHogIdentityVerification(canonical).then((hash) => {
      if (hash) setIsIdentityVerified(true);
    });
  }, [userReg]);

  // Sync session recording status
  useEffect(() => {
    setIsRecordingLive(isPostHogSessionRecordingActive());
  }, []);

  // Local ticket cache helpers
  const LOCAL_TICKETS_KEY = "amazecc_support_tickets";

  const getStoredTickets = (): PostHogConversationTicket[] => {
    if (typeof window === "undefined") return [];
    try {
      const raw = window.localStorage.getItem(LOCAL_TICKETS_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  };

  const saveStoredTickets = (newTickets: PostHogConversationTicket[]) => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(LOCAL_TICKETS_KEY, JSON.stringify(newTickets));
    } catch {}
  };

  // Live polling for developer replies while viewing an active ticket
  useEffect(() => {
    if (!activeTicket) return;
    const client = getPostHogConversations();
    if (!client || typeof client.getMessages !== "function") return;

    const interval = setInterval(async () => {
      try {
        const res: any = await client.getMessages(activeTicket.id);
        const msgs = Array.isArray(res)
          ? res
          : Array.isArray(res?.messages)
            ? res.messages
            : Array.isArray(res?.results)
              ? res.results
              : [];
        if (msgs.length > 0) {
          setTicketMessages(msgs);
        }
      } catch (err) {
        console.debug("[PostHog live polling]", err);
      }
    }, 4000);

    return () => clearInterval(interval);
  }, [activeTicket]);

  const startReproductionRecording = () => {
    setOrigin("page");
    const started = startPostHogSessionRecording();
    setIsRecordingLive(started || true);
    setEnableSessionRecording(true);
    setIsBugRecordingActive(true);
    setBugStartedAt(Date.now());
    setHasClip(false);
  };

  const finishReproductionRecording = () => {
    stopPostHogSessionRecording();
    const elapsed = bugStartedAt ? Math.max(1, Math.floor((Date.now() - bugStartedAt) / 1000)) : 1;
    setClipDuration(elapsed);
    setHasClip(true);
    setIsRecordingLive(false);
    setIsBugRecordingActive(false);
    setBugStartedAt(null);
    setEnableSessionRecording(true);
  };

  const discardReproductionClip = () => {
    stopPostHogSessionRecording();
    setHasClip(false);
    setClipDuration(0);
    setIsRecordingLive(false);
    setIsBugRecordingActive(false);
    setBugStartedAt(null);
    setEnableSessionRecording(false);
  };

  const handleToggleRecording = (checked: boolean) => {
    setEnableSessionRecording(checked);
    if (checked) {
      startReproductionRecording();
    } else {
      discardReproductionClip();
    }
  };

  // Fetch tickets if Support Conversations is available
  const loadTickets = async () => {
    setIsLoadingTickets(true);
    const local = getStoredTickets();
    const client = getPostHogConversations();

    if (client && typeof client.getTickets === "function") {
      try {
        const res: any = await client.getTickets();
        const remoteList: PostHogConversationTicket[] = Array.isArray(res)
          ? res
          : Array.isArray(res?.tickets)
            ? res.tickets
            : Array.isArray(res?.results)
              ? res.results
              : [];

        // Merge remote + local (remote wins on status, local ensures newly submitted tickets aren't missing)
        const ticketMap = new Map<string, PostHogConversationTicket>();
        local.forEach((t) => ticketMap.set(String(t.id), t));
        remoteList.forEach((t) => ticketMap.set(String(t.id), { ...ticketMap.get(String(t.id)), ...t }));

        const merged = Array.from(ticketMap.values()).sort(
          (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
        );

        setTickets(merged);
        saveStoredTickets(merged);
      } catch (err) {
        console.debug("[PostHog getTickets]", err);
        setTickets(local);
      }
    } else {
      setTickets(local);
    }
    setIsLoadingTickets(false);
  };

  useEffect(() => {
    if (activeTab === "tickets") {
      loadTickets();
    }
  }, [activeTab]);

  // Load messages for a ticket
  const openTicketThread = async (ticket: PostHogConversationTicket) => {
    setActiveTicket(ticket);
    setIsLoadingMessages(true);
    const client = getPostHogConversations();
    if (client && typeof client.getMessages === "function") {
      try {
        const res: any = await client.getMessages(ticket.id);
        const msgs = Array.isArray(res)
          ? res
          : Array.isArray(res?.messages)
            ? res.messages
            : Array.isArray(res?.results)
              ? res.results
              : [];
        setTicketMessages(msgs);
        client.markAsRead?.(ticket.id);
      } catch (err) {
        console.debug("[PostHog getMessages]", err);
      }
    }
    setIsLoadingMessages(false);
  };

  const handleSendReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!replyMessage.trim() || !activeTicket || isSendingReply) return;

    setIsSendingReply(true);
    const client = getPostHogConversations();
    if (client && typeof client.sendMessage === "function") {
      try {
        await client.sendMessage(
          replyMessage.trim(),
          {
            name: userName || userReg || "Student",
            ticket_id: activeTicket.id,
          },
          false,
        );
        setReplyMessage("");
        // Reload messages
        const res = await client.getMessages(activeTicket.id);
        setTicketMessages(res.messages || []);
      } catch (err) {
        console.error("[PostHog send reply]", err);
      }
    }
    setIsSendingReply(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!description.trim() || isSubmitting) return;

    setIsSubmitting(true);
    setSubmitError(null);

    const fullMessage = [
      subject.trim() ? `**Subject**: ${subject.trim()}` : "",
      `**Category**: ${category.toUpperCase()}`,
      `**Severity**: ${severity}`,
      `**Description**: ${description.trim()}`,
      stepsToReproduce.trim() ? `**Steps to Reproduce**:\n${stepsToReproduce.trim()}` : "",
      userReg ? `**Student Reg**: ${userReg}` : "",
      `**Commit**: ${buildInfo.commitHash || "latest"}`,
    ]
      .filter(Boolean)
      .join("\n\n");

    try {
      const result = await sendPostHogSupportTicket({
        message: fullMessage,
        category,
        contact: contactEmail.trim() || undefined,
        name: userName || userReg || undefined,
        includeSessionRecording: enableSessionRecording,
        metadata: {
          subject: subject.trim() || `${category.toUpperCase()} Report`,
          severity,
          steps_to_reproduce: stepsToReproduce.trim(),
          app_version: buildInfo.commitHash,
          url: typeof window !== "undefined" ? window.location.href : "",
          user_agent: typeof navigator !== "undefined" ? navigator.userAgent : "",
          session_id: sessionId,
          distinct_id: distinctId,
          replay_url: getPostHogSessionReplayUrl(),
          contact_email: contactEmail.trim() || undefined,
        },
      });

      if (result.success) {
        if (contactEmail.trim()) {
          try {
            window.localStorage.setItem("amazecc_feedback_email", contactEmail.trim());
          } catch {}
        }
        if (result.ticketId) {
          const newTicket: PostHogConversationTicket = {
            id: result.ticketId,
            subject: subject.trim() || `${category.toUpperCase()} Report`,
            status: "open",
            created_at: new Date().toISOString(),
            last_message: description.trim(),
          };
          const updated = [newTicket, ...getStoredTickets().filter((t) => String(t.id) !== String(result.ticketId))];
          saveStoredTickets(updated);
          setTickets(updated);
        }
        stopPostHogSessionRecording();
        setIsRecordingLive(false);
        setEnableSessionRecording(false);
        setIsBugRecordingActive(false);
        setHasClip(false);
        setClipDuration(0);
        setBugStartedAt(null);
        setSubmitSuccess(true);
        setSubmittedTicketId(result.ticketId || null);
      } else {
        setSubmitError("Failed to dispatch feedback. Check your network connection and PostHog settings.");
      }
    } catch (err: any) {
      setSubmitError(err?.message || "An unexpected error occurred while communicating with PostHog.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResetForm = () => {
    setSubmitSuccess(false);
    setSubmittedTicketId(null);
    setSubject("");
    setDescription("");
    setStepsToReproduce("");
    setCategory("bug");
    setSeverity("normal");
  };

  return (
    <PageShell
      eyebrow={
        <span className="inline-flex items-center gap-2">
          <span>AmazeCC Support</span>
          <span className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
          <span className="text-indigo-600 dark:text-indigo-400 font-bold">PostHog Analytics</span>
        </span>
      }
      title="Feedback and Bug Report"
      subtitle="Report glitches, share feature requests, and converse directly with developer tickets."
      onBack={onBack}
      actions={
        <div className="flex items-center gap-2">
          {isRecordingLive && (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-rose-500/10 text-rose-500 border border-rose-500/20 animate-pulse">
              <span className="w-2 h-2 rounded-full bg-rose-500" />
              DOM Recording Active
            </span>
          )}
          <ToneBadge tone="indigo">PostHog Support</ToneBadge>
        </div>
      }
    >
      <div className="space-y-6">
        {/* Navigation Tabs */}
        <div className="flex justify-center sm:justify-start">
          <SegmentedControl
            options={[
              { value: "report", label: "New Report" },
              { value: "tickets", label: "My Tickets & Support" },
              { value: "diagnostics", label: "PostHog Diagnostics" },
            ]}
            value={activeTab}
            onChange={(tab) => startTransition(() => setActiveTab(tab))}
          />
        </div>

        {/* ── TAB 1: NEW REPORT ── */}
        {activeTab === "report" && (
          <div className="space-y-6">
            {submitSuccess ? (
              <div className={`${TILE_CARD} text-center py-10 space-y-4`}>
                <div className="w-16 h-16 mx-auto rounded-full bg-emerald-500/10 text-emerald-500 flex items-center justify-center">
                  <CheckCircle2 className="w-10 h-10 animate-in zoom-in-75 duration-200" />
                </div>
                <div className="space-y-1.5 max-w-md mx-auto">
                  <h3 className="text-lg font-bold text-text-primary">Report Dispatched to PostHog</h3>
                  <p className="text-xs text-text-muted leading-relaxed">
                    Your feedback and session metrics were securely delivered to our PostHog Support channel.
                    {submittedTicketId && (
                      <span className="block mt-2 font-mono font-semibold text-indigo-500 text-[11px]">
                        Ticket ID: #{submittedTicketId}
                      </span>
                    )}
                  </p>
                </div>
                <div className="pt-2 flex justify-center gap-3">
                  <button
                    type="button"
                    onClick={handleResetForm}
                    className="px-4 py-2 rounded-xl border border-border-muted hover:bg-surface-secondary text-xs font-bold text-text-primary transition-colors cursor-pointer"
                  >
                    Submit Another Note
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab("tickets")}
                    className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition-transform active:scale-95 cursor-pointer shadow-xs"
                  >
                    View Developer Tickets
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-6">
                {/* Category selector */}
                <div className="space-y-2">
                  <SectionHeader title="What are you submitting?" />
                  <p className="text-xs text-text-muted px-1">
                    Select a category so we can route it to the right developer inbox
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                    {CATEGORIES.map((cat) => {
                      const Icon = cat.icon;
                      const isSelected = category === cat.id;
                      return (
                        <button
                          key={cat.id}
                          type="button"
                          onClick={() => setCategory(cat.id)}
                          className={`p-3.5 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                            isSelected
                              ? "border-indigo-500/80 bg-indigo-500/5 ring-2 ring-indigo-500/20 shadow-xs"
                              : "border-border-strong dark:border-border bg-surface-secondary/40 hover:bg-surface-secondary"
                          }`}
                        >
                          <div className="flex items-center justify-between mb-2">
                            <div className={`p-2 rounded-xl ${cat.badgeClass}`}>
                              <Icon className="w-4 h-4" />
                            </div>
                            <span className="text-[10px] font-extrabold uppercase px-1.5 py-0.5 rounded bg-surface-tertiary text-text-muted border border-border-muted">
                              {cat.tag}
                            </span>
                          </div>
                          <div>
                            <span className="text-xs font-bold text-text-primary block">{cat.label}</span>
                            <span className="text-[11px] text-text-muted leading-tight mt-0.5 block">{cat.desc}</span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Bug Specific Severity */}
                {category === "bug" && (
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-text-muted uppercase tracking-wider block">
                      Severity Level
                    </label>
                    <div className="grid grid-cols-3 gap-2">
                      {SEVERITIES.map((s) => (
                        <button
                          key={s.value}
                          type="button"
                          onClick={() => setSeverity(s.value)}
                          className={`py-2 px-3 rounded-xl border text-center transition-all cursor-pointer ${
                            severity === s.value
                              ? "border-rose-500/70 bg-rose-500/10 text-rose-600 dark:text-rose-400 font-bold"
                              : "border-border-muted bg-surface-secondary/40 text-text-secondary text-xs"
                          }`}
                        >
                          <div className="text-xs">{s.label}</div>
                          <div className="text-[10px] text-text-muted opacity-80 hidden sm:block">{s.desc}</div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Form Inputs */}
                <div className={`${TILE_CARD} space-y-4`}>
                  <div>
                    <label className="block text-xs font-bold text-text-primary mb-1">
                      Title / Headline <span className="text-text-muted font-normal">(Optional)</span>
                    </label>
                    <input
                      type="text"
                      value={subject}
                      onChange={(e) => setSubject(e.target.value)}
                      placeholder={
                        category === "bug"
                          ? "e.g. Schedule clashes not showing on Safari"
                          : "e.g. Add dark mode toggle to Paper Scanner"
                      }
                      className={SEARCH_FIELD}
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-text-primary mb-1">
                      Detailed Description <span className="text-rose-500">*</span>
                    </label>
                    <textarea
                      required
                      rows={4}
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder={
                        category === "bug"
                          ? "Explain what went wrong, which button you clicked, and what you expected to see..."
                          : "Describe your idea and how it will improve your day at VIT..."
                      }
                      className="w-full px-4 py-3 rounded-2xl bg-surface dark:bg-surface-secondary border border-border-strong dark:border-border text-xs sm:text-sm font-medium text-text-heading placeholder:text-text-muted focus:outline-none focus:border-border-strong"
                    />
                  </div>

                  {category === "bug" && (
                    <div>
                      <label className="block text-xs font-bold text-text-primary mb-1">
                        Steps to Reproduce <span className="text-text-muted font-normal">(Optional)</span>
                      </label>
                      <textarea
                        rows={2}
                        value={stepsToReproduce}
                        onChange={(e) => setStepsToReproduce(e.target.value)}
                        placeholder="1. Go to Academics Tab&#10;2. Click on Grades&#10;3. Click Export to PDF"
                        className="w-full px-4 py-2.5 rounded-2xl bg-surface dark:bg-surface-secondary border border-border-strong dark:border-border text-xs font-mono text-text-heading placeholder:text-text-muted focus:outline-none focus:border-border-strong"
                      />
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                    <div>
                      <label className="block text-xs font-bold text-text-primary mb-1">
                        Personal Email{" "}
                        <span className="text-text-muted font-normal">(Optional, for developer replies)</span>
                      </label>
                      <input
                        type="email"
                        value={contactEmail}
                        onChange={(e) => handleEmailChange(e.target.value)}
                        placeholder="your.personal.email@gmail.com"
                        className={SEARCH_FIELD}
                      />
                      <p className="text-[10px] text-text-muted mt-1 leading-tight">
                        Developer replies from the PostHog dashboard will be delivered to this email and synced in-app.
                      </p>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-text-primary mb-1">Author Identifier</label>
                      <div className="px-4 py-2.5 rounded-2xl bg-surface-secondary/50 border border-border-muted text-xs font-mono text-text-muted flex items-center justify-between">
                        <span className="font-bold text-text-primary">{distinctId}</span>
                        <ToneBadge tone={isIdentityVerified ? "emerald" : "indigo"}>
                          {isIdentityVerified ? "Verified HMAC" : userReg ? "Reg Number" : "Guest"}
                        </ToneBadge>
                      </div>
                    </div>
                  </div>
                </div>

                {/* ── SESSION RECORDING SECTION ── */}
                <div className={`${TILE_CARD} border-indigo-500/30 bg-indigo-500/5 space-y-3`}>
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3">
                      <div className="p-2.5 rounded-xl bg-indigo-500/10 text-indigo-500 shrink-0 mt-0.5">
                        {isRecordingLive ? (
                          <Video className="w-5 h-5 animate-pulse text-rose-500" />
                        ) : (
                          <VideoOff className="w-5 h-5" />
                        )}
                      </div>
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="text-xs sm:text-sm font-bold text-text-primary">
                            Attach Reactive DOM Session Recording
                          </span>
                          {isRecordingLive && (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-rose-500/10 text-rose-500 border border-rose-500/20 animate-pulse">
                              Recording Active
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-text-muted leading-relaxed">
                          The session recording will automatically take place within the reactive DOM of the app so your
                          phone is not overwhelmed by screen casting or video encoding. You can navigate anywhere in
                          AmazeCC to replicate the glitch. If you reload, it cancels.
                        </p>
                      </div>
                    </div>
                    <div className="shrink-0 pt-1">
                      <Switch
                        checked={enableSessionRecording}
                        onCheckedChange={handleToggleRecording}
                        label="Toggle reactive DOM session recording"
                      />
                    </div>
                  </div>

                  {/* Active Recording Notice */}
                  {isBugRecordingActive && (
                    <div className="p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/25 space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="relative flex h-2.5 w-2.5">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75" />
                            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-rose-500" />
                          </span>
                          <span className="text-xs font-bold text-rose-600 dark:text-rose-400">
                            Recording In Progress — Freely Navigate AmazeCC
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={finishReproductionRecording}
                          className="px-3 py-1 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition-all cursor-pointer shadow-xs"
                        >
                          Finish & Attach Clip
                        </button>
                      </div>
                      <p className="text-[11px] text-text-muted leading-relaxed">
                        A floating pill is pinned to the top of the app. Switch tabs, trigger the glitch, and tap
                        &quot;Finish &amp; Review&quot; anytime to return here.
                      </p>
                    </div>
                  )}

                  {/* Clip Attached Notice */}
                  {!isBugRecordingActive && hasClip && (
                    <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/25 space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                          <span className="text-xs font-bold text-emerald-700 dark:text-emerald-300">
                            Bug Reproduction Clip Attached ({clipDuration}s)
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={startReproductionRecording}
                            className="px-2.5 py-1 rounded-lg border border-border-muted bg-surface hover:bg-surface-secondary text-[11px] font-semibold text-text-primary cursor-pointer transition-colors"
                          >
                            Re-record
                          </button>
                          <button
                            type="button"
                            onClick={discardReproductionClip}
                            className="px-2.5 py-1 rounded-lg border border-rose-500/20 text-[11px] font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-500/10 cursor-pointer transition-colors"
                          >
                            Discard
                          </button>
                        </div>
                      </div>
                      <p className="text-[11px] text-text-muted leading-relaxed">
                        Your reproduction actions were captured in-session and will be attached to the developer ticket.
                      </p>
                    </div>
                  )}

                  {/* Trigger Action Button */}
                  {!isBugRecordingActive && !hasClip && (
                    <div className="pt-1">
                      <button
                        type="button"
                        onClick={startReproductionRecording}
                        className="w-full sm:w-auto px-4 py-2 rounded-xl bg-surface-tertiary hover:bg-border-muted border border-border-muted text-xs font-bold text-text-primary flex items-center justify-center gap-2 transition-all cursor-pointer active:scale-98"
                      >
                        <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-pulse" />
                        <span>Start Bug Reproduction Recording (Across App)</span>
                      </button>
                    </div>
                  )}

                  <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-start gap-2.5 text-amber-700 dark:text-amber-400">
                    <Info className="w-4 h-4 shrink-0 mt-0.5" />
                    <p className="text-[11px] leading-relaxed">
                      <strong>Privacy Notice:</strong> Because this captures live DOM mutations within the app to help
                      reproduce bugs, the recording may include personal data or grades rendered on screen during your
                      session. Passwords and sensitive inputs are masked by default.
                    </p>
                  </div>
                </div>

                {submitError && (
                  <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs font-semibold">
                    {submitError}
                  </div>
                )}

                {/* Submit button */}
                <div className="flex items-center justify-between gap-4 pt-2">
                  <div className="flex items-center gap-2 text-[11px] text-text-muted">
                    <ShieldCheck className="w-4 h-4 text-emerald-500" />
                    <span>Dispatched to PostHog EU/US Secure Ingestion</span>
                  </div>
                  <button
                    type="submit"
                    disabled={isSubmitting || !description.trim()}
                    className="flex items-center gap-2 px-6 py-3 rounded-2xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-bold text-xs sm:text-sm transition-all active:scale-[0.98] cursor-pointer shadow-md"
                  >
                    {isSubmitting ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        <span>Sending to PostHog...</span>
                      </>
                    ) : (
                      <>
                        <Send className="w-4 h-4" />
                        <span>Submit Report</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            )}
          </div>
        )}

        {/* ── TAB 2: MY TICKETS & CONVERSATIONS ── */}
        {activeTab === "tickets" && (
          <div className="space-y-5">
            {activeTicket ? (
              /* Active Ticket Detail View */
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => setActiveTicket(null)}
                    className="flex items-center gap-1.5 text-xs font-bold text-indigo-500 hover:text-indigo-600 cursor-pointer"
                  >
                    ← Back to All Tickets
                  </button>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => openTicketThread(activeTicket)}
                      className="p-1.5 rounded-lg border border-border-muted hover:bg-surface-secondary text-text-muted cursor-pointer transition-colors"
                      title="Refresh messages"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${isLoadingMessages ? "animate-spin" : ""}`} />
                    </button>
                    <ToneBadge tone={activeTicket.status === "closed" ? "slate" : "emerald"}>
                      {activeTicket.status.toUpperCase()}
                    </ToneBadge>
                  </div>
                </div>

                <div className={`${TILE_CARD} space-y-4`}>
                  <div className="border-b border-border-muted pb-3">
                    <h3 className="text-base font-bold text-text-primary">
                      {activeTicket.subject || `Ticket #${activeTicket.id}`}
                    </h3>
                    <p className="text-[11px] text-text-muted mt-0.5">
                      Created {new Date(activeTicket.created_at).toLocaleString()}
                    </p>
                  </div>

                  {/* Messages Thread */}
                  <div className="space-y-3 min-h-[160px] max-h-[360px] overflow-y-auto pr-1">
                    {isLoadingMessages ? (
                      <div className="py-8 text-center text-xs text-text-muted">Loading conversation...</div>
                    ) : ticketMessages.length === 0 ? (
                      <div className="py-8 text-center text-xs text-text-muted">No messages yet.</div>
                    ) : (
                      ticketMessages.map((msg) => (
                        <div
                          key={msg.id}
                          className={`p-3.5 rounded-2xl text-xs max-w-[85%] ${
                            msg.is_customer
                              ? "ml-auto bg-indigo-600 text-white rounded-br-xs"
                              : "mr-auto bg-surface-secondary text-text-primary border border-border-muted rounded-bl-xs"
                          }`}
                        >
                          <div className="text-[10px] font-bold opacity-75 mb-1">
                            {msg.is_customer ? "You" : msg.sender?.name || "PostHog Support Team"}
                          </div>
                          <div className="whitespace-pre-wrap leading-relaxed">{msg.content}</div>
                          <div className="text-[9px] opacity-60 text-right mt-1">
                            {new Date(msg.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                          </div>
                        </div>
                      ))
                    )}
                  </div>

                  {/* Reply form */}
                  <form onSubmit={handleSendReply} className="flex gap-2 pt-2 border-t border-border-muted">
                    <input
                      type="text"
                      value={replyMessage}
                      onChange={(e) => setReplyMessage(e.target.value)}
                      placeholder="Reply to the developers..."
                      className="flex-1 px-4 py-2.5 rounded-xl bg-surface dark:bg-surface-secondary border border-border-muted text-xs text-text-primary focus:outline-none"
                    />
                    <button
                      type="submit"
                      disabled={isSendingReply || !replyMessage.trim()}
                      className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs disabled:opacity-50 flex items-center gap-1.5 cursor-pointer"
                    >
                      {isSendingReply ? (
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Send className="w-3.5 h-3.5" />
                      )}
                      <span>Reply</span>
                    </button>
                  </form>
                </div>
              </div>
            ) : (
              /* Tickets List View */
              <div className="space-y-4">
                <SectionHeader
                  title="Developer Conversations"
                  right={
                    <button
                      type="button"
                      onClick={loadTickets}
                      className="p-2 rounded-xl border border-border-muted hover:bg-surface-secondary text-text-muted cursor-pointer"
                      title="Refresh tickets"
                    >
                      <RefreshCw className={`w-4 h-4 ${isLoadingTickets ? "animate-spin" : ""}`} />
                    </button>
                  }
                />

                {isLoadingTickets ? (
                  <div className="py-12 text-center text-xs text-text-muted">Checking PostHog tickets...</div>
                ) : tickets.length > 0 ? (
                  <ListShell>
                    {tickets.map((t) => (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => openTicketThread(t)}
                        className="w-full flex items-center justify-between py-3.5 px-4 text-left hover:bg-surface-secondary transition-colors cursor-pointer"
                      >
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-text-primary">
                              {t.subject || `Ticket #${t.id}`}
                            </span>
                            <ToneBadge tone={t.status === "closed" ? "slate" : "emerald"}>{t.status}</ToneBadge>
                          </div>
                          <p className="text-[11px] text-text-muted truncate max-w-md">
                            {t.last_message || "No recent messages"}
                          </p>
                        </div>
                        <ChevronRight className="w-4 h-4 text-text-muted" />
                      </button>
                    ))}
                  </ListShell>
                ) : (
                  <EmptyPanel
                    icon={<MessageSquare className="w-8 h-8 text-indigo-500" />}
                    title="No tickets yet"
                    description="Tickets you submit will sync here via the PostHog Conversations API."
                  />
                )}
              </div>
            )}
          </div>
        )}

        {/* ── TAB 3: POSTHOG DIAGNOSTICS & TELEMETRY ── */}
        {activeTab === "diagnostics" && (
          <div className="space-y-5">
            <SectionHeader title="PostHog Telemetry & Integration Engine" />
            <p className="text-xs text-text-muted px-1">
              Live insight into PostHog instrumentation, session replays, and identity verification.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
              <StatTile
                label="Conversations API"
                value={isPostHogConversationsAvailable() ? "Online" : "Fallback"}
                badge={isPostHogConversationsAvailable() ? "Direct API" : "Event Channel"}
                tone={isPostHogConversationsAvailable() ? "emerald" : "amber"}
              />
              <StatTile
                label="Reactive DOM Replay"
                value={isRecordingLive ? "Recording" : "Idle"}
                badge={isRecordingLive ? "Capturing" : "Opt-In"}
                tone={isRecordingLive ? "rose" : "slate"}
              />
              <StatTile label="Client SDK Version" value="posthog-js" badge="v1.445+" tone="indigo" />
              <StatTile
                label="Distinct Identity"
                value={isIdentityVerified ? "Verified HMAC" : userReg ? "Reg Number" : "Anonymous"}
                badge={distinctId}
                tone={isIdentityVerified ? "emerald" : "indigo"}
              />
            </div>

            <div className={`${TILE_CARD} space-y-4`}>
              <div className="flex items-center justify-between border-b border-border-muted pb-3">
                <div className="flex items-center gap-2">
                  <Terminal className="w-4 h-4 text-indigo-500" />
                  <h4 className="text-xs font-bold text-text-primary">Active PostHog Metadata</h4>
                </div>
                <ToneBadge tone="indigo">shoot.amazecc.com</ToneBadge>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 font-mono text-[11px]">
                <div className="p-3 rounded-xl bg-surface-secondary/50 border border-border-muted">
                  <span className="text-text-muted block mb-1">PostHog Distinct ID:</span>
                  <span className="text-text-primary font-bold select-all break-all">{distinctId}</span>
                </div>
                <div className="p-3 rounded-xl bg-surface-secondary/50 border border-border-muted">
                  <span className="text-text-muted block mb-1">Current Session ID:</span>
                  <span className="text-text-primary font-bold select-all break-all">{sessionId}</span>
                </div>
              </div>

              {/* Identity Verification Explanation */}
              <div className="p-4 rounded-xl bg-surface-secondary/40 border border-border-muted space-y-2">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-indigo-500" />
                  <span className="text-xs font-bold text-text-primary">Signed Token Identity Verification</span>
                </div>
                <p className="text-[11px] text-text-muted leading-relaxed">
                  PostHog Support provides server-side HMAC-SHA256 signature verification. When enabled, your student
                  identifier (<code>{distinctId}</code>) is signed with the PostHog identity secret so conversations and
                  bug tickets persist across multiple browsers, laptops, and mobile devices without manual email links.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </PageShell>
  );
}
