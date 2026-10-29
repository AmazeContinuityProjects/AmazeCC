"use client";

/**
 * The screens a first-time visitor sees *before* the five onboarding steps:
 *
 *   login  →  full-sync progress  →  welcome  →  (hand-off to the steps)
 *
 * They share the onboarding hero's design language (fixed zinc-950 canvas,
 * ambient indigo/violet wash, `font-outfit` display type, zinc-900 cards) so
 * sign-in reads as page one of onboarding rather than a modal bolted on top.
 *
 * The sync screen replaces the sync-engine bottom sheet for the first login:
 * it subscribes to the very same session store the sheet uses, so it reports
 * real progress (and real failures) without a popup covering the hero.
 */

import { useEffect, useRef, useState } from "react";
import { useAtomValue } from "jotai";
import {
  AlertCircle,
  ArrowRight,
  Check,
  CheckCircle2,
  ExternalLink,
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
  Lock,
  Server,
  Shield,
  Sparkles,
  X,
} from "lucide-react";
import { isLoggedInAtom } from "@/store";
import {
  useSyncSession,
  type SyncLogLine,
} from "@/lib/sync-engine/sync-session";
import { classifyAuthFailure, type AuthFailureKind } from "@/lib/sync-engine/errors";
import { getActiveApiUrl, setActiveApiUrl, PRIMARY_API_URL, BACKUP_API_URL, hasBackupApi } from "@/lib/fetch-utils";
import { UNICC_API_URL } from "@/lib/unicc-fallback";
import { useUniccTarget, setUniccTarget, isUniccFallbackEnabled } from "@/lib/useUniccTarget";
import SelectField from "../shared/primitives/SelectField";

export type IntroPhase = "login" | "sync" | "welcome";

export interface IntroLogin {
  username: string;
  password: string;
  setUsername: (value: string) => void;
  setPassword: (value: string) => void;
  /** Resolves `true` when the sign-in landed; `false` when it was rejected. */
  onSignIn: () => Promise<boolean>;
  /** Reason the last attempt failed, straight from the sync log. */
  error: string | null;
  /**
   * Opens the credential editor ("Change Password"). Only offered for the
   * failures a new password actually fixes — see `classifyAuthFailure`.
   */
  onChangePassword?: () => void;
}

interface OnboardingIntroProps {
  initialPhase: Exclude<IntroPhase, "sync">;
  login: IntroLogin;
  /** Called once the student continues past the welcome screen. */
  onDone: () => void;
}

/** Don't flash past the loading screen on a warm cache — but don't stall either. */
const MIN_SYNC_FACE_MS = 1400;

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex flex-col overflow-hidden bg-zinc-950 px-5 text-zinc-100 select-none animate-in fade-in duration-300 sm:px-8">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 left-1/2 h-[550px] w-[550px] -translate-x-1/2 rounded-full bg-indigo-600/10 blur-[150px]" />
        <div className="absolute -bottom-40 left-1/2 h-[550px] w-[550px] -translate-x-1/2 rounded-full bg-violet-600/10 blur-[150px]" />
      </div>
      <div className="relative z-10 flex min-h-0 flex-1 flex-col overflow-y-auto pt-[calc(env(safe-area-inset-top,0px)+1.25rem)] pb-[calc(env(safe-area-inset-bottom,0px)+1.25rem)] sm:pt-[calc(env(safe-area-inset-top,0px)+1.75rem)] sm:pb-[calc(env(safe-area-inset-bottom,0px)+1.75rem)]">{children}</div>
    </div>
  );
}

function Brand() {
  return (
    <div className="flex shrink-0 items-center gap-2.5">
      <img
        src="/logo.png"
        alt=""
        width={28}
        height={28}
        decoding="async"
        className="h-7 w-7 rounded-xl border border-zinc-800 bg-zinc-900 p-0.5 object-contain"
      />
      <span className="text-xs font-black uppercase tracking-[0.2em] text-zinc-500 font-outfit">AmazeCC</span>
    </div>
  );
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <label className="text-[10px] font-black uppercase tracking-wider text-zinc-400 font-outfit">{children}</label>;
}

const inputClass =
  "w-full rounded-xl border border-zinc-800 bg-zinc-950/60 px-4 py-2.5 text-sm font-bold text-white transition-all placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-indigo-500";

const ctaClass =
  "flex w-full items-center justify-center gap-2 rounded-2xl bg-indigo-600 px-5 py-3.5 font-black text-sm text-white shadow-xl shadow-indigo-600/20 transition-all hover:bg-indigo-500 active:scale-[0.98] cursor-pointer font-outfit tracking-wide";

