"use client";

/**
 * Friend Finder: Find classmates who share your sections.
 *
 * Sharing is VTOP-verified only: timetables are read from VTOP after
 * registration. Classmates can be browsed in two groupings: by class and by
 * friend. Drilling into a class shows faculty details, subject information,
 * faculty reviews, and classmates enrolled. Tapping a friend opens a bottom
 * sheet with their name, registration number, shared classes, and quick
 * drill-in to any shared class.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAtomValue, useSetAtom } from "jotai";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  BadgeCheck,
  BookOpen,
  Check,
  ChevronRight,
  Clock,
  Eye,
  EyeOff,
  GraduationCap,
  Link2,
  Loader2,
  LogIn,
  LogOut,
  MapPin,
  Pencil,
  RefreshCw,
  Share2,
  ShieldCheck,
  Sparkles,
  Star,
  UserRound,
  Users,
  UsersRound,
} from "lucide-react";
import { activeTabAtom, credentialsAtom, demoModeAtom, isLoggedInAtom } from "@/store";
import {
  callClassmates,
  classmatesSemester,
  ClassmatesError,
  displayName,
  ensureClassmatesSession,
  FRIEND_FINDER_REFRESH_EVENT,
  type ClassmateOverlap,
  type ClassmatePerson,
  type ClassmateSection,
  type ClassmatesRequest,
  type ClassmatesState,
} from "@/lib/ffcsClassmates";
import { GLOBAL_SEMESTER_CHANGE_EVENT } from "@/lib/ffcsReports";
import { storage } from "@/lib/storage";
import { hasStoredVtopCredentials } from "@/components/custom/app/readBootstrapSnapshot";
import { getAssetPath } from "@/lib/utils";
import ThemeToggle from "@/components/custom/ThemeToggle";
import { GHOST_BUTTON, LIST_ROW, LIST_SHELL, TILE_CARD, TONE_ICON_TILE } from "@/lib/uiTokens";
import {
  ListSkeleton,
  PageShell,
  RadioGroup,
  SectionHeader,
  SegmentedControl,
  StatTile,
  Switch,
  ToneBadge,
} from "../shared/primitives";
import BottomSheet from "../shared/BottomSheet";
import FriendFinderLoginModal from "./FriendFinderLoginModal";
import { useFacultyReviewSheet } from "../exams/FFCS/hooks/useFacultyReviewSheet";
import FacultyReviewSheetHost from "../exams/FFCS/components/FacultyReviewSheetHost";

export interface FriendFinderTabProps {
  onBack?: () => void;
  semesterId?: string;
  standaloneLogo?: boolean;
  onRequestSignIn?: () => void;
}

const REGISTERED = "registered";
const CLASSMATES_PATH = "/?open=friend-finder";

const PRIMARY_BUTTON =
  "inline-flex items-center justify-center gap-2 rounded-2xl bg-indigo-500 hover:bg-indigo-600 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100 text-white font-bold px-5 py-3 text-sm shadow-lg shadow-indigo-500/20 transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 focus-visible:ring-offset-background";
const ACTION_BUTTON = `${GHOST_BUTTON} justify-center py-2.5 text-xs font-bold disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500`;

const AVATAR_TONES = ["indigo", "emerald", "amber", "violet", "sky", "red"] as const;

function initials(name: string): string {
  const parts = displayName(name).split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "") + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase() || "?";
}

function avatarTone(key: string): string {
  let hash = 0;
  for (const ch of key) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return TONE_ICON_TILE[AVATAR_TONES[hash % AVATAR_TONES.length]];
}

function Avatar({ person, size = "md" }: { person: Pick<ClassmatePerson, "handle" | "name">; size?: "sm" | "md" }) {
  const dims = size === "sm" ? "w-6 h-6 text-[10px]" : "w-10 h-10 text-sm";
  return (
    <span
      aria-hidden
      className={`${dims} ${avatarTone(person.handle)} rounded-full border flex items-center justify-center shrink-0 font-black font-outfit`}
    >
      {initials(person.name)}
    </span>
  );
}

function VerifiedTick({ className = "w-4 h-4" }: { className?: string }) {
  return <BadgeCheck className={`${className} text-emerald-500 shrink-0`} aria-label="Registered in VTOP" />;
}

function PersonChip({ person }: { person: ClassmatePerson }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-2xl border border-border-strong dark:border-border bg-surface pl-1 pr-2.5 py-1 text-xs font-semibold text-text-heading max-w-full">
      <Avatar person={person} size="sm" />
      <span className="truncate">
        {displayName(person.name) || person.handle}
        {person.regNo ? ` (${person.regNo})` : ""}
      </span>
      {person.source === "registered" ? <VerifiedTick className="w-3.5 h-3.5" /> : null}
    </span>
  );
}

function TrustPoints() {
  const points = [
    { Icon: ShieldCheck, tone: "emerald", text: "Signed in with VTOP, so nobody can join under your name." },
    { Icon: Eye, tone: "indigo", text: "Only people in at least one of your sections can see you." },
    { Icon: EyeOff, tone: "amber", text: "Hide or remove yourself whenever you like." },
  ] as const;
  return (
    <ul className="space-y-3">
      {points.map(({ Icon, tone, text }) => (
        <li key={text} className="flex items-start gap-3">
          <span
            className={`w-8 h-8 rounded-xl border flex items-center justify-center shrink-0 ${TONE_ICON_TILE[tone]}`}
          >
            <Icon className="w-4 h-4" />
          </span>
          <span className="text-sm text-text-secondary dark:text-text-muted leading-snug pt-1.5">{text}</span>
        </li>
      ))}
      <li className="pt-1 text-xs text-muted-foreground pl-11">
        <Link
          href="/friend-finder/disclaimer"
          className="text-indigo-600 dark:text-indigo-400 underline hover:opacity-80 font-medium"
        >
          Read Sharing & Liability Disclaimer →
        </Link>
      </li>
    </ul>
  );
}

function Notice({
  tone = "red",
  children,
  action,
}: {
  tone?: "red" | "amber";
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  const palette =
    tone === "red"
      ? "border-red-500/25 bg-red-500/10 text-red-700 dark:text-red-300"
      : "border-amber-500/25 bg-amber-500/10 text-amber-800 dark:text-amber-200";
  return (
    <div
      role="alert"
      className={`flex flex-col sm:flex-row sm:items-center gap-3 rounded-2xl border px-4 py-3 ${palette}`}
    >
      <span className="flex items-start gap-2 text-sm font-medium flex-1 min-w-0">
        <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
        <span>{children}</span>
      </span>
      {action}
    </div>
  );
}

function InviteButton({ className = "" }: { className?: string }) {
  const [copied, setCopied] = useState(false);
  const invite = async () => {
    const url = `${window.location.origin}${CLASSMATES_PATH}`;
    const text = "See who shares your classes on AmazeCC";
    try {
      if (navigator.share) {
        await navigator.share({ title: "Find classmates", text, url });
        return;
      }
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // Share sheet dismissed, or clipboard blocked: nothing to undo.
    }
  };
  return (
    <button type="button" onClick={() => void invite()} className={`${ACTION_BUTTON} ${className}`}>
      {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Share2 className="w-3.5 h-3.5" />}
      {copied ? "Link copied" : "Invite friends"}
    </button>
  );
}

function SectionCard({ section, onClick }: { section: ClassmateSection; onClick?: () => void }) {
  const o = section.offering;
  const count = section.people.length;
  return (
    <div
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onClick={onClick}
      onKeyDown={(e) => {
        if (onClick && (e.key === "Enter" || e.key === " ")) {
          e.preventDefault();
          onClick();
        }
      }}
      className={`px-4 py-4 space-y-3 ${onClick ? "cursor-pointer hover:bg-zinc-50/70 dark:hover:bg-zinc-800/40 active:scale-[0.99] transition-all" : ""}`}
    >
      <div className="flex items-start gap-3">
        <span
          className={`w-10 h-10 rounded-xl border flex items-center justify-center shrink-0 ${TONE_ICON_TILE[count ? "indigo" : "zinc"]}`}
        >
          <BookOpen className="w-4 h-4" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <p className="text-sm font-bold text-text-heading leading-snug min-w-0">
              {o ? (
                <>
                  <span className="font-outfit font-black tracking-tight">{o.code}</span>
                  <span className="text-muted-foreground font-medium"> · </span>
                  {o.title.replace(/\s+-\s*|-\s+/g, "-")}
                </>
              ) : (
                section.classId
              )}
            </p>
            <div className="flex items-center gap-1.5 shrink-0">
              <ToneBadge size="sm" tone={count ? "indigo" : "zinc"}>
                {count ? `${count} ${count === 1 ? "classmate" : "classmates"}` : "No one yet"}
              </ToneBadge>
              {onClick && <ChevronRight className="w-4 h-4 text-zinc-400" />}
            </div>
          </div>
          {o ? (
            <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1">
                <Clock className="w-3 h-3" /> {o.slot}
              </span>
              <span className="inline-flex items-center gap-1 min-w-0">
                <UserRound className="w-3 h-3 shrink-0" />
                <span className="truncate">{displayName(o.faculty)}</span>
              </span>
              <span className="uppercase tracking-wide text-[10px] font-bold">{o.type}</span>
            </p>
          ) : null}
        </div>
      </div>
      {count ? (
        <div className="flex flex-wrap gap-1.5 sm:pl-[52px]">
          {section.people.map((p) => (
            <PersonChip key={p.handle} person={p} />
          ))}
        </div>
      ) : null}
    </div>
  );
}

/**
 * Friend Finder is exclusively for the upcoming next semester (CH20262705 / Winter 2026-27),
 * not the currently ongoing semester.
 */
