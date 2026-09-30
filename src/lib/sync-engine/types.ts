export interface Ids {
  VtopUsername: string;
  VtopPassword: string;
  MoodleUsername?: string;
  MoodlePassword?: string;
  [key: string]: unknown;
}

export interface VtopCreds {
  /**
   * The VTOP session cookie jar, ready to send as a `Cookie:` header.
   *
   * `string[]` is what this has always been *typed* as and never been: both
   * backends join the jar before returning it — `AmazeCC-API/src/app/api/login`
   * does `[...cookies, ...loginCookies].join("; ")`, and UniCC's `/api/login`
   * does the same. So a `string` is the real value, and this union exists to say
   * that plainly rather than to keep a type that has been lying since it was
   * written.
   *
   * Nothing in the client reads it as an array: it is forwarded as JSON to the
   * AmazeCC API, whose routes already accept both shapes
   * (`Array.isArray(cookies) ? cookies.join("; ") : cookies`). A `string` — what
   * UniCC returns — is therefore handled correctly by the existing backend with no
   * change to it.
   */
  cookies: string | string[];
  authorizedID: string;
  csrf: string;
  /**
   * When these were obtained, in epoch ms.
   *
   * The VTOP session is not durable — the server can invalidate the cookie jar at
   * any time, and it expires on its own — so a cached set of cookies that looked
   * fine an hour ago may now be rejected. Tracking the age lets
   * `CredentialManager` re-authenticate before a request wastes a round trip on
   * a session that is already dead.
   *
   * Optional so that a `VtopCreds` built without it (tests, the demo stub) is
   * still assignable; a missing value is treated as stale, which is the safe
   * direction.
   */
  fetchedAt?: number;
}

export type SyncPhase = "idle" | "start" | "done" | "error";

export interface ProgressEvent {
  op: string;
  phase: SyncPhase;
  message?: string;
  delta?: number;
  error?: EngineError;
}

export type EngineError =
  | { kind: "auth"; domain: "vtop" | "eventhub"; message: string }
  | { kind: "transient"; message: string; retryAfterMs: number }
  | { kind: "notFound"; message: string }
  | { kind: "aborted" }
  | { kind: "unknown"; message: string };

export type AuthDomain = "vtop" | "eventhub";

export type AtomSetter = (atom: unknown, value: unknown) => void;
