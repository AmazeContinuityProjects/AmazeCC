"use client";

/**
 * Pair with someone by their handle.
 *
 * This is the first surface in the app that calls `POST /api/social/pair/claim`.
 * The flow it drives:
 *
 *   1. `lookupPerson(handle)` confirms the handle exists, so the user gets a real
 *      answer before a grant is minted rather than a 404 afterwards.
 *   2. `claimPair(handle, visibility)` mints the grant. Pairing is MUTUAL — the
 *      other student is not asked to accept, and both sides end up able to read
 *      each other. That is disclosed here, before the claim, because it is the
 *      one part of this screen the user cannot undo by clicking cancel.
 *   3. `markDirty()` schedules the debounced push, so the peer and the secret
 *      arrive in the UI without a second manual sync.
 */

import { useCallback, useState } from "react";
import { Camera, Link2, Loader2, ShieldCheck, UserCheck, UserX } from "lucide-react";
import BottomSheet from "../shared/BottomSheet";
import ScanHandleSheet from "./ScanHandleSheet";
import { FIELD_INPUT, TONE_BADGE } from "@/lib/libraries/ui";
import { claimPair, lookupPerson, SocialApiError } from "@/lib/social/client";
import { isSelfHandle, isValidHandle, normaliseHandle } from "@/lib/social/handle";
import { credentialManager } from "@/lib/sync-engine/credential-manager";
import { AuthError } from "@/lib/sync-engine/errors";
import { useSocialData } from "@/lib/social/useSocialData";
import type { SocialVisibility } from "@/lib/social/types";


