import type { Env, ReviewSubmissionMessage } from "./types";
import { createSnapshotStore } from "./store/SnapshotStore";
import { validateIngestMessage } from "./validation/ingest";
import { SupabaseClient } from "./db/supabase";
import { runAggregationAndSnapshotSync } from "./aggregation/engine";

// ==============================================================================
// Structured JSON Logging & PII Redaction (Feature 15)
// ==============================================================================

export type LogLevel = "info" | "warn" | "error" | "debug";

export interface LogEntry {
  timestamp?: string;
  level: LogLevel;
  requestId: string;
  path?: string;
  method?: string;
  status?: number;
  durationMs?: number;
  service?: string;
  job?: string;
  message?: string;
  event?: string;
  [key: string]: unknown;
}

const FORBIDDEN_LOG_KEYS = new Set([
  "authorizedid",
  "vtop_id",
  "student_hash",
  "registration_number",
  "token",
  "x-signature",
  "signature",
  "authorization",
  "cookie",
  "rawbody",
  "body",
  "secret",
  "apikey",
  "password",
  "answers",
  "tags_green",
  "tags_red",
]);

function sanitizeLogValue(key: string, value: unknown): unknown {
  if (FORBIDDEN_LOG_KEYS.has(key.toLowerCase())) {
    return undefined; // Scrub completely
  }
  if (typeof value === "string") {
    if (/bearer\s+/i.test(value) || /sbp_[a-zA-Z0-9]+/i.test(value)) {
      return "[REDACTED]";
    }
  }
  return value;
}

export function logStructured(entry: LogEntry): void {
  const sanitized: Record<string, unknown> = {
    service: entry.service || "amazecc-reviews-worker",
    timestamp: entry.timestamp || new Date().toISOString(),
    level: entry.level,
    requestId: entry.requestId,
  };

  if (entry.method) sanitized.method = entry.method;
  if (entry.path) sanitized.path = entry.path;
  if (typeof entry.status === "number") sanitized.status = entry.status;
  if (typeof entry.durationMs === "number") sanitized.durationMs = entry.durationMs;
  if (entry.message) sanitized.message = entry.message;
  if (entry.event) sanitized.event = entry.event;
  if (entry.job) sanitized.job = entry.job;

  for (const [k, v] of Object.entries(entry)) {
    if (k in sanitized) continue;
    const sanitizedVal = sanitizeLogValue(k, v);
    if (sanitizedVal !== undefined) {
      sanitized[k] = sanitizedVal;
    }
  }

  const json = JSON.stringify(sanitized);
  switch (entry.level) {
    case "error":
      console.error(json);
      break;
    case "warn":
      console.warn(json);
      break;
    case "debug":
      console.debug(json);
      break;
    default:
      console.log(json);
      break;
  }
}

// ==============================================================================
// CORS Allowlist & Resolution (Feature 16)
// ==============================================================================

const DEFAULT_ALLOWED_ORIGINS = [
  "https://amazecc.com",
  "https://www.amazecc.com",
  "https://vitfac.amazecc.com",
];

function buildOriginAllowlist(env: Env): Set<string> {
  const allow = new Set<string>(DEFAULT_ALLOWED_ORIGINS);
  const extra = (env.ALLOWED_ORIGINS || "")
    .split(",")
    .map((o) => o.trim().toLowerCase())
    .filter(Boolean);
  for (const o of extra) allow.add(o);
  return allow;
}

function resolveCors(req: Request, env: Env): Record<string, string> {
  const origin = (req.headers.get("origin") || "").toLowerCase();
  const headers: Record<string, string> = {
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, If-None-Match, x-signature, x-timestamp",
    "Access-Control-Max-Age": "86400",
    // Always vary on Origin: a cached response without ACAO must never be served to an allowlisted origin.
    Vary: "Origin",
  };

  if (origin) {
    const host = (() => {
      try {
        return new URL(origin).hostname;
      } catch {
        return "";
      }
    })();
    const isLocalhost = host === "localhost" || host === "127.0.0.1";
    if (isLocalhost || buildOriginAllowlist(env).has(origin)) {
      headers["Access-Control-Allow-Origin"] = origin;
    }
  } else {
    // If no origin header, allow public access
    headers["Access-Control-Allow-Origin"] = "*";
  }
  return headers;
}

// ==============================================================================
// Security Headers (Feature 16)
// ==============================================================================

