import { describe, it, expect } from "vitest";
import worker from "../index";
import { validateIngestMessage, isSupportedSchemaVersion } from "../validation/ingest";
import { TEACHING_CONFIG, PROJECT_CONFIG } from "../config/reviewQuestions";
import type { Env } from "../types";

const FACULTY = "11111111-1111-4111-a111-111111111111";
const HASH = "d".repeat(64);

function teachingAnswers(): Record<string, number> {
  const out: Record<string, number> = {};
  for (const q of TEACHING_CONFIG.qualityQuestions) if (!q.conditional) out[q.id] = 4;
  for (const s of TEACHING_CONFIG.styleQuestions) out[s.id] = 3;
  return out;
}

function base(over: Record<string, unknown> = {}) {
  return {
    schemaVersion: "1.0.0",
    idempotencyKey: `${HASH}:${FACULTY}:teaching:BCSE101E:CH20262701:`,
    student_hash: HASH,
    faculty_id: FACULTY,
    track: "teaching",
    course_code: "BCSE101E",
    semester: "CH20262701",
    verified: true,
    answers: teachingAnswers(),
    tags_green: [TEACHING_CONFIG.tags.green[0]],
    tags_red: [],
    context: { component: "Theory" },
    grade_bucket: "mid",
    timestamp: Date.now(),
    ...over,
  };
}

describe("ingest message validation", () => {
  it("accepts a well-formed teaching message", () => {
    const res = validateIngestMessage(base());
    expect(res.ok).toBe(true);
  });

  it("tolerates older/newer minor and patch versions but rejects an unknown major", () => {
    expect(isSupportedSchemaVersion("1.0.0")).toBe(true);
    expect(isSupportedSchemaVersion("1.7.3")).toBe(true);
    expect(isSupportedSchemaVersion("2.0.0")).toBe(false);
    expect(isSupportedSchemaVersion("0.9.0")).toBe(false);
    expect(isSupportedSchemaVersion("1")).toBe(false);
    expect(isSupportedSchemaVersion(undefined)).toBe(false);
    expect(validateIngestMessage(base({ schemaVersion: "1.4.0" })).ok).toBe(true);
    expect(validateIngestMessage(base({ schemaVersion: "2.0.0" })).ok).toBe(false);
  });

  it("drops unknown fields instead of forwarding them to the queue or database", () => {
    const res = validateIngestMessage(base({ comment: "great teacher", bio: "x", extra: { a: 1 } }));
    expect(res.ok).toBe(true);
    if (res.ok) {
      const keys = Object.keys(res.message);
      expect(keys).not.toContain("comment");
      expect(keys).not.toContain("bio");
      expect(keys).not.toContain("extra");
    }
  });

  it("rejects free text in every string-typed slot", () => {
    const prose = "This professor was really great and explained everything";
    const cases: Array<Record<string, unknown>> = [
      { course_code: prose },
      { semester: prose },
      { idempotencyKey: prose + "<script>" },
      { student_hash: prose },
      { faculty_id: prose },
      { tags_green: [prose] },
      { tags_red: ["made-up tag"] },
      { context: { component: prose } },
      { answers: { ...teachingAnswers(), T_CLARITY: prose } },
      { answers: { ...teachingAnswers(), NOT_A_QUESTION: 3 } },
      { grade_bucket: prose },
    ];
    for (const over of cases) {
      expect(validateIngestMessage(base(over)).ok, JSON.stringify(Object.keys(over))).toBe(false);
    }
  });

  it("rejects out-of-range, non-integer and non-numeric ratings", () => {
    for (const v of [0, 6, 3.5, NaN, "4", null]) {
      expect(validateIngestMessage(base({ answers: { ...teachingAnswers(), T_CLARITY: v } })).ok).toBe(false);
    }
  });

  it("bounds the number of tags and answers", () => {
    const tags = TEACHING_CONFIG.tags.green.slice(0, 4);
    expect(validateIngestMessage(base({ tags_green: tags })).ok).toBe(false);
  });

  it("accepts a project message only with an approved project_term and context options", () => {
    const answers: Record<string, number> = {};
    for (const q of PROJECT_CONFIG.qualityQuestions) if (!q.conditional) answers[q.id] = 4;
    for (const s of PROJECT_CONFIG.styleQuestions) answers[s.id] = 3;
    const project = {
      track: "project",
      course_code: null,
      semester: null,
      verified: false,
      project_term: "FALL2026-27 Capstone",
      tags_green: [PROJECT_CONFIG.tags.green[0]],
      answers,
      context: { project_type: "Capstone", team_size: "Solo", how_assigned: "I chose them", outcomes: ["None"] },
    };
    expect(validateIngestMessage(base(project)).ok).toBe(true);
    expect(validateIngestMessage(base({ ...project, project_term: "FALL2026-27 anything I like" })).ok).toBe(false);
    expect(validateIngestMessage(base({ ...project, context: { project_type: "free text" } })).ok).toBe(false);
  });
});

describe("queue consumer write semantics", () => {
  it("inserts with ignore-duplicates so rows the API already wrote do not fail the batch", async () => {
    const { SupabaseClient } = await import("../db/supabase");
    const realFetch = globalThis.fetch;
    let prefer = "";
    globalThis.fetch = (async (_u: unknown, init?: RequestInit) => {
      prefer = String((init?.headers as Record<string, string>).Prefer);
      return new Response(null, { status: 201 });
    }) as typeof fetch;
    try {
      const res = validateIngestMessage(base());
      if (!res.ok) throw new Error("fixture invalid");
      const db = new SupabaseClient({ SUPABASE_URL: "https://t.supabase.co", SUPABASE_SERVICE_ROLE_KEY: "k", REVIEWS_INGEST_SECRET: "s" } as Env);
      expect(await db.upsertReviewsBatch([res.message])).toBe(true);
    } finally {
      globalThis.fetch = realFetch;
    }
    expect(prefer).toContain("resolution=ignore-duplicates");
    expect(prefer).not.toContain("merge-duplicates");
  });
});

describe("queue payload never carries free text (end to end through the Worker)", () => {
  it("enqueues only the validated, rebuilt message", async () => {
    const sent: unknown[] = [];
    const env: Env = {
      SNAPSHOT_STORE: "memory",
      ENABLE_AMAZE_REVIEWS: "true",
      SUPABASE_URL: "https://test.supabase.co",
      REVIEWS_INGEST_SECRET: "test-secret-1234567890",
      amazecc_reviews_queue: { send: async (m: unknown) => void sent.push(m) } as unknown as Env["amazecc_reviews_queue"],
    };
    const raw = JSON.stringify(base({ comment: "smuggled prose", notes: "more prose" }));
    const ts = Date.now().toString();
    const enc = new TextEncoder();
    const key = await crypto.subtle.importKey("raw", enc.encode(env.REVIEWS_INGEST_SECRET), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
    const sig = Array.from(new Uint8Array(await crypto.subtle.sign("HMAC", key, enc.encode(`${ts}.${raw}`))))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");

    const res = await worker.fetch(
      new Request("http://localhost/internal/ingest", {
        method: "POST",
        headers: { "x-timestamp": ts, "x-signature": sig },
        body: raw,
      }),
      env,
      {} as ExecutionContext
    );
    expect(res.status).toBe(202);
    expect(sent).toHaveLength(1);
    const serialized = JSON.stringify(sent[0]);
    expect(serialized).not.toContain("smuggled");
    expect(serialized).not.toContain("prose");
  });
});