export default function AddPeerSheet({
  onClose,
  onPaired,
}: {
  onClose: () => void;
  onPaired?: (handle: string) => void;
}) {
  const { markDirty, handle: myHandle } = useSocialData();
  const [handle, setHandle] = useState("");
  const [visibility, setVisibility] = useState<SocialVisibility>("coarse");
  const [busy, setBusy] = useState(false);
  const [stage, setStage] = useState<"idle" | "checking" | "ready" | "claimed">("idle");
  const [error, setError] = useState<string | null>(null);
  /** Right shape, but no student has it. Kept apart from a format error. */
  const [notFound, setNotFound] = useState(false);
  const [foundName, setFoundName] = useState<string>("");
  const [scanning, setScanning] = useState(false);

  const reset = useCallback(() => {
    setHandle("");
    setVisibility("coarse");
    setBusy(false);
    setStage("idle");
    setError(null);
    setNotFound(false);
    setFoundName("");
  }, []);

  const close = useCallback(() => {
    reset();
    onClose();
  }, [reset, onClose]);

  /** Your own handle cannot be a peer, and the server would answer 409 anyway. */
  const isSelf = isSelfHandle(handle, myHandle);

  /**
   * Look the handle up before letting anyone pair with it.
   *
   * Three outcomes are kept apart on purpose, because they need different
   * messages: the handle is the wrong SHAPE, the handle is the right shape but
   * nobody has it, or the server could not be reached. Collapsing them into one
   * "invalid handle" is how a real person gets told their friend's handle is
   * broken when the truth is that the API is down.
   */
  const checkFor = useCallback(
    async (raw: string) => {
      const candidate = normaliseHandle(raw);
      setError(null);
      setNotFound(false);

      if (myHandle && candidate === myHandle) {
        setStage("idle");
        return;
      }
      if (!isValidHandle(candidate)) {
        setStage("idle");
        setError("That does not look like a handle. It should be AMZ-XXXX-XXXX, like AMZ-7K2P-9RTW.");
        return;
      }

      setStage("checking");
      try {
        // A second device resolves a handle through the server, not from a local
        // cache, so this genuinely needs a live VTOP session — and the session may
        // have aged out since the user last synced. Without this the lookup went
        // out unauthenticated and came back as an indistinguishable 404, which
        // reads as "your friend does not exist".
        await credentialManager.ensureVtopSession();
        const res = await lookupPerson(candidate);
        setFoundName(res.person?.displayName || "");
        setStage("ready");
      } catch (err: unknown) {
        setStage("idle");
        if (err instanceof AuthError) {
          // No session at all, or login was refused. Say so instead of implying
          // the handle is wrong.
          setError("Log in to VTOP first — pairing needs a live session.");
        } else if (err instanceof SocialApiError) {
          if (err.code === "handle_not_found") {
            setNotFound(true);
          } else if (err.code === "unexpected_response") {
            setError(
              "The server did not answer properly, so this handle is unverified. If you are pointed at production, the social routes only exist on the local API."
            );
          } else {
            setError(err.detail || err.message);
          }
        } else {
          setError("Could not reach the server. Check your connection and try again.");
        }
      }
    },
    [myHandle]
  );

  /**
   * The field-driven entry point. Takes the handle as an argument rather than
   * reading it off state, so a scan can look up the value it just decoded in the
   * same tick — `setHandle` has not been applied yet at that point, and a
   * `check()` that read `handle` would verify the previous, empty value.
   */
  const check = useCallback(async () => {
    const candidate = normaliseHandle(handle);
    setHandle(candidate);
    await checkFor(candidate);
  }, [handle, checkFor]);

  const claim = useCallback(async () => {
    if (!isValidHandle(handle)) return;
    setBusy(true);
    setError(null);
    setNotFound(false);
    try {
      const res = await claimPair(handle, visibility);
      setStage("claimed");
      setFoundName(res.peer?.name || foundName);
      markDirty();
      onPaired?.(handle);
      // Leave the success state up briefly so the user sees it land.
      setTimeout(() => {
        close();
      }, 900);
    } catch (err: unknown) {
      setBusy(false);
      if (err instanceof SocialApiError) {
        if (err.code === "handle_not_found") {
          setNotFound(true);
          setStage("idle");
          return;
        }
        if (err.code === "already_self") {
          setError("That is your own handle. A pairing needs two people.");
          setStage("idle");
          return;
        }
        setError(err.detail || err.message);
      } else {
        setError("Could not reach the server. Try again.");
      }
    }
  }, [handle, visibility, foundName, markDirty, onPaired, close]);

  return (
    // No `avoidKeyboard` here on purpose. This sheet is tall (input, two
    // visibility cards, the mutuality disclosure, two buttons), so lifting it
    // clear of the keyboard left a short scrolling box and the Pair button
    // below the fold. Letting the keyboard win — the browser resizes the
    // viewport and the content scrolls under it — is what the other 33 sheets
    // do, and it is the behaviour that actually works on a phone.
    <BottomSheet onClose={close} overlayId="social-add-peer" maxWidth="max-w-md">
      <div className="text-left space-y-5">
        <div className="flex items-center gap-3">
          <span className="w-10 h-10 rounded-2xl flex items-center justify-center border border-indigo-500/20 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 shrink-0">
            <Link2 className="w-4.5 h-4.5" />
          </span>
          <div className="min-w-0">
            <h3 className="text-sm font-black text-zinc-900 dark:text-white font-outfit leading-tight">
              Pair with a student
            </h3>
            <p className="text-[11px] text-zinc-500 dark:text-zinc-400 font-medium">
              Enter their handle to share timetables both ways
            </p>
          </div>
        </div>

        <div className="space-y-2">
          <label
            htmlFor="social-peer-handle"
            className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-500 font-outfit block"
          >
            Their handle
          </label>
          <input
            id="social-peer-handle"
            value={handle}
            onChange={(e) => {
              setHandle(e.target.value.toUpperCase());
              setStage("idle");
              setError(null);
            }}
            onBlur={() => void check()}
            onKeyDown={(e) => {
              if (e.key === "Enter") void check();
            }}
            placeholder="AMZ-7K2P-9RTW"
            autoComplete="off"
            spellCheck={false}
            className={`${FIELD_INPUT} font-mono tracking-widest uppercase`}
          />
          <p className="text-[11px] text-zinc-400 dark:text-zinc-500 font-medium leading-relaxed">
            Their handle is on their Social → Share screen. It identifies the person, not their
            schedule.
          </p>
        </div>

        {/* The other half of the exchange: read the QR they are showing. */}
        <button
          type="button"
          onClick={() => setScanning(true)}
          className="w-full flex items-center justify-center gap-2 py-2.5 rounded-2xl border border-indigo-200/70 dark:border-indigo-800/50 bg-indigo-50/60 dark:bg-indigo-950/30 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100/70 dark:hover:bg-indigo-900/40 text-xs font-bold transition-colors cursor-pointer"
        >
          <Camera className="w-4 h-4" />
          <span>Scan their QR instead</span>
        </button>

        {stage === "checking" && (
          <p className="flex items-center gap-2 text-xs font-bold text-zinc-500 dark:text-zinc-400">
            <Loader2 className="w-4 h-4 animate-spin" />
            Checking handle…
          </p>
        )}

        {stage === "ready" && (
          <div className="p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center gap-2">
            <UserCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <p className="text-xs font-bold text-emerald-700 dark:text-emerald-300 truncate">
              {foundName ? `${foundName} · ` : ""}Handle found
            </p>
          </div>
        )}

        {stage === "claimed" && (
          <div className="p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <p className="text-xs font-bold text-emerald-700 dark:text-emerald-300">
              Paired. Their timetable will appear after the next sync.
            </p>
          </div>
        )}

        {isSelf ? (
          <div className="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-start gap-2">
            <UserX className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-px" />
            <p className="text-xs font-bold text-amber-700 dark:text-amber-300">
              That is your own handle. A pairing needs two people — the server rejects this too, so
              enter someone else&apos;s.
            </p>
          </div>
        ) : notFound ? (
          <div className="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-start gap-2">
            <UserX className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-px" />
            <p className="text-xs font-bold text-amber-700 dark:text-amber-300">
              No student has the handle {normaliseHandle(handle)}. Check for a typo — it is easier to
              read the wrong pair of characters than you would think.
            </p>
          </div>
        ) : error ? (
          <p className="p-3 rounded-2xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/40 text-red-600 dark:text-red-400 text-xs font-bold flex items-start gap-2">
            <UserX className="w-4 h-4 shrink-0 mt-px" />
            <span>{error}</span>
          </p>
        ) : null}

        {/* The mutuality disclosure. This is the one irreversible part. */}
        <div className="p-3 rounded-2xl bg-zinc-50 dark:bg-zinc-950/60 border border-zinc-200/70 dark:border-zinc-800 space-y-1.5">
          <p className="text-[11px] font-black text-zinc-700 dark:text-zinc-300 uppercase tracking-wider">
            Before you pair
          </p>
          <p className="text-[11px] text-zinc-500 dark:text-zinc-400 font-medium leading-relaxed">
            Pairing is <strong className="text-zinc-700 dark:text-zinc-200">mutual and immediate</strong>.
            They are not asked to accept, and they will be able to read your timetable for this
            term straight away. Either of you can end it at any time from Pairs.
          </p>
        </div>

        <div className="space-y-2">
          <label className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-500 font-outfit block">
            What you share
          </label>
          <div className="grid grid-cols-2 gap-2">
            {(
              [
                { value: "coarse", label: "Coarse", desc: "Free / busy only" },
                { value: "full", label: "Full", desc: "Course, venue, title" },
              ] as const
            ).map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setVisibility(opt.value)}
                aria-pressed={visibility === opt.value}
                className={`p-3 rounded-2xl border text-left transition-all cursor-pointer ${
                  visibility === opt.value
                    ? "border-indigo-300 dark:border-indigo-700 bg-indigo-50 dark:bg-indigo-950/40"
                    : "border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/60 hover:border-zinc-300"
                }`}
              >
                <p
                  className={`text-xs font-black font-outfit ${
                    visibility === opt.value
                      ? "text-indigo-700 dark:text-indigo-300"
                      : "text-zinc-700 dark:text-zinc-300"
                  }`}
                >
                  {opt.label}
                </p>
                <p className="text-[10.5px] text-zinc-500 dark:text-zinc-400 font-medium mt-0.5">
                  {opt.desc}
                </p>
              </button>
            ))}
          </div>
          <p className="text-[11px] text-zinc-400 dark:text-zinc-500 font-medium leading-relaxed">
            This applies to both of you. You can change it later from Pairs, and it takes effect for
            both directions at once.
          </p>
        </div>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={close}
            className="flex-1 py-3 rounded-2xl bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 font-bold text-xs transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => void claim()}
            disabled={busy || stage !== "ready" || isSelf}
            className={`flex-1 py-3 rounded-2xl font-bold text-xs transition-all cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2 ${TONE_BADGE.indigo} bg-indigo-600 text-white border border-indigo-600 hover:bg-indigo-700`}
          >
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Link2 className="w-4 h-4" />}
            {busy ? "Pairing…" : "Pair"}
          </button>
        </div>
      </div>

      {/* Nested, so system back closes the scanner before this sheet. */}
      {scanning && (
        <ScanHandleSheet
          onClose={() => setScanning(false)}
          onScanned={(scanned) => {
            setScanning(false);
            setHandle(scanned);
            setNotFound(false);
            setError(null);
            setStage("idle");
            // The scanner only accepts a well-formed handle, so this goes
            // straight to the lookup the field would have triggered on blur.
            void checkFor(scanned);
          }}
        />
      )}
    </BottomSheet>
  );
}
