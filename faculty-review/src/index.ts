import type { Env, ReviewSubmissionMessage } from "./types";
import { createSnapshotStore } from "./store/SnapshotStore";
import { SupabaseClient } from "./db/supabase";
import { runAggregationAndSnapshotSync } from "./aggregation/engine";

// Helper: HMAC SHA-256 verification for internal routes
async function verifyHmacSignature(
  secret: string,
  rawBody: string,
  timestampHeader: string | null,
  signatureHeader: string | null
): Promise<boolean> {
  if (!signatureHeader || !timestampHeader) return false;

  const timestamp = parseInt(timestampHeader, 10);
  if (isNaN(timestamp) || Math.abs(Date.now() - timestamp) > 5 * 60 * 1000) {
    return false; // Request expired or timestamp forged
  }

  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["verify"]
  );

  const payload = `${timestamp}.${rawBody}`;
  const sigBytes = new Uint8Array(
    signatureHeader.match(/.{1,2}/g)?.map((byte) => parseInt(byte, 16)) || []
  );

  return crypto.subtle.verify("HMAC", key, sigBytes, enc.encode(payload));
}

function corsHeaders(): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, If-None-Match, x-signature, x-timestamp",
  };
}

export default {
  /**
   * 1. HTTP Fetch Handler
   */
  async fetch(req: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(req.url);

    if (req.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders() });
    }

    const store = createSnapshotStore(env.SNAPSHOT_STORE || "kv", env.REVIEWS_SNAPSHOTS);

    // --- GET /api/reviews/catalog ---
    if (req.method === "GET" && url.pathname === "/api/reviews/catalog") {
      const ifNoneMatch = req.headers.get("if-none-match");
      const snapshot = await store.get("catalog.json");

      if (!snapshot) {
        return new Response(JSON.stringify({ schemaVersion: "1.0.0", faculty: [], updated_at: new Date().toISOString() }), {
          status: 200,
          headers: {
            ...corsHeaders(),
            "Content-Type": "application/json",
            "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300",
          },
        });
      }

      if (ifNoneMatch && ifNoneMatch === snapshot.etag) {
        return new Response(null, {
          status: 304,
          headers: {
            ...corsHeaders(),
            ETag: snapshot.etag,
            "Cache-Control": "public, s-maxage=300, stale-while-revalidate=86400",
          },
        });
      }

      return new Response(snapshot.body, {
        status: 200,
        headers: {
          ...corsHeaders(),
          "Content-Type": "application/json",
          ETag: snapshot.etag,
          "Cache-Control": "public, s-maxage=300, stale-while-revalidate=86400",
        },
      });
    }

    // --- GET /api/reviews/faculty/:id ---
    const facultyMatch = url.pathname.match(/^\/api\/reviews\/faculty\/([^/]+)$/);
    if (req.method === "GET" && facultyMatch) {
      const facultyId = facultyMatch[1];
      const ifNoneMatch = req.headers.get("if-none-match");
      const key = `profile/${facultyId}.json`;
      const snapshot = await store.get(key);

      if (!snapshot) {
        return new Response(JSON.stringify({ error: "Faculty profile not found" }), {
          status: 404,
          headers: {
            ...corsHeaders(),
            "Content-Type": "application/json",
          },
        });
      }

      if (ifNoneMatch && ifNoneMatch === snapshot.etag) {
        return new Response(null, {
          status: 304,
          headers: {
            ...corsHeaders(),
            ETag: snapshot.etag,
            "Cache-Control": "public, s-maxage=300, stale-while-revalidate=86400",
          },
        });
      }

      return new Response(snapshot.body, {
        status: 200,
        headers: {
          ...corsHeaders(),
          "Content-Type": "application/json",
          ETag: snapshot.etag,
          "Cache-Control": "public, s-maxage=300, stale-while-revalidate=86400",
        },
      });
    }

    // --- POST /internal/ingest ---
    if (req.method === "POST" && url.pathname === "/internal/ingest") {
      const rawBody = await req.text();
      const sig = req.headers.get("x-signature");
      const timestamp = req.headers.get("x-timestamp");

      const isValid = await verifyHmacSignature(
        env.REVIEWS_INGEST_SECRET,
        rawBody,
        timestamp,
        sig
      );

      if (!isValid) {
        return new Response(JSON.stringify({ error: "Unauthorized: Invalid or expired signature" }), {
          status: 401,
          headers: { "Content-Type": "application/json" },
        });
      }

      if (env.READ_ONLY_MODE === "true") {
        return new Response(
          JSON.stringify({ error: "System is currently in read-only mode for FFCS day." }),
          { status: 503, headers: { "Content-Type": "application/json" } }
        );
      }

      let payload: ReviewSubmissionMessage;
      try {
        payload = JSON.parse(rawBody);
      } catch {
        return new Response(JSON.stringify({ error: "Bad JSON payload" }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        });
      }

      // Enforce canonical contract schemaVersion
      if (!payload || typeof payload !== "object" || payload.schemaVersion !== "1.0.0") {
        return new Response(
          JSON.stringify({ error: "Invalid or missing schemaVersion: expected 1.0.0" }),
          {
            status: 400,
            headers: { "Content-Type": "application/json" },
          }
        );
      }

      // Enqueue to Cloudflare Queue
      try {
        if (env.amazecc_reviews_queue) {
          await env.amazecc_reviews_queue.send(payload);
        } else {
          // Direct fallback if queue binding is absent in mock/local test
          const supabase = new SupabaseClient(env);
          await supabase.upsertReviewsBatch([payload]);
        }
      } catch (err) {
        console.error("[ingest] Failed to enqueue message:", err);
        return new Response(JSON.stringify({ error: "Write buffering failure" }), {
          status: 500,
          headers: { "Content-Type": "application/json" },
        });
      }

      return new Response(
        JSON.stringify({
          success: true,
          status: "accepted",
          idempotencyKey: payload.idempotencyKey,
        }),
        {
          status: 202,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // --- POST /internal/recompute (trigger on-demand aggregation) ---
    if (req.method === "POST" && url.pathname === "/internal/recompute") {
      const rawBody = await req.text();
      const sig = req.headers.get("x-signature");
      const timestamp = req.headers.get("x-timestamp");

      const isValid = await verifyHmacSignature(
        env.REVIEWS_INGEST_SECRET,
        rawBody,
        timestamp,
        sig
      );

      if (!isValid) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: { "Content-Type": "application/json" },
        });
      }

      const supabase = new SupabaseClient(env);
      const [faculties, allReviews] = await Promise.all([
        supabase.fetchAllFaculty(),
        supabase.fetchAllReviews(),
      ]);

      const maxWrites = parseInt(env.MAX_KV_WRITES_PER_RUN || "50", 10);
      const res = await runAggregationAndSnapshotSync(
        store,
        faculties,
        allReviews,
        maxWrites
      );

      return new Response(JSON.stringify({ success: true, ...res }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Not found" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  },

  /**
   * 2. Cloudflare Queue Consumer Handler
   * Batch upserts up to 25 review submissions into Supabase
   */
  async queue(batch: MessageBatch<ReviewSubmissionMessage>, env: Env): Promise<void> {
    const supabase = new SupabaseClient(env);
    const messages = batch.messages.map((m) => m.body);

    const success = await supabase.upsertReviewsBatch(messages);
    if (success) {
      batch.ackAll();
    } else {
      batch.retryAll();
    }
  },

  /**
   * 3. Cloudflare Scheduled Cron Handler
   * Runs every 10 minutes to recompute aggregates and write changed snapshots
   */
  async scheduled(controller: ScheduledController, env: Env, ctx: ExecutionContext): Promise<void> {
    if (env.READ_ONLY_MODE === "true") {
      console.log("[scheduled] READ_ONLY_MODE is enabled (FFCS peak). Skipping recomputation.");
      return;
    }

    const store = createSnapshotStore(env.SNAPSHOT_STORE || "kv", env.REVIEWS_SNAPSHOTS);
    const supabase = new SupabaseClient(env);

    try {
      const [faculties, allReviews] = await Promise.all([
        supabase.fetchAllFaculty(),
        supabase.fetchAllReviews(),
      ]);

      const maxWrites = parseInt(env.MAX_KV_WRITES_PER_RUN || "50", 10);
      const result = await runAggregationAndSnapshotSync(
        store,
        faculties,
        allReviews,
        maxWrites
      );

      console.log(
        `[scheduled] Aggregation complete. Written: ${result.writtenKeys.length}, Skipped (diff=0): ${result.skippedKeys.length}`
      );
    } catch (err) {
      console.error("[scheduled] Aggregation run error:", err);
    }
  },
};
