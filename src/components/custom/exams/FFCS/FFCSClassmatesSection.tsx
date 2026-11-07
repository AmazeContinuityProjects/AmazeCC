"use client";

/**
 * Find classmates: the FFCS friend finder, inside the planner's Friends page.
 *
 * Share a timetable (or your registered one, read from VTOP) and see who else
 * picked the same sections. This replaces sites where you type in your own name
 * and protect it with a PIN: here the name is the one VTOP holds for your
 * account, the server checks every class against the registration report, and
 * the matching happens on the server. All the logic is in amazecc-api's
 * `/api/social/ffcs-match`, and `@/lib/ffcsClassmates` is the thin client.
 *
 * Privacy, as the student sees it:
 * - you are only shown to people who share at least one section with you;
 * - they see your name and which of their sections you share, nothing else;
 * - you only see others while you are visible yourself, and you can hide or
 *   remove yourself at any time.
 *
 * Layout: one column on phones; on laptops the intro and the picker sit side
 * by side, and the matches split into "most in common" beside "your sections".
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { useAtomValue } from "jotai";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  BadgeCheck,
  BookOpen,
  Check,
  Clock,
  Eye,
  EyeOff,
  Link2,
  Loader2,
  LogIn,
  LogOut,
  Pencil,
  RefreshCw,
  Share2,
  ShieldCheck,
  Sparkles,
  UserRound,
  UsersRound,
} from "lucide-react";
import { demoModeAtom, isLoggedInAtom } from "@/store";
import {
  callClassmates,
  classmatesSemester,
  ClassmatesError,
  displayName,
  ensureClassmatesSession,
  planClassIds,
  type ClassmatePerson,
  type ClassmateSection,
  type ClassmatesRequest,
  type ClassmatesState,
} from "@/lib/ffcsClassmates";
import { prepareSignIn } from "@/lib/signInReturn";
import type { FFCSSemesterId } from "@/lib/ffcsReports";
import type { ParsedCourse, TimetableState } from "@/lib/ffcsTypes";
import { GHOST_BUTTON, LIST_SHELL, TILE_CARD, TONE_ICON_TILE } from "@/lib/uiTokens";
import { ListSkeleton, RadioGroup, SectionHeader, StatTile, Switch, ToneBadge } from "../../shared/primitives";

export interface FFCSClassmatesSectionProps {
  semesterId: FFCSSemesterId;
  timetables: TimetableState[];
  activeTimetableId: string;
  /** The planner's loaded report for `semesterId`, or `[]` while it loads. */
  reportCourses: ParsedCourse[];
}

const REGISTERED = "registered";
/** Where "Sign in" and "Invite friends" point: the planner, opened on this section. */
const CLASSMATES_PATH = "/ffcs/?open=classmates";

const PRIMARY_BUTTON =
  "inline-flex items-center justify-center gap-2 rounded-2xl bg-indigo-500 hover:bg-indigo-600 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100 text-white font-bold px-5 py-3 text-sm shadow-lg shadow-indigo-500/20 transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 focus-visible:ring-offset-background";
const ACTION_BUTTON = `${GHOST_BUTTON} justify-center py-2.5 text-xs font-bold disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500`;

const AVATAR_TONES = ["indigo", "emerald", "amber", "violet", "sky", "red"] as const;

function initials(name: string): string {
  const parts = displayName(name).split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "") + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase() || "?";
}

/** A stable colour per person, so the same classmate looks the same in every list. */
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
      <span className="truncate">{displayName(person.name) || person.handle}</span>
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

