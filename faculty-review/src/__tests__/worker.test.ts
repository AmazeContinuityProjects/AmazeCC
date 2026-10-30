import { describe, it, expect, beforeEach } from "vitest";
import worker from "../index";
import { InMemorySnapshotStore } from "../store/SnapshotStore";
import type { Env, ReviewSubmissionMessage } from "../types";

describe("Cloudflare Worker Handlers", () => {
  let mockEnv: Env;
  let inMemoryStore: InMemorySnapshotStore;

  beforeEach(() => {
    inMemoryStore = new InMemorySnapshotStore();
    mockEnv = {
      SNAPSHOT_STORE: "memory",
      READ_ONLY_MODE: "false",
      MAX_KV_WRITES_PER_RUN: "50",
      SUPABASE_URL: "https://test.supabase.co",
      REVIEWS_INGEST_SECRET: "test-secret-1234567890",
      REVIEWS_SNAPSHOTS: inMemoryStore as unknown as KVNamespace,
      amazecc_reviews_queue: {
        send: async () => {},
      } as unknown as Queue<ReviewSubmissionMessage>,
    };
  });

  it("serves catalog snapshot with ETag and supports 304 Not Modified", async () => {
    const catalogData = JSON.stringify({ faculty: [], updated_at: "2026-10-30T00:00:00.000Z" });
    const etag = '"catalog-etag-1"';
    await inMemoryStore.put("catalog.json", catalogData, etag);

    // Initial GET
    const req1 = new Request("http://localhost/api/reviews/catalog");
    const res1 = await worker.fetch(req1, mockEnv, {} as ExecutionContext);
    expect(res1.status).toBe(200);
    expect(res1.headers.get("ETag")).toBe(etag);
    expect(await res1.text()).toBe(catalogData);

    // Subsequent GET with If-None-Match
    const req2 = new Request("http://localhost/api/reviews/catalog", {
      headers: { "if-none-match": etag },
    });
    const res2 = await worker.fetch(req2, mockEnv, {} as ExecutionContext);
    expect(res2.status).toBe(304);
  });

  it("rejects unsigned requests to /internal/ingest with 401", async () => {
    const req = new Request("http://localhost/internal/ingest", {
      method: "POST",
      body: JSON.stringify({ test: "data" }),
    });
    const res = await worker.fetch(req, mockEnv, {} as ExecutionContext);
    expect(res.status).toBe(401);
  });

  it("accepts valid HMAC signed request to /internal/ingest and enqueues it with 202", async () => {
    const payload: ReviewSubmissionMessage = {
      schemaVersion: "1.0.0",
      idempotencyKey: "test-key-1",
      student_hash: "student_hash_abc",
      faculty_id: "f-123",
      track: "teaching",
      verified: true,
      answers: { T_CLARITY: 5 },
      tags_green: [],
      tags_red: [],
      context: {},
      timestamp: Date.now(),
    };

    const rawBody = JSON.stringify(payload);
    const timestamp = Date.now().toString();

    // Compute HMAC-SHA256 signature
    const enc = new TextEncoder();
    const key = await crypto.subtle.importKey(
      "raw",
      enc.encode(mockEnv.REVIEWS_INGEST_SECRET),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"]
    );
    const sigBuffer = await crypto.subtle.sign(
      "HMAC",
      key,
      enc.encode(`${timestamp}.${rawBody}`)
    );
    const signature = Array.from(new Uint8Array(sigBuffer))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");

    const req = new Request("http://localhost/internal/ingest", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-timestamp": timestamp,
        "x-signature": signature,
      },
      body: rawBody,
    });

    const res = await worker.fetch(req, mockEnv, {} as ExecutionContext);
    expect(res.status).toBe(202);
    const json = (await res.json()) as { success: boolean; status: string };
    expect(json.success).toBe(true);
    expect(json.status).toBe("accepted");
  });

  it("rejects signed requests to /internal/ingest with missing schemaVersion with 400", async () => {
    const payload = {
      idempotencyKey: "test-key-no-version",
      student_hash: "student_hash_abc",
      faculty_id: "f-123",
      track: "teaching",
      verified: true,
      answers: { T_CLARITY: 5 },
      tags_green: [],
      tags_red: [],
      context: {},
      timestamp: Date.now(),
    };
    const rawBody = JSON.stringify(payload);
    const timestamp = Date.now().toString();

    const enc = new TextEncoder();
    const key = await crypto.subtle.importKey(
      "raw",
      enc.encode(mockEnv.REVIEWS_INGEST_SECRET),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"]
    );
    const sigBuffer = await crypto.subtle.sign(
      "HMAC",
      key,
      enc.encode(`${timestamp}.${rawBody}`)
    );
    const signature = Array.from(new Uint8Array(sigBuffer))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");

    const req = new Request("http://localhost/internal/ingest", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-timestamp": timestamp,
        "x-signature": signature,
      },
      body: rawBody,
    });

    const res = await worker.fetch(req, mockEnv, {} as ExecutionContext);
    expect(res.status).toBe(400);
    const json = (await res.json()) as { error: string };
    expect(json.error).toContain("schemaVersion");
  });

  it("rejects signed requests to /internal/ingest with invalid schemaVersion with 400", async () => {
    const payload = {
      schemaVersion: "2.0.0",
      idempotencyKey: "test-key-wrong-ver",
      student_hash: "student_hash_abc",
      faculty_id: "f-123",
      track: "teaching",
      verified: true,
      answers: { T_CLARITY: 5 },
      tags_green: [],
      tags_red: [],
      context: {},
      timestamp: Date.now(),
    };
    const rawBody = JSON.stringify(payload);
    const timestamp = Date.now().toString();

    const enc = new TextEncoder();
    const key = await crypto.subtle.importKey(
      "raw",
      enc.encode(mockEnv.REVIEWS_INGEST_SECRET),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"]
    );
    const sigBuffer = await crypto.subtle.sign(
      "HMAC",
      key,
      enc.encode(`${timestamp}.${rawBody}`)
    );
    const signature = Array.from(new Uint8Array(sigBuffer))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");

    const req = new Request("http://localhost/internal/ingest", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-timestamp": timestamp,
        "x-signature": signature,
      },
      body: rawBody,
    });

    const res = await worker.fetch(req, mockEnv, {} as ExecutionContext);
    expect(res.status).toBe(400);
    const json = (await res.json()) as { error: string };
    expect(json.error).toContain("schemaVersion");
  });

  it("rejects stale requests (> 5 min) even if signature is valid", async () => {
    const rawBody = JSON.stringify({ test: true });
    const staleTimestamp = (Date.now() - 10 * 60 * 1000).toString(); // 10 minutes ago

    const enc = new TextEncoder();
    const key = await crypto.subtle.importKey(
      "raw",
      enc.encode(mockEnv.REVIEWS_INGEST_SECRET),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"]
    );
    const sigBuffer = await crypto.subtle.sign(
      "HMAC",
      key,
      enc.encode(`${staleTimestamp}.${rawBody}`)
    );
    const signature = Array.from(new Uint8Array(sigBuffer))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");

    const req = new Request("http://localhost/internal/ingest", {
      method: "POST",
      headers: {
        "x-timestamp": staleTimestamp,
        "x-signature": signature,
      },
      body: rawBody,
    });

    const res = await worker.fetch(req, mockEnv, {} as ExecutionContext);
    expect(res.status).toBe(401);
  });
});
