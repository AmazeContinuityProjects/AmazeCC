/**
 * UniCC as a fallback for the AmazeCC API.
 *
 * ## What this is for
 *
 * When the AmazeCC API is unreachable, a student cannot log in and therefore
 * sees nothing — no attendance, no grades, no timetable sync. `fetch-utils.ts`
 * already fails over between two AmazeCC hosts, so both can be down at once.
 * UniCC is a third-party service that proxies the same VTOP data, and it is the
 * only one that can still answer when both of ours cannot.
 *
 * ## Why this is not a third entry in the failover chain
 *
 * The obvious-looking change — add `api.uni-cc.site` as `BACKUP_API_URL_2`, or
 * straight into `NEXT_PUBLIC_BACKUP_API_URL` — makes things *worse*, and this has
 * been tried in anger.
 *
 * `rewriteUrlIfNeeded` rewrites the origin of **any** request to the active API
 * host, and `fetchWithFailover` flips `activeApiUrl` globally on failure. UniCC
 * is not a mirror of AmazeCC, it is a different service with a different surface.
 * A global swap sends student, transport, buses, wallet, social sync and the
 * EventHub endpoints to a host that 404s every one of them, and the app looks
 * healthy while returning nothing.
 *
 * So the fallback is **targeted**: `fetchWithFailover` retries the single failed
 * request here, and only for paths in {@link UNICC_SUPPORTED_PATHS}. The global
 * active URL is never pointed at UniCC, and {@link isUniccHost} enforces that
 * even against a bad `NEXT_PUBLIC_BACKUP_API_URL` or a stale stored value.
 *
 * ## What UniCC actually offers
 *
 * Read from its OpenAPI document and its source, and verified live:
 *
 * | We need | UniCC has | |
 * |---|---|---|
 * | `POST /api/login` → `{success, cookies, csrf, authorizedID}` | identical | ✅ drop-in |
 * | `POST /api/grades`, `/api/all-grades`, `/api/attendance` | identical | ✅ drop-in |
 * | `POST /api/calendar`, `/api/schedule`, `/api/hostel` | identical | ✅ drop-in |
 * | `POST /api/lms-data`, `/api/vitol-data` | identical | ✅ drop-in |
 * | `GET /api/health` | `GET /api/status` → `{text}` | ⚠️ different path |
 * | `POST /api/events/*` → `jsessionid` | — | ❌ EventHub has no fallback |
 * | `POST /api/social/*` | — | ❌ |
 * | `/api/student`, `/api/buses`, `/api/transport`, `/api/wallet`, `/api/payments`, `/api/od`, `/api/acknowledgement`, `/api/ept-schedule`, `/api/registration-schedule`, `/api/library-due`, `/api/bank-info`, `/api/course-completion`, `/api/credentials`, `/api/hostel-counselling`, `/api/dayboarder`, `/api/exc-registration`, `/api/minor-honour`, `/api/payment-receipts`, `/api/profile-images` | — | ❌ |
 *
 * The drop-in rows are drop-in because the two projects share the same
 * `types/data/*.ts`: `login`, `schedule`, `grades`, `hostel`, `marks` and
 * `semTT` are byte-identical files, and `allgrades`/`attendance` differ only in
 * `unknown` vs `any` plus types UniCC added for its own internals.
 *
 * ## The rule that matters: never fail over on a rejected password
 *
 * A wrong password must be tried **once**. Both backends log in against real
 * VTOP, and VTOP locks an account after repeated failed attempts. So this module
 * is only ever reached when the primary is *unavailable* — a network failure, a
 * 5xx, a timeout — never when it answered and said the credentials were wrong.
 *
 * That is not a rule this module has to enforce. `fetchWithFailover` only
 * treats `500/502/503/504` and thrown network errors as failures; a `401` with a
 * `{"success": false}` body is `res.ok === false` but never thrown, so it flows
 * through to `request()` which converts it into an `AuthError`. The rejection
 * therefore never reaches this module at all, and the protection is structural
 * rather than a condition somebody has to remember to write.
 */

import type { VtopCreds } from "./sync-engine/types";

/**
 * The UniCC deployment to fall back to.
 *
 * Overridable so a fork or a self-hosted UniCC can be pointed at instead.
 * HTTPS is not a preference: the app is served over HTTPS, and a browser refuses
 * to send a plain-HTTP request from a secure page, so an `http://` value here
 * would simply never fire.
 */
