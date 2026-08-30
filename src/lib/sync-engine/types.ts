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