export default function OnboardingIntro({ initialPhase, login, onDone }: OnboardingIntroProps) {
  const [phase, setPhase] = useState<IntroPhase>(initialPhase);
  const [showPassword, setShowPassword] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const syncStartedAt = useRef(0);

  const [activeApi, setActiveApi] = useState("");
  const uniccTarget = useUniccTarget();
  const uniccAvailable = isUniccFallbackEnabled();
  const targetValue = uniccTarget === "unicc" ? UNICC_API_URL : activeApi;

  const isLoggedIn = useAtomValue(isLoggedInAtom);
  const session = useSyncSession();

  useEffect(() => {
    setActiveApi(getActiveApiUrl());
  }, []);

  const handleApiChange = (newUrl: string) => {
    if (newUrl === UNICC_API_URL) {
      // UniCC is a routing preference, not a new host: it is tried first for the
      // routes it implements and the AmazeCC hosts keep serving everything else.
      setUniccTarget("unicc");
      setActiveApi(PRIMARY_API_URL);
    } else {
      setUniccTarget("amazecc");
      setActiveApiUrl(newUrl);
      setActiveApi(newUrl);
    }
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (submitting) return;
    if (!login.username.trim() || !login.password) {
      setLocalError("Enter your VTOP user ID and password to continue.");
      return;
    }
    setLocalError(null);
    setSubmitting(true);
    syncStartedAt.current = Date.now();
    setPhase("sync");
    const ok = await login.onSignIn();
    setSubmitting(false);
    if (!ok) setPhase("login");
  };

  // Full sync → welcome. The session reports per-module progress, and the run
  // only counts as "some data" once the app is actually signed in (or the run
  // reported success), so a failed attempt bounces back to the login page.
  useEffect(() => {
    if (phase !== "sync") return;

    if (session.outcome === "error" && !isLoggedIn) {
      setPhase("login");
      return;
    }

    const ready = isLoggedIn || session.outcome === "success";
    if (!ready) return;

    const elapsed = Date.now() - syncStartedAt.current;
    const timer = setTimeout(() => setPhase("welcome"), Math.max(0, MIN_SYNC_FACE_MS - elapsed));
    return () => clearTimeout(timer);
  }, [phase, isLoggedIn, session.outcome]);

  // A retry can also start somewhere other than this form's Continue button —
  // most importantly the "Change Password" editor, which re-runs the login with
  // the freshly saved credentials. Follow it onto the sync screen so the student
  // watches the retry instead of staring at a login form.
  useEffect(() => {
    if (phase !== "login" || submitting) return;
    if (session.open && session.outcome === null) setPhase("sync");
  }, [phase, submitting, session.open, session.outcome]);

  // Why the sign-in was rejected, as far as the message can say. The same
  // classifier the sync sheet uses, so the two screens never give different
  // advice: a named bad password gets a "Change Password" fix here, while a
  // captcha / rate limit / bare "login failed" can only be resolved on VTOP.
  const authFailure: AuthFailureKind | null = (() => {
    let kind: AuthFailureKind | null = null;
    for (const line of session.lines) {
      if (line.status !== "error") continue;
      const found = classifyAuthFailure(line.text);
      // A named bad password is the more specific answer, so it wins.
      if (found === "bad-credentials") return found;
      if (found) kind = found;
    }
    return kind;
  })();

  // `login.error` only knows about failures from the Continue button. A retry
  // started by the credential editor reports through the session log instead,
  // so fall back to the last line the run actually wrote.
  const lastSessionError = [...session.lines].reverse().find((line) => line.status === "error")?.text ?? null;
  const error = localError ?? login.error ?? lastSessionError;

  return (
    <Shell>
      <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col justify-center gap-6 py-2">
        {phase === "login" && (
          <div className="grid w-full animate-in fade-in slide-in-from-bottom-4 duration-300 gap-6 lg:grid-cols-2 lg:items-center lg:gap-10">
            {/* Pitch (design language of the hero pages) */}
            <div className="space-y-4 text-left">
              <Brand />
              <p className="inline-flex w-fit items-center gap-1.5 rounded-full border border-indigo-500/20 bg-indigo-500/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-indigo-400 font-outfit">
                <Sparkles size={11} /> Step one of onboarding
              </p>
              <h1 className="text-3xl font-black leading-[1.05] tracking-tight text-white font-outfit sm:text-4xl">
                Bring your VIT life
                <span className="block bg-gradient-to-r from-indigo-400 via-violet-400 to-fuchsia-400 bg-clip-text text-transparent">
                  into one place.
                </span>
              </h1>
              <p className="max-w-md text-sm leading-relaxed text-zinc-400">
                Sign in with your VTOP credentials and we will pull attendance, grades, your timetable and campus services
                straight from the source.
              </p>
              <ul className="flex flex-wrap gap-2 text-[10px] font-bold text-zinc-400">
                {[
                  { icon: Lock, text: "Stays in this browser" },
                  { icon: Shield, text: "Verified with VTOP" },
                  { icon: Server, text: "Free forever" },
                ].map((item) => (
                  <li
                    key={item.text}
                    className="flex items-center gap-1.5 rounded-full border border-zinc-800 bg-zinc-900/60 px-3 py-1.5"
                  >
                    <item.icon size={11} className="text-indigo-400" />
                    {item.text}
                  </li>
                ))}
              </ul>
            </div>

            {/* Sign-in card */}
            <div className="rounded-[28px] border border-zinc-800/80 bg-zinc-900/80 p-5 shadow-2xl backdrop-blur-xl sm:p-6">
              <form onSubmit={submit} className="space-y-4 text-left">
                <div className="space-y-1 border-b border-zinc-800 pb-3">
                  <h2 className="text-sm font-black uppercase tracking-wider text-white font-outfit">Sign in to VTOP</h2>
                  <p className="text-[11px] text-zinc-500">Just your user ID and password.</p>
                </div>

                <div className="flex items-center justify-between gap-3 rounded-xl border border-zinc-800 bg-zinc-950/60 px-3 py-2.5">
                  <div className="flex items-center gap-2 text-[11px] font-bold text-zinc-400">
                    <Server size={13} className="text-zinc-500" />
                    Target server
                  </div>
                  <SelectField
                    value={targetValue}
                    onChange={handleApiChange}
                    options={[
                      { value: PRIMARY_API_URL, label: "AmazeCC" },
                      ...(hasBackupApi() ? [{ value: BACKUP_API_URL, label: "AmazeCC (Backup)" }] : []),
                      ...(uniccAvailable ? [{ value: UNICC_API_URL, label: "UniCC" }] : []),
                    ]}
                    searchable={false}
                    size="sm"
                    role="group"
                    aria-label="Target server"
                    className="w-auto shrink-0 [&>button:first-child]:border-none [&>button:first-child]:bg-transparent [&>button:first-child]:px-0 [&>button:first-child]:text-indigo-400"
                  />
                </div>

                {uniccTarget === "unicc" && (
                  <p className="rounded-lg border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-[10px] leading-relaxed text-amber-400">
                    Your VTOP password is sent to <span className="font-bold">api.uni-cc.site</span>, a third-party
                    service, to sign you in. Everything else still comes from AmazeCC.
                  </p>
                )}

                <div className="space-y-1.5">
                  <FieldLabel>VTOP user ID</FieldLabel>
                  <input
                    className={`${inputClass} uppercase`}
                    value={login.username}
                    onChange={(e) => login.setUsername(e.target.value)}
                    placeholder="E.g., VITUSER12345"
                    autoComplete="username"
                    autoCapitalize="characters"
                    spellCheck={false}
                    disabled={submitting}
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <FieldLabel>Password</FieldLabel>
                  <div className="relative">
                    <input
                      type={showPassword ? "text" : "password"}
                      className={`${inputClass} pr-11`}
                      value={login.password}
                      onChange={(e) => login.setPassword(e.target.value)}
                      placeholder="••••••••"
                      autoComplete="current-password"
                      disabled={submitting}
                      required
                    />
                    <button
                      type="button"
                      aria-label={showPassword ? "Hide password" : "Show password"}
                      onClick={() => setShowPassword((prev) => !prev)}
                      className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded-lg p-2 text-zinc-500 transition-colors hover:text-white"
                    >
                      {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                  </div>
                </div>

                {error && (
                  <SignInRejection
                    authFailure={authFailure}
                    message={error}
                    onChangePassword={login.onChangePassword}
                  />
                )}

                <button type="submit" className={ctaClass} disabled={submitting}>
                  {submitting ? <Loader2 size={15} className="animate-spin" /> : null}
                  <span>{submitting ? "Signing in…" : "Continue"}</span>
                  {!submitting && <ArrowRight size={15} />}
                </button>

                <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-[10px] text-zinc-500">
                  <span>Credentials never leave this browser.</span>
                  <a href="/ffcs/" className="font-bold text-indigo-400 transition-colors hover:text-indigo-300">
                    Skip — open FFCS Planner
                  </a>
                </div>
              </form>
            </div>
          </div>
        )}

        {phase === "sync" && <SyncFace progress={session.progress} lines={session.lines} title={session.title} />}

        {phase === "welcome" && <WelcomeFace onDone={onDone} />}
      </div>
    </Shell>
  );
}

/**
 * Why the last sign-in was refused, and what to do about it.
 *
 * Mirrors the sync sheet's rejected-sign-in panel (`SyncNotification`) so the
 * loader screen and the login page never disagree:
 *
 * - `bad-credentials` — VTOP named the user ID / password as wrong. The saved
 *   password is the fix, so the credential editor is offered inline, plus a
 *   link to reset it on VTOP itself.
 * - `unknown` — a captcha, a rate limit, a lock-out, or a bare "login failed".
 *   A new password here will not clear those, so the only honest advice is to
 *   go and change it on VTOP.
 */
function SignInRejection({
  authFailure,
  message,
  onChangePassword,
}: {
  authFailure: AuthFailureKind | null;
  message: string;
  onChangePassword?: () => void;
}) {
  // Not a sign-in failure (a timeout, a dropped connection): keep the plain
  // error line — pretending otherwise would send the student to change a
  // password that was never the problem.
  if (!authFailure) {
    return (
      <div
        role="alert"
        className="flex items-start gap-2 rounded-xl border border-rose-500/25 bg-rose-500/10 px-3 py-2.5 text-[11px] font-semibold text-rose-400"
      >
        <AlertCircle size={14} className="mt-0.5 shrink-0" />
        <span className="min-w-0 break-words">{message}</span>
      </div>
    );
  }

  const badCredentials = authFailure === "bad-credentials";

  return (
    <div
      role="alert"
      className="space-y-3 rounded-xl border border-amber-500/25 bg-amber-500/10 p-3.5 text-left"
    >
      <div className="flex items-start gap-2">
        <KeyRound size={14} className="mt-0.5 shrink-0 text-amber-400" />
        <div className="min-w-0 space-y-1">
          <p className="text-[10px] font-black uppercase tracking-wider text-amber-400">
            {badCredentials ? "Check your password" : "Sign-in rejected"}
          </p>
          <p className="text-[11px] font-semibold leading-relaxed text-zinc-300">
            {badCredentials ? (
              <>
                VTOP says that user ID and password don&apos;t match. If you changed your password recently, update it
                here — otherwise VTOP may lock the account after more failed attempts.
              </>
            ) : (
              <>
                VTOP refused the sign-in (a captcha, a rate limit or a lock-out). A new password here won&apos;t clear
                it — please log in to{" "}
                <span className="font-black text-amber-400">vtopcc.vit.ac.in</span> and change your password there.
              </>
            )}
          </p>
          <p className="break-words text-[10px] font-semibold text-zinc-500">{message}</p>
        </div>
      </div>

      {badCredentials && onChangePassword && (
        <button
          type="button"
          onClick={onChangePassword}
          className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-3 text-[10px] font-black uppercase tracking-wider text-white shadow-md shadow-indigo-500/20 transition-colors hover:bg-indigo-500 active:scale-[0.985]"
        >
          <KeyRound size={11} />
          <span>Change Password</span>
        </button>
      )}

      <a
        href="https://vtopcc.vit.ac.in"
        target="_blank"
        rel="noreferrer"
        className={`flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl border border-amber-500/25 px-4 py-3 text-[10px] font-black uppercase tracking-wider transition-colors active:scale-[0.985] ${
          badCredentials
            ? "bg-amber-500/10 text-amber-300 hover:bg-amber-500/20"
            : "bg-amber-500 text-white shadow-md shadow-amber-500/25 hover:bg-amber-600"
        }`}
      >
        <ExternalLink size={11} />
        <span>{badCredentials ? "Reset on VTOP" : "Change Password on VTOP"}</span>
      </a>
    </div>
  );
}

/** Big percentage, spinner and the live module log — the first-login sync screen. */
function SyncFace({ progress, lines, title }: { progress: number; lines: SyncLogLine[]; title: string }) {
  const pct = Math.max(0, Math.min(100, Math.round(progress)));
  const R = 84;
  const C = 2 * Math.PI * R;
  const recent = lines.slice(-4);

  return (
    <div
      className="flex animate-in fade-in slide-in-from-bottom-4 duration-300 flex-col items-center justify-center gap-6 text-center"
      role="status"
      aria-live="polite"
      aria-label={`Full sync ${pct} percent complete`}
    >
      <div className="relative h-44 w-44 shrink-0">
        <svg viewBox="0 0 200 200" className="h-full w-full -rotate-90">
          <defs>
            <linearGradient id="onboarding-sync-grad" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#818cf8" />
              <stop offset="100%" stopColor="#a855f7" />
            </linearGradient>
          </defs>
          <circle cx="100" cy="100" r={R} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth="11" />
          <circle
            cx="100"
            cy="100"
            r={R}
            fill="none"
            stroke="url(#onboarding-sync-grad)"
            strokeWidth="11"
            strokeLinecap="round"
            strokeDasharray={C}
            strokeDashoffset={C - (pct / 100) * C}
            className="transition-[stroke-dashoffset] duration-500 ease-out"
          />
        </svg>
        {/* Loading icon: a comet that keeps sweeping while the bar itself is honest. */}
        <svg viewBox="0 0 200 200" className="absolute inset-0 h-full w-full animate-spin -rotate-90 [animation-duration:1.15s]">
          <circle
            cx="100"
            cy="100"
            r={R}
            fill="none"
            stroke="#a5b4fc"
            strokeWidth="3"
            strokeLinecap="round"
            strokeDasharray="18 600"
            opacity="0.85"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-4xl font-black text-white tabular-nums font-outfit">{pct}%</span>
          <span className="mt-1 text-[10px] font-black uppercase tracking-[0.18em] text-zinc-500 font-outfit">
            {title || "Full Sync"}
          </span>
        </div>
      </div>

      <div className="space-y-1.5">
        <h2 className="text-xl font-black tracking-tight text-white font-outfit sm:text-2xl">
          Preparing your workspace
        </h2>
        <p className="text-xs text-zinc-400">A one-time full sync — attendance, grades, timetable and campus services.</p>
      </div>

      <div className="w-full max-w-md space-y-3">
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-zinc-900">
          <div
            className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-violet-500 transition-[width] duration-500 ease-out"
            style={{ width: `${pct}%` }}
          />
        </div>

        <ul className="space-y-1.5 text-left">
          {recent.map((line, idx) => (
            <li
              key={`${line.text}-${idx}`}
              className="flex items-start gap-2 rounded-lg border border-zinc-900 bg-zinc-900/50 px-3 py-2 text-[11px] text-zinc-400"
            >
              <LineIcon status={line.status} />
              <span className="min-w-0 break-words">{line.text}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function LineIcon({ status }: { status: SyncLogLine["status"] }) {
  if (status === "success") return <Check size={12} className="mt-0.5 shrink-0 text-emerald-400" />;
  if (status === "error") return <X size={12} className="mt-0.5 shrink-0 text-rose-400" />;
  return <Loader2 size={12} className="mt-0.5 shrink-0 animate-spin text-indigo-400" />;
}

/** The celebration beat between "enough data is here" and the onboarding steps. */
function WelcomeFace({ onDone }: { onDone: () => void }) {
  return (
    <div className="flex animate-in fade-in zoom-in-95 duration-300 flex-col items-center justify-center gap-6 text-center">
      <div className="relative">
        <span
          aria-hidden="true"
          className="absolute inset-0 animate-ping rounded-full bg-indigo-500/20 blur-xl"
        />
        <div className="relative flex h-24 w-24 items-center justify-center rounded-full border border-indigo-500/30 bg-indigo-500/10">
          <CheckCircle2 className="h-12 w-12 text-indigo-400" strokeWidth={1.75} />
        </div>
      </div>

      <div className="space-y-2">
        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-indigo-400 font-outfit">
          Sign-in complete
        </p>
        <h2 className="text-3xl font-black tracking-tight text-white font-outfit sm:text-4xl">Welcome to AmazeCC</h2>
        <p className="mx-auto max-w-md text-sm leading-relaxed text-zinc-400">
          Your records are on this device. Now a few quick choices and your workspace is ready.
        </p>
      </div>

      <ul className="flex flex-wrap justify-center gap-2 text-[10px] font-bold text-zinc-300">
        {["Attendance & marks", "Grades & timetable", "Campus services"].map((label) => (
          <li
            key={label}
            className="flex items-center gap-1.5 rounded-full border border-zinc-800 bg-zinc-900/70 px-3 py-1.5"
          >
            <Check size={11} className="text-emerald-400" />
            {label}
          </li>
        ))}
      </ul>

      <button type="button" onClick={onDone} className="flex w-full max-w-xs items-center justify-center gap-2 rounded-2xl bg-indigo-600 px-5 py-3.5 font-black text-sm text-white shadow-xl shadow-indigo-600/20 transition-all hover:bg-indigo-500 active:scale-[0.98] cursor-pointer font-outfit tracking-wide">
        Let&apos;s set up my workspace
        <ArrowRight size={15} />
      </button>
    </div>
  );
}
