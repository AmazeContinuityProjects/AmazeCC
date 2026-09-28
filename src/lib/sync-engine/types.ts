export interface Ids {
  VtopUsername: string;
  VtopPassword: string;
  MoodleUsername?: string;
  MoodlePassword?: string;
  [key: string]: unknown;
}

export interface VtopCreds {
  cookies: string[];
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
