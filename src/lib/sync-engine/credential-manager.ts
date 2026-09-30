import { request, setAuthProvider, type AuthCreds } from "./request-layer";
import { AuthError, backoff } from "./errors";
import { storage } from "../storage";
import type { AuthDomain, Ids, VtopCreds } from "./types";

interface FailedPair {
  username: string;
  password: string;
}

/**
 * How long a VTOP session is trusted before being re-fetched.
 *
 * Ten minutes is well inside the real server-side session lifetime, so this
 * never logs in "too late" — a session that is still alive simply gets replaced
 * by an equally valid one. The cost of being generous is a redundant captcha
 * solve; the cost of being stingy is a request that 401s and, because
 * `apiRequest` does not throw on a non-2xx, a silently empty result. Avoiding
 * the silent failure is worth the occasional extra login.
 */
export const VTOP_SESSION_MAX_AGE_MS = 10 * 60 * 1000;

/**
 * Single owner of all sessions (VTOP + EventHub) and the give-up/backoff logic.
 * Supersedes the duplicated logic in auth.ts and event-hub.ts.
 */
class CredentialManager {
  private vtop: VtopCreds | null = null;
  private eventHub: string | null = null;
  /**
   * When `this.eventHub` was obtained.
   *
   * EventHub sessions expire server-side with no signal to the client, so this
   * is what stops a session from days ago being reused forever — which showed up
   * as a permanent `401` from `/api/events/profile` while the credentials were
   * perfectly valid. Same rule as VTOP.
   */
  private eventHubFetchedAt = 0;
  private failedVtop: FailedPair | null = null;
  private failedEventHub: FailedPair | null = null;
  private backoffVtopUntil = 0;
  private backoffEventHubUntil = 0;
  /**
   * In-flight VTOP re-authentication, shared by every caller that notices the
   * session is stale.
   *
   * A VTOP login solves a captcha, so two callers refreshing at once would burn
   * two captchas and — worse — race to write `this.vtop`. Callers await this
   * same promise instead.
   */
  private refreshingVtop: Promise<VtopCreds> | null = null;
  /** Same single-flight guard as `refreshingVtop`, for the EventHub session. */
  private refreshingEventHub: Promise<string> | null = null;

  constructor() {
    setAuthProvider((domain) => this.getCreds(domain));
    // Restored from disk, along with when it was minted. A session stored by an
    // older build has no timestamp and is treated as stale, which costs one
    // login and is the safe direction.
    const stored = storage.eventHubSession.get();
    if (stored?.id) {
      this.eventHub = stored.id;
      this.eventHubFetchedAt = stored.fetchedAt ?? 0;
    }
  }

  /** True when there is no session, or the one we hold is older than the limit. */
  private isVtopStale(): boolean {
    if (!this.vtop) return true;
    if (this.vtop.fetchedAt === undefined) return true;
    return Date.now() - this.vtop.fetchedAt >= VTOP_SESSION_MAX_AGE_MS;
  }

  /**
   * Log in if the VTOP session is missing or older than
   * `VTOP_SESSION_MAX_AGE_MS`, and return a session that is good for at least
   * part of that window.
   *
   * Concurrent callers share one login, because a login costs a captcha solve and
   * `loginVtop` is deliberately not retried.
   */
  async ensureVtopSession(
    opts: { demoMode?: boolean; forceNew?: boolean } = {}
  ): Promise<VtopCreds> {
    if (opts.demoMode) {
      return { cookies: [], authorizedID: "DEMO123", csrf: "", fetchedAt: Date.now() };
    }
    // Always join an in-flight login, even for `forceNew`: the refresh already
    // under way is as fresh as anything a second one would produce.
    if (this.refreshingVtop) return this.refreshingVtop;
    if (this.vtop && !this.isVtopStale() && !opts.forceNew) return this.vtop;

    // The in-flight marker is published BEFORE the login starts, and the caller
    // awaits a deferred rather than the IIFE's own promise.
    //
    // Assigning the IIFE's promise instead leaves `refreshingVtop` null for the
    // whole synchronous phase of that IIFE — which is exactly when
    // `request("login")` fires and re-enters `getCreds`. The re-entrant call
    // would then see no refresh in progress and start a second login, and the
    // two would await each other forever.
    let settle!: (creds: VtopCreds) => void;
    let fail!: (reason: unknown) => void;
    const gate = new Promise<VtopCreds>((res, rej) => {
      settle = res;
      fail = rej;
    });
    this.refreshingVtop = gate;

    void (async () => {
      const ids = storage.ids.get();
      if (!ids?.VtopUsername) {
        // Nothing to log in with. Distinct from a failed login, so it must not
        // go through `markFailed` — there is no account to protect here.
        throw new AuthError("Not logged in — add your VTOP credentials first.", "vtop");
      }
      return this.loginVtop(ids, { demoMode: opts.demoMode, forceNew: true });
    })()
      .then(settle, fail)
      .finally(() => {
        // Identity-checked so a `clearCache()` mid-flight cannot be undone by
        // this late teardown.
        if (this.refreshingVtop === gate) this.refreshingVtop = null;
      });

    return gate;
  }

