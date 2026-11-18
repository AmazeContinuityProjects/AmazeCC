"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import type { CabShareUser } from "@/types/storage";
import { api } from "@/lib/sync-engine";
import { getValidAccessToken, signInInteractive } from "@/lib/oauth2";
import { AlertCircle, ArrowRight, Car, ExternalLink, Loader2, Phone, Shield } from "lucide-react";
import { ListRowText, ListShell, SectionHeader } from "../../shared/primitives";
import { FIELD_INPUT, LIST_ROW, TILE_CARD, TONE_ICON_TILE } from "@/lib/uiTokens";

const FIELD_LABEL = "block text-[10px] font-black uppercase tracking-wider text-text-muted";
const AUTH_BASE = process.env.NEXT_PUBLIC_AUTH_URL ?? "https://auth.amazecc.com";

const STEPS = [
  ["Verify", "Use your Amaze ID with a linked VTOP account to keep ride requests student-only."],
  ["Post or find", "Choose your hub, travel date, and preferred time."],
  ["Confirm", "Contact details unlock only after the host accepts a request."],
] as const;

type CabShareAuthResponse = {
  success?: boolean;
  error?: string;
  message?: string;
  detail?: { detail?: string };
  phone_required?: boolean;
  user?: CabShareUser & { user_id?: number; phone_number?: string | null };
};

type AuthStep = "checking" | "sign-in" | "link-vtop" | "phone" | "error";

async function responseBody(response: Response): Promise<CabShareAuthResponse | null> {
  return response.json().catch(() => null) as Promise<CabShareAuthResponse | null>;
}

function responseError(body: CabShareAuthResponse | null, status: number): string {
  return body?.detail?.detail || body?.error || body?.message || `Cab Share authentication failed (HTTP ${status}).`;
}

