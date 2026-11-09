"use client";

import React, { useState, useEffect, useMemo, useTransition } from "react";
import { createPortal } from "react-dom";
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
  ChevronRight,
  ChevronLeft,
  ArrowRight,
  Info,
  Layers,
  Sparkle,
  FileText,
  Pencil,
  Maximize2,
  Minimize2,
  X,
} from "lucide-react";
import { AnimatePresence, m } from "framer-motion";
import {
  PageShell,
  SegmentedControl,
  ToneBadge,
  Switch,
  SectionHeader,
  ListShell,
  ListRowText,
  StatTile,
} from "../shared/primitives";
import { TILE_CARD, SEARCH_FIELD, LIST_ROW, TONE_ICON_TILE } from "@/lib/uiTokens";
import { useOverlayBack } from "@/lib/overlayStack";
import { acquireBodyScrollLock } from "@/lib/bodyScrollLock";
import { exitNativeFullscreen, requestNativeFullscreen } from "@/lib/fullscreen";
import {
  getPostHogConversations,
  sendPostHogSupportTicket,
  startPostHogSessionRecording,
  stopPostHogSessionRecording,
  isPostHogSessionRecordingActive,
  getPostHogSessionId,
  resolveCanonicalDistinctId,
  syncPostHogIdentityVerification,
  type PostHogConversationTicket,
  type PostHogConversationMessage,
} from "@/lib/posthog";
import { getActiveDisplayName, getActiveRegNumber } from "@/lib/social/identity";
import buildInfo from "@/data/buildInfo.json";

export type ReportCategory = "bug" | "feature" | "experience" | "other";

export const CATEGORIES: {
  id: ReportCategory;
  label: string;
  icon: typeof Bug;
  desc: string;
  badgeClass: string;
  tag: string;
  headlinePlaceholder: string;
  concernPlaceholder: string;
  promptTitle: string;
  promptSubtitle: string;
}[] = [
  {
    id: "bug",
    label: "Bug Report",
    icon: Bug,
    desc: "Glitch, broken button, or calculation error",
    badgeClass: "text-rose-500 bg-rose-500/10 border-rose-500/20",
    tag: "Urgent Fix",
    headlinePlaceholder: "e.g. Schedule clashes not showing on Safari",
    concernPlaceholder: "Explain what went wrong, which button you clicked, and what you expected to see...",
    promptTitle: "What glitch did you encounter?",
    promptSubtitle: "Explain where the app broke and how to reproduce it.",
  },
  {
    id: "feature",
    label: "Feature Request",
    icon: Lightbulb,
    desc: "New tool ideas or workflow enhancements",
    badgeClass: "text-indigo-500 bg-indigo-500/10 border-indigo-500/20",
    tag: "Idea",
    headlinePlaceholder: "e.g. Push notification when mess menu changes",
    concernPlaceholder: "Describe your idea and how it will improve your day at VIT...",
    promptTitle: "What feature would help you most?",
    promptSubtitle: "Share your vision for new features or student workflows.",
  },
  {
    id: "experience",
    label: "UI / UX Polish",
    icon: Sparkles,
    desc: "Haptics, themes, spacing, and animations",
    badgeClass: "text-amber-500 bg-amber-500/10 border-amber-500/20",
    tag: "Design",
    headlinePlaceholder: "e.g. High contrast mode for timetable grid",
    concernPlaceholder: "Tell us what could look sharper, smoother, or more comfortable...",
    promptTitle: "How can we refine the design?",
    promptSubtitle: "Give feedback on dark mode, layouts, animations, or readability.",
  },
  {
    id: "other",
    label: "General Notes",
    icon: MessageSquare,
    desc: "Thoughts, suggestions, or quick questions",
    badgeClass: "text-emerald-500 bg-emerald-500/10 border-emerald-500/20",
    tag: "Feedback",
    headlinePlaceholder: "e.g. Quick note for the team",
    concernPlaceholder: "Share your question, suggestion, or quick thought...",
    promptTitle: "What's on your mind?",
    promptSubtitle: "Send a direct message or inquiry to our development team.",
  },
];

const SEVERITIES = [
  { value: "minor", label: "Minor", desc: "Cosmetic or low impact" },
  { value: "normal", label: "Normal", desc: "Feature works with workaround" },
  { value: "critical", label: "Critical", desc: "Blocks normal app usage" },
];

export type FeedbackSubpage = "overview" | "report" | "tickets" | "diagnostics";

export interface FeedbackReportPageProps {
  onBack?: () => void;
  initialMode?: "guided" | "classic";
  initialCategory?: ReportCategory;
  initialStep?: 1 | 2 | 3 | 4;
  initialTab?: FeedbackSubpage;
}