  /** True when the EventHub session is missing or older than the limit. */
  private isEventHubStale(): boolean {
    if (!this.eventHub) return true;
    if (!this.eventHubFetchedAt) return true;
    return Date.now() - this.eventHubFetchedAt >= VTOP_SESSION_MAX_AGE_MS;
  }

  /**
   * Return a usable EventHub session, logging in again if the cached one has
   * expired.
   *
   * Single-flight for the same reason as VTOP: a login is a network round trip
   * and concurrent callers must not each start one.
   */
  async ensureEventHubSession(
    ids: Ids,
    opts: { demoMode?: boolean } = {}
  ): Promise<string> {
    if (opts.demoMode || ids.VtopUsername === "demo") return "";
    if (this.refreshingEventHub) return this.refreshingEventHub;
    if (this.eventHub && !this.isEventHubStale()) return this.eventHub;

    let settle!: (id: string) => void;
    let fail!: (reason: unknown) => void;
    const gate = new Promise<string>((res, rej) => {
      settle = res;
      fail = rej;
    });
    this.refreshingEventHub = gate;

    void this.loginEventHub(ids, { demoMode: opts.demoMode, forceNew: true })
      .then(settle, fail)
      .finally(() => {
        if (this.refreshingEventHub === gate) this.refreshingEventHub = null;
      });

    return gate;
  }

  async getCreds(domain: AuthDomain): Promise<AuthCreds | null> {
    if (domain === "vtop") {
      // A refresh already running means we are somewhere inside `loginVtop`,
      // whose own request body-building calls back into here. Awaiting
      // `refreshingVtop` here would await the request that is waiting on us.
      // Returning the possibly-stale creds is harmless: the login request
      // authenticates with the username and password in its body, not with
      // cookies.
      if (this.refreshingVtop) return this.vtop;

      // No session at all is NOT repaired here. Re-authenticating means solving
      // a captcha, and that belongs to an explicit caller (see
      // `ensureVtopSession`) so it is attributable rather than triggered as a
      // side effect of some unrelated request.
      if (!this.vtop) return null;

      // Stale, so replace it rather than let the request fail.
      if (this.isVtopStale()) {
        try {
          await this.ensureVtopSession();
        } catch {
          // Fall through to the stale creds. A refresh that fails (VTOP down,
          // backoff active) should not also break the request; the server will
          // decide whether the old session is still usable.
        }
      }
      return this.vtop;
    }
    return this.eventHub ? { jsessionid: this.eventHub } : null;
  }

  getStoredVtop(): VtopCreds | null {
    return this.vtop;
  }

  private isBlocked(domain: AuthDomain, ids: Ids): boolean {
    const now = Date.now();
    if (domain === "vtop") {
      return (
        !!this.failedVtop &&
        this.failedVtop.username === ids.VtopUsername &&
        this.failedVtop.password === ids.VtopPassword &&
        now < this.backoffVtopUntil
      );
    }
    return (
      !!this.failedEventHub &&
      this.failedEventHub.username === ids.VtopUsername &&
      this.failedEventHub.password === ids.VtopPassword &&
      now < this.backoffEventHubUntil
    );
  }

  private markFailed(domain: AuthDomain, ids: Ids): void {
    const pair: FailedPair = { username: ids.VtopUsername, password: ids.VtopPassword };
    if (domain === "vtop") {
      this.failedVtop = pair;
      this.backoffVtopUntil = Date.now() + backoff(1000, 1);
    } else {
      this.failedEventHub = pair;
      this.backoffEventHubUntil = Date.now() + backoff(1000, 1);
    }
  }