export const UPCOMING_FFCS_SEMESTER = "CH20262705";

function getActiveVtopSemester(): string | null {
  return UPCOMING_FFCS_SEMESTER;
}

function AmazeCCLogoLeading() {
  return (
    <Link
      href="/"
      className="inline-flex items-center gap-2.5 group transition-transform active:scale-95 py-0.5"
      title="AmazeCC Home"
    >
      <img
        loading="lazy"
        decoding="async"
        src={getAssetPath("/favicon/FFCS.png")}
        alt="AmazeCC Friend Finder"
        className="h-8 w-8 rounded-xl object-contain shadow-xs border border-indigo-500/30 p-0.5 bg-white dark:bg-zinc-900"
      />
      <div className="flex items-center gap-2">
        <span className="text-base sm:text-lg font-black tracking-tight font-outfit text-zinc-900 dark:text-white">
          AmazeCC <span className="text-indigo-600 dark:text-indigo-400">Friend Finder</span>
        </span>
        <span className="hidden sm:inline-flex items-center text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 border border-indigo-500/20">
          Winter 26-27
        </span>
      </div>
    </Link>
  );
}

export default function FriendFinderTab({
  onBack,
  semesterId,
  standaloneLogo = false,
  onRequestSignIn,
}: FriendFinderTabProps = {}) {
  const router = useRouter();
  const setActiveTab = useSetAtom(activeTabAtom);
  const isLoggedIn = useAtomValue(isLoggedInAtom);
  const setIsLoggedIn = useSetAtom(isLoggedInAtom);
  const isDemo = useAtomValue(demoModeAtom);
  const setDemoMode = useSetAtom(demoModeAtom);
  const setIDs = useSetAtom(credentialsAtom);
  const [showLoginModal, setShowLoginModal] = useState(false);

  useEffect(() => {
    if (!isLoggedIn) {
      try {
        const idsRaw = storage.ids.get();
        const storedUsername = storage.username.get();
        const storedPassword = storage.password.get();
        const isDemoStored = storage.demoMode.get();
        const hasVtop = hasStoredVtopCredentials(idsRaw, storedUsername, storedPassword);

        if (hasVtop || isDemoStored) {
          setIsLoggedIn(true);
          setDemoMode(Boolean(isDemoStored));
          setIDs({
            VtopUsername: storedUsername || "",
            VtopPassword: storedPassword || "",
            MoodleUsername: storage.moodleUsername.get() || "",
            MoodlePassword: storage.moodlePassword.get() || "",
            ...(idsRaw || {}),
          });
        }
      } catch {}
    }
  }, [isLoggedIn, setIsLoggedIn, setDemoMode, setIDs]);

  const [derivedSemester, setDerivedSemester] = useState<string | null>(() => getActiveVtopSemester());
  const vtopSemester = semesterId !== undefined ? classmatesSemester(semesterId as any) : derivedSemester;
  const canUse = isLoggedIn && !isDemo && Boolean(vtopSemester);

  const [openedFromHome, setOpenedFromHome] = useState(false);
  const launchSourceRead = useRef(false);

  const [state, setState] = useState<ClassmatesState | null>(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<{ message: string; retry: ClassmatesRequest; needsSignIn: boolean } | null>(null);
  const [reauthing, setReauthing] = useState(false);
  const [editing, setEditing] = useState(false);
  const [confirmingRemove, setConfirmingRemove] = useState(false);

  const [grouping, setGrouping] = useState<"classes" | "friends">("classes");
  const [selectedClassId, setSelectedClassId] = useState<string | null>(null);
  const [selectedFriend, setSelectedFriend] = useState<ClassmateOverlap | null>(null);

  const { target: reviewTarget, open: openFacultyReview, close: closeFacultyReview } = useFacultyReviewSheet();

  useEffect(() => {
    if (launchSourceRead.current) return;
    launchSourceRead.current = true;
    try {
      if (window.localStorage.getItem("friend_finder_source") === "home") {
        setOpenedFromHome(true);
      }
    } catch {}
  }, []);

  useEffect(
    () => () => {
      try {
        window.localStorage.removeItem("friend_finder_source");
      } catch {}
    },
    [],
  );

  useEffect(() => {
    const handleGlobalChange = () => {
      const nextSem = getActiveVtopSemester();
      setDerivedSemester(nextSem);
    };
    window.addEventListener(GLOBAL_SEMESTER_CHANGE_EVENT, handleGlobalChange);
    window.addEventListener("storage", handleGlobalChange);
    return () => {
      window.removeEventListener(GLOBAL_SEMESTER_CHANGE_EVENT, handleGlobalChange);
      window.removeEventListener("storage", handleGlobalChange);
    };
  }, []);

  const run = useCallback(
    async (request: ClassmatesRequest, mode: "load" | "action") => {
      if (!vtopSemester) return;
      const setPending = mode === "load" ? setLoading : setBusy;
      setPending(true);
      setError(null);
      try {
        const next = await callClassmates(vtopSemester, request);
        setState(next);
        if (request.op === "publish" || request.op === "leave") {
          setEditing(false);
        }
      } catch (err) {
        setError({
          message: err instanceof ClassmatesError ? err.message : "Couldn't reach the friend finder. Try again.",
          retry: request,
          needsSignIn: err instanceof ClassmatesError && err.needsSignIn,
        });
      } finally {
        setPending(false);
        setConfirmingRemove(false);
      }
    },
    [vtopSemester],
  );

  useEffect(() => {
    if (canUse) void run({ op: "get" }, "load");
  }, [canUse, run]);

  useEffect(() => {
    const onRefresh = () => {
      if (!vtopSemester || !canUse) return;
      if (state?.me?.joined) {
        void callClassmates(vtopSemester, { op: "publish", source: "registered" })
          .then((next) => setState(next))
          .catch(() => {});
      } else {
        void callClassmates(vtopSemester, { op: "get" })
          .then((next) => setState(next))
          .catch(() => {});
      }
    };
    window.addEventListener(FRIEND_FINDER_REFRESH_EVENT, onRefresh);
    return () => window.removeEventListener(FRIEND_FINDER_REFRESH_EVENT, onRefresh);
  }, [vtopSemester, canUse, state?.me?.joined]);

  const codeOf = useMemo(() => {
    const m = new Map<string, string>();
    for (const s of state?.sections ?? []) if (s.offering) m.set(s.classId, s.offering.code);
    return m;
  }, [state]);

  const sortedSections = useMemo(
    () =>
      [...(state?.sections ?? [])].sort(
        (a, b) =>
          b.people.length - a.people.length ||
          (a.offering?.code ?? a.classId).localeCompare(b.offering?.code ?? b.classId),
      ),
    [state],
  );

  const selectedSection = useMemo(
    () => (selectedClassId ? (state?.sections.find((s) => s.classId === selectedClassId) ?? null) : null),
    [selectedClassId, state],
  );

  const handleBack = () => {
    if (selectedClassId) {
      setSelectedClassId(null);
      return;
    }
    if (onBack) {
      onBack();
      return;
    }
    if (openedFromHome) {
      setActiveTab("home");
    }
  };

  const reauthenticate = async (retry: ClassmatesRequest) => {
    setReauthing(true);
    try {
      await ensureClassmatesSession(true);
      await run(retry, retry.op === "get" ? "load" : "action");
    } catch {
      router.push("/?signin=1&open=friend-finder");
    } finally {
      setReauthing(false);
    }
  };

  const errorAction = (e: NonNullable<typeof error>) =>
    e.needsSignIn ? (
      <button
        type="button"
        className={`${ACTION_BUTTON} !bg-indigo-500 !text-white hover:!bg-indigo-600`}
        disabled={reauthing}
        onClick={() => void reauthenticate(e.retry)}
      >
        {reauthing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <LogIn className="w-3.5 h-3.5" />}
        {reauthing ? "Signing in…" : "Sign in again"}
      </button>
    ) : e.retry.op === "get" ? (
      <button type="button" className={ACTION_BUTTON} onClick={() => void run(e.retry, "load")}>
        <RefreshCw className="w-3.5 h-3.5" /> Try again
      </button>
    ) : undefined;

  /* ── Signed out / demo ─────────────────────────────────────────── */
  if (!isLoggedIn || isDemo) {
    return (
      <PageShell
        leading={standaloneLogo ? <AmazeCCLogoLeading /> : undefined}
        onBack={standaloneLogo ? undefined : (onBack ?? (openedFromHome ? () => setActiveTab("home") : undefined))}
        actions={standaloneLogo ? <ThemeToggle /> : undefined}
        eyebrow="Friend Finder"
        title="Find classmates"
        subtitle="See who picked the same sections as you"
      >
        <div className={`${TILE_CARD} max-w-xl mx-auto`}>
          <div className="flex flex-col items-center text-center gap-3 pt-2">
            <span className={`w-14 h-14 rounded-2xl border flex items-center justify-center ${TONE_ICON_TILE.indigo}`}>
              <UsersRound className="w-7 h-7" />
            </span>
            <h3 className="text-lg sm:text-xl font-black font-outfit tracking-tight text-text-heading">
              {isDemo ? "Sign in to find your classmates" : "Find who's in your classes"}
            </h3>
            <p className="text-sm text-muted-foreground max-w-sm">
              {isDemo
                ? "The demo account has no VTOP login, so it can't join. Sign in with your own account to use the friend finder."
                : "Share your registered timetable and see who picked the same faculty and slots as you."}
            </p>
          </div>
          <div className="my-6">
            <TrustPoints />
          </div>
          {isDemo ? (
            <button
              type="button"
              className={`${PRIMARY_BUTTON} w-full`}
              onClick={() => {
                if (onRequestSignIn) onRequestSignIn();
                else setShowLoginModal(true);
              }}
            >
              <LogIn className="w-4 h-4" /> Sign in with your VTOP account
            </button>
          ) : (
            <button
              type="button"
              className={`${PRIMARY_BUTTON} w-full`}
              onClick={() => {
                if (onRequestSignIn) onRequestSignIn();
                else setShowLoginModal(true);
              }}
            >
              <LogIn className="w-4 h-4" /> Sign in with VTOP
            </button>
          )}
          <p className="mt-3 text-center text-xs text-muted-foreground">
            Logging in here will log you into the rest of AmazeCC.
          </p>
        </div>
        <FriendFinderLoginModal
          open={showLoginModal}
          onClose={() => setShowLoginModal(false)}
          onSuccess={() => setShowLoginModal(false)}
        />
      </PageShell>
    );
  }

  /* ── Mock / unsupported list ───────────────────────────────────── */
  if (!vtopSemester) {
    return (
      <PageShell
        leading={standaloneLogo ? <AmazeCCLogoLeading /> : undefined}
        onBack={standaloneLogo ? undefined : (onBack ?? (openedFromHome ? () => setActiveTab("home") : undefined))}
        actions={standaloneLogo ? <ThemeToggle /> : undefined}
        eyebrow="Friend Finder"
        title="Find classmates"
      >
        <div className={`${TILE_CARD} max-w-xl mx-auto text-center space-y-3`}>
          <span
            className={`mx-auto w-14 h-14 rounded-2xl border flex items-center justify-center ${TONE_ICON_TILE.amber}`}
          >
            <AlertTriangle className="w-7 h-7" />
          </span>
          <h3 className="text-lg font-black font-outfit tracking-tight text-text-heading">
            Switch to the upcoming winter course list
          </h3>
          <p className="text-sm text-muted-foreground max-w-sm mx-auto">
            The friend finder shares only the upcoming Winter 2026-27 semester (CH20262705).
          </p>
        </div>
      </PageShell>
    );
  }

  /* ── First load ────────────────────────────────────────────────── */
  if (!state) {
    return (
      <PageShell
        leading={standaloneLogo ? <AmazeCCLogoLeading /> : undefined}
        onBack={standaloneLogo ? undefined : (onBack ?? (openedFromHome ? () => setActiveTab("home") : undefined))}
        actions={standaloneLogo ? <ThemeToggle /> : undefined}
        eyebrow="Friend Finder"
        title="Find classmates"
      >
        {error ? (
          <Notice tone={error.needsSignIn ? "amber" : "red"} action={errorAction(error)}>
            {error.message}
          </Notice>
        ) : (
          <div className="space-y-4" aria-busy="true" aria-label="Loading the friend finder">
            <div className={`${TILE_CARD} h-28 animate-pulse`} />
            <ListSkeleton rows={4} leading="dot" trailing />
          </div>
        )}
      </PageShell>
    );
  }

  const me = state.me;
  const showPicker = !me.joined || editing;
  const errorNotice = error ? (
    <Notice tone={error.needsSignIn ? "amber" : "red"} action={errorAction(error)}>
      {error.message}
    </Notice>
  ) : null;

  /* ── Class Subpage (Drill-in) ──────────────────────────────────── */
  if (selectedClassId && selectedSection) {
    const o = selectedSection.offering;
    const count = selectedSection.people.length;
    return (
      <PageShell
        onBack={handleBack}
        actions={standaloneLogo ? <ThemeToggle /> : undefined}
        eyebrow={o ? o.code : "Class Details"}
        title={o ? o.title.replace(/\s+-\s*|-\s+/g, "-") : selectedSection.classId}
        subtitle={o ? `${o.type} · ${o.credits} Credits · Slot ${o.slot}` : undefined}
      >
        <div className="space-y-5 max-w-3xl mx-auto">
          {o ? (
            <div className={`${TILE_CARD} space-y-4`}>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span
                    className={`w-12 h-12 rounded-2xl border flex items-center justify-center shrink-0 ${TONE_ICON_TILE.indigo}`}
                  >
                    <GraduationCap className="w-6 h-6" />
                  </span>
                  <div>
                    <h4 className="text-base font-bold text-text-heading">{displayName(o.faculty)}</h4>
                    <p className="text-xs text-muted-foreground flex items-center gap-2">
                      <span className="inline-flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5" /> Slot {o.slot}
                      </span>
                      {o.room ? (
                        <span className="inline-flex items-center gap-1">
                          <MapPin className="w-3.5 h-3.5" /> Room {o.room}
                        </span>
                      ) : null}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => openFacultyReview({ name: o.faculty, courseCode: o.code })}
                  className={`${ACTION_BUTTON} !border !border-indigo-500/30 !bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 hover:!bg-indigo-500/20`}
                >
                  <Star className="w-3.5 h-3.5 fill-current" />
                  Faculty reviews
                </button>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-border-strong dark:border-border">
                <div className="p-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-800/50">
                  <span className="block text-[11px] font-medium text-muted-foreground">Course Code</span>
                  <span className="text-xs font-bold text-text-heading">{o.code}</span>
                </div>
                <div className="p-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-800/50">
                  <span className="block text-[11px] font-medium text-muted-foreground">Credits</span>
                  <span className="text-xs font-bold text-text-heading">{o.credits}</span>
                </div>
                <div className="p-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-800/50">
                  <span className="block text-[11px] font-medium text-muted-foreground">Type</span>
                  <span className="text-xs font-bold text-text-heading uppercase">{o.type}</span>
                </div>
                <div className="p-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-800/50">
                  <span className="block text-[11px] font-medium text-muted-foreground">Class ID</span>
                  <span className="text-xs font-mono font-bold text-text-heading">{selectedSection.classId}</span>
                </div>
              </div>
            </div>
          ) : null}

          <section className="space-y-3">
            <SectionHeader
              icon={Users}
              title={count ? `${count} ${count === 1 ? "classmate" : "classmates"} here` : "No classmates yet"}
              count={count}
            />
            {count > 0 ? (
              <div className={LIST_SHELL}>
                {selectedSection.people.map((p) => (
                  <div
                    key={p.handle}
                    className="flex items-center gap-3 px-4 py-3 border-b last:border-b-0 border-border-subtle"
                  >
                    <Avatar person={p} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-sm font-bold text-text-heading truncate">
                          {displayName(p.name) || p.handle}
                        </span>
                        {p.regNo && (
                          <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 shrink-0">
                            {p.regNo}
                          </span>
                        )}
                        {p.source === "registered" ? <VerifiedTick /> : null}
                      </div>
                      <p className="text-xs text-muted-foreground truncate">{p.handle}</p>
                    </div>
                    {p.source === "registered" && (
                      <ToneBadge size="sm" tone="emerald">
                        Verified
                      </ToneBadge>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-border-strong dark:border-border p-6 text-center space-y-2">
                <p className="text-sm text-muted-foreground">None of your classmates have joined this section yet.</p>
                <InviteButton className="mx-auto" />
              </div>
            )}
          </section>
        </div>

        <FacultyReviewSheetHost target={reviewTarget} onClose={closeFacultyReview} />
      </PageShell>
    );
  }

  /* ── Choose what to share (first time, or "Change classes") ───── */
  if (showPicker) {
    const publish = () => {
      void run({ op: "publish", source: "registered" }, "action");
    };
    const options = [
      {
        value: REGISTERED,
        label: "My registered timetable",
        icon: <BadgeCheck className="w-4 h-4" />,
        description: "Read from VTOP after registration. Others see you as verified.",
      },
    ];

    return (
      <PageShell
        leading={standaloneLogo && !editing ? <AmazeCCLogoLeading /> : undefined}
        onBack={
          editing
            ? () => setEditing(false)
            : standaloneLogo
              ? undefined
              : (onBack ?? (openedFromHome ? () => setActiveTab("home") : undefined))
        }
        actions={standaloneLogo ? <ThemeToggle /> : undefined}
        eyebrow="Friend Finder"
        title="Find classmates"
        subtitle="Share your registered timetable to find who's in your classes"
      >
        <div className="space-y-4">
          {errorNotice}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:items-start">
            <div className={`${TILE_CARD} space-y-5`}>
              <div className="space-y-2">
                <span
                  className={`w-12 h-12 rounded-2xl border flex items-center justify-center ${TONE_ICON_TILE.indigo}`}
                >
                  <Sparkles className="w-6 h-6" />
                </span>
                <h3 className="text-lg sm:text-xl font-black font-outfit tracking-tight text-text-heading">
                  {editing ? "Change what you share" : "See who's in your classes"}
                </h3>
                <p className="text-sm text-muted-foreground">
                  We&apos;ll show everyone who chose the same faculty and slot for any of your registered courses.
                </p>
              </div>
              <TrustPoints />
              <div className="flex items-center gap-2 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 px-3 py-2.5">
                <UsersRound className="w-4 h-4 text-indigo-500 shrink-0" />
                <span className="text-xs font-semibold text-indigo-700 dark:text-indigo-300">
                  {state.participants.toLocaleString()} {state.participants === 1 ? "student has" : "students have"}{" "}
                  joined this semester
                </span>
              </div>
            </div>

            <div className={`${TILE_CARD} space-y-4`}>
              <SectionHeader title="What to share" />
              <RadioGroup name="friend-finder-source" options={options} value={REGISTERED} onChange={() => {}} />
              <div className="flex flex-col-reverse sm:flex-row gap-2 pt-1">
                {editing ? (
                  <button
                    type="button"
                    className={`${ACTION_BUTTON} sm:w-auto py-3`}
                    disabled={busy}
                    onClick={() => {
                      setEditing(false);
                    }}
                  >
                    Cancel
                  </button>
                ) : null}
                <button
                  type="button"
                  className={`${PRIMARY_BUTTON} w-full sm:flex-1`}
                  disabled={busy}
                  onClick={publish}
                >
                  {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <UsersRound className="w-4 h-4" />}
                  {busy ? "Sharing…" : editing ? "Save and update matches" : "Share and find classmates"}
                </button>
              </div>
              {me.joined ? (
                <p className="text-xs text-muted-foreground text-center sm:text-left">
                  {me.changesLeft} {me.changesLeft === 1 ? "change" : "changes"} left today
                </p>
              ) : null}
            </div>
          </div>
        </div>
      </PageShell>
    );
  }

  /* ── Joined: main view ─────────────────────────────────────────── */
  const uniqueClassmates = new Set(state.sections.flatMap((s) => s.people.map((p) => p.handle))).size;
  const sectionsWithPeople = state.sections.filter((s) => s.people.length).length;
  const hasVerified = state.sections.some((s) => s.people.some((p) => p.source === "registered"));

  return (
    <PageShell
      leading={standaloneLogo ? <AmazeCCLogoLeading /> : undefined}
      onBack={standaloneLogo ? undefined : (onBack ?? (openedFromHome ? () => setActiveTab("home") : undefined))}
      eyebrow="Friend Finder"
      title="Find classmates"
      subtitle="See who picked the same faculty and slots as you"
      actions={
        <div className="flex items-center gap-2">
          <SegmentedControl
            options={[
              { value: "classes", label: "Classes" },
              { value: "friends", label: "Friends" },
            ]}
            value={grouping}
            onChange={(val) => setGrouping(val as "classes" | "friends")}
          />
          {standaloneLogo ? <ThemeToggle /> : null}
        </div>
      }
    >
      <div className="space-y-5">
        {errorNotice}

        {/* Profile bar */}
        <div className={`${TILE_CARD} space-y-4`}>
          <div className="flex items-center gap-3">
            <Avatar person={{ handle: me.handle, name: me.name }} />
            <div className="min-w-0 flex-1">
              <p className="text-sm sm:text-base font-bold text-text-heading truncate">{displayName(me.name)}</p>
              <p className="text-xs text-muted-foreground flex flex-wrap items-center gap-x-2 gap-y-1">
                <span>
                  Sharing {me.classIds.length} {me.classIds.length === 1 ? "class" : "classes"}
                </span>
                <ToneBadge size="sm" tone={me.source === "registered" ? "emerald" : "indigo"}>
                  {me.source === "registered" ? "Verified" : "Planned"}
                </ToneBadge>
              </p>
            </div>
            <label className="flex items-center gap-2 shrink-0 cursor-pointer">
              <span className="hidden sm:block text-xs font-semibold text-muted-foreground">
                {me.discoverable ? "Visible" : "Hidden"}
              </span>
              <Switch
                size="md"
                checked={me.discoverable}
                disabled={busy}
                label="Visible to classmates"
                onCheckedChange={(on) => void run({ op: "visibility", discoverable: on }, "action")}
              />
            </label>
          </div>

          <div className="grid grid-cols-2 sm:flex sm:flex-wrap gap-2">
            <button
              type="button"
              className={ACTION_BUTTON}
              disabled={busy}
              onClick={() => {
                setEditing(true);
              }}
            >
              <Pencil className="w-3.5 h-3.5" /> Change classes
            </button>
            <button
              type="button"
              className={ACTION_BUTTON}
              disabled={busy || loading}
              onClick={() => void run({ op: "get" }, "load")}
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} /> Refresh
            </button>
            <InviteButton />
            <button
              type="button"
              disabled={busy}
              onClick={() => (confirmingRemove ? void run({ op: "leave" }, "action") : setConfirmingRemove(true))}
              onBlur={() => setConfirmingRemove(false)}
              className={`${ACTION_BUTTON} ${confirmingRemove ? "!bg-red-500 !text-white hover:!bg-red-600" : "!text-red-600 dark:!text-red-400"}`}
            >
              <LogOut className="w-3.5 h-3.5" /> {confirmingRemove ? "Tap again to remove" : "Remove me"}
            </button>
          </div>
        </div>

        {!me.discoverable ? (
          <div className={`${TILE_CARD} text-center space-y-3`}>
            <span
              className={`mx-auto w-14 h-14 rounded-2xl border flex items-center justify-center ${TONE_ICON_TILE.zinc}`}
            >
              <EyeOff className="w-7 h-7" />
            </span>
            <h3 className="text-lg font-black font-outfit tracking-tight text-text-heading">You&apos;re hidden</h3>
            <p className="text-sm text-muted-foreground max-w-sm mx-auto">
              Nobody can see you, and you can&apos;t see anyone either. Your classes are still saved.
            </p>
            <button
              type="button"
              className={PRIMARY_BUTTON}
              disabled={busy}
              onClick={() => void run({ op: "visibility", discoverable: true }, "action")}
            >
              <Eye className="w-4 h-4" /> Become visible
            </button>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-3 gap-2 sm:gap-3">
              <StatTile
                label="Classmates"
                value={uniqueClassmates}
                sub={<span className="text-[11px] text-muted-foreground">found</span>}
                tone="indigo"
                height="h-24 sm:h-28"
              />
              <StatTile
                label="Sections"
                value={`${sectionsWithPeople}/${state.sections.length}`}
                sub={<span className="text-[11px] text-muted-foreground">shared</span>}
                tone="emerald"
                height="h-24 sm:h-28"
              />
              <StatTile
                label="Joined"
                value={state.participants.toLocaleString()}
                sub={<span className="text-[11px] text-muted-foreground">students</span>}
                tone="neutral"
                height="h-24 sm:h-28"
              />
            </div>

            {grouping === "classes" ? (
              <section className="space-y-3">
                <SectionHeader icon={Link2} title="Your sections" count={state.sections.length} />
                <div className={LIST_SHELL}>
                  {sortedSections.map((s) => (
                    <SectionCard key={s.classId} section={s} onClick={() => setSelectedClassId(s.classId)} />
                  ))}
                </div>
              </section>
            ) : (
              <section className="space-y-3">
                <SectionHeader icon={Sparkles} title="Friends with common classes" count={state.overlaps.length} />
                {state.overlaps.length ? (
                  <div className={LIST_SHELL}>
                    {state.overlaps.map((o) => {
                      const codes = o.sharedClassIds.map((id) => codeOf.get(id)).filter(Boolean);
                      return (
                        <div
                          key={o.handle}
                          role="button"
                          tabIndex={0}
                          onClick={() => setSelectedFriend(o)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault();
                              setSelectedFriend(o);
                            }
                          }}
                          className={`${LIST_ROW} cursor-pointer hover:bg-zinc-50/70 dark:hover:bg-zinc-800/40 active:scale-[0.99] transition-all`}
                        >
                          <Avatar person={o} />
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="text-sm font-bold text-text-heading truncate">
                                {displayName(o.name) || o.handle}
                              </span>
                              {o.regNo && (
                                <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 shrink-0">
                                  {o.regNo}
                                </span>
                              )}
                              {o.source === "registered" ? <VerifiedTick /> : null}
                            </div>
                            <p className="text-xs text-muted-foreground truncate">
                              {o.identical
                                ? "Exactly your timetable"
                                : codes.length
                                  ? codes.join(" · ")
                                  : `${o.shared} shared classes`}
                            </p>
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0">
                            <ToneBadge size="sm" tone={o.identical ? "emerald" : "indigo"}>
                              {o.identical ? "Identical" : `${o.shared} shared`}
                            </ToneBadge>
                            <ChevronRight className="w-4 h-4 text-zinc-400" />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="rounded-2xl border border-dashed border-border-strong dark:border-border px-4 py-8 text-center space-y-3">
                    <p className="text-sm text-muted-foreground max-w-sm mx-auto">
                      Nobody shares two or more of your sections yet. Invite your friends to see who you&apos;ll be
                      with.
                    </p>
                    <InviteButton className="mx-auto" />
                  </div>
                )}
                {hasVerified ? (
                  <p className="flex items-center gap-1.5 px-1 text-[11px] text-muted-foreground">
                    <VerifiedTick className="w-3.5 h-3.5" /> Verified: registered in VTOP, not just planned
                  </p>
                ) : null}
              </section>
            )}
          </>
        )}
      </div>

      {/* Friend bottom sheet */}
      {selectedFriend && (
        <BottomSheet
          overlayId="friend-sheet"
          onClose={() => setSelectedFriend(null)}
          title={displayName(selectedFriend.name) || selectedFriend.handle}
          subtitle={
            selectedFriend.regNo
              ? `${selectedFriend.regNo} · ${selectedFriend.shared} ${selectedFriend.shared === 1 ? "class" : "classes"} in common`
              : `${selectedFriend.shared} ${selectedFriend.shared === 1 ? "class" : "classes"} in common`
          }
          icon={<Avatar person={selectedFriend} size="sm" />}
        >
          <div className="space-y-3 p-1">
            <p className="text-xs font-semibold text-muted-foreground px-1">Classes in common (tap to view details)</p>
            <div className={LIST_SHELL}>
              {selectedFriend.sharedClassIds.map((classId) => {
                const section = state.sections.find((s) => s.classId === classId);
                const o = section?.offering;
                return (
                  <div
                    key={classId}
                    role="button"
                    tabIndex={0}
                    onClick={() => {
                      setSelectedFriend(null);
                      setSelectedClassId(classId);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        setSelectedFriend(null);
                        setSelectedClassId(classId);
                      }
                    }}
                    className={`${LIST_ROW} cursor-pointer hover:bg-zinc-50/70 dark:hover:bg-zinc-800/40 transition-all`}
                  >
                    <span
                      className={`w-9 h-9 rounded-xl border flex items-center justify-center shrink-0 ${TONE_ICON_TILE.indigo}`}
                    >
                      <BookOpen className="w-4 h-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-bold text-text-heading truncate">
                        {o ? `${o.code} · ${o.title.replace(/\s+-\s*|-\s+/g, "-")}` : classId}
                      </p>
                      {o ? (
                        <p className="text-xs text-muted-foreground flex items-center gap-2 truncate">
                          <span>Slot {o.slot}</span>
                          <span>·</span>
                          <span>{displayName(o.faculty)}</span>
                        </p>
                      ) : null}
                    </div>
                    <ChevronRight className="w-4 h-4 text-zinc-400 shrink-0" />
                  </div>
                );
              })}
            </div>
          </div>
        </BottomSheet>
      )}

      <FacultyReviewSheetHost target={reviewTarget} onClose={closeFacultyReview} />
    </PageShell>
  );
}