export const UNICC_API_URL = (
  process.env.NEXT_PUBLIC_UNICC_API_URL || "https://api-unicc.arya22.dev"
).replace(/\/+$/, "");

/**
 * Whether the fallback is used at all.
 *
 * On by default, because the alternative to a fallback is a student staring at a
 * blank app. Set `NEXT_PUBLIC_UNICC_FALLBACK=off` to turn it off without a code
 * change — useful if the deployment does not want third-party credentials at all.
 */
export function isUniccFallbackEnabled(): boolean {
  return process.env.NEXT_PUBLIC_UNICC_FALLBACK !== "off";
}

/**
 * The endpoints UniCC actually implements, as bare paths under `/api/`.
 *
 * ## Why this list is the whole safety mechanism
 *
 * UniCC is not a mirror of the AmazeCC API. It implements a *subset* of the same
 * routes, and it is a different service. Anything not in this list — social
 * sync, the EventHub endpoints, student profile, the EPT and registration
 * schedules, the hostel detail routes, question bank, admin — has no UniCC
 * equivalent, and a request for one must fail rather than be sent to a host that
 * would 404 it.
 *
 * Verified by diffing the two repositories' `types/data/*.ts`, which are shared
 * almost verbatim: `login`, `schedule`, `grades`, `hostel`, `marks` and `semTT`
 * are byte-identical files, and `allgrades`/`attendance` differ only in
 * `unknown` vs `any` and some extra internal types UniCC added. Same VTOP parsing,
 * same wire shape.
 */
const UNICC_SUPPORTED_PATHS: ReadonlySet<string> = new Set([
  "login",
  "grades",
  "all-grades",
  "attendance",
  "calendar",
  "schedule",
  "hostel",
  "lms-data",
  "vitol-data",
]);

/**
 * Is this path one UniCC serves, and if so what is it called there?
 *
 * Accepts a full URL or a path, so the caller can hand over whatever it already
 * has. Returns `null` for everything UniCC does not implement, and that `null` is
 * the only thing standing between a 404 and a silent wrong answer.
 */