export default function CabShareAuthModal({
  isOpen,
  onAuthSuccess,
}: {
  isOpen: boolean;
  onAuthSuccess: (user: CabShareUser) => void;
}) {
  const [phoneNumber, setPhoneNumber] = useState("");
  const [step, setStep] = useState<AuthStep>("checking");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const onAuthSuccessRef = useRef(onAuthSuccess);

  useEffect(() => {
    onAuthSuccessRef.current = onAuthSuccess;
  }, [onAuthSuccess]);

  const loadCabShareUser = useCallback(async () => {
    const token = await getValidAccessToken();
    if (!token) {
      setStep("sign-in");
      return;
    }

    const response = (await api("cabshare/auth", {
      method: "POST",
      parse: "raw",
      body: {},
    })) as Response;
    const data = await responseBody(response);

    if (response.status === 403 && data?.error === "profile_incomplete") {
      setStep("link-vtop");
      return;
    }
    if (response.status === 401) {
      setStep("sign-in");
      setError("Your Amaze ID session expired. Sign in again to continue.");
      return;
    }
    if (!response.ok || !data?.success || !data.user) {
      throw new Error(responseError(data, response.status));
    }
    if (data.phone_required || !data.user.phone_number?.trim()) {
      setStep("phone");
      return;
    }

    onAuthSuccessRef.current(data.user as CabShareUser);
  }, []);

  const authenticate = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      await loadCabShareUser();
    } catch (cause) {
      setStep("error");
      setError(cause instanceof Error ? cause.message : "Could not connect to Cab Share.");
    } finally {
      setLoading(false);
    }
  }, [loadCabShareUser]);

  useEffect(() => {
    if (isOpen) void authenticate();
  }, [authenticate, isOpen]);

  const handlePhoneSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const digits = phoneNumber.replace(/\D/g, "");
    if (!/^[6-9]\d{9}$/.test(digits)) {
      setError("Enter a valid 10-digit Indian mobile number.");
      return;
    }

    setLoading(true);
    setError("");
    try {
      const token = await getValidAccessToken();
      if (!token) {
        setStep("sign-in");
        return;
      }

      const response = (await api("profile/phone", {
        method: "PATCH",
        parse: "raw",
        body: { phone_number: digits },
      })) as Response;
      const data = await responseBody(response);
      if (!response.ok || !data?.success) {
        throw new Error(responseError(data, response.status));
      }
      await loadCabShareUser();
    } catch (cause) {
      setStep("error");
      setError(cause instanceof Error ? cause.message : "Could not save your phone number.");
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <section className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
      <div className={TILE_CARD}>
        <div className="flex items-start gap-3">
          <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${TONE_ICON_TILE.indigo}`}>
            <Car className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <p className="text-[10px] font-black uppercase tracking-wider text-text-muted">One-time setup</p>
            <h2 className="mt-1 text-lg font-black font-outfit tracking-tight text-text-heading">
              Start using Cab Share
            </h2>
            <p className="mt-1 text-xs font-medium leading-relaxed text-text-secondary dark:text-text-muted">
              Sign in with Amaze ID, link your VTOP account, and register a reachable phone number.
            </p>
          </div>
        </div>

        <div className="mt-5 space-y-4">
          {error && (
            <div className="flex items-center gap-2 rounded-2xl border border-red-500/20 bg-red-500/10 p-4 text-sm font-semibold text-red-600 dark:text-red-400">
              <AlertCircle className="h-5 w-5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {loading || step === "checking" ? (
            <div className="flex items-center gap-2 text-sm font-semibold text-text-secondary dark:text-text-muted">
              <Loader2 className="h-5 w-5 animate-spin" />
              Checking your Amaze ID…
            </div>
          ) : null}

          {step === "sign-in" && !loading && (
            <div className="space-y-3">
              <p className="text-sm text-text-secondary dark:text-text-muted">
                An Amaze ID is required to use Cab Share. Sign up or sign in to continue; link your VTOP account
                afterward.
              </p>
              <button
                type="button"
                onClick={signInInteractive}
                className="flex w-full items-center justify-center gap-2 rounded-2xl bg-indigo-600 px-4 py-3 text-sm font-black text-white transition-colors hover:bg-indigo-700"
              >
                Sign up or sign in with Amaze ID <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          )}

          {step === "link-vtop" && !loading && (
            <div className="space-y-3">
              <p className="text-sm text-text-secondary dark:text-text-muted">
                Link a VTOP account to your Amaze ID before using Cab Share.
              </p>
              <a
                href={`${AUTH_BASE}/account`}
                target="_blank"
                rel="noreferrer"
                className="flex w-full items-center justify-center gap-2 rounded-2xl bg-indigo-600 px-4 py-3 text-sm font-black text-white transition-colors hover:bg-indigo-700"
              >
                Link VTOP in Amaze ID <ExternalLink className="h-4 w-4" />
              </a>
              <button
                type="button"
                onClick={() => void authenticate()}
                className="w-full rounded-2xl border border-border-muted px-4 py-3 text-sm font-bold text-text-heading"
              >
                I&apos;ve linked VTOP — retry
              </button>
            </div>
          )}

          {step === "phone" && !loading && (
            <form onSubmit={handlePhoneSubmit} className="space-y-3">
              <label className="block space-y-1">
                <span className={FIELD_LABEL}>Phone Number</span>
                <span className="relative block [&_input]:pl-11">
                  <Phone className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
                  <input
                    type="tel"
                    value={phoneNumber}
                    onChange={(event) => setPhoneNumber(event.target.value)}
                    required
                    autoComplete="tel"
                    inputMode="tel"
                    className={FIELD_INPUT}
                    placeholder="10-digit mobile number"
                  />
                </span>
              </label>
              <p className="flex items-center gap-1.5 text-[11px] font-medium text-text-muted">
                <Shield className="h-3.5 w-3.5" /> Shared only with confirmed ride matches.
              </p>
              <button
                type="submit"
                disabled={loading}
                className="flex w-full items-center justify-center gap-2 rounded-2xl bg-indigo-600 px-4 py-3 text-sm font-black text-white transition-colors hover:bg-indigo-700 disabled:opacity-70"
              >
                {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : "Register phone & continue"}
              </button>
            </form>
          )}

          {step === "error" && !loading && (
            <button
              type="button"
              onClick={() => void authenticate()}
              className="w-full rounded-2xl border border-border-muted px-4 py-3 text-sm font-bold text-text-heading"
            >
              Retry Cab Share sign-in
            </button>
          )}
        </div>
      </div>

      <div className="space-y-3">
        <SectionHeader title="How it works" />
        <ListShell>
          {STEPS.map(([title, description], index) => (
            <div key={title} className={LIST_ROW}>
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-xl bg-surface-secondary border border-border-muted text-[11px] font-black text-indigo-600 dark:text-indigo-400">
                {index + 1}
              </span>
              <ListRowText title={title} subtitle={description} />
            </div>
          ))}
        </ListShell>
      </div>
    </section>
  );
}
