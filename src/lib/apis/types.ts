/**
 * API definition files - the adapter contract for every API the app talks to.
 *
 * The sync engine (and everything else that reaches the network) resolves
 * *operations* (`whoami`, `marks/stats`, `buses`, ...) through a registry of
 * mounted `ApiDefinition`s instead of hardcoding hosts and paths. Each mount
 * is a self-contained description of one API: its base URL, the operations it
 * serves, and how to call them.
 *
 * Mounts are intentionally plain data + small functions - no React, no
 * framework, no singletons beyond one registry map - so any API (hono,
 * legacy, UniCC, the cache worker, a self-hosted fork) can be mounted with a
 * single file in `src/lib/apis/`. Nothing else changes.
 */
export type ApiAuth = "vtop" | "eventhub" | "none" | "amazeId";

export interface AuthCreds {
  cookies?: string | string[];
  authorizedID?: string;
  csrf?: string;
  jsessionid?: string;
}

export interface ApiRoute {
  method?: "GET" | "POST";
  /** Path relative to the mount, e.g. "/whoami" or "/services/marks/stats". */
  path: string;
  /** Auth domain this route requires. Defaults to the mount's default. */
  auth?: ApiAuth;
  timeoutMs?: number;
  retry?: { max?: number; baseMs?: number };
  /**
   * Adapt the operation input (+ resolved credentials) into the wire body.
   * Receives the raw body object the caller passed; return the merged body.
   * Credentials are injected by the transport layer AFTER this runs, so a
   * definition only deals with operation-specific fields.
   */
  mapBody?: (input: unknown, creds: AuthCreds | null) => Record<string, unknown>;
  /** Adapt the raw JSON response into the shape the app expects. */
  mapResponse?: (raw: any) => any;
}

export interface ApiDefinition {
  /** Stable id: "hono" | "legacy" | "cache" | "unicc" | ... */
  id: string;
  /** Human label for settings/diagnostics. */
  title: string;
  baseUrl: string;
  /** Which auth domains this mount can serve. */
  auth: ApiAuth[];
  /**
   * Route table for the canonical operation names used by the sync engine.
   * A function form lets a mount express "anything under /api/*" as a default
   * while listing the exceptions explicitly (e.g. the /services/ prefix).
   */
  routeFor: (operation: string) => ApiRoute | null;
}
