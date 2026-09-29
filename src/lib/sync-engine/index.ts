import { credentialManager } from "./credential-manager";
import { progressBus } from "./progress-bus";
import { makeCtx, getOp } from "./operation-registry";
import { toEngineError } from "./errors";
import { storage } from "../storage";
import type { Ids, VtopCreds, ProgressEvent } from "./types";

export { apiRequest as api } from "./request-layer";
import { apiRequest } from "./request-layer";

export interface SyncAllOptions {
  semesterId: string;
  calendarType?: string;
  isHosteller?: boolean;
  settings?: Record<string, unknown>;
  demoMode?: boolean;
}

const BACKGROUND_OPS = ["pastAttendance", "fresher", "buses", "transport", "events", "bulk", "lms", "officialOd"];

class SyncEngine {
  private ids: Ids | null = null;

  private ensureIds(): Ids {
    if (!this.ids) throw new Error("SyncEngine: not logged in");
    return this.ids;
  }

  async login(ids: Ids, demoMode = false): Promise<VtopCreds> {
    this.ids = ids;
    const creds = await credentialManager.loginVtop(ids, { demoMode });
    // Published HERE rather than in a caller, because there is no single
    // caller: `Main.tsx` calls `syncEngine.login` directly from four places
    // (handleLogin, handleReloadRequest, and two branches), and `loginToVTOP` —
    // which looked like the choke point — is only a prop handed to child
    // components like BusFinder. Wiring the atom in `loginToVTOP` therefore left
    // it permanently empty on the main login path.
    //
    // `stateBridge` uses the same default-store pattern, which is why this is
    // safe without a jotai <Provider>.
    if (typeof window !== "undefined") {
      try {
        const { getDefaultStore } = await import("jotai");
        const { authorizedIDAtom } = await import("@/store/authAtoms");
        getDefaultStore().set(authorizedIDAtom, creds.authorizedID ?? "");
      } catch {
        // Never fail a login over a cosmetic state publish.
      }
    }
    return creds;
  }

  async loginEventHub(ids: Ids, demoMode = false): Promise<string> {
    this.ids = ids;
    return credentialManager.loginEventHub(ids, { demoMode });
  }

  async editCredentials(next: Ids): Promise<void> {
    this.ids = next;
    return credentialManager.editCredentials(next);
  }

  logout(): void {
    credentialManager.logout();
    this.ids = null;
    // Cleared with the session, so the next person to log in on this browser is
    // not gated on the previous one's authorizedID.
    if (typeof window !== "undefined") {
      void (async () => {
        try {
          const { getDefaultStore } = await import("jotai");
          const { authorizedIDAtom } = await import("@/store/authAtoms");
          getDefaultStore().set(authorizedIDAtom, "");
        } catch {
          /* never fail a logout over a cosmetic state publish */
        }
      })();
    }
  }

  getVtopCreds(): VtopCreds {
    const c = credentialManager.getStoredVtop();
    if (!c || !c.cookies) throw new Error("SyncEngine: not logged in");
    return c;
  }

  async sync<T = unknown>(name: string, args: Record<string, unknown> = {}): Promise<T> {
    const op = getOp(name);
    if (!op) throw new Error(`Unknown sync op: ${name}`);
    const ctx = makeCtx(this.ensureIds());
    progressBus.emit({ op: name, phase: "start" });
    try {
      const result = (await op.run(ctx, args)) as T;
      progressBus.emit({ op: name, phase: "done" });
      return result;
    } catch (e) {
      progressBus.emit({ op: name, phase: "error", error: toEngineError(e) });
      throw e;
    }
  }

  /**
   * Make sure there is a live VTOP session, then run the social sync.
   *
   * This is what the Social page's sync button calls. The two steps are kept
   * together deliberately: the social routes are all `auth: "vtop"`, and without
   * a session they fail in a way that is indistinguishable from "no friends"
   * (the op swallows its error into `lastError`). Logging in first makes the
   * button do the one thing the user actually asked for.
   */
  async syncSocial(args: Record<string, unknown> = {}): Promise<unknown> {
    // `this.ids` is normally set by `login`, but the Social page can be opened
    // before that resolves, so fall back to the persisted credentials rather
    // than failing with "not logged in".
    if (!this.ids) {
      const stored = storage.ids.get();
      if (!stored?.VtopUsername) {
        throw new Error("Add your VTOP credentials first — social sync needs an account.");
      }
      this.ids = stored;
    }
    await credentialManager.ensureVtopSession();
    return this.sync("social", args);
  }

