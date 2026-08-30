import { request, setAuthProvider } from "./request-layer";
import { AuthError, backoff, isAuthFailMessage } from "./errors";
import { storage } from "../storage";
import type { AuthDomain, Ids, VtopCreds } from "./types";

interface FailedPair {
  username: string;
  password: string;
}

/**
 * Single owner of all sessions (VTOP + EventHub) and the give-up/backoff logic.
 * Supersedes the duplicated logic in auth.ts and event-hub.ts.
 */
class CredentialManager {
  private vtop: VtopCreds | null = null;
  private eventHub: string | null = storage.eventHubSession.get() ?? null;
  private failedVtop: FailedPair | null = null;
  private failedEventHub: FailedPair | null = null;
  private backoffVtopUntil = 0;
  private backoffEventHubUntil = 0;

  constructor() {
    setAuthProvider((domain) => this.getCreds(domain));
  }

  async getCreds(
    domain: AuthDomain,
  ): Promise<{ cookies?: string[]; authorizedID?: string; csrf?: string; jsessionid?: string } | null> {
    if (domain === "vtop") return this.vtop;
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
      return { cookies: [], authorizedID: "DEMO123", csrf: "" };
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
        { auth: "none", authFailDomain: "vtop", retry: { max: 0 } },
      );
    } catch (e) {
      if (e instanceof AuthError) this.markFailed("vtop", ids);
      throw e;
    }

    if (!res || res.success === false || !res.authorizedID || !res.cookies) {
      this.markFailed("vtop", ids);
      throw new AuthError(res?.message || "Login failed", "vtop");
    }

    this.vtop = { cookies: res.cookies, authorizedID: res.authorizedID, csrf: res.csrf };
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
    storage.eventHubSession.set(res.jsessionid);
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
  }

  clearEventHub(): void {
    this.eventHub = null;
    this.failedEventHub = null;
    this.backoffEventHubUntil = 0;
    storage.eventHubSession.remove();
  }
}

export const credentialManager = new CredentialManager();