export default function FeedbackReportPage({
  onBack,
  initialMode = "guided",
  initialCategory = "bug",
  initialStep = 1,
  initialTab,
}: FeedbackReportPageProps) {
  const [activeSubpage, setActiveSubpage] = useState<FeedbackSubpage>(
    initialTab || (initialCategory && initialCategory !== "bug" ? "report" : "overview"),
  );
  const [flowMode, setFlowMode] = useState<"guided" | "classic">(initialMode);
  const [guidedStep, setGuidedStep] = useState<1 | 2 | 3 | 4>(initialStep);
  const [, startTransition] = useTransition();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const [isNativeFullscreen, setIsNativeFullscreen] = useState(false);

  useOverlayBack("feedback-subpage", activeSubpage !== "overview", () => {
    exitNativeFullscreen().catch(() => {});
    setActiveSubpage("overview");
  });

  useEffect(() => {
    if (typeof document === "undefined") return;

    const handleFullscreenChange = () => {
      const docWithWebkit = document as Document & {
        webkitFullscreenElement?: Element | null;
      };
      setIsNativeFullscreen(Boolean(document.fullscreenElement || docWithWebkit.webkitFullscreenElement));
    };

    document.addEventListener("fullscreenchange", handleFullscreenChange);
    document.addEventListener("webkitfullscreenchange", handleFullscreenChange);

    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
      document.removeEventListener("webkitfullscreenchange", handleFullscreenChange);
    };
  }, []);

  const handleToggleFullScreen = async () => {
    if (isNativeFullscreen) {
      await exitNativeFullscreen();
    } else {
      await requestNativeFullscreen();
    }
  };

  useEffect(() => {
    if (activeSubpage === "report" && flowMode === "guided") {
      return acquireBodyScrollLock();
    }
  }, [activeSubpage, flowMode]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const params = new URLSearchParams(window.location.search);
      const cat = params.get("category");
      if (cat && (cat === "bug" || cat === "feature" || cat === "experience" || cat === "other")) {
        setCategory(cat as ReportCategory);
        setActiveSubpage("report");
      }
      const section = params.get("section");
      if (
        section &&
        (section === "report" || section === "tickets" || section === "diagnostics" || section === "overview")
      ) {
        setActiveSubpage(section as FeedbackSubpage);
      }
    } catch {}
  }, []);

  // Form state
  const [category, setCategory] = useState<ReportCategory>(initialCategory);
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

  // Load tickets whenever entering the tickets subpage
  useEffect(() => {
    if (activeSubpage === "tickets") {
      loadTickets();
    }
  }, [activeSubpage]);

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

        const mergedMap = new Map<string, PostHogConversationTicket>();
        for (const t of local) mergedMap.set(t.id, t);
        for (const t of remoteList) mergedMap.set(t.id, t);

        const merged = Array.from(mergedMap.values()).sort(
          (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
        );

        setTickets(merged);
        saveStoredTickets(merged);
      } catch (err) {
        console.warn("[PostHog getTickets]", err);
        setTickets(local);
      }
    } else {
      setTickets(local);
    }
    setIsLoadingTickets(false);
  };

  useEffect(() => {
    if (activeSubpage === "tickets") {
      loadTickets();
    }
  }, [activeSubpage]);

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
        if (typeof client.markAsRead === "function") {
          client.markAsRead(ticket.id).catch(() => {});
        }
      } catch (err) {
        console.warn("[PostHog getMessages]", err);
        setTicketMessages([
          {
            id: `local_${ticket.id}`,
            content: ticket.last_message || ticket.subject,
            created_at: ticket.created_at,
            is_customer: true,
          },
        ]);
      }
    } else {
      setTicketMessages([
        {
          id: `local_${ticket.id}`,
          content: ticket.last_message || ticket.subject,
          created_at: ticket.created_at,
          is_customer: true,
        },
      ]);
    }
    setIsLoadingMessages(false);
  };

  const handleSendReply = async () => {
    if (!replyMessage.trim() || !activeTicket) return;
    const client = getPostHogConversations();
    if (!client || typeof client.sendMessage !== "function") return;

    setIsSendingReply(true);
    try {
      await client.sendMessage(
        replyMessage.trim(),
        {
          ticket_id: activeTicket.id,
          distinct_id: distinctId,
          email: contactEmail.trim() || undefined,
        },
        false,
      );

      setTicketMessages((prev) => [
        ...prev,
        {
          id: `tmp_${Date.now()}`,
          content: replyMessage.trim(),
          created_at: new Date().toISOString(),
          is_customer: true,
        },
      ]);
      setReplyMessage("");
    } catch (err) {
      console.error("[PostHog sendReply]", err);
    } finally {
      setIsSendingReply(false);
    }
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!description.trim() || isSubmitting) return;

    setIsSubmitting(true);
    setSubmitError(null);

    try {
      const fullMessage = [
        subject.trim() ? `### ${subject.trim()}` : "",
        `**Category**: ${category.toUpperCase()}`,
        category === "bug" ? `**Severity**: ${severity.toUpperCase()}` : "",
        `**Concern**:\n${description.trim()}`,
        stepsToReproduce.trim() ? `**Steps to Reproduce**:\n${stepsToReproduce.trim()}` : "",
        contactEmail.trim() ? `**Contact Email**: ${contactEmail.trim()}` : "",
        `**Author**: ${userReg || "Anonymous"} (${userName || "Student"})`,
        `**App Session**: \`${sessionId}\``,
      ]
        .filter(Boolean)
        .join("\n\n");

      const result = await sendPostHogSupportTicket({
        category,
        message: fullMessage,
        contact: contactEmail.trim() || undefined,
        name: userName || userReg || undefined,
        includeSessionRecording: enableSessionRecording,
        metadata: {
          subject: subject.trim() || `${category.toUpperCase()} Report`,
          severity,
          has_clip: hasClip,
          clip_duration_s: clipDuration,
          author_reg: userReg,
          author_name: userName,
          session_id: sessionId,
          verified_hmac: isIdentityVerified,
        },
      });

      if (result.success) {
        if (result.ticketId) {
          const newTicket: PostHogConversationTicket = {
            id: result.ticketId,
            subject: subject.trim() || `${category.toUpperCase()}: ${description.slice(0, 30)}...`,
            status: "open",
            created_at: new Date().toISOString(),
            last_message: description.trim(),
          };
          const existing = getStoredTickets();
          saveStoredTickets([newTicket, ...existing]);
        }

        if (contactEmail.trim()) {
          try {
            window.localStorage.setItem("amazecc_feedback_email", contactEmail.trim());
          } catch {}
        }

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
    setGuidedStep(1);
  };

  const activeCatMeta = useMemo(() => {
    return CATEGORIES.find((c) => c.id === category) || CATEGORIES[0];
  }, [category]);

  const ActiveCatIcon = activeCatMeta.icon;

  if (activeSubpage === "overview") {
    return (
      <PageShell
        eyebrow={
          <span className="inline-flex items-center gap-2">
            <span>AmazeCC Support</span>
            <span className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
            <span className="text-indigo-600 dark:text-indigo-400 font-bold">PostHog Analytics</span>
          </span>
        }
        title="Feedback and Support"
        subtitle="Report glitches, share feature requests, or converse directly with developer tickets."
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
          {/* Stat Tiles mirroring CourseDetailSubpage overview */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <StatTile
              label="Support Channel"
              value="PostHog"
              sub="Direct developer desk (#712727)"
              tone="indigo"
              icon={<ShieldCheck className="w-4 h-4 text-indigo-500" />}
            />
            <StatTile
              label="My Support Tickets"
              value={tickets.length > 0 ? String(tickets.length) : "0"}
              sub={tickets.length > 0 ? "Active ticket discussions" : "No open tickets"}
              tone="amber"
              icon={<MessageSquare className="w-4 h-4 text-amber-500" />}
            />
            <StatTile
              label="Telemetry & Replay"
              value={isRecordingLive ? "Recording" : "Ready"}
              sub={isIdentityVerified ? "HMAC Verified distinct ID" : userReg ? `Reg ${userReg}` : "Guest distinct ID"}
              tone="emerald"
              icon={<CheckCircle2 className="w-4 h-4 text-emerald-500" />}
            />
          </div>

          {/* ── COURSE SUBPAGE GUIDELINE MENU (Joined Grouped List) ── */}
          <div className="space-y-3">
            <SectionHeader icon={Layers} title="Support Sections" count={3} />

            <ListShell>
              {/* Option 1: New Report */}
              <button
                type="button"
                onClick={() => {
                  setFlowMode("guided");
                  setActiveSubpage("report");
                  requestNativeFullscreen().catch(() => {});
                }}
                className={`${LIST_ROW} cursor-pointer group`}
              >
                <span
                  className={`h-10 w-10 shrink-0 rounded-2xl border flex items-center justify-center transition-transform group-hover:scale-105 ${TONE_ICON_TILE.indigo}`}
                >
                  <Send className="w-5 h-5" />
                </span>
                <ListRowText
                  title="New Report"
                  subtitle="Submit bug reports, feature requests, or UI polish directly to developers"
                />
                <span className="flex items-center gap-2 shrink-0">
                  <ToneBadge tone="indigo">Create</ToneBadge>
                  <ChevronRight className="w-4 h-4 text-zinc-400 group-hover:translate-x-0.5 transition-transform" />
                </span>
              </button>

              {/* Option 2: My Tickets & Support */}
              <button
                type="button"
                onClick={() => setActiveSubpage("tickets")}
                className={`${LIST_ROW} cursor-pointer group`}
              >
                <span
                  className={`h-10 w-10 shrink-0 rounded-2xl border flex items-center justify-center transition-transform group-hover:scale-105 ${TONE_ICON_TILE.amber}`}
                >
                  <MessageSquare className="w-5 h-5" />
                </span>
                <ListRowText
                  title="My Tickets & Support"
                  subtitle="View and converse directly with developers on your submitted tickets"
                />
                <span className="flex items-center gap-2 shrink-0">
                  {tickets.length > 0 ? (
                    <ToneBadge tone="amber">
                      {tickets.length} ticket{tickets.length === 1 ? "" : "s"}
                    </ToneBadge>
                  ) : (
                    <ToneBadge tone="zinc">Support Desk</ToneBadge>
                  )}
                  <ChevronRight className="w-4 h-4 text-zinc-400 group-hover:translate-x-0.5 transition-transform" />
                </span>
              </button>

              {/* Option 3: PostHog Diagnostics */}
              <button
                type="button"
                onClick={() => setActiveSubpage("diagnostics")}
                className={`${LIST_ROW} cursor-pointer group`}
              >
                <span
                  className={`h-10 w-10 shrink-0 rounded-2xl border flex items-center justify-center transition-transform group-hover:scale-105 ${TONE_ICON_TILE.emerald}`}
                >
                  <ShieldCheck className="w-5 h-5" />
                </span>
                <ListRowText
                  title="PostHog Diagnostics"
                  subtitle="Telemetry health, distinct ID verification, and DOM session replay"
                />
                <span className="flex items-center gap-2 shrink-0">
                  <ToneBadge tone="emerald">Connected</ToneBadge>
                  <ChevronRight className="w-4 h-4 text-zinc-400 group-hover:translate-x-0.5 transition-transform" />
                </span>
              </button>
            </ListShell>
          </div>
        </div>
      </PageShell>
    );
  }

  // ── SUBPAGE 1: NEW REPORT (GUIDED HERO MODE - TRUE FULL SCREEN LIKE ONBOARDING) ──
  if (activeSubpage === "report" && flowMode === "guided") {
    const heroContent = (
      <div
        data-testid="guided-hero-container"
        className="fixed inset-0 z-50 h-[100dvh] w-full bg-zinc-950 text-zinc-100 flex flex-col justify-between overflow-hidden select-none px-4 sm:px-8 pt-[calc(env(safe-area-inset-top,0px)+1rem)] pb-[calc(env(safe-area-inset-bottom,0px)+1rem)] sm:pt-[calc(env(safe-area-inset-top,0px)+1.5rem)] sm:pb-[calc(env(safe-area-inset-bottom,0px)+1.5rem)] animate-in fade-in duration-300"
      >
        {/* Background ambient lighting */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <div className="absolute -top-40 left-1/2 -translate-x-1/2 w-[550px] h-[550px] rounded-full bg-indigo-600/10 blur-[150px]" />
          <div className="absolute -bottom-40 left-1/2 -translate-x-1/2 w-[550px] h-[550px] rounded-full bg-violet-600/10 blur-[150px]" />
        </div>

        {/* ── TOP BAR: BACK BUTTON, PROGRESS PILLS & ACTIONS ── */}
        <header className="relative z-20 w-full max-w-2xl sm:max-w-3xl mx-auto flex items-center justify-between shrink-0 pt-1">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                exitNativeFullscreen().catch(() => {});
                setActiveSubpage("overview");
              }}
              className="flex items-center gap-1.5 text-xs font-bold text-zinc-400 hover:text-white transition-colors cursor-pointer py-1.5 px-3 rounded-xl bg-zinc-900/60 border border-zinc-800 backdrop-blur-md active:scale-95"
            >
              <ChevronLeft className="w-4 h-4" />
              <span>Support Sections</span>
            </button>
            <span className="text-xs font-black uppercase tracking-wider text-indigo-400 font-outfit">New Report</span>
          </div>

          {/* Step Indicator Pills (matching AmazeOnboardingFlow) */}
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5">
              {Array.from({ length: 4 }).map((_, i) => (
                <div
                  key={i}
                  className={`h-1.5 rounded-full transition-all duration-300 ${
                    i === guidedStep - 1
                      ? "w-7 bg-indigo-500 shadow-xs shadow-indigo-500/50"
                      : i < guidedStep - 1
                        ? "w-2.5 bg-indigo-400/50"
                        : "w-2 bg-zinc-800"
                  }`}
                />
              ))}
            </div>
            <span className="text-[11px] font-bold text-zinc-400 font-outfit hidden sm:inline">
              Step {guidedStep} of 4 ·{" "}
              {guidedStep === 1 ? "Category" : guidedStep === 2 ? "Concern" : guidedStep === 3 ? "Contact" : "Summary"}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 bg-zinc-900/60 p-1 rounded-2xl border border-zinc-800 backdrop-blur-md">
              <button
                type="button"
                onClick={() => setFlowMode("guided")}
                className="px-2.5 py-1 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 bg-indigo-600 text-white shadow-xs"
              >
                <Sparkle className="w-3.5 h-3.5" />
                <span>Guided Hero</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  exitNativeFullscreen().catch(() => {});
                  setFlowMode("classic");
                }}
                className="px-2.5 py-1 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 text-zinc-400 hover:text-white"
              >
                <Layers className="w-3.5 h-3.5" />
                <span>Classic Form</span>
              </button>
            </div>

            <button
              type="button"
              onClick={handleToggleFullScreen}
              title={isNativeFullscreen ? "Exit Fullscreen" : "Enter Fullscreen"}
              className="p-2 rounded-xl bg-zinc-900/60 border border-zinc-800 text-zinc-400 hover:text-white transition-colors cursor-pointer active:scale-95"
            >
              {isNativeFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </button>

            <button
              type="button"
              onClick={() => {
                exitNativeFullscreen().catch(() => {});
                setActiveSubpage("overview");
              }}
              title="Close"
              className="p-2 rounded-xl bg-zinc-900/60 border border-zinc-800 text-zinc-400 hover:text-white transition-colors cursor-pointer active:scale-95"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </header>

        {/* ── MAIN CONTENT (SPACIOUS & CENTERED, NOT WRAPPED IN AN EXTRA CARD BOX) ── */}
        <main className="relative z-20 w-full max-w-xl sm:max-w-2xl mx-auto flex-1 flex flex-col items-center justify-center my-auto min-h-0 overflow-y-auto py-3 px-1">
          {submitSuccess ? (
            <div className="my-auto w-full text-center space-y-4 py-4">
              <div className="w-16 h-16 mx-auto rounded-full bg-emerald-500/10 text-emerald-400 flex items-center justify-center border border-emerald-500/20 shadow-xl">
                <CheckCircle2 className="w-10 h-10 animate-in zoom-in-75 duration-200" />
              </div>
              <div className="space-y-1.5 max-w-md mx-auto">
                <h3 className="text-xl sm:text-2xl font-black text-white font-outfit">Report Dispatched to PostHog</h3>
                <p className="text-xs text-zinc-400 leading-relaxed">
                  Your feedback and session metrics were securely delivered to our PostHog Support channel.
                  {submittedTicketId && (
                    <span className="block mt-2 font-mono font-semibold text-indigo-400 text-xs bg-indigo-500/15 py-1.5 px-3 rounded-xl border border-indigo-500/30">
                      Ticket ID: #{submittedTicketId}
                    </span>
                  )}
                </p>
              </div>
              <div className="pt-4 flex flex-wrap justify-center gap-3">
                <button
                  type="button"
                  onClick={handleResetForm}
                  className="px-5 py-2.5 rounded-xl border border-zinc-800 hover:bg-zinc-850 text-xs font-bold text-zinc-200 transition-colors cursor-pointer"
                >
                  Submit Another Note
                </button>
                <button
                  type="button"
                  onClick={() => {
                    exitNativeFullscreen().catch(() => {});
                    setActiveSubpage("tickets");
                  }}
                  className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition-transform active:scale-95 cursor-pointer shadow-md"
                >
                  View Developer Tickets
                </button>
                <button
                  type="button"
                  onClick={() => {
                    exitNativeFullscreen().catch(() => {});
                    handleResetForm();
                    setActiveSubpage("overview");
                  }}
                  className="px-5 py-2.5 rounded-xl border border-zinc-800 hover:bg-zinc-850 text-xs font-bold text-zinc-200 transition-colors cursor-pointer"
                >
                  Back to Support Sections
                </button>
              </div>
            </div>
          ) : (
            <AnimatePresence mode="wait">
              {/* ── STEP 1: CATEGORY SELECTION MENU ── */}
              {guidedStep === 1 && (
                <m.div
                  key="step-1"
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -12 }}
                  transition={{ duration: 0.2 }}
                  className="my-auto w-full space-y-5 text-center"
                >
                  <div className="flex flex-col items-center gap-2">
                    <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-black uppercase tracking-wider bg-indigo-500/15 text-indigo-400 border border-indigo-500/30 font-outfit">
                      <Sparkle className="w-3.5 h-3.5" />
                      Guided Hero · Step 1
                    </div>
                    <h1 className="text-2xl sm:text-3xl font-black text-white font-outfit tracking-tight">
                      What would you like to share?
                    </h1>
                    <p className="text-xs sm:text-sm text-zinc-400 font-medium max-w-sm mx-auto">
                      Select a category below to open a focused, clean screen.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 w-full pt-1">
                    {CATEGORIES.map((cat) => {
                      const Icon = cat.icon;
                      const isSelected = category === cat.id;
                      return (
                        <button
                          key={cat.id}
                          type="button"
                          onClick={() => {
                            setCategory(cat.id);
                            setGuidedStep(2);
                          }}
                          className={`group p-4 sm:p-5 rounded-2xl border text-left transition-all cursor-pointer relative overflow-hidden flex flex-col justify-between min-h-[120px] backdrop-blur-md ${
                            isSelected
                              ? "border-indigo-500 bg-indigo-500/15 ring-2 ring-indigo-500/30 shadow-lg"
                              : "border-zinc-800/90 bg-zinc-900/60 hover:border-indigo-500/50 hover:bg-zinc-900/90 shadow-xs hover:shadow-lg hover:scale-[1.01] active:scale-[0.99]"
                          }`}
                        >
                          <div className="flex items-center justify-between w-full mb-2.5">
                            <div className={`p-2.5 rounded-xl ${cat.badgeClass}`}>
                              <Icon className="w-4.5 h-4.5" />
                            </div>
                            <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-300 border border-zinc-700/80 font-outfit">
                              {cat.tag}
                            </span>
                          </div>
                          <div>
                            <h3 className="text-sm sm:text-base font-black text-white font-outfit">{cat.label}</h3>
                            <p className="text-xs text-zinc-400 font-medium leading-relaxed mt-1">{cat.desc}</p>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </m.div>
              )}

              {/* ── STEP 2: CONCERN SCREEN ── */}
              {guidedStep === 2 && (
                <m.div
                  key="step-2"
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -12 }}
                  transition={{ duration: 0.2 }}
                  className="my-auto w-full space-y-4 sm:space-y-5"
                >
                  <div className="flex flex-col items-center text-center gap-2">
                    <div
                      className={`w-12 h-12 rounded-2xl flex items-center justify-center ${activeCatMeta.badgeClass} shadow-lg`}
                    >
                      <ActiveCatIcon className="w-6 h-6" />
                    </div>
                    <h2 className="text-2xl sm:text-3xl font-black text-white font-outfit tracking-tight">
                      {activeCatMeta.promptTitle}
                    </h2>
                    <p className="text-xs sm:text-sm text-zinc-400 font-medium max-w-sm mx-auto">
                      {activeCatMeta.promptSubtitle}
                    </p>
                  </div>

                  <div className="w-full space-y-3.5">
                    <div>
                      <label className="block text-xs font-bold text-zinc-300 mb-1.5">
                        Headline / Topic <span className="text-zinc-500 font-normal">(Optional)</span>
                      </label>
                      <input
                        type="text"
                        value={subject}
                        onChange={(e) => setSubject(e.target.value)}
                        placeholder={activeCatMeta.headlinePlaceholder}
                        className="w-full px-4 py-3 rounded-2xl bg-zinc-900/90 border border-zinc-800 text-white placeholder:text-zinc-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all text-sm font-medium"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-zinc-300 mb-1.5">
                        Detailed Concern <span className="text-rose-500">*</span>
                      </label>
                      <textarea
                        required
                        rows={5}
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        placeholder={activeCatMeta.concernPlaceholder}
                        className="w-full px-4 py-3.5 rounded-2xl bg-zinc-900/90 border border-zinc-800 text-sm font-medium text-white placeholder:text-zinc-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 transition-all leading-relaxed"
                      />
                    </div>

                    {category === "bug" && (
                      <div className="space-y-3 pt-1">
                        <div>
                          <label className="block text-xs font-bold text-zinc-300 mb-1.5">Severity Level</label>
                          <div className="grid grid-cols-3 gap-2">
                            {SEVERITIES.map((s) => (
                              <button
                                key={s.value}
                                type="button"
                                onClick={() => setSeverity(s.value)}
                                className={`py-2 px-3 rounded-xl border text-center transition-all cursor-pointer ${
                                  severity === s.value
                                    ? "border-rose-500 bg-rose-500/20 text-rose-300 font-bold shadow-xs"
                                    : "border-zinc-800 bg-zinc-900/60 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200 text-xs"
                                }`}
                              >
                                <div className="text-xs font-bold">{s.label}</div>
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* Reactive DOM recording toggle */}
                        <div className="p-3.5 rounded-2xl border border-indigo-500/30 bg-indigo-500/10 space-y-2">
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex items-start gap-3">
                              <div className="p-2 rounded-xl bg-indigo-500/20 text-indigo-400 shrink-0 mt-0.5">
                                {isRecordingLive ? (
                                  <Video className="w-4.5 h-4.5 animate-pulse text-rose-500" />
                                ) : (
                                  <VideoOff className="w-4.5 h-4.5" />
                                )}
                              </div>
                              <div className="space-y-1">
                                <div className="flex items-center gap-2">
                                  <span className="text-xs font-bold text-zinc-100">
                                    Attach Reactive DOM Session Recording
                                  </span>
                                  {isRecordingLive && (
                                    <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-rose-500/20 text-rose-400 border border-rose-500/30 animate-pulse">
                                      Active
                                    </span>
                                  )}
                                </div>
                                <p className="text-[11px] text-zinc-400 leading-relaxed">
                                  The session recording will automatically take place within the reactive DOM of the app
                                  so your phone is not overwhelmed by screen casting or video encoding. You can navigate
                                  anywhere in AmazeCC to replicate the glitch. If you reload, it cancels.
                                </p>
                                <p className="text-[10px] text-amber-400 font-medium">
                                  Note: the recording may include personal data or grades rendered on screen during your
                                  session. Passwords and sensitive inputs are masked by default.
                                </p>
                              </div>
                            </div>
                            <div className="shrink-0 pt-0.5">
                              <Switch
                                checked={enableSessionRecording}
                                onCheckedChange={handleToggleRecording}
                                label="Toggle reactive DOM session recording"
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </m.div>
              )}

              {/* ── STEP 3: CONTACT DETAILS ── */}
              {guidedStep === 3 && (
                <m.div
                  key="step-3"
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -12 }}
                  transition={{ duration: 0.2 }}
                  className="my-auto w-full space-y-4 sm:space-y-5"
                >
                  <div className="flex flex-col items-center text-center gap-2">
                    <div className="w-12 h-12 mx-auto rounded-2xl bg-indigo-500/15 border border-indigo-500/30 text-indigo-400 flex items-center justify-center shadow-lg">
                      <Mail className="w-6 h-6" />
                    </div>
                    <h2 className="text-2xl sm:text-3xl font-black text-white font-outfit tracking-tight">
                      Where Should We Reach You?
                    </h2>
                    <p className="text-xs sm:text-sm text-zinc-400 font-medium max-w-sm mx-auto">
                      Developer updates and support responses will be delivered straight to your personal inbox.
                    </p>
                  </div>

                  <div className="w-full space-y-3.5">
                    <div>
                      <label className="block text-xs font-bold text-zinc-300 mb-1.5">
                        Personal Email Address <span className="text-zinc-500 font-normal">(Optional)</span>
                      </label>
                      <div className="relative">
                        <Mail className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-500" />
                        <input
                          type="email"
                          value={contactEmail}
                          onChange={(e) => handleEmailChange(e.target.value)}
                          placeholder="your.personal.email@gmail.com"
                          className="w-full pl-10 pr-4 py-3 rounded-2xl bg-zinc-900/90 border border-zinc-800 text-sm font-medium text-white placeholder:text-zinc-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all"
                        />
                      </div>
                      <p className="text-[11px] text-zinc-400 mt-1 leading-relaxed">
                        Developer replies from the PostHog dashboard will be delivered to this email and synced in-app.
                      </p>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-zinc-300 mb-1.5">Author Identifier</label>
                      <div className="px-4 py-3 rounded-2xl bg-zinc-900/90 border border-zinc-800 text-xs font-mono text-zinc-300 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <ShieldCheck className="w-4 h-4 text-indigo-400" />
                          <span className="font-bold text-white">{distinctId}</span>
                        </div>
                        <ToneBadge tone={isIdentityVerified ? "emerald" : "indigo"}>
                          {isIdentityVerified ? "Verified HMAC" : userReg ? "Reg Number" : "Guest"}
                        </ToneBadge>
                      </div>
                    </div>

                    <div className="p-3.5 rounded-2xl bg-zinc-900/60 border border-zinc-800 flex items-start gap-2.5 text-xs text-zinc-400">
                      <Info className="w-4 h-4 shrink-0 text-indigo-400 mt-0.5" />
                      <p className="leading-relaxed">
                        On the next screen, you can review your complete submission summary and reproduction details
                        before sending anything to the engineering team.
                      </p>
                    </div>
                  </div>
                </m.div>
              )}

              {/* ── STEP 4: SUBMISSION SUMMARY ── */}
              {guidedStep === 4 && (
                <m.div
                  key="step-4"
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -12 }}
                  transition={{ duration: 0.2 }}
                  className="my-auto w-full space-y-4"
                >
                  <div className="flex flex-col items-center text-center gap-2">
                    <div className="flex items-center justify-between w-full">
                      <button
                        type="button"
                        onClick={() => setGuidedStep(3)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-zinc-800 text-xs font-bold text-zinc-400 hover:text-white hover:bg-zinc-850 transition-colors cursor-pointer"
                      >
                        <ChevronLeft className="w-4 h-4" />
                        <span>Back to Contact</span>
                      </button>
                      <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-black uppercase tracking-wider bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 font-outfit">
                        Step 4 of 4 · Submission Summary
                      </div>
                    </div>

                    <div className="w-12 h-12 mx-auto rounded-2xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 flex items-center justify-center shadow-lg">
                      <FileText className="w-6 h-6" />
                    </div>
                    <h2 className="text-2xl sm:text-3xl font-black text-white font-outfit tracking-tight">
                      Review Your Submission
                    </h2>
                    <p className="text-xs sm:text-sm text-zinc-400 font-medium max-w-sm mx-auto">
                      Verify your report details and telemetry before dispatching to our developers.
                    </p>
                  </div>

                  {/* Stat Strip */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 w-full">
                    <div className="p-3 rounded-2xl bg-zinc-900/90 border border-zinc-800 text-center shadow-xs">
                      <div className="text-[10px] font-bold uppercase text-zinc-400 font-outfit">Category</div>
                      <div className="text-xs font-black text-white mt-0.5 truncate">{activeCatMeta.label}</div>
                    </div>
                    <div className="p-3 rounded-2xl bg-zinc-900/90 border border-zinc-800 text-center shadow-xs">
                      <div className="text-[10px] font-bold uppercase text-zinc-400 font-outfit">Severity</div>
                      <div
                        className={`text-xs font-black mt-0.5 ${category === "bug" ? "text-rose-400" : "text-white"}`}
                      >
                        {category === "bug" ? severity.toUpperCase() : "STANDARD"}
                      </div>
                    </div>
                    <div className="p-3 rounded-2xl bg-zinc-900/90 border border-zinc-800 text-center shadow-xs">
                      <div className="text-[10px] font-bold uppercase text-zinc-400 font-outfit">DOM Replay</div>
                      <div
                        className={`text-xs font-black mt-0.5 ${enableSessionRecording ? "text-rose-400" : "text-zinc-500"}`}
                      >
                        {enableSessionRecording ? "ATTACHED" : "NONE"}
                      </div>
                    </div>
                    <div className="p-3 rounded-2xl bg-zinc-900/90 border border-zinc-800 text-center shadow-xs">
                      <div className="text-[10px] font-bold uppercase text-zinc-400 font-outfit">Identity</div>
                      <div className="text-xs font-black text-indigo-400 mt-0.5 truncate">
                        {isIdentityVerified ? "VERIFIED" : userReg || "ANONYMOUS"}
                      </div>
                    </div>
                  </div>

                  {/* Detailed Summary */}
                  <div className="w-full bg-zinc-900/90 border border-zinc-800 shadow-xl rounded-2xl p-4 sm:p-5 divide-y divide-zinc-800 space-y-3.5">
                    {/* Section 1: Category & Severity */}
                    <div className="flex items-start justify-between gap-4 pb-3">
                      <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-xl ${activeCatMeta.badgeClass}`}>
                          <ActiveCatIcon className="w-4.5 h-4.5" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-black text-white font-outfit">{activeCatMeta.label}</span>
                            <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-300 border border-zinc-700 font-outfit">
                              {activeCatMeta.tag}
                            </span>
                            {category === "bug" && (
                              <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/30">
                                {severity}
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-zinc-400 mt-0.5">{activeCatMeta.desc}</p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setGuidedStep(1)}
                        className="inline-flex items-center gap-1 text-xs text-indigo-400 hover:text-indigo-300 hover:underline font-bold shrink-0 cursor-pointer"
                      >
                        <Pencil className="w-3 h-3" />
                        <span>Edit</span>
                      </button>
                    </div>

                    {/* Section 2: Concern Details */}
                    <div className="pt-3 space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-black uppercase tracking-wider text-zinc-400 font-outfit">
                          Report Concern
                        </span>
                        <button
                          type="button"
                          onClick={() => setGuidedStep(2)}
                          className="inline-flex items-center gap-1 text-xs text-indigo-400 hover:text-indigo-300 hover:underline font-bold cursor-pointer"
                        >
                          <Pencil className="w-3 h-3" />
                          <span>Edit</span>
                        </button>
                      </div>
                      {subject.trim() && <div className="text-sm font-bold text-white">{subject.trim()}</div>}
                      <div className="p-3.5 rounded-xl bg-zinc-950/70 border border-zinc-800 text-xs sm:text-sm text-zinc-100 font-medium leading-relaxed whitespace-pre-wrap">
                        {description}
                      </div>
                    </div>

                    {/* Section 3: Telemetry & Recording */}
                    <div className="pt-3 space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-black uppercase tracking-wider text-zinc-400 font-outfit">
                          Session Reproduction Telemetry
                        </span>
                        <button
                          type="button"
                          onClick={() => setGuidedStep(2)}
                          className="inline-flex items-center gap-1 text-xs text-indigo-400 hover:text-indigo-300 hover:underline font-bold cursor-pointer"
                        >
                          <Pencil className="w-3 h-3" />
                          <span>Edit</span>
                        </button>
                      </div>
                      {enableSessionRecording ? (
                        <div className="p-3 rounded-xl border border-rose-500/25 bg-rose-500/10 flex items-center justify-between">
                          <div className="flex items-center gap-2.5">
                            <div className="p-1.5 rounded-lg bg-rose-500/20 text-rose-400">
                              <Video className="w-4 h-4 animate-pulse" />
                            </div>
                            <div>
                              <div className="text-xs font-bold text-white">Reactive DOM Session Replay Attached</div>
                              <div className="text-[11px] text-zinc-400">
                                Safe in-DOM interaction replay will be sent with ticket
                              </div>
                            </div>
                          </div>
                          <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/30">
                            Active
                          </span>
                        </div>
                      ) : (
                        <div className="p-3 rounded-xl border border-zinc-800 bg-zinc-950/50 flex items-center justify-between">
                          <div className="flex items-center gap-2 text-xs text-zinc-400">
                            <VideoOff className="w-4 h-4" />
                            <span>No session recording attached</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => setGuidedStep(2)}
                            className="text-xs text-indigo-400 hover:underline font-bold"
                          >
                            Attach
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Section 4: Contact & Route */}
                    <div className="pt-3 space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-black uppercase tracking-wider text-zinc-400 font-outfit">
                          Contact & Destination
                        </span>
                        <button
                          type="button"
                          onClick={() => setGuidedStep(3)}
                          className="inline-flex items-center gap-1 text-xs text-indigo-400 hover:text-indigo-300 hover:underline font-bold cursor-pointer"
                        >
                          <Pencil className="w-3 h-3" />
                          <span>Edit</span>
                        </button>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                        <div className="p-2.5 rounded-xl bg-zinc-950/50 border border-zinc-800">
                          <span className="text-zinc-500 block text-[10px] uppercase font-bold">Email</span>
                          <span className="font-bold text-white truncate block mt-0.5">
                            {contactEmail.trim() || "In-app ticket updates only"}
                          </span>
                        </div>
                        <div className="p-2.5 rounded-xl bg-zinc-950/50 border border-zinc-800">
                          <span className="text-zinc-500 block text-[10px] uppercase font-bold">Destination</span>
                          <span className="font-bold text-indigo-400 truncate block mt-0.5">
                            PostHog Support Channel (#712727)
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {submitError && (
                    <div className="p-3.5 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs font-semibold">
                      {submitError}
                    </div>
                  )}
                </m.div>
              )}
            </AnimatePresence>
          )}
        </main>

        {/* ── FOOTER: BACK & PRIMARY ACTION BUTTONS (AmazeOnboardingFlow style) ── */}
        {!submitSuccess && (
          <footer className="relative z-20 w-full max-w-xl sm:max-w-2xl mx-auto flex items-center justify-between gap-3 shrink-0 pt-3 border-t border-zinc-800/80">
            {guidedStep > 1 ? (
              <button
                type="button"
                onClick={() => setGuidedStep((prev) => (prev > 1 ? ((prev - 1) as any) : 1))}
                className="flex items-center gap-1.5 text-xs font-bold text-zinc-400 hover:text-white transition-colors cursor-pointer py-3 px-4 rounded-2xl bg-zinc-900/80 border border-zinc-800 hover:bg-zinc-850 active:scale-95"
              >
                <ChevronLeft className="w-4 h-4" />
                <span>Back</span>
              </button>
            ) : (
              <div className="w-16" />
            )}

            {guidedStep === 1 ? (
              <span className="text-xs text-zinc-500 font-medium">Select a category above to proceed</span>
            ) : guidedStep === 2 ? (
              <button
                type="button"
                disabled={!description.trim()}
                onClick={() => setGuidedStep(3)}
                className="py-3 px-6 rounded-2xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs sm:text-sm font-black font-outfit tracking-wide shadow-xl transition-all active:scale-95 cursor-pointer flex items-center gap-2"
              >
                <span>Continue to Contact</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            ) : guidedStep === 3 ? (
              <button
                type="button"
                disabled={!description.trim()}
                onClick={() => setGuidedStep(4)}
                className="py-3 px-6 rounded-2xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs sm:text-sm font-black font-outfit tracking-wide shadow-xl transition-all active:scale-95 cursor-pointer flex items-center gap-2"
              >
                <span>Review Summary</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            ) : (
              <button
                type="button"
                disabled={isSubmitting || !description.trim()}
                onClick={() => handleSubmit()}
                className="py-3 px-8 rounded-2xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs sm:text-sm font-black font-outfit tracking-wide shadow-xl transition-all active:scale-95 cursor-pointer flex items-center gap-2"
              >
                {isSubmitting ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Sending to PostHog…</span>
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    <span>Submit Report</span>
                  </>
                )}
              </button>
            )}
          </footer>
        )}
      </div>
    );

    if (mounted && typeof document !== "undefined") {
      return createPortal(heroContent, document.body);
    }
    return heroContent;
  }

  // ── SUBPAGE 1: NEW REPORT (CLASSIC FORM MODE) ──
  if (activeSubpage === "report") {
    return (
      <PageShell
        eyebrow={
          <button
            type="button"
            onClick={() => setActiveSubpage("overview")}
            className="inline-flex items-center gap-1.5 text-xs font-bold text-text-muted hover:text-text-primary transition-colors cursor-pointer"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
            <span>Support Sections</span>
          </button>
        }
        title="New Report"
        subtitle="Submit a bug report, feature request, or UI polish directly to developers."
        onBack={() => setActiveSubpage("overview")}
        actions={
          !submitSuccess ? (
            <div className="flex items-center gap-1.5 bg-surface-secondary/70 p-1 rounded-2xl border border-border-muted">
              <button
                type="button"
                onClick={() => {
                  setFlowMode("guided");
                  requestNativeFullscreen().catch(() => {});
                }}
                className="px-3 py-1 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 text-text-muted hover:text-text-primary"
              >
                <Sparkle className="w-3.5 h-3.5" />
                <span>Guided Hero</span>
              </button>
              <button
                type="button"
                onClick={() => setFlowMode("classic")}
                className="px-3 py-1 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 bg-surface text-text-primary border border-border-muted shadow-xs"
              >
                <Layers className="w-3.5 h-3.5" />
                <span>Classic Form</span>
              </button>
            </div>
          ) : null
        }
      >
        <div className="space-y-6">
          {submitSuccess ? (
            <div
              className={`${TILE_CARD} text-center py-12 px-6 space-y-4 max-w-xl mx-auto rounded-3xl border border-emerald-500/30 bg-emerald-500/5 shadow-xl`}
            >
              <div className="w-16 h-16 mx-auto rounded-full bg-emerald-500/10 text-emerald-500 flex items-center justify-center border border-emerald-500/20">
                <CheckCircle2 className="w-10 h-10 animate-in zoom-in-75 duration-200" />
              </div>
              <div className="space-y-1.5 max-w-md mx-auto">
                <h3 className="text-xl font-black text-text-primary font-outfit">Report Dispatched to PostHog</h3>
                <p className="text-xs text-text-muted leading-relaxed">
                  Your feedback and session metrics were securely delivered to our PostHog Support channel.
                  {submittedTicketId && (
                    <span className="block mt-2 font-mono font-semibold text-indigo-500 text-xs bg-indigo-500/10 py-1.5 px-3 rounded-xl border border-indigo-500/20">
                      Ticket ID: #{submittedTicketId}
                    </span>
                  )}
                </p>
              </div>
              <div className="pt-4 flex flex-wrap justify-center gap-3">
                <button
                  type="button"
                  onClick={handleResetForm}
                  className="px-5 py-2.5 rounded-xl border border-border-muted hover:bg-surface-secondary text-xs font-bold text-text-primary transition-colors cursor-pointer"
                >
                  Submit Another Note
                </button>
                <button
                  type="button"
                  onClick={() => setActiveSubpage("tickets")}
                  className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition-transform active:scale-95 cursor-pointer shadow-md"
                >
                  View Developer Tickets
                </button>
                <button
                  type="button"
                  onClick={() => {
                    handleResetForm();
                    setActiveSubpage("overview");
                  }}
                  className="px-5 py-2.5 rounded-xl border border-border-muted hover:bg-surface-secondary text-xs font-bold text-text-primary transition-colors cursor-pointer"
                >
                  Back to Support Sections
                </button>
              </div>
            </div>
          ) : (
            /* ── CLASSIC ALL-IN-ONE FORM MODE ── */
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Category selector */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-bold text-text-primary font-outfit">Select Category</h3>
                    <p className="text-xs text-text-muted">
                      Select a category so we can route it to the right developer inbox
                    </p>
                  </div>
                </div>
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
                          <span className="text-[10px] font-extrabold uppercase px-1.5 py-0.5 rounded bg-surface-tertiary text-text-muted border border-border-muted font-outfit">
                            {cat.tag}
                          </span>
                        </div>
                        <div>
                          <span className="text-xs font-bold text-text-primary block font-outfit">{cat.label}</span>
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
                  <label className="text-xs font-bold text-text-muted uppercase tracking-wider block font-outfit">
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
                        <div className="text-xs font-bold">{s.label}</div>
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
                    placeholder={activeCatMeta.headlinePlaceholder}
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
                    placeholder={activeCatMeta.concernPlaceholder}
                    className="w-full px-4 py-3 rounded-2xl bg-surface dark:bg-surface-secondary border border-border-strong dark:border-border text-xs sm:text-sm font-medium text-text-heading placeholder:text-text-muted focus:outline-none focus:border-border-strong leading-relaxed"
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
      </PageShell>
    );
  }

  // ── SUBPAGE 2: MY TICKETS & SUPPORT ──
  if (activeSubpage === "tickets") {
    return (
      <PageShell
        eyebrow={
          <button
            type="button"
            onClick={() => setActiveSubpage("overview")}
            className="inline-flex items-center gap-1.5 text-xs font-bold text-text-muted hover:text-text-primary transition-colors cursor-pointer"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
            <span>Support Sections</span>
          </button>
        }
        title="My Tickets & Support"
        subtitle="View and converse directly with developers on your submitted tickets."
        onBack={() => setActiveSubpage("overview")}
        actions={
          <button
            type="button"
            onClick={() => {
              setFlowMode("guided");
              setActiveSubpage("report");
              requestNativeFullscreen().catch(() => {});
            }}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white transition-all active:scale-95 cursor-pointer shadow-xs"
          >
            <Send className="w-3.5 h-3.5" />
            <span>New Report</span>
          </button>
        }
      >
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
                  <h3 className="text-base font-bold text-text-primary font-outfit">
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
                        <div className="font-semibold mb-1 opacity-90 text-[11px]">
                          {msg.is_customer ? "You" : msg.sender?.name || "Support Team"}
                        </div>
                        <div className="whitespace-pre-wrap leading-relaxed">{msg.content}</div>
                        <div className="text-[10px] opacity-60 text-right mt-1.5">
                          {new Date(msg.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        </div>
                      </div>
                    ))
                  )}
                </div>

                {/* Reply Input */}
                <div className="pt-2 border-t border-border-muted flex gap-2">
                  <input
                    type="text"
                    value={replyMessage}
                    onChange={(e) => setReplyMessage(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        handleSendReply();
                      }
                    }}
                    placeholder="Type a reply to the developers..."
                    className={SEARCH_FIELD}
                  />
                  <button
                    type="button"
                    disabled={isSendingReply || !replyMessage.trim()}
                    onClick={handleSendReply}
                    className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs font-bold shrink-0 transition-transform active:scale-95 cursor-pointer shadow-xs"
                  >
                    {isSendingReply ? (
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Send className="w-3.5 h-3.5" />
                    )}
                  </button>
                </div>
              </div>
            </div>
          ) : (
            /* Ticket List View */
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-text-primary font-outfit">Past Support Requests</h3>
                  <p className="text-xs text-text-muted">
                    Support conversations from this device and your registration number
                  </p>
                </div>
                <button
                  type="button"
                  onClick={loadTickets}
                  className="p-2 rounded-xl border border-border-muted hover:bg-surface-secondary text-text-muted cursor-pointer transition-colors shadow-2xs"
                  title="Refresh tickets"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isLoadingTickets ? "animate-spin" : ""}`} />
                </button>
              </div>

              {isLoadingTickets ? (
                <div className="py-12 text-center text-xs text-text-muted">Loading your tickets from PostHog...</div>
              ) : tickets.length === 0 ? (
                <div className="py-12 text-center space-y-3 bg-surface-secondary/40 rounded-3xl border border-border-muted">
                  <MessageSquare className="w-8 h-8 text-text-muted mx-auto opacity-50" />
                  <div className="space-y-1">
                    <p className="text-xs font-bold text-text-primary font-outfit">No Support Tickets Yet</p>
                    <p className="text-[11px] text-text-muted max-w-xs mx-auto">
                      Submit a bug report or feature request in the &quot;New Report&quot; subpage to start a
                      conversation with developers.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="divide-y divide-border-muted rounded-2xl border border-border-strong dark:border-border overflow-hidden bg-surface dark:bg-surface-secondary">
                  {tickets.map((t) => (
                    <div
                      key={t.id}
                      onClick={() => openTicketThread(t)}
                      className="p-4 hover:bg-surface-tertiary transition-colors cursor-pointer flex items-center justify-between gap-4"
                    >
                      <div className="min-w-0 space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-xs text-text-primary truncate font-outfit">
                            {t.subject || `Ticket #${t.id}`}
                          </span>
                          <ToneBadge tone={t.status === "closed" ? "slate" : "emerald"}>
                            {t.status.toUpperCase()}
                          </ToneBadge>
                        </div>
                        {t.last_message && (
                          <p className="text-xs text-text-muted truncate max-w-md">{t.last_message}</p>
                        )}
                        <p className="text-[10px] text-text-muted opacity-80">
                          {new Date(t.created_at).toLocaleDateString()} at{" "}
                          {new Date(t.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        </p>
                      </div>
                      <div className="shrink-0 flex items-center gap-2">
                        <span className="text-xs font-bold text-indigo-500 hidden sm:inline">Open Thread</span>
                        <ChevronRight className="w-4 h-4 text-text-muted" />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </PageShell>
    );
  }

  // ── SUBPAGE 3: POSTHOG DIAGNOSTICS & TELEMETRY ──
  return (
    <PageShell
      eyebrow={
        <button
          type="button"
          onClick={() => setActiveSubpage("overview")}
          className="inline-flex items-center gap-1.5 text-xs font-bold text-text-muted hover:text-text-primary transition-colors cursor-pointer"
        >
          <ChevronLeft className="w-3.5 h-3.5" />
          <span>Support Sections</span>
        </button>
      }
      title="PostHog Diagnostics"
      subtitle="Inspect device session identifiers, HMAC cryptographic verification, and PostHog ingestion health."
      onBack={() => setActiveSubpage("overview")}
      actions={<ToneBadge tone="emerald">Connected</ToneBadge>}
    >
      <div className="space-y-5">
        <div>
          <h3 className="text-sm font-bold text-text-primary font-outfit">PostHog Diagnostics</h3>
          <p className="text-xs text-text-muted">
            Inspect device session identifiers, HMAC cryptographic verification, and PostHog ingestion health
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
          <div className="p-4 rounded-2xl border border-border-muted bg-surface dark:bg-surface-secondary space-y-1">
            <span className="text-[10px] font-black uppercase text-text-muted font-outfit">Active Distinct ID</span>
            <div className="font-mono text-xs font-bold text-text-primary truncate">{distinctId}</div>
          </div>
          <div className="p-4 rounded-2xl border border-border-muted bg-surface dark:bg-surface-secondary space-y-1">
            <span className="text-[10px] font-black uppercase text-text-muted font-outfit">Session ID</span>
            <div className="font-mono text-xs font-bold text-text-primary truncate">{sessionId}</div>
          </div>
          <div className="p-4 rounded-2xl border border-border-muted bg-surface dark:bg-surface-secondary space-y-1">
            <span className="text-[10px] font-black uppercase text-text-muted font-outfit">Identity Verification</span>
            <div className="font-semibold text-xs text-text-primary flex items-center gap-1.5">
              <span className={`w-2 h-2 rounded-full ${isIdentityVerified ? "bg-emerald-500" : "bg-indigo-500"}`} />
              <span>{isIdentityVerified ? "HMAC Signed" : "Device Canonical"}</span>
            </div>
          </div>
          <div className="p-4 rounded-2xl border border-border-muted bg-surface dark:bg-surface-secondary space-y-1">
            <span className="text-[10px] font-black uppercase text-text-muted font-outfit">Session Recorder</span>
            <div className="font-semibold text-xs text-text-primary flex items-center gap-1.5">
              <span
                className={`w-2 h-2 rounded-full ${isRecordingLive ? "bg-rose-500 animate-pulse" : "bg-zinc-400"}`}
              />
              <span>{isRecordingLive ? "Recording Active" : "On-Demand Standby"}</span>
            </div>
          </div>
        </div>

        <div className={`${TILE_CARD} space-y-4`}>
          <div className="flex items-center justify-between border-b border-border-muted pb-3">
            <h4 className="text-xs font-bold text-text-primary font-outfit">PostHog Telemetry & Integration Engine</h4>
            <ToneBadge tone="emerald">Active</ToneBadge>
          </div>

          <div className="space-y-3 text-xs text-text-muted">
            <div className="flex items-center justify-between py-1 border-b border-border-muted/50">
              <span>Reverse Proxy Endpoint</span>
              <span className="font-mono text-[11px] text-text-primary">shoot.amazecc.com</span>
            </div>
            <div className="flex items-center justify-between py-1 border-b border-border-muted/50">
              <span>Signed Token Identity Verification</span>
              <span className="font-mono text-[11px] text-text-primary">
                {isIdentityVerified ? "Active (HMAC-SHA256)" : "Client Mode"}
              </span>
            </div>
            <div className="flex items-center justify-between py-1 border-b border-border-muted/50">
              <span>Conversations Direct API</span>
              <span className="font-mono text-[11px] text-text-primary">posthog.conversations.sendMessage</span>
            </div>
            <div className="flex items-center justify-between py-1">
              <span>Current Project ID</span>
              <span className="font-mono text-[11px] text-text-primary">712727</span>
            </div>
          </div>
        </div>
      </div>
    </PageShell>
  );
}