function securityHeaders(): Record<string, string> {
  return {
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Strict-Transport-Security": "max-age=31536000; includeSubDomains; preload",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
  };
}

function positiveInt(v: string | undefined, fallback: number): number {
  const n = parseInt(v ?? "", 10);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}

/** Cache-Control for snapshot reads. TTLs are configurable (CACHE_TTL_SECONDS / CACHE_SWR_SECONDS). */
function snapshotCacheControl(env: Env): string {
  const ttl = positiveInt(env.CACHE_TTL_SECONDS, 300);
  const swr = positiveInt(env.CACHE_SWR_SECONDS, 86400);
  return `public, max-age=${ttl}, stale-while-revalidate=${swr}`;
}

function responseHeaders(req: Request, env: Env, extra: Record<string, string> = {}): Record<string, string> {
  return {
    ...securityHeaders(),
    ...resolveCors(req, env),
    ...extra,
  };
}

// ==============================================================================
// Cryptographic HMAC & Dual-Secret Verification (Feature 18)
// ==============================================================================

function constantTimeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

async function verifyHmacWithSecret(
  secret: string,
  rawBody: string,
  timestampHeader: string | null,
  signatureHeader: string | null
): Promise<boolean> {
  if (!secret || !signatureHeader || !timestampHeader) return false;

  const timestamp = parseInt(timestampHeader, 10);
  if (isNaN(timestamp)) return false;

  // Support both 10-digit unix seconds and 13-digit milliseconds
  const isSeconds = timestamp < 100000000000;
  const now = isSeconds ? Math.floor(Date.now() / 1000) : Date.now();
  const maxDrift = isSeconds ? 300 : 300 * 1000;

  if (Math.abs(now - timestamp) > maxDrift) {
    return false; // Request expired or timestamp forged
  }

  const expected = signatureHeader.toLowerCase().trim();
  if (!/^[0-9a-f]{64}$/.test(expected)) return false;

  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const payload = `${timestamp}.${rawBody}`;
  const sigBuffer = await crypto.subtle.sign("HMAC", key, enc.encode(payload));
  const computedHex = Array.from(new Uint8Array(sigBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  return constantTimeEqualHex(computedHex, expected);
}

export async function verifyDualHmacSignature(
  env: Env,
  rawBody: string,
  timestampHeader: string | null,
  signatureHeader: string | null
): Promise<boolean> {
  // 1. Check primary active secret
  if (env.REVIEWS_INGEST_SECRET) {
    const valid = await verifyHmacWithSecret(
      env.REVIEWS_INGEST_SECRET,
      rawBody,
      timestampHeader,
      signatureHeader
    );
    if (valid) return true;
  }

  // 2. Fall back to previous secret during zero-downtime rotation window
  if (env.REVIEWS_INGEST_SECRET_PREVIOUS) {
    const validPrevious = await verifyHmacWithSecret(
      env.REVIEWS_INGEST_SECRET_PREVIOUS,
      rawBody,
      timestampHeader,
      signatureHeader
    );
    if (validPrevious) return true;
  }

  return false;
}

const PROFILE_ID_PATTERN = /^[A-Za-z0-9-]{1,64}$/;

function isFeatureDisabled(env: Env): boolean {
  // Strictly opt-in: ONLY the literal "true" enables the feature. Any other
  // value or an UNSET variable means OFF (default OFF; can be turned on from
  // the dashboard without a redeploy).
  return env.ENABLE_AMAZE_REVIEWS !== "true";
}

// ==============================================================================
// Worker Implementation
// ==============================================================================

const worker = {
  /**
   * 1. HTTP Fetch Handler
   */
  async fetch(req: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const startTime = Date.now();
    const requestId =
      req.headers.get("cf-ray") ||
      req.headers.get("x-request-id") ||
      crypto.randomUUID();
    const url = new URL(req.url);
    const method = req.method;
    const path = url.pathname;

    let response: Response;

    try {
      // Preflight OPTIONS handling
      if (req.method === "OPTIONS") {
        if (url.pathname.startsWith("/internal/")) {
          return new Response(null, {
            status: 405,
            headers: securityHeaders(),
          });
        }
        return new Response(null, {
          status: 204,
          headers: responseHeaders(req, env),
        });
      }

      // --- GET /health (liveness only: no store, DB or secret access; flag-independent) ---
      if (req.method === "GET" && url.pathname === "/health") {
        response = new Response(
          JSON.stringify({ ok: true, service: "amazecc-reviews-worker" }),
          {
            status: 200,
            headers: responseHeaders(req, env, {
              "Content-Type": "application/json",
              "Cache-Control": "no-store",
            }),
          }
        );
        logStructured({
          level: "info",
          requestId,
          method,
          path,
          status: 200,
          durationMs: Date.now() - startTime,
        });
        return response;
      }

      const store = createSnapshotStore(env);

      // --- GET /api/reviews/catalog ---
      if (req.method === "GET" && url.pathname === "/api/reviews/catalog") {
        if (isFeatureDisabled(env)) {
          response = new Response(
            JSON.stringify({ error: "Faculty reviews are currently unavailable" }),
            {
              status: 503,
              headers: responseHeaders(req, env, { "Content-Type": "application/json" }),
            }
          );
        } else {
          const ifNoneMatch = req.headers.get("if-none-match");
          const snapshot = await store.get("catalog.json");

          if (!snapshot) {
            response = new Response(
              JSON.stringify({
                schemaVersion: "1.0.0",
                faculty: [],
                updated_at: new Date().toISOString(),
              }),
              {
                status: 200,
                headers: responseHeaders(req, env, {
                  "Content-Type": "application/json",
                  "Cache-Control": "public, max-age=60, stale-while-revalidate=300",
                }),
              }
            );
          } else if (ifNoneMatch && ifNoneMatch.replace(/^W\//, "").replace(/"/g, "") === snapshot.etag.replace(/"/g, "")) {
            response = new Response(null, {
              status: 304,
              headers: responseHeaders(req, env, {
                ETag: snapshot.etag,
                "Cache-Control": snapshotCacheControl(env),
              }),
            });
          } else {
            response = new Response(snapshot.body, {
              status: 200,
              headers: responseHeaders(req, env, {
                "Content-Type": "application/json",
                ETag: snapshot.etag,
                "Cache-Control": snapshotCacheControl(env),
              }),
            });
          }
        }
      }

      // --- GET /api/reviews/faculty/:id ---
      else if (req.method === "GET" && url.pathname.startsWith("/api/reviews/faculty/")) {
        const facultyMatch = url.pathname.match(/^\/api\/reviews\/faculty\/([^/]+)$/);
        if (facultyMatch) {
          if (isFeatureDisabled(env)) {
            response = new Response(
              JSON.stringify({ error: "Faculty reviews are currently unavailable" }),
              {
                status: 503,
                headers: responseHeaders(req, env, { "Content-Type": "application/json" }),
              }
            );
          } else {
            const facultyId = decodeURIComponent(facultyMatch[1]);
            if (!PROFILE_ID_PATTERN.test(facultyId)) {
              response = new Response(JSON.stringify({ error: "Not found" }), {
                status: 404,
                headers: responseHeaders(req, env, { "Content-Type": "application/json" }),
              });
            } else {
              const ifNoneMatch = req.headers.get("if-none-match");
              const key = `profile/${facultyId}.json`;
              const snapshot = await store.get(key);

              if (!snapshot) {
                response = new Response(
                  JSON.stringify({ error: "Faculty profile not found" }),
                  {
                    status: 404,
                    headers: responseHeaders(req, env, { "Content-Type": "application/json" }),
                  }
                );
              } else if (ifNoneMatch && ifNoneMatch.replace(/^W\//, "").replace(/"/g, "") === snapshot.etag.replace(/"/g, "")) {
                response = new Response(null, {
                  status: 304,
                  headers: responseHeaders(req, env, {
                    ETag: snapshot.etag,
                    "Cache-Control": snapshotCacheControl(env),
                  }),
                });
              } else {
                response = new Response(snapshot.body, {
                  status: 200,
                  headers: responseHeaders(req, env, {
                    "Content-Type": "application/json",
                    ETag: snapshot.etag,
                    "Cache-Control": snapshotCacheControl(env),
                  }),
                });
              }
            }
          }
        } else {
          response = new Response(JSON.stringify({ error: "Not found" }), {
            status: 404,
            headers: responseHeaders(req, env, { "Content-Type": "application/json" }),
          });
        }
      }

      // --- POST /internal/ingest ---
      else if (req.method === "POST" && url.pathname === "/internal/ingest") {
        const rawBody = await req.text();
        const sig = req.headers.get("x-signature");
        const timestamp = req.headers.get("x-timestamp");

        // Dual-secret HMAC verification
        const isValid = await verifyDualHmacSignature(
          env,
          rawBody,
          timestamp,
          sig
        );

        if (!isValid) {
          response = new Response(
            JSON.stringify({
              error: "Unauthorized: Invalid or expired signature",
            }),
            {
              status: 401,
              headers: responseHeaders(req, env, { "Content-Type": "application/json" }),
            }
          );
        } else if (isFeatureDisabled(env)) {
          response = new Response(
            JSON.stringify({ error: "Faculty reviews are currently disabled" }),
            {
              status: 503,
              headers: responseHeaders(req, env, { "Content-Type": "application/json" }),
            }
          );
        } else if (env.READ_ONLY_MODE === "true") {
          response = new Response(
            JSON.stringify({
              error: "System is currently in read-only mode for FFCS day.",
            }),
            {
              status: 503,
              headers: responseHeaders(req, env, { "Content-Type": "application/json" }),
            }
          );
        } else {
          let payload: ReviewSubmissionMessage;
          try {
            payload = JSON.parse(rawBody);
          } catch {
            response = new Response(
              JSON.stringify({ error: "Bad JSON payload" }),
              {
                status: 400,
                headers: responseHeaders(req, env, { "Content-Type": "application/json" }),
              }
            );
            logStructured({
              level: "warn",
              requestId,
              method,
              path,
              status: response.status,
              durationMs: Date.now() - startTime,
              message: "Bad JSON payload received on ingest",
            });
            return response;
          }

          // Defence in depth: schema-validate (any 1.x.y accepted), drop unknown
          // fields, and rebuild the message from validated parts only.
          const validated = validateIngestMessage(payload);
          if (!validated.ok) {
            response = new Response(JSON.stringify({ error: validated.error }), {
              status: 400,
              headers: responseHeaders(req, env, { "Content-Type": "application/json" }),
            });
          } else {
            payload = validated.message;
            // Enqueue to Cloudflare Queue
            try {
              if (env.amazecc_reviews_queue) {
                await env.amazecc_reviews_queue.send(payload);
              } else {
                // Direct fallback for local development or mock environments
                const supabase = new SupabaseClient(env);
                await supabase.upsertReviewsBatch([payload]);
              }

              response = new Response(
                JSON.stringify({
                  success: true,
                  status: "accepted",
                  idempotencyKey: payload.idempotencyKey,
                }),
                {
                  status: 202,
                  headers: responseHeaders(req, env, { "Content-Type": "application/json" }),
                }
              );
            } catch (err: unknown) {
              logStructured({
                level: "error",
                requestId,
                method,
                path,
                status: 500,
                durationMs: Date.now() - startTime,
                message: "Write buffering failure while enqueuing review",
              });
              return new Response(
                JSON.stringify({ error: "Write buffering failure" }),
                {
                  status: 500,
                  headers: responseHeaders(req, env, { "Content-Type": "application/json" }),
                }
              );
            }
          }
        }
      }

      // --- POST /internal/recompute (trigger on-demand aggregation) ---
      else if (req.method === "POST" && url.pathname === "/internal/recompute") {
        const rawBody = await req.text();
        const sig = req.headers.get("x-signature");
        const timestamp = req.headers.get("x-timestamp");

        const isValid = await verifyDualHmacSignature(
          env,
          rawBody,
          timestamp,
          sig
        );

        if (!isValid) {
          response = new Response(JSON.stringify({ error: "Unauthorized" }), {
            status: 401,
            headers: responseHeaders(req, env, { "Content-Type": "application/json" }),
          });
        } else if (isFeatureDisabled(env)) {
          response = new Response(
            JSON.stringify({ error: "Faculty reviews are currently disabled" }),
            {
              status: 503,
              headers: responseHeaders(req, env, { "Content-Type": "application/json" }),
            }
          );
        } else {
          const supabase = new SupabaseClient(env);
          const [faculties, allReviews] = await Promise.all([
            supabase.fetchAllFaculty(),
            supabase.fetchAllReviews(),
          ]);

          const maxWrites = parseInt(env.MAX_KV_WRITES_PER_RUN || "200", 10);
          const res = await runAggregationAndSnapshotSync(
            store,
            faculties,
            allReviews,
            maxWrites
          );

          response = new Response(JSON.stringify({ success: true, ...res }), {
            status: 200,
            headers: responseHeaders(req, env, { "Content-Type": "application/json" }),
          });
        }
      } else {
        response = new Response(JSON.stringify({ error: "Not found" }), {
          status: 404,
          headers: responseHeaders(req, env, { "Content-Type": "application/json" }),
        });
      }
    } catch (err: unknown) {
      const durationMs = Date.now() - startTime;
      logStructured({
        level: "error",
        requestId,
        method,
        path,
        status: 500,
        durationMs,
        message: "Unhandled fetch exception occurred",
      });
      return new Response(JSON.stringify({ error: "Internal server error" }), {
        status: 500,
        headers: responseHeaders(req, env, {
          "Content-Type": "application/json",
          "x-request-id": requestId,
        }),
      });
    }

    const durationMs = Date.now() - startTime;
    logStructured({
      level:
        response.status >= 500
          ? "error"
          : response.status >= 400
          ? "warn"
          : "info",
      requestId,
      method,
      path,
      status: response.status,
      durationMs,
    });

    return response;
  },

  /**
   * 2. Cloudflare Queue Consumer Handler
   * Batch upserts up to 25 review submissions into Supabase
   */
  async queue(
    batch: MessageBatch<ReviewSubmissionMessage>,
    env: Env
  ): Promise<void> {
    const startTime = Date.now();
    const requestId = `queue-${crypto.randomUUID()}`;
    const supabase = new SupabaseClient(env);
    const messages = batch.messages.map((m) => m.body);

    try {
      const success = await supabase.upsertReviewsBatch(messages);
      const durationMs = Date.now() - startTime;

      if (success) {
        batch.ackAll();
        logStructured({
          level: "info",
          requestId,
          job: "queue_consumer",
          batchSize: messages.length,
          durationMs,
          message: `Successfully processed queue batch of ${messages.length} reviews`,
        });
      } else {
        batch.retryAll();
        logStructured({
          level: "error",
          requestId,
          job: "queue_consumer",
          batchSize: messages.length,
          durationMs,
          message: "Failed to batch upsert reviews to database; retrying",
        });
      }
    } catch (err: unknown) {
      const durationMs = Date.now() - startTime;
      batch.retryAll();
      logStructured({
        level: "error",
        requestId,
        job: "queue_consumer",
        batchSize: messages.length,
        durationMs,
        message: "Queue consumer exception; retrying batch",
      });
    }
  },

  /**
   * 3. Cloudflare Scheduled Cron Handler
   * Runs periodically to recompute aggregates and write changed snapshots
   */
  async scheduled(
    controller: ScheduledController,
    env: Env,
    ctx: ExecutionContext
  ): Promise<void> {
    const startTime = Date.now();
    const requestId = `cron-${crypto.randomUUID()}`;

    if (isFeatureDisabled(env)) {
      logStructured({
        level: "info",
        requestId,
        job: "scheduled_aggregation",
        message: "ENABLE_AMAZE_REVIEWS is false. Skipping scheduled recomputation.",
      });
      return;
    }

    if (env.READ_ONLY_MODE === "true") {
      logStructured({
        level: "info",
        requestId,
        job: "scheduled_aggregation",
        message:
          "READ_ONLY_MODE is enabled (FFCS peak). Skipping scheduled recomputation.",
      });
      return;
    }

    const store = createSnapshotStore(env);
    const supabase = new SupabaseClient(env);

    try {
      const [faculties, allReviews] = await Promise.all([
        supabase.fetchAllFaculty(),
        supabase.fetchAllReviews(),
      ]);

      const maxWrites = parseInt(env.MAX_KV_WRITES_PER_RUN || "200", 10);
      const result = await runAggregationAndSnapshotSync(
        store,
        faculties,
        allReviews,
        maxWrites
      );

      const durationMs = Date.now() - startTime;
      logStructured({
        level: "info",
        requestId,
        job: "scheduled_aggregation",
        durationMs,
        writtenKeysCount: result.writtenKeys.length,
        skippedKeysCount: result.skippedKeys.length,
        message: `Scheduled aggregation complete. Written: ${result.writtenKeys.length}, Skipped (diff=0): ${result.skippedKeys.length}`,
      });
    } catch (err: unknown) {
      const durationMs = Date.now() - startTime;
      logStructured({
        level: "error",
        requestId,
        job: "scheduled_aggregation",
        durationMs,
        message: "Scheduled aggregation run error",
      });
    }
  },
};

export default worker;