export function uniccPathFor(urlOrPath: string): string | null {
  let pathname: string;
  try {
    pathname = new URL(urlOrPath, "https://api-unicc.arya22.dev").pathname;
  } catch {
    return null;
  }
  const clean = pathname.replace(/^\/+/, "").replace(/^api\//, "").replace(/\/+$/, "");
  return UNICC_SUPPORTED_PATHS.has(clean) ? clean : null;
}

/**
 * The same request, pointed at UniCC.
 *
 * Returns `null` when there is nothing to point at — an endpoint UniCC does not
 * serve, or the fallback being switched off — so the caller rethrows its own
 * error rather than replacing a real failure with a confusing one.
 *
 * The enable check lives here rather than at the call site on purpose: this is
 * the only function that produces a UniCC URL, so putting the kill-switch
 * anywhere else would make it possible to reach UniCC with the switch off.
 */
export function uniccUrlFor(original: string): string | null {
  if (!isUniccFallbackEnabled()) return null;
  const path = uniccPathFor(original);
  return path ? `${UNICC_API_URL}/api/${path}` : null;
}

/**
 * Is this URL the UniCC host?
 *
 * The failover code uses this to refuse to make UniCC the global active API URL
 * even when configuration or a stale `localStorage` value tries to.
 *
 * ## Why this has to be defensive
 *
 * The intended design already keeps UniCC off the global origin, and it works.
 * But the easiest way to break it is to put UniCC in `NEXT_PUBLIC_BACKUP_API_URL`,
 * which looks like exactly the right knob to reach for. That slot is the one
 * place the origin of *every* request is swapped, so it bypasses the allowlist
 * entirely: the app then asks UniCC for `/api/student`, `/api/transport`,
 * `/api/buses`, `/api/wallet` and the rest, and every one comes back 404. Worse,
 * the swap is persisted to `localStorage`, so it keeps happening after the config
 * is fixed, until the stored value is cleared.
 *
 * Refusing the host at the point of use means a misconfiguration degrades into
 * "no global backup, allowlisted UniCC fallback only" — the intended behaviour —
 * rather than into a silently broken app.
 */
export function isUniccHost(url: string): boolean {
  try {
    return new URL(url).origin === new URL(UNICC_API_URL).origin;
  } catch {
    return false;
  }
}

/**
 * Which server the user has asked us to talk to first.
 *
 * `amazecc` (the default) is the behaviour that has always existed: AmazeCC
 * first, and UniCC only if every AmazeCC host has already failed. `unicc` is an
 * explicit opt-in that puts UniCC *first*, which is what a student actually
 * wants when the AmazeCC API is blocked on their network or down for their
 * region — waiting out two AmazeCC timeouts before the first useful request is
 * a poor experience, and this skips them.
 *
 * ## "Prefer UniCC" does not mean "only UniCC"
 *
 * UniCC implements nine of the routes the app calls. There is no honest version
 * of "use UniCC" that also returns the bus route, hostel counselling, library
 * dues, the student profile, the wallet or social sync, because those endpoints
 * simply do not exist there. So this is a routing *preference*: UniCC answers
 * what it can, AmazeCC answers the rest, and AmazeCC is still the fallback if
 * UniCC is down. The UI says so rather than implying a switch that cannot
 * deliver on the promise.
 *
 * ## A rejected password still ends the chain
 *
 * Choosing UniCC does not buy a second attempt at VTOP. UniCC and AmazeCC both
 * log in against real VTOP against real credentials, and VTOP locks an account
 * after repeated failures, so a `401` from UniCC is returned to the caller
 * untouched and never re-tried against AmazeCC. The opt-in changes which server
 * is asked *first*; it does not weaken the one-attempt rule.
 */
export type UniccTarget = "amazecc" | "unicc";

const TARGET_STORAGE_KEY = "amazecc_unicc_target";

function readStoredTarget(): UniccTarget {
  if (typeof window === "undefined") return "amazecc";
  try {
    // Default to AmazeCC. Opting in sends credentials to a third-party server,
    // so it has to be a deliberate act, never something a stale value can do.
    return window.localStorage.getItem(TARGET_STORAGE_KEY) === "unicc" ? "unicc" : "amazecc";
  } catch {
    return "amazecc";
  }
}

let uniccTarget: UniccTarget = readStoredTarget();
const targetListeners = new Set<() => void>();

export function getUniccTarget(): UniccTarget {
  return uniccTarget;
}

export function isUniccPreferred(): boolean {
  return uniccTarget === "unicc";
}

export function setUniccTarget(next: UniccTarget): void {
  if (next === uniccTarget) return;
  uniccTarget = next;
  if (typeof window !== "undefined") {
    try {
      if (next === "unicc") window.localStorage.setItem(TARGET_STORAGE_KEY, "unicc");
      else window.localStorage.removeItem(TARGET_STORAGE_KEY);
    } catch {
      // Storage can be unavailable (private mode, quota). The in-memory value
      // still applies for this session, which is the part that matters.
    }
  }
  targetListeners.forEach((l) => l());
}

export function subscribeUniccTarget(listener: () => void): () => void {
  targetListeners.add(listener);
  return () => void targetListeners.delete(listener);
}

/**
 * Who is actually answering, and what UniCC has done this session.
 *
 * The point of this is visibility. A student who chose UniCC deserves to know
 * whether it is genuinely serving their data, and a student on the default
 * AmazeCC target deserves to know when it silently did the work anyway — that
 * used to be invisible, which is how a third party ending up in the request path
 * goes unnoticed.
 *
 * `lastServer` is what the UI leads with, because "which API is serving" is a
 * question about *right now* rather than about totals. It is updated on every
 * request either server answers, so it cannot go stale while a sync is running
 * and cannot go on claiming UniCC is serving after it has handed back to AmazeCC.
 *
 * `unsupported` counts requests that were *not* sent to UniCC because it has no
 * such route. While a student is opted in to UniCC, those are answered by
 * AmazeCC, and counting them is the honest way to show that the preference has
 * limits rather than letting the UI imply everything came from UniCC.
 */
export interface UniccActivity {
  /** Requests UniCC answered successfully. */
  served: number;
  /** Requests UniCC was asked and could not answer. */
  failed: number;
  /** Requests that went to AmazeCC because UniCC has no such route. */
  unsupported: number;
  lastPath: string | null;
  lastAt: number;
  lastOutcome: "served" | "failed" | "unsupported" | null;
  /** Which server answered the most recent request. */
  lastServer: "amazecc" | "unicc" | null;
}

function emptyActivity(): UniccActivity {
  return {
    served: 0,
    failed: 0,
    unsupported: 0,
    lastPath: null,
    lastAt: 0,
    lastOutcome: null,
    lastServer: null,
  };
}

let activity: UniccActivity = emptyActivity();
const activityListeners = new Set<() => void>();

export function getUniccActivity(): UniccActivity {
  return activity;
}

export function subscribeUniccActivity(listener: () => void): () => void {
  activityListeners.add(listener);
  return () => void activityListeners.delete(listener);
}

function record(
  path: string,
  outcome: UniccActivity["lastOutcome"],
  server: "amazecc" | "unicc"
): void {
  activity = {
    ...activity,
    served: activity.served + (outcome === "served" ? 1 : 0),
    failed: activity.failed + (outcome === "failed" ? 1 : 0),
    unsupported: activity.unsupported + (outcome === "unsupported" ? 1 : 0),
    lastPath: path,
    lastAt: Date.now(),
    lastOutcome: outcome,
    lastServer: server,
  };
  activityListeners.forEach((l) => l());
}

export function noteUniccServed(path: string): void {
  record(path, "served", "unicc");
}

export function noteUniccFailed(path: string): void {
  record(path, "failed", "unicc");
}

export function noteUniccUnsupported(path: string): void {
  record(path, "unsupported", "amazecc");
}

/**
 * An AmazeCC host answered.
 *
 * Recorded for every successful AmazeCC response rather than only the ones where
 * UniCC was skipped, so "which API is serving" tracks the latest real request.
 * Deliberately does not touch the counters: a request that never involved UniCC
 * is not a UniCC statistic, and inflating `served` here would make the sync log
 * claim a hand-off that never happened.
 */
export function noteAmazeccServing(path: string): void {
  activity = {
    ...activity,
    lastPath: path,
    lastAt: Date.now(),
    lastServer: "amazecc",
  };
  activityListeners.forEach((l) => l());
}

/**
 * Notable routing events, for the sync log.
 *
 * Separate from {@link UniccActivity} on purpose. The counters answer "who is
 * serving right now"; this answers "what happened", and only for the things a
 * student would want explained — a third party taking over, or being unable to.
 * Logging every routine AmazeCC request would bury the two lines that matter.
 *
 * An event stream rather than diffed counters: it cannot be thrown off by a
 * counter reset between sessions, and it carries the route that caused it.
 */
export type UniccLogEvent =
  /** UniCC answered a request. */
  | { type: "unicc_served"; path: string }
  /** An AmazeCC host failed and the request is going to UniCC instead. */
  | { type: "fell_back_to_unicc"; path: string }
  /** UniCC was asked, could not answer, and AmazeCC is being used instead. */
  | { type: "unicc_unavailable"; path: string };

const logListeners = new Set<(e: UniccLogEvent) => void>();

export function subscribeUniccLogEvents(listener: (e: UniccLogEvent) => void): () => void {
  logListeners.add(listener);
  return () => void logListeners.delete(listener);
}

export function emitUniccLogEvent(e: UniccLogEvent): void {
  logListeners.forEach((l) => l(e));
}

/** For tests, and for starting a fresh sync session's tally. */
export function resetUniccActivity(): void {
  activity = emptyActivity();
  activityListeners.forEach((l) => l());
}

/** The bare route name, for display. `"all-grades"`, not the full URL. */
export function uniccRouteName(urlOrPath: string): string {
  return uniccPathFor(urlOrPath) ?? new URL(urlOrPath, "https://api-unicc.arya22.dev").pathname.replace(/^\/+/, "").replace(/^api\//, "");
}

/**
 * How long to wait on UniCC.
 *
 * UniCC solves the VTOP captcha server-side, so a successful login takes as long
 * as the primary's does — the AmazeCC API allows 120s for exactly this reason.
 * 60s is the same trade made once: long enough for a real solve, bounded so a
 * dead host cannot hang the login button for two minutes after the primary has
 * already failed.
 */
const UNICC_TIMEOUT_MS = 60_000;


/**
 * `GET /api/status` result cache lifetime.
 *
 * The probe exists so a login button is not held hostage by a dead host, and so a
 * failover does not pay a fresh connection timeout on every attempt. Five minutes
 * is short enough that a host coming back is picked up while the user is still
 * retrying.
 */
const PROBE_TTL_MS = 5 * 60 * 1000;
let probeCache: { at: number; ok: boolean } | null = null;

/** For tests: forget the probe verdict and any injected fetch. */
export function __resetUniccProbe() {
  probeCache = null;
}

type FetchLike = typeof fetch;
let uniccFetch: FetchLike | null = null;

/** For tests: substitute the transport. */
export function __setUniccFetch(f: FetchLike | null) {
  uniccFetch = f;
}

function transport(): FetchLike {
  return uniccFetch ?? fetch;
}

/**
 * Is UniCC up?
 *
 * `GET /api/status`, which is documented as "Simple health check endpoint used to
 * verify that the API server is running and reachable" and returns
 * `200 {"text": "API is working"}`.
 *
 * The body is not inspected: the question is whether the host answered, and a
 * 200 is the answer. Result cached for {@link PROBE_TTL_MS}.
 */
export async function isUniccReachable(): Promise<boolean> {
  if (!isUniccFallbackEnabled()) return false;
  const now = Date.now();
  if (probeCache && now - probeCache.at < PROBE_TTL_MS) return probeCache.ok;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8_000);
  let ok = false;
  try {
    // Plain `fetch`, deliberately. `window.fetch` is `fetchWithFailover`, which
    // only rewrites URLs on the AmazeCC origins and passes everything else
    // through — so this would be equivalent, but going direct keeps the intent
    // legible and immune to a change in that override.
    const res = await transport()(`${UNICC_API_URL}/api/status`, {
      method: "GET",
      signal: controller.signal,
      headers: { Accept: "application/json" },
    });
    ok = res.ok;
  } catch {
    ok = false;
  } finally {
    clearTimeout(timer);
  }

  probeCache = { at: now, ok };
  return ok;
}

export type UniccLoginOutcome =
  | { kind: "ok"; creds: VtopCreds }
  /** UniCC answered, and the credentials were no better there than here. */
  | { kind: "rejected"; message: string }
  /** UniCC could not be used: disabled, unreachable, or an unexpected shape. */
  | { kind: "unavailable"; reason: string };

interface UniccLoginBody {
  success?: boolean;
  message?: string;
  cookies?: string;
  csrf?: string;
  authorizedID?: string;
}

/**
 * Log in through UniCC.
 *
 * Returns `unavailable` rather than throwing for every failure mode, because every
 * one of them means the same thing to the caller: we have no session, carry on
 * with the original error. Throwing would mean inventing a failure mode the
 * caller has to handle separately.
 */
export async function loginViaUnicc(
  username: string,
  password: string
): Promise<UniccLoginOutcome> {
  if (!isUniccFallbackEnabled()) {
    return { kind: "unavailable", reason: "disabled by configuration" };
  }
  if (!(await isUniccReachable())) {
    return { kind: "unavailable", reason: "UniCC did not respond to /api/status" };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), UNICC_TIMEOUT_MS);

  try {
    const res = await transport()(`${UNICC_API_URL}/api/login`, {
      method: "POST",
      signal: controller.signal,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });

    const body = (await res.json().catch(() => ({}))) as UniccLoginBody;

    if (body?.success === false) {
      // A real answer, and it is no. `401` with "Invalid Username / Password"
      // is what UniCC returns, and it means the credentials are wrong — not that
      // the host is down — so the caller must treat it as a final failure and
      // not try anywhere else.
      return { kind: "rejected", message: body.message || "Login failed" };
    }

    if (!res.ok) {
      return {
        kind: "unavailable",
        reason: `UniCC responded ${res.status} without a structured failure`,
      };
    }

    if (!body?.cookies || !body?.authorizedID) {
      // A 200 with no session. Nothing to work with, and guessing at which field
      // is the real one would be worse than reporting nothing.
      return { kind: "unavailable", reason: "UniCC returned no session" };
    }

    return {
      kind: "ok",
      creds: {
        // UniCC returns the cookie jar already joined with "; ", which is the
        // same shape the AmazeCC API returns — see the note in `VtopCreds`.
        cookies: body.cookies as VtopCreds["cookies"],
        authorizedID: body.authorizedID,
        csrf: body.csrf ?? "",
        fetchedAt: Date.now(),
      },
    };
  } catch (err) {
    return {
      kind: "unavailable",
      reason: err instanceof Error ? `${err.name}: ${err.message}` : String(err),
    };
  } finally {
    clearTimeout(timer);
  }
}