  async syncAll(opts: SyncAllOptions): Promise<void> {
    this.ensureIds();
    await this.sync("attendanceMarks", { semesterId: opts.semesterId });
    await this.sync("core", {
      semesterId: opts.semesterId,
      calendarType: opts.calendarType,
      isHosteller: opts.isHosteller,
    });
    await this.sync("studentProfile");
    const allGradesRes = storage.allGrades.get();
    for (const name of BACKGROUND_OPS) {
      this.sync(name, {
        semesterId: opts.semesterId,
        allGradesRes,
        settings: opts.settings,
        demoMode: opts.demoMode,
      }).catch(() => {});
    }
  }

  subscribe(cb: (e: ProgressEvent) => void): () => void {
    return progressBus.subscribe(cb);
  }
}

import "./operations";

export const syncEngine = new SyncEngine();

export function clearEventHubSession(): void {
  credentialManager.clearEventHub();
}

export function loginToEventHub(ids: Ids, demoMode = false): Promise<string> {
  return syncEngine.loginEventHub(ids, demoMode);
}

export function getVtopCreds(): VtopCreds {
  return syncEngine.getVtopCreds();
}

/**
 * Raised by `eventHubRequest` when an Event Hub route answers with an error.
 *
 * Carries the route's own `reason` where it sent one (`session_expired`,
 * `invalid_credentials`, `missing_credentials`) so a caller can tell "your
 * session died, try again" from "these credentials are wrong", which are very
 * different things to show a user.
 */
export class EventHubError extends Error {
  readonly reason?: string;
  constructor(message: string, reason?: string) {
    super(message);
    this.name = "EventHubError";
    this.reason = reason;
  }
}

/**
 * Call an Event Hub route with the cached session attached.
 *
 * The three things a raw `api("events/…", { auth: "none" })` call gets wrong,
 * and why this exists:
 *
 *  - **No session.** Every Event Hub route falls back to logging in from
 *    `username`/`password` when `jsessionid` is absent, so an action like
 *    1-Click Register spent a full login round trip to VIT (with TLS
 *    verification disabled server-side) before doing any work. `ensureEventHubSession`
 *    hands over the session the sync engine already holds.
 *  - **No expiry recovery.** With a session attached the routes can *tell* us
 *    the session died — they answer `401` with `reauthenticate: true` — and we
 *    drop the dead one and try once more. That signal is unreachable when we
 *    never send a session, so a stale cache was invisible to the client.
 *  - **Silent failure.** `apiRequest` returns the parsed body for any status,
 *    so a `400`/`500` arrives as data. Every Event Hub route puts its failure
 *    in an `error` field, so that is treated as a throw here — otherwise a
 *    failed registration is a button press with no visible result at all.
 */
export async function eventHubRequest<T = any>(
  ids: Ids,
  path: string,
  body: Record<string, unknown> = {},
  opts: { method?: "GET" | "POST" } = {},
): Promise<T> {
  const demoMode = ids?.VtopUsername === "demo";
  const hasBody = Object.keys(body).length > 0;

  const send = async (): Promise<any> => {
    // `ensureEventHubSession`, not `loginEventHub`: the latter returns a cached
    // session with no age check, so an expired one would be reused forever.
    const jsessionid = demoMode ? "" : await credentialManager.ensureEventHubSession(ids, { demoMode });
    return apiRequest(path, {
      method: opts.method ?? (hasBody ? "POST" : "GET"),
      body: hasBody ? { ...body, ...(jsessionid ? { jsessionid } : {}) } : undefined,
      // The session is already in the body, so the layer must not add another.
      auth: "none",
    });
  };

  const first = await send();
  // One retry, and only one: a session that keeps coming back marked dead is a
  // problem to report, not to keep retrying against.
  const res = first?.reauthenticate
    ? (credentialManager.clearEventHub(), await send())
    : first;
  if (res?.error) {
    throw new EventHubError(String(res.error), res.reason);
  }
  return res as T;
}