/** Copy (or natively share) the link that opens this page, so friends can join. */
function InviteButton({ className = "" }: { className?: string }) {
  const [copied, setCopied] = useState(false);
  const invite = async () => {
    const url = `${window.location.origin}${CLASSMATES_PATH}`;
    const text = "See who picked the same FFCS sections as you on AmazeCC";
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

function SectionCard({ section }: { section: ClassmateSection }) {
  const o = section.offering;
  const count = section.people.length;
  return (
    <div className="px-4 py-4 space-y-3">
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
            <ToneBadge size="sm" tone={count ? "indigo" : "zinc"} className="shrink-0">
              {count ? `${count} ${count === 1 ? "classmate" : "classmates"}` : "No one yet"}
            </ToneBadge>
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

export default function FFCSClassmatesSection({
  semesterId,
  timetables,
  activeTimetableId,
  reportCourses,
}: FFCSClassmatesSectionProps) {
  const router = useRouter();
  const isLoggedIn = useAtomValue(isLoggedInAtom);
  const isDemo = useAtomValue(demoModeAtom);
  const vtopSemester = classmatesSemester(semesterId);
  const canUse = isLoggedIn && !isDemo && Boolean(vtopSemester);

  const [state, setState] = useState<ClassmatesState | null>(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<{ message: string; retry: ClassmatesRequest; needsSignIn: boolean } | null>(null);
  const [reauthing, setReauthing] = useState(false);
  const [editing, setEditing] = useState(false);
  const [confirmingRemove, setConfirmingRemove] = useState(false);

  const plans = useMemo(
    () =>
      timetables.map((t) => ({
        timetable: t,
        ...(reportCourses.length ? planClassIds(t, reportCourses) : { classIds: [], unresolved: [] }),
      })),
    [timetables, reportCourses],
  );
  const usablePlans = plans.filter((p) => p.classIds.length > 0);
  const defaultChoice =
    usablePlans.find((p) => p.timetable.id === activeTimetableId)?.timetable.id ??
    usablePlans[0]?.timetable.id ??
    REGISTERED;
  const [pickedChoice, setChoice] = useState<string | null>(null);
  // Until the student picks, follow the best default (it changes as the report loads).
  const choice = pickedChoice ?? defaultChoice;
  const chosenPlan = plans.find((p) => p.timetable.id === choice);

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
          setChoice(null);
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

  // One request per open: the response carries both your state and your matches.
  useEffect(() => {
    if (canUse) void run({ op: "get" }, "load");
  }, [canUse, run]);

  // Map class id → course code, for "you share BACSE104, BAMAT207" lines.
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

  /* ── Signed out / demo ─────────────────────────────────────────── */
  if (!isLoggedIn || isDemo) {
    return (
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
              : "Share your FFCS plan and see who picked the same faculty and slots as you."}
          </p>
        </div>
        <div className="my-6">
          <TrustPoints />
        </div>
        {isDemo ? (
          <Link href="/" className={`${PRIMARY_BUTTON} w-full`}>
            <LogIn className="w-4 h-4" /> Go to sign in
          </Link>
        ) : (
          <button
            type="button"
            className={`${PRIMARY_BUTTON} w-full`}
            onClick={() => router.push(prepareSignIn(CLASSMATES_PATH))}
          >
            <LogIn className="w-4 h-4" /> Sign in with VTOP
          </button>
        )}
        <p className="mt-3 text-center text-xs text-muted-foreground">
          You&apos;ll come straight back here after signing in.
        </p>
      </div>
    );
  }

  /* ── Mock / unsupported list ───────────────────────────────────── */
  if (!vtopSemester) {
    return (
      <div className={`${TILE_CARD} max-w-xl mx-auto text-center space-y-3`}>
        <span
          className={`mx-auto w-14 h-14 rounded-2xl border flex items-center justify-center ${TONE_ICON_TILE.amber}`}
        >
          <AlertTriangle className="w-7 h-7" />
        </span>
        <h3 className="text-lg font-black font-outfit tracking-tight text-text-heading">
          Switch to a final course list
        </h3>
        <p className="text-sm text-muted-foreground max-w-sm mx-auto">
          The friend finder works with the final Winter or Fall 2026-27 list. Pick one in the planner&apos;s course-list
          switch, then come back.
        </p>
      </div>
    );
  }

  /**
   * What the error banner offers. A sign-in problem gets "Sign in again": a
   * fresh login with the saved credentials, then the same request; if even that
   * fails, the sign-in page, which returns here afterwards. Anything else gets
   * "Try again" for reads (a failed save is retried by pressing the save button).
   */
  const reauthenticate = async (retry: ClassmatesRequest) => {
    setReauthing(true);
    try {
      await ensureClassmatesSession(true);
      await run(retry, retry.op === "get" ? "load" : "action");
    } catch {
      router.push(prepareSignIn(CLASSMATES_PATH));
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

  /* ── First load ────────────────────────────────────────────────── */
  if (!state) {
    if (error) {
      return (
        <Notice tone={error.needsSignIn ? "amber" : "red"} action={errorAction(error)}>
          {error.message}
        </Notice>
      );
    }
    return (
      <div className="space-y-4" aria-busy="true" aria-label="Loading the friend finder">
        <div className={`${TILE_CARD} h-28 animate-pulse`} />
        <ListSkeleton rows={4} leading="dot" trailing />
      </div>
    );
  }

  const me = state.me;
  const showPicker = !me.joined || editing;
  const errorNotice = error ? (
    <Notice tone={error.needsSignIn ? "amber" : "red"} action={errorAction(error)}>
      {error.message}
    </Notice>
  ) : null;

  /* ── Choose what to share (first time, or "Change classes") ───── */
  if (showPicker) {
    const canPublish = !busy && (choice === REGISTERED || Boolean(chosenPlan?.classIds.length));
    const publish = () => {
      if (choice === REGISTERED) void run({ op: "publish", source: "registered" }, "action");
      else if (chosenPlan) void run({ op: "publish", source: "planned", classIds: chosenPlan.classIds }, "action");
    };
    const options = [
      ...usablePlans.map((p) => ({
        value: p.timetable.id,
        label: p.timetable.name,
        icon: <Pencil className="w-4 h-4" />,
        description: (
          <span className="block space-y-0.5">
            <span className="block">
              {p.classIds.length} {p.classIds.length === 1 ? "class" : "classes"}
              {p.timetable.id === activeTimetableId ? " · open in the planner" : ""}
            </span>
            {p.unresolved.length ? (
              <span className="block text-amber-600 dark:text-amber-400">
                Won&apos;t be shared: {p.unresolved.join(", ")}
              </span>
            ) : null}
          </span>
        ),
      })),
      {
        value: REGISTERED,
        label: "My registered timetable",
        icon: <BadgeCheck className="w-4 h-4" />,
        description: "Read from VTOP after registration. Others see you as verified.",
      },
    ];

    return (
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
                Pick a timetable. We&apos;ll show everyone who chose the same faculty and slot for any of its courses.
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
            {reportCourses.length === 0 ? (
              <p className="text-sm text-muted-foreground flex items-center gap-2 px-1">
                <Loader2 className="w-4 h-4 animate-spin" /> Loading the course list…
              </p>
            ) : usablePlans.length === 0 ? (
              <p className="text-sm text-muted-foreground px-1">
                None of your timetables has courses from the final list yet. Add some in the planner, or share your
                registered timetable below.
              </p>
            ) : null}
            <RadioGroup name="ffcs-classmates-source" options={options} value={choice} onChange={setChoice} />
            <div className="flex flex-col-reverse sm:flex-row gap-2 pt-1">
              {editing ? (
                <button
                  type="button"
                  className={`${ACTION_BUTTON} sm:w-auto py-3`}
                  disabled={busy}
                  onClick={() => {
                    setEditing(false);
                    setChoice(null);
                  }}
                >
                  Cancel
                </button>
              ) : null}
              <button
                type="button"
                className={`${PRIMARY_BUTTON} w-full sm:flex-1`}
                disabled={!canPublish}
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
    );
  }

  /* ── Joined ─────────────────────────────────────────────────────── */
  const uniqueClassmates = new Set(state.sections.flatMap((s) => s.people.map((p) => p.handle))).size;
  const sectionsWithPeople = state.sections.filter((s) => s.people.length).length;
  const hasVerified = state.sections.some((s) => s.people.some((p) => p.source === "registered"));

  return (
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
              setChoice(me.source === "registered" ? REGISTERED : null);
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

          <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:items-start">
            <section className="space-y-2 lg:sticky lg:top-4">
              <SectionHeader icon={Sparkles} title="Most in common" count={state.overlaps.length} />
              {state.overlaps.length ? (
                <div className={LIST_SHELL}>
                  {state.overlaps.map((o) => {
                    const codes = o.sharedClassIds.map((id) => codeOf.get(id)).filter(Boolean);
                    return (
                      <div key={o.handle} className="flex items-center gap-3 px-4 py-3">
                        <Avatar person={o} />
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-bold text-text-heading flex items-center gap-1.5 min-w-0">
                            <span className="truncate">{displayName(o.name) || o.handle}</span>
                            {o.source === "registered" ? <VerifiedTick /> : null}
                          </p>
                          <p className="text-xs text-muted-foreground truncate">
                            {o.identical
                              ? "Exactly your timetable"
                              : codes.length
                                ? codes.join(" · ")
                                : `${o.shared} sections together`}
                          </p>
                        </div>
                        <ToneBadge size="sm" tone={o.identical ? "emerald" : "indigo"} className="shrink-0">
                          {o.identical ? "Identical" : `${o.shared} shared`}
                        </ToneBadge>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="rounded-2xl border border-dashed border-border-strong dark:border-border px-4 py-6 text-center space-y-3">
                  <p className="text-sm text-muted-foreground">
                    Nobody shares two or more of your sections yet. Invite your friends to see who you&apos;ll be with.
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

            <section className="space-y-2">
              <SectionHeader icon={Link2} title="Your sections" count={state.sections.length} />
              <div className={LIST_SHELL}>
                {sortedSections.map((s) => (
                  <SectionCard key={s.classId} section={s} />
                ))}
              </div>
            </section>
          </div>
        </>
      )}
    </div>
  );
}
