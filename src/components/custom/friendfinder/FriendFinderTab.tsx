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
  RefreshCw,
  Share2,
  ShieldCheck,
  Sparkles,
  Star,
  UserRound,
  Users,
  UsersRound,
  UserX,
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
import { syncCurrentUserPostHogIdentity, trackFeatureUsage } from "@/lib/posthog";
import posthog from "posthog-js";
import { forgetStoredCredentials, SIGNED_OUT_EVENT } from "@/lib/forgetDevice";
import { getActiveRegNumber } from "@/lib/social/identity";
import ThemeToggle from "@/components/custom/ThemeToggle";
import { GHOST_BUTTON, LIST_ROW, LIST_SHELL, TILE_CARD, TONE_ICON_TILE } from "@/lib/uiTokens";
import {
  IconButton,
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
import { openLoginSyncSession } from "@/lib/sync-engine/sync-session";
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

/**
 * Normalizes course codes to their base (e.g. BCSE202L / BCSE202P -> BCSE202).
 */
export function getBaseCourseCode(code?: string): string {
  if (!code) return "";
  const upper = code.trim().toUpperCase();
  if ((upper.endsWith("L") || upper.endsWith("P")) && upper.length > 4) {
    return upper.slice(0, -1);
  }
  return upper;
}

/**
 * Normalizes course title for fuzzy embedded pairing comparison.
 */
export function normalizeCourseTitle(title?: string): string {
  if (!title) return "";
  return title
    .trim()
    .toLowerCase()
    .replace(/\s+-\s*|-\s+/g, " ")
    .replace(/\b(theory|lab|embedded|only)\b/gi, "")
    .replace(/[^a-z0-9]/g, "");
}

/**
 * Checks whether a section is Embedded Theory (ETH) or Embedded Lab (ELA).
 */
export function getSectionEmbeddedRole(section?: ClassmateSection | null): "theory" | "lab" | null {
  if (!section?.offering) return null;
  const t = section.offering.type.trim().toUpperCase();
  if (t === "ETH" || t === "EMBEDDED THEORY" || t.includes("ETH") || (t.includes("THEORY") && t.includes("EMBEDDED"))) {
    return "theory";
  }
  if (t === "ELA" || t === "EMBEDDED LAB" || t.includes("ELA") || (t.includes("LAB") && t.includes("EMBEDDED"))) {
    return "lab";
  }
  return null;
}

export interface EmbeddedPairingMap {
  counterparts: Map<string, ClassmateSection>;
  roles: Map<string, "theory" | "lab">;
}

export function buildEmbeddedPairMap(sections: ClassmateSection[]): EmbeddedPairingMap {
  const counterparts = new Map<string, ClassmateSection>();
  const roles = new Map<string, "theory" | "lab">();

  const theories: ClassmateSection[] = [];
  const labs: ClassmateSection[] = [];

  for (const s of sections) {
    const role = getSectionEmbeddedRole(s);
    if (role === "theory") {
      theories.push(s);
      roles.set(s.classId, "theory");
    } else if (role === "lab") {
      labs.push(s);
      roles.set(s.classId, "lab");
    }
  }

  for (const t of theories) {
    const tBase = getBaseCourseCode(t.offering?.code);
    const tTitle = normalizeCourseTitle(t.offering?.title);

    const matchingLab = labs.find((l) => {
      if (counterparts.has(l.classId)) return false;
      const lBase = getBaseCourseCode(l.offering?.code);
      if (tBase && lBase && tBase === lBase) return true;
      const lTitle = normalizeCourseTitle(l.offering?.title);
      if (tTitle && lTitle && tTitle === lTitle) return true;
      return false;
    });

    if (matchingLab) {
      counterparts.set(t.classId, matchingLab);
      counterparts.set(matchingLab.classId, t);
    }
  }

  return { counterparts, roles };
}

export function isPersonInCounterpart(
  person: ClassmatePerson,
  counterpart: ClassmateSection | null | undefined,
): boolean {
  if (!counterpart) return false;
  return counterpart.people.some(
    (cp) =>
      cp.handle === person.handle ||
      (person.regNo && cp.regNo && cp.regNo.toUpperCase() === person.regNo.toUpperCase()),
  );
}

export function getOverlapForPerson(p: ClassmatePerson, state: ClassmatesState | null): ClassmateOverlap {
  const match = state?.overlaps.find(
    (o) => o.handle === p.handle || (p.regNo && o.regNo && o.regNo.toUpperCase() === p.regNo.toUpperCase()),
  );
  if (match) return match;

  const sharedSections = (state?.sections ?? []).filter((s) =>
    s.people.some(
      (sp) => sp.handle === p.handle || (p.regNo && sp.regNo && sp.regNo.toUpperCase() === p.regNo.toUpperCase()),
    ),
  );
  const sharedClassIds = sharedSections.map((s) => s.classId);

  return {
    handle: p.handle,
    name: p.name,
    source: p.source,
    regNo: p.regNo,
    shared: sharedClassIds.length,
    sharedClassIds,
    identical: Boolean(state?.sections.length && sharedClassIds.length === state.sections.length),
    updatedAt: new Date().toISOString(),
  };
}

export interface ClassEntryPerson extends ClassmatePerson {
  enrollmentRole: "both" | "theory" | "lab" | "single";
}

export interface ClassEntry {
  id: string;
  classIds: string[];
  isPaired: boolean;
  code: string;
  title: string;
  type: string;
  credits: string;
  slot: string;
  room: string;
  faculty: string;
  people: ClassEntryPerson[];
  theorySection?: ClassmateSection;
  labSection?: ClassmateSection;
  singleSection?: ClassmateSection;
}

export function buildClassEntries(sections: ClassmateSection[], embeddedMap: EmbeddedPairingMap): ClassEntry[] {
  const entries: ClassEntry[] = [];
  const handledClassIds = new Set<string>();

  for (const s of sections) {
    if (handledClassIds.has(s.classId)) continue;

    const counterpart = embeddedMap.counterparts.get(s.classId);
    const role = embeddedMap.roles.get(s.classId);

    if (counterpart && role && !handledClassIds.has(counterpart.classId)) {
      // Paired entry: merge ETH and ELA into ONE single entry
      const theory = role === "theory" ? s : counterpart;
      const lab = role === "theory" ? counterpart : s;

      handledClassIds.add(theory.classId);
      handledClassIds.add(lab.classId);

      const peopleMap = new Map<string, ClassEntryPerson>();

      for (const tp of theory.people) {
        const inLab = isPersonInCounterpart(tp, lab);
        peopleMap.set(tp.handle, {
          ...tp,
          enrollmentRole: inLab ? "both" : "theory",
        });
      }

      for (const lp of lab.people) {
        if (!peopleMap.has(lp.handle)) {
          peopleMap.set(lp.handle, {
            ...lp,
            enrollmentRole: "lab",
          });
        }
      }

      const tOff = theory.offering;
      const lOff = lab.offering;

      const code = tOff?.code || lOff?.code || theory.classId;
      const title = tOff?.title || lOff?.title || theory.classId;
      const tCred = parseInt(tOff?.credits || "0", 10) || 0;
      const lCred = parseInt(lOff?.credits || "0", 10) || 0;
      const totalCredits = tCred + lCred > 0 ? String(tCred + lCred) : tOff?.credits || lOff?.credits || "";

      const faculty =
        tOff?.faculty && lOff?.faculty && tOff.faculty.toUpperCase() === lOff.faculty.toUpperCase()
          ? tOff.faculty
          : [tOff?.faculty, lOff?.faculty].filter(Boolean).map(displayName).join(" / ");

      // Slots shown together, e.g. "F1+TF1 + L23+L24"
      const slotParts = [tOff?.slot, lOff?.slot].filter(Boolean);
      const slot = slotParts.join(" + ");
      const roomParts = [tOff?.room, lOff?.room].filter(Boolean);
      const room = roomParts[0] === roomParts[1] ? roomParts[0] : roomParts.join(" / ");

      entries.push({
        id: theory.classId,
        classIds: [theory.classId, lab.classId],
        isPaired: true,
        code,
        title,
        type: "Embedded",
        credits: totalCredits,
        slot,
        room,
        faculty,
        people: Array.from(peopleMap.values()),
        theorySection: theory,
        labSection: lab,
      });
    } else if (!counterpart) {
      // Standalone section
      handledClassIds.add(s.classId);
      const o = s.offering;

      entries.push({
        id: s.classId,
        classIds: [s.classId],
        isPaired: false,
        code: o?.code || s.classId,
        title: o?.title || s.classId,
        type: o?.type || "",
        credits: o?.credits || "",
        slot: o?.slot || "",
        room: o?.room || "",
        faculty: o?.faculty || "",
        people: s.people.map((p) => ({ ...p, enrollmentRole: "single" })),
        singleSection: s,
      });
    }
  }

  return entries.sort((a, b) => b.people.length - a.people.length || a.code.localeCompare(b.code));
}

function PersonChip({
  person,
  onClick,
  isMarked,
  markLabel,
}: {
  person: ClassmatePerson;
  onClick?: (e: React.MouseEvent) => void;
  isMarked?: boolean;
  markLabel?: string;
}) {
  return (
    <span
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onClick={onClick}
      onKeyDown={
        onClick
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onClick(e as unknown as React.MouseEvent);
              }
            }
          : undefined
      }
      className={`inline-flex items-center gap-1.5 rounded-2xl border border-border-strong dark:border-border bg-surface pl-1 pr-2.5 py-1 text-xs font-semibold text-text-heading max-w-full ${
        onClick ? "cursor-pointer hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors" : ""
      }`}
    >
      <Avatar person={person} size="sm" />
      <span className="truncate">
        {displayName(person.name) || person.handle}
        {person.regNo ? ` (${person.regNo})` : ""}
      </span>
      {isMarked && markLabel ? (
        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/20">
          {markLabel}
        </span>
      ) : null}
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

function SectionCard({
  entry,
  onClick,
  onPersonClick,
}: {
  entry: ClassEntry;
  onClick?: () => void;
  onPersonClick?: (person: ClassmatePerson) => void;
}) {
  const count = entry.people.length;
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
          <p className="text-sm font-bold text-text-heading leading-snug">
            <span className="font-outfit font-black tracking-tight">{entry.code}</span>
            <span className="text-muted-foreground font-medium"> · </span>
            {entry.title.replace(/\s+-\s*|-\s+/g, "-")}
          </p>
          <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <Clock className="w-3 h-3" /> {entry.slot}
            </span>
            <span className="inline-flex items-center gap-1 min-w-0">
              <UserRound className="w-3 h-3 shrink-0" />
              <span className="truncate">{displayName(entry.faculty)}</span>
            </span>
            <span className="uppercase tracking-wide text-[10px] font-bold">{entry.type}</span>
          </p>
        </div>
        <div className="flex items-center gap-1.5 shrink-0 self-center pl-1">
          <span
            aria-label={`${count} ${count === 1 ? "classmate" : "classmates"}`}
            title={`${count} ${count === 1 ? "classmate" : "classmates"}`}
            className={`text-2xl sm:text-3xl font-black font-outfit tracking-tight leading-none ${
              count ? "text-indigo-600 dark:text-indigo-400" : "text-zinc-300 dark:text-zinc-600"
            }`}
          >
            {count}
          </span>
          {onClick && <ChevronRight className="w-4 h-4 text-zinc-400 shrink-0" />}
        </div>
      </div>
      {count ? (
        <div className="flex flex-wrap gap-1.5 sm:pl-[52px]">
          {entry.people.map((p) => {
            const isMarked = p.enrollmentRole === "theory" || p.enrollmentRole === "lab";
            const markLabel =
              p.enrollmentRole === "theory" ? "ETH only" : p.enrollmentRole === "lab" ? "ELA only" : undefined;

            return (
              <PersonChip
                key={p.handle}
                person={p}
                isMarked={isMarked}
                markLabel={markLabel}
                onClick={
                  onPersonClick
                    ? (e) => {
                        e.stopPropagation();
                        onPersonClick(p);
                      }
                    : undefined
                }
              />
            );
          })}
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
      className="inline-flex items-center transition-transform active:scale-95 py-0.5"
      title="AmazeCC Home"
      aria-label="AmazeCC Home"
    >
      <img
        loading="lazy"
        decoding="async"
        src={getAssetPath("/favicon/favicon.svg")}
        alt="AmazeCC"
        className="h-9 w-9 sm:h-10 sm:w-10 object-contain"
      />
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
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const [grouping, setGrouping] = useState<"classes" | "friends">("classes");
  const [selectedClassId, setSelectedClassId] = useState<string | null>(null);
  const [selectedFriend, setSelectedFriend] = useState<ClassmateOverlap | null>(null);
  const [confirmingLogout, setConfirmingLogout] = useState(false);

  const handleLogout = useCallback(() => {
    if (process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN && process.env.NEXT_PUBLIC_POSTHOG_HOST) {
      try {
        posthog.reset();
      } catch {}
    }
    forgetStoredCredentials();
    setIsLoggedIn(false);
    setDemoMode(false);
    setIDs({
      VtopUsername: "",
      VtopPassword: "",
      MoodleUsername: "",
      MoodlePassword: "",
    });
    try {
      if (typeof document !== "undefined") {
        document.documentElement.classList.remove("has-stored-session");
      }
    } catch {}
    setIsProfileOpen(false);
    setConfirmingLogout(false);
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent(SIGNED_OUT_EVENT));
    }
  }, [setIsLoggedIn, setDemoMode, setIDs]);

  const handleShare = useCallback(async () => {
    const text =
      "Check who's in your classes on AmazeCC Friend Finder — see everyone who picked the same faculty and slots as you:";
    const url = `${typeof window !== "undefined" ? window.location.origin : ""}${CLASSMATES_PATH}`;
    if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
      try {
        await navigator.share({ title: "Find classmates", text, url });
        return;
      } catch (err) {
        if ((err as Error)?.name === "AbortError") return;
      }
    }
    try {
      await navigator.clipboard.writeText(`${text}\n${url}`);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {}
  }, []);

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
          if (request.op === "publish") {
            syncCurrentUserPostHogIdentity({
              route: "friend_finder",
              semester: vtopSemester,
            });
            trackFeatureUsage("friend_finder", "timetable_published", {
              semester: vtopSemester,
            });
          } else {
            trackFeatureUsage("friend_finder", "timetable_unpublished");
          }
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
    if (canUse) {
      syncCurrentUserPostHogIdentity({
        route: "friend_finder",
        semester: vtopSemester,
      });
      void run({ op: "get" }, "load");
    }
  }, [canUse, run, vtopSemester]);

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

  const embeddedMap = useMemo(() => buildEmbeddedPairMap(state?.sections ?? []), [state?.sections]);

  const classEntries = useMemo(
    () => buildClassEntries(state?.sections ?? [], embeddedMap),
    [state?.sections, embeddedMap],
  );

  const selectedEntry = useMemo(
    () =>
      selectedClassId
        ? (classEntries.find((e) => e.id === selectedClassId || e.classIds.includes(selectedClassId)) ?? null)
        : null,
    [selectedClassId, classEntries],
  );

  const handlePersonClick = useCallback(
    (person: ClassmatePerson) => {
      const overlap = getOverlapForPerson(person, state);
      setSelectedFriend(overlap);
    },
    [state],
  );

  const renderProfileBottomSheet = () => {
    if (!isProfileOpen || !state?.me) return null;
    const me = state.me;
    const myRegNo = (me as any).regNo || getActiveRegNumber();

    return (
      <BottomSheet
        overlayId="profile-sheet"
        onClose={() => {
          setIsProfileOpen(false);
          setConfirmingRemove(false);
        }}
        title="Your Profile"
        subtitle="Friend Finder status & settings"
        icon={<Avatar person={{ handle: me.handle, name: me.name }} size="sm" />}
      >
        <div className="space-y-4 p-1">
          setConfirmingLogout(false);
          {/* User Details Card */}
          <div className="p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-800/50 border border-border-subtle space-y-3">
            <div className="flex items-center gap-3">
              <Avatar person={{ handle: me.handle, name: me.name }} size="md" />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <h4 className="text-base font-bold text-text-heading truncate">{displayName(me.name)}</h4>
                  {me.source === "registered" ? <VerifiedTick /> : null}
                </div>
                <p className="text-xs text-muted-foreground truncate">
                  {myRegNo ? <span>{myRegNo}</span> : <span>{me.handle}</span>}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 pt-1">
              <div className="p-2.5 rounded-xl bg-white dark:bg-zinc-900/60 border border-border-subtle/60">
                <span className="block text-[11px] font-medium text-muted-foreground">Classes Shared</span>
                <span className="text-xs font-bold text-text-heading">
                  {me.classIds.length} {me.classIds.length === 1 ? "class" : "classes"}
                </span>
              </div>
              <div className="p-2.5 rounded-xl bg-white dark:bg-zinc-900/60 border border-border-subtle/60">
                <span className="block text-[11px] font-medium text-muted-foreground">Status</span>
                <div className="flex items-center gap-1 mt-0.5">
                  <ToneBadge size="sm" tone={me.source === "registered" ? "emerald" : "indigo"}>
                    {me.source === "registered" ? "Verified" : "Planned"}
                  </ToneBadge>
                </div>
              </div>
            </div>
          </div>
          {/* Visibility Switch */}
          <div className="flex items-center justify-between p-3.5 rounded-2xl bg-zinc-50 dark:bg-zinc-800/40 border border-border-subtle">
            <div>
              <p className="text-xs font-bold text-text-heading">Visible to classmates</p>
              <p className="text-[11px] text-muted-foreground">
                {me.discoverable ? "Others in your sections can find you" : "You are hidden from everyone"}
              </p>
            </div>
            <Switch
              size="md"
              checked={me.discoverable}
              disabled={busy}
              label="Visible to classmates"
              onCheckedChange={(on) => void run({ op: "visibility", discoverable: on }, "action")}
            />
          </div>
          {/* Menu item to leave */}
          <div>
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                if (confirmingRemove) {
                  setIsProfileOpen(false);
                  void run({ op: "leave" }, "action");
                } else {
                  setConfirmingRemove(true);
                  setConfirmingLogout(false);
                }
              }}
              onBlur={() => setConfirmingRemove(false)}
              className={`w-full flex items-center justify-between px-4 py-3 rounded-2xl text-xs font-bold transition-all cursor-pointer ${
                confirmingRemove
                  ? "!bg-red-500 !text-white hover:!bg-red-600 shadow-sm"
                  : "!bg-red-500/10 !text-red-600 dark:!text-red-400 hover:!bg-red-500/15 border border-red-500/20"
              }`}
            >
              <span className="flex items-center gap-2">
                <UserX className="w-4 h-4" />
                {confirmingRemove ? "Tap again to remove" : "Remove me"}
              </span>
              <ChevronRight className="w-4 h-4 opacity-70" />
            </button>
          </div>
          {/* Menu item to log out */}
          <div>
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                if (confirmingLogout) {
                  handleLogout();
                } else {
                  setConfirmingLogout(true);
                  setConfirmingRemove(false);
                }
              }}
              onBlur={() => setConfirmingLogout(false)}
              className={`w-full flex items-center justify-between px-4 py-3 rounded-2xl text-xs font-bold transition-all cursor-pointer ${
                confirmingLogout
                  ? "!bg-rose-600 !text-white hover:!bg-rose-700 shadow-sm"
                  : "bg-zinc-100 hover:bg-zinc-200/80 dark:bg-zinc-800/80 dark:hover:bg-zinc-700/80 text-zinc-700 dark:text-zinc-200 border border-border-subtle"
              }`}
            >
              <span className="flex items-center gap-2">
                <LogOut className="w-4 h-4 text-rose-500" />
                {confirmingLogout ? "Tap again to log out" : "Log out"}
              </span>
              <ChevronRight className="w-4 h-4 opacity-70" />
            </button>
          </div>
        </div>
      </BottomSheet>
    );
  };

  const renderFriendBottomSheet = () => {
    if (!selectedFriend || !state) return null;

    const sharedEntries: {
      entry: ClassEntry;
      roleBadge: React.ReactNode;
    }[] = [];
    const seenEntryIds = new Set<string>();

    for (const classId of selectedFriend.sharedClassIds) {
      const entry = classEntries.find((e) => e.classIds.includes(classId));
      if (!entry) {
        const rawSec = state.sections.find((s) => s.classId === classId);
        if (rawSec && !seenEntryIds.has(rawSec.classId)) {
          seenEntryIds.add(rawSec.classId);
          sharedEntries.push({
            entry: {
              id: rawSec.classId,
              classIds: [rawSec.classId],
              isPaired: false,
              code: rawSec.offering?.code || rawSec.classId,
              title: rawSec.offering?.title || rawSec.classId,
              type: rawSec.offering?.type || "",
              credits: rawSec.offering?.credits || "",
              slot: rawSec.offering?.slot || "",
              room: rawSec.offering?.room || "",
              faculty: rawSec.offering?.faculty || "",
              people: rawSec.people.map((p) => ({ ...p, enrollmentRole: "single" })),
              singleSection: rawSec,
            },
            roleBadge: null,
          });
        }
        continue;
      }

      if (seenEntryIds.has(entry.id)) continue;
      seenEntryIds.add(entry.id);

      let roleBadge: React.ReactNode = null;
      if (entry.isPaired) {
        const hasTheory = entry.theorySection && selectedFriend.sharedClassIds.includes(entry.theorySection.classId);
        const hasLab = entry.labSection && selectedFriend.sharedClassIds.includes(entry.labSection.classId);
        if (hasTheory && !hasLab) {
          roleBadge = (
            <ToneBadge size="sm" tone="amber">
              ETH only · Lab differs
            </ToneBadge>
          );
        } else if (!hasTheory && hasLab) {
          roleBadge = (
            <ToneBadge size="sm" tone="amber">
              ELA only · Theory differs
            </ToneBadge>
          );
        }
      }

      sharedEntries.push({ entry, roleBadge });
    }

    const sharedCount = sharedEntries.length;

    return (
      <BottomSheet
        overlayId="friend-sheet"
        onClose={() => setSelectedFriend(null)}
        title={displayName(selectedFriend.name) || selectedFriend.handle}
        subtitle={
          selectedFriend.regNo
            ? `${selectedFriend.regNo} · ${sharedCount} ${sharedCount === 1 ? "class" : "classes"} in common`
            : `${sharedCount} ${sharedCount === 1 ? "class" : "classes"} in common`
        }
        icon={<Avatar person={selectedFriend} size="sm" />}
      >
        <div className="space-y-3 p-1">
          <p className="text-xs font-semibold text-muted-foreground px-1">Classes in common (tap to view details)</p>
          <div className={LIST_SHELL}>
            {sharedEntries.map(({ entry, roleBadge }) => {
              return (
                <div
                  key={entry.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => {
                    setSelectedFriend(null);
                    setSelectedClassId(entry.id);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      setSelectedFriend(null);
                      setSelectedClassId(entry.id);
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
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <p className="text-sm font-bold text-text-heading truncate">
                        {`${entry.code} · ${entry.title.replace(/\s+-\s*|-\s+/g, "-")}`}
                      </p>
                      {roleBadge}
                    </div>
                    <p className="text-xs text-muted-foreground flex items-center gap-2 truncate">
                      <span>Slot {entry.slot}</span>
                      <span>·</span>
                      <span>{displayName(entry.faculty)}</span>
                      {entry.type ? (
                        <>
                          <span>·</span>
                          <span className="uppercase font-bold text-[10px]">{entry.type}</span>
                        </>
                      ) : null}
                    </p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-zinc-400 shrink-0" />
                </div>
              );
            })}
          </div>
        </div>
      </BottomSheet>
    );
  };

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
                else if (standaloneLogo) openLoginSyncSession();
                else router.push("/?signin=1&open=friend-finder");
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
                else if (standaloneLogo) openLoginSyncSession();
                else router.push("/?signin=1&open=friend-finder");
              }}
            >
              <LogIn className="w-4 h-4" /> Sign in with VTOP
            </button>
          )}
          <p className="mt-3 text-center text-xs text-muted-foreground">
            Logging in here will log you into the rest of AmazeCC.
          </p>
        </div>
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
  if (selectedClassId && selectedEntry) {
    const isPaired = selectedEntry.isPaired;
    const count = selectedEntry.people.length;

    return (
      <PageShell
        onBack={handleBack}
        actions={standaloneLogo ? <ThemeToggle /> : undefined}
        eyebrow={selectedEntry.code}
        title={selectedEntry.title.replace(/\s+-\s*|-\s+/g, "-")}
        subtitle={
          isPaired
            ? `Embedded · ${selectedEntry.credits} Credits · Slots: ${selectedEntry.slot}`
            : `${selectedEntry.type} · ${selectedEntry.credits} Credits · Slot ${selectedEntry.slot}`
        }
      >
        <div className="space-y-5 max-w-3xl mx-auto">
          {isPaired && selectedEntry.theorySection?.offering && selectedEntry.labSection?.offering ? (
            <div className={`${TILE_CARD} space-y-4`}>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span
                    className={`w-12 h-12 rounded-2xl border flex items-center justify-center shrink-0 ${TONE_ICON_TILE.indigo}`}
                  >
                    <GraduationCap className="w-6 h-6" />
                  </span>
                  <div>
                    <h4 className="text-base font-bold text-text-heading">{displayName(selectedEntry.faculty)}</h4>
                    <p className="text-xs text-muted-foreground flex items-center gap-2">
                      <span className="inline-flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5" /> Slots: {selectedEntry.slot}
                      </span>
                      {selectedEntry.room ? (
                        <span className="inline-flex items-center gap-1">
                          <MapPin className="w-3.5 h-3.5" /> Room {selectedEntry.room}
                        </span>
                      ) : null}
                    </p>
                  </div>
                </div>
                {selectedEntry.faculty && (
                  <button
                    type="button"
                    onClick={() => {
                      const fac = selectedEntry.theorySection?.offering?.faculty || selectedEntry.faculty;
                      openFacultyReview({ name: fac, courseCode: selectedEntry.code });
                    }}
                    className={`${ACTION_BUTTON} !border !border-indigo-500/30 !bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 hover:!bg-indigo-500/20`}
                  >
                    <Star className="w-3.5 h-3.5 fill-current" />
                    Faculty reviews
                  </button>
                )}
              </div>

              {/* Theory and Lab components breakdown */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-border-strong dark:border-border">
                {/* Theory (ETH) */}
                <div className="p-3 rounded-2xl bg-zinc-50 dark:bg-zinc-800/40 border border-border-subtle space-y-2">
                  <div className="flex items-center justify-between">
                    <ToneBadge size="sm" tone="indigo">
                      Theory (ETH)
                    </ToneBadge>
                    <button
                      type="button"
                      onClick={() =>
                        openFacultyReview({
                          name: selectedEntry.theorySection!.offering!.faculty,
                          courseCode: selectedEntry.theorySection!.offering!.code,
                        })
                      }
                      className={`${ACTION_BUTTON} !py-1 !px-2 !text-xs !border !border-indigo-500/30 !bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 hover:!bg-indigo-500/20`}
                    >
                      <Star className="w-3 h-3 fill-current" />
                      Review
                    </button>
                  </div>
                  <div>
                    <h5 className="text-sm font-bold text-text-heading">
                      {displayName(selectedEntry.theorySection!.offering!.faculty)}
                    </h5>
                    <p className="text-xs text-muted-foreground flex flex-wrap items-center gap-2 mt-0.5">
                      <span className="inline-flex items-center gap-1">
                        <Clock className="w-3 h-3" /> Slot {selectedEntry.theorySection!.offering!.slot}
                      </span>
                      {selectedEntry.theorySection!.offering!.room && (
                        <span className="inline-flex items-center gap-1">
                          <MapPin className="w-3 h-3" /> Room {selectedEntry.theorySection!.offering!.room}
                        </span>
                      )}
                      <span>· {selectedEntry.theorySection!.offering!.credits} Credits</span>
                    </p>
                  </div>
                </div>

                {/* Lab (ELA) */}
                <div className="p-3 rounded-2xl bg-zinc-50 dark:bg-zinc-800/40 border border-border-subtle space-y-2">
                  <div className="flex items-center justify-between">
                    <ToneBadge size="sm" tone="emerald">
                      Lab (ELA)
                    </ToneBadge>
                    <button
                      type="button"
                      onClick={() =>
                        openFacultyReview({
                          name: selectedEntry.labSection!.offering!.faculty,
                          courseCode: selectedEntry.labSection!.offering!.code,
                        })
                      }
                      className={`${ACTION_BUTTON} !py-1 !px-2 !text-xs !border !border-indigo-500/30 !bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 hover:!bg-indigo-500/20`}
                    >
                      <Star className="w-3 h-3 fill-current" />
                      Review
                    </button>
                  </div>
                  <div>
                    <h5 className="text-sm font-bold text-text-heading">
                      {displayName(selectedEntry.labSection!.offering!.faculty)}
                    </h5>
                    <p className="text-xs text-muted-foreground flex flex-wrap items-center gap-2 mt-0.5">
                      <span className="inline-flex items-center gap-1">
                        <Clock className="w-3 h-3" /> Slot {selectedEntry.labSection!.offering!.slot}
                      </span>
                      {selectedEntry.labSection!.offering!.room && (
                        <span className="inline-flex items-center gap-1">
                          <MapPin className="w-3 h-3" /> Room {selectedEntry.labSection!.offering!.room}
                        </span>
                      )}
                      <span>· {selectedEntry.labSection!.offering!.credits} Credits</span>
                    </p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-border-strong dark:border-border">
                <div className="p-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-800/50">
                  <span className="block text-[11px] font-medium text-muted-foreground">Course Code</span>
                  <span className="text-xs font-bold text-text-heading">{selectedEntry.code}</span>
                </div>
                <div className="p-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-800/50">
                  <span className="block text-[11px] font-medium text-muted-foreground">Total Credits</span>
                  <span className="text-xs font-bold text-text-heading">{selectedEntry.credits}</span>
                </div>
                <div className="p-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-800/50">
                  <span className="block text-[11px] font-medium text-muted-foreground">Type</span>
                  <span className="text-xs font-bold text-text-heading uppercase">Embedded</span>
                </div>
                <div className="p-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-800/50">
                  <span className="block text-[11px] font-medium text-muted-foreground">Class IDs</span>
                  <span className="text-xs font-mono font-bold text-text-heading truncate">
                    {selectedEntry.classIds.join(", ")}
                  </span>
                </div>
              </div>
            </div>
          ) : (
            <div className={`${TILE_CARD} space-y-4`}>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span
                    className={`w-12 h-12 rounded-2xl border flex items-center justify-center shrink-0 ${TONE_ICON_TILE.indigo}`}
                  >
                    <GraduationCap className="w-6 h-6" />
                  </span>
                  <div>
                    <h4 className="text-base font-bold text-text-heading">{displayName(selectedEntry.faculty)}</h4>
                    <p className="text-xs text-muted-foreground flex items-center gap-2">
                      <span className="inline-flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5" /> Slot {selectedEntry.slot}
                      </span>
                      {selectedEntry.room ? (
                        <span className="inline-flex items-center gap-1">
                          <MapPin className="w-3.5 h-3.5" /> Room {selectedEntry.room}
                        </span>
                      ) : null}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => openFacultyReview({ name: selectedEntry.faculty, courseCode: selectedEntry.code })}
                  className={`${ACTION_BUTTON} !border !border-indigo-500/30 !bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 hover:!bg-indigo-500/20`}
                >
                  <Star className="w-3.5 h-3.5 fill-current" />
                  Faculty reviews
                </button>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-border-strong dark:border-border">
                <div className="p-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-800/50">
                  <span className="block text-[11px] font-medium text-muted-foreground">Course Code</span>
                  <span className="text-xs font-bold text-text-heading">{selectedEntry.code}</span>
                </div>
                <div className="p-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-800/50">
                  <span className="block text-[11px] font-medium text-muted-foreground">Credits</span>
                  <span className="text-xs font-bold text-text-heading">{selectedEntry.credits}</span>
                </div>
                <div className="p-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-800/50">
                  <span className="block text-[11px] font-medium text-muted-foreground">Type</span>
                  <span className="text-xs font-bold text-text-heading uppercase">{selectedEntry.type}</span>
                </div>
                <div className="p-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-800/50">
                  <span className="block text-[11px] font-medium text-muted-foreground">Class ID</span>
                  <span className="text-xs font-mono font-bold text-text-heading">{selectedEntry.id}</span>
                </div>
              </div>
            </div>
          )}

          <section className="space-y-3">
            <SectionHeader
              icon={Users}
              title={count ? `${count} ${count === 1 ? "classmate" : "classmates"} here` : "No classmates yet"}
              count={count}
            />
            {count > 0 ? (
              <div className={LIST_SHELL}>
                {selectedEntry.people.map((p) => {
                  return (
                    <div
                      key={p.handle}
                      role="button"
                      tabIndex={0}
                      onClick={() => handlePersonClick(p)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          handlePersonClick(p);
                        }
                      }}
                      className="flex items-center gap-3 px-4 py-3 border-b last:border-b-0 border-border-subtle cursor-pointer hover:bg-zinc-50/70 dark:hover:bg-zinc-800/40 active:scale-[0.99] transition-all"
                    >
                      <Avatar person={p} />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-sm font-bold text-text-heading truncate">
                            {displayName(p.name) || p.handle}
                          </span>
                          {p.source === "registered" ? <VerifiedTick /> : null}
                        </div>
                        <p className="text-xs text-muted-foreground truncate">
                          <span>{p.regNo || p.handle}</span>
                        </p>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        {p.enrollmentRole === "theory" && (
                          <ToneBadge size="sm" tone="amber">
                            ETH only · Lab differs
                          </ToneBadge>
                        )}
                        {p.enrollmentRole === "lab" && (
                          <ToneBadge size="sm" tone="amber">
                            ELA only · Theory differs
                          </ToneBadge>
                        )}
                        {p.source === "registered" && (
                          <ToneBadge size="sm" tone="emerald">
                            Verified
                          </ToneBadge>
                        )}
                        <ChevronRight className="w-4 h-4 text-zinc-400" />
                      </div>
                    </div>
                  );
                })}
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
        {renderFriendBottomSheet()}
        {renderProfileBottomSheet()}
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
  const hasVerified = state.sections.some((s) => s.people.some((p) => p.source === "registered"));

  return (
    <PageShell
      leading={standaloneLogo ? <AmazeCCLogoLeading /> : undefined}
      onBack={standaloneLogo ? undefined : (onBack ?? (openedFromHome ? () => setActiveTab("home") : undefined))}
      eyebrow={
        <span className="font-black tracking-tight text-zinc-700 dark:text-zinc-200">
          Amaze<span className="text-indigo-600 dark:text-indigo-400">CC</span>
        </span>
      }
      title="Find your friend"
      subtitle="See who picked the same faculty and slots as you"
      actions={
        <div className="flex items-center gap-1.5 sm:gap-2">
          <IconButton
            onClick={() => void run({ op: "get" }, "load")}
            title="Refresh classmates"
            aria-label="Refresh"
            disabled={busy || loading}
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </IconButton>
          <IconButton
            onClick={() => void handleShare()}
            title={copied ? "Link copied" : "Share with friends"}
            aria-label="Share"
          >
            {copied ? <Check className="w-4 h-4 text-emerald-500" /> : <Share2 className="w-4 h-4" />}
          </IconButton>
          <IconButton onClick={() => setIsProfileOpen(true)} title="Profile" aria-label="Profile">
            <UserRound className="w-4 h-4" />
          </IconButton>
          {standaloneLogo ? <ThemeToggle /> : null}
        </div>
      }
    >
      <div className="space-y-5">
        {errorNotice}

        {/* Switcher between classes and friends (just like /ffcs route) */}
        <div>
          <SegmentedControl
            options={[
              { value: "classes", label: "Classes" },
              { value: "friends", label: "Friends" },
            ]}
            value={grouping}
            onChange={(val) => setGrouping(val as "classes" | "friends")}
          />
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
            <div className="grid grid-cols-2 gap-2 sm:gap-3">
              <StatTile
                label="Classmates"
                value={uniqueClassmates}
                sub={<span className="text-[11px] text-muted-foreground">found</span>}
                tone="indigo"
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
                <SectionHeader icon={Link2} title="Your sections" count={classEntries.length} />
                <div className={LIST_SHELL}>
                  {classEntries.map((entry) => (
                    <SectionCard
                      key={entry.id}
                      entry={entry}
                      onClick={() => setSelectedClassId(entry.id)}
                      onPersonClick={handlePersonClick}
                    />
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

                      let hasPartialEmbedded: string | null = null;

                      for (const cid of o.sharedClassIds) {
                        const counterpart = embeddedMap.counterparts.get(cid);
                        if (counterpart) {
                          const inBoth = o.sharedClassIds.includes(counterpart.classId);
                          if (!inBoth) {
                            const role = embeddedMap.roles.get(cid);
                            hasPartialEmbedded = role === "theory" ? "ETH only" : "ELA only";
                            break;
                          }
                        }
                      }

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
                              {o.source === "registered" ? <VerifiedTick /> : null}
                            </div>
                            <p className="text-xs text-muted-foreground truncate">
                              {o.regNo && <span>{o.regNo}</span>}
                              {o.regNo ? " · " : ""}
                              <span>
                                {o.identical
                                  ? "Exactly your timetable"
                                  : codes.length
                                    ? codes.join(" · ")
                                    : `${o.shared} shared classes`}
                              </span>
                            </p>
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0">
                            {hasPartialEmbedded && (
                              <ToneBadge size="sm" tone="amber">
                                {hasPartialEmbedded}
                              </ToneBadge>
                            )}
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

      {renderFriendBottomSheet()}
      {renderProfileBottomSheet()}

      <FacultyReviewSheetHost target={reviewTarget} onClose={closeFacultyReview} />
    </PageShell>
  );
}