  async loginVtop(
    ids: Ids,
    opts: { demoMode?: boolean; forceNew?: boolean } = {},
  ): Promise<VtopCreds> {
    if (opts.demoMode || ids.VtopUsername === "demo") {
      return { cookies: [], authorizedID: "DEMO123", csrf: "", fetchedAt: Date.now() };
    }
    if (this.isBlocked("vtop", ids)) {
      throw new AuthError(
        "Login failed — stopped retrying to avoid locking your account. Use “Edit credentials” to fix it.",
        "vtop",
      );
    }
    if (this.vtop && !opts.forceNew) return this.vtop;

    let res: any;
    try {
      res = await request(
        "login",
        { username: ids.VtopUsername, password: ids.VtopPassword },
        // VTOP login does server-side captcha solving and can take a while:
        // generous timeout + one retry on transient/timeout failures.
        // AuthError is never retried (thrown immediately in request()).
        { auth: "none", authFailDomain: "vtop", retry: { max: 1 }, timeoutMs: 120000 },
      );
    } catch (e) {
      if (e instanceof AuthError) this.markFailed("vtop", ids);
      throw e;
    }

    if (!res || res.success === false || !res.authorizedID || !res.cookies) {
      this.markFailed("vtop", ids);
      throw new AuthError(res?.message || "Login failed", "vtop");
    }

    // `fetchedAt` starts the 10-minute freshness clock for these cookies.
    this.vtop = {
      cookies: res.cookies,
      authorizedID: res.authorizedID,
      csrf: res.csrf,
      fetchedAt: Date.now(),
    };
    this.failedVtop = null;
    return this.vtop;
  }

  async loginEventHub(
    ids: Ids,
    opts: { demoMode?: boolean; forceNew?: boolean } = {},
  ): Promise<string> {
    if (opts.demoMode || ids.VtopUsername === "demo") return "";
    if (this.isBlocked("eventhub", ids)) {
      throw new AuthError("Event Hub login failed — stopped retrying.", "eventhub");
    }
    if (this.eventHub && !opts.forceNew) return this.eventHub;

    let res: any;
    try {
      res = await request(
        "events/login",
        { username: ids.VtopUsername, password: ids.VtopPassword },
        { auth: "none", authFailDomain: "eventhub", retry: { max: 0 } },
      );
    } catch (e) {
      if (e instanceof AuthError) this.markFailed("eventhub", ids);
      throw e;
    }

    if (!res || res.success === false || !res.jsessionid) {
      this.markFailed("eventhub", ids);
      throw new AuthError(res?.error || "Event Hub login failed", "eventhub");
    }

    this.eventHub = res.jsessionid;
    this.eventHubFetchedAt = Date.now();
    storage.eventHubSession.set({ id: res.jsessionid, fetchedAt: this.eventHubFetchedAt });
    this.failedEventHub = null;
    return this.eventHub;
  }

  /** Safe password change: clears give-up state and attempts login exactly once. */
  async editCredentials(next: Ids): Promise<void> {
    this.vtop = null;
    this.eventHub = null;
    this.failedVtop = null;
    this.failedEventHub = null;
    this.backoffVtopUntil = 0;
    this.backoffEventHubUntil = 0;
    storage.ids.set({
      VtopUsername: next.VtopUsername,
      VtopPassword: next.VtopPassword,
      MoodleUsername: next.MoodleUsername,
      MoodlePassword: next.MoodlePassword,
    });
    storage.password.set(next.VtopPassword);
    storage.username.set(next.VtopUsername);
    await this.loginVtop(next); // single attempt; throws AuthError if still wrong (no loop)
    try {
      await this.loginEventHub(next);
    } catch {
      /* EventHub login optional */
    }
  }

  logout(): void {
    this.clearCache();
    storage.eventHubSession.remove();
  }

  clearCache(): void {
    this.vtop = null;
    this.eventHub = null;
    this.failedVtop = null;
    this.failedEventHub = null;
    this.backoffVtopUntil = 0;
    this.backoffEventHubUntil = 0;
    // An in-flight refresh is discarded too. Normally `.finally` clears it, but
    // if a login hangs, leaving the promise here would make every later
    // `ensureVtopSession` await that hang forever — the manager would be wedged
    // with no way back short of a reload.
    this.refreshingVtop = null;
    this.refreshingEventHub = null;
    this.eventHubFetchedAt = 0;
  }

  clearEventHub(): void {
    this.eventHub = null;
    this.eventHubFetchedAt = 0;
    this.refreshingEventHub = null;
    this.failedEventHub = null;
    this.backoffEventHubUntil = 0;
    storage.eventHubSession.remove();
  }
}

export const credentialManager = new CredentialManager();
