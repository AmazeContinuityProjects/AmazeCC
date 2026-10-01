"use client";

import { useState, useEffect } from "react";
import { api } from "@/lib/sync-engine";
import { AlertCircle, Car, KeyRound, Loader2, Phone, Shield, UserRound } from "lucide-react";
import { ListRowText, ListShell, SectionHeader } from "../../shared/primitives";
import { FIELD_INPUT, LIST_ROW, TILE_CARD, TONE_ICON_TILE } from "@/lib/uiTokens";

const FIELD_LABEL =
  "block text-[10px] font-black uppercase tracking-wider text-text-muted";

const STEPS = [
  ["Verify", "Use your saved VTOP registration number to keep ride requests student-only."],
  ["Post or find", "Choose your hub, travel date, and preferred time."],
  ["Confirm", "Contact details unlock only after the host accepts a request."],
] as const;

export default function CabShareAuthModal({ isOpen, onAuthSuccess }: { isOpen: boolean, onAuthSuccess: (user: any) => void }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (isOpen) {
      const idsObj = localStorage.getItem("IDs");
      if (idsObj) {
        try {
          const ids = JSON.parse(idsObj);
          if (ids.VtopUsername) setUsername(ids.VtopUsername);
          // We can optionally pre-fill password too if we want true auto-login,
          // but the user's requirement "fetch the vtop username and password from the local storage" means we should probably just do it silently.
          if (ids.VtopPassword) setPassword(ids.VtopPassword);
        } catch (e) {}
      }
    }
  }, [isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !password || !phoneNumber) {
      setError("Please fill all fields.");
      return;
    }
    if (phoneNumber.length < 10) {
      setError("Please enter a valid phone number.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      // `parse: "raw"` is required, not stylistic. Without it `api` returns the
      // already-parsed body instead of a `Response`, so `readJsonResponse`'s
      // `res.headers.get(...)` threw — and because that sat inside the try, a
      // rejected password, an unreachable server and a *successful* login all
      // landed in the same catch and quietly produced a local-only profile. It
      // also matters because `parse: "raw"` returns above the `AuthError` the
      // request layer raises on an auth-failure body: a Cab Share password
      // problem must not be able to trigger the VTOP give-up flow.
      const res = (await api("cabshare/auth", {
        method: "POST",
        parse: "raw",
        body: { username, password, phone_number: phoneNumber },
      })) as Response;

      // Read the body once, for both the OK and the rejected case: a non-OK
      // status is exactly when the server's own explanation is most worth
      // showing. `catch` covers an error page that is not JSON at all.
      const data = await res.json().catch(() => null);

      if (res.ok && data?.success && data.user) {
        onAuthSuccess(data.user);
        return;
      }

      // A server that answered has judged these details. Never fall through to
      // the local-only profile here — a wrong password that reads as a success
      // is worse than an error, because the ride request then never reaches
      // anyone and there is nothing to show for it.
      setError(
        data?.error ||
          data?.message ||
          `Authentication failed — the server rejected these details (HTTP ${res.status}).`
      );
    } catch {
      // No response at all: offline, or the endpoint is unreachable. This is the
      // one case where a local-only profile is a fair substitute, because there
      // was nobody to reject the credentials.
      onAuthSuccess({
        reg_number: username.trim(),
        username: username.trim(),
        name: username.trim(),
        phone_number: phoneNumber.trim(),
        local_only: true,
      });
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
              Verify your VTOP account and add a reachable phone number before posting or joining rides.
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="mt-5 grid gap-4 md:grid-cols-2">
          {error && (
            <div className="flex items-center gap-2 rounded-2xl border border-red-500/20 bg-red-500/10 p-4 text-sm font-semibold text-red-600 dark:text-red-400 md:col-span-2">
              <AlertCircle className="h-5 w-5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <label className="block space-y-1">
            <span className={FIELD_LABEL}>Registration Number</span>
            <span className="relative block [&_input]:pl-11">
              <UserRound className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                className={FIELD_INPUT}
                placeholder="Enter registration number"
              />
            </span>
          </label>

          <label className="block space-y-1">
            <span className={FIELD_LABEL}>VTOP Password</span>
            <span className="relative block [&_input]:pl-11">
              <KeyRound className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className={FIELD_INPUT}
                placeholder="Enter your VTOP password"
              />
            </span>
          </label>

          <div className="space-y-1 md:col-span-2">
            <label className={FIELD_LABEL}>Phone Number</label>
            <div className="relative">
              <Phone className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
              <input
                type="tel"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                required
                className={`${FIELD_INPUT} pl-11`}
                placeholder="10-digit mobile number"
              />
            </div>
            <p className="mt-2 flex items-center gap-1.5 text-[11px] font-medium text-text-muted">
              <Shield className="h-3.5 w-3.5" /> Shared only with confirmed ride matches.
            </p>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-indigo-600 px-4 py-3 text-sm font-black text-white transition-colors hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-70 md:col-span-2"
          >
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : "Authenticate & Continue"}
          </button>
        </form>
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
