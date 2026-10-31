import type { Env, ReviewSubmissionMessage } from "../types";
import type { FacultyRow, RawReviewRow } from "../aggregation/engine";

/**
 * PostgREST error bodies can echo row values (e.g. a unique violation includes
 * the reviewer hash). Never log the body; log the HTTP status and, when present,
 * the stable SQLSTATE-style error code only.
 */
async function safeErrorCode(res: Response): Promise<string> {
  try {
    const j = (await res.json()) as { code?: unknown };
    return typeof j.code === "string" && /^[A-Za-z0-9_-]{1,16}$/.test(j.code) ? j.code : "unknown";
  } catch {
    return "unparsed";
  }
}

export class SupabaseClient {
  private url: string;
  private key: string;

  constructor(env: Env) {
    this.url = env.SUPABASE_URL.replace(/\/$/, "");
    // Prefer the canonical service-role key name; fall back to legacy names so
    // environments provisioned before the rename keep working until rotated.
    this.key =
      env.SUPABASE_SERVICE_ROLE_KEY ||
      env.SUPABASE_SECRET_KEY ||
      env.SUPABASE_PUBLISHABLE_KEY ||
      "";
  }

  private headers(prefer?: string): HeadersInit {
    const h: Record<string, string> = {
      apikey: this.key,
      Authorization: `Bearer ${this.key}`,
      "Content-Type": "application/json",
    };
    if (prefer) {
      h.Prefer = prefer;
    }
    return h;
  }

  /**
   * Batch upsert reviews into the reviews table idempotently.
   */
  async upsertReviewsBatch(messages: ReviewSubmissionMessage[]): Promise<boolean> {
    if (messages.length === 0) return true;

    const rows = messages.map((m) => ({
      student_hash: m.student_hash,
      faculty_id: m.faculty_id,
      track: m.track,
      course_code: m.course_code || null,
      semester: m.semester || null,
      project_term: m.project_term || null,
      verified: m.verified,
      answers: m.answers,
      tags_green: m.tags_green || [],
      tags_red: m.tags_red || [],
      context: m.context || {},
      grade_bucket: m.grade_bucket || null,
      updated_at: new Date().toISOString(),
    }));

    const res = await fetch(`${this.url}/rest/v1/reviews`, {
      method: "POST",
      headers: this.headers("resolution=merge-duplicates"),
      body: JSON.stringify(rows),
    });

    if (!res.ok) {
      console.error("[supabase] Failed to upsert reviews batch:", res.status, await safeErrorCode(res));
      return false;
    }

    return true;
  }

  /**
   * Fetch all official faculty records (paginated across PostgREST 1000-row limit).
   */
  async fetchAllFaculty(): Promise<FacultyRow[]> {
    const allFaculty: FacultyRow[] = [];
    const pageSize = 1000;
    let offset = 0;

    while (true) {
      const res = await fetch(
        `${this.url}/rest/v1/faculty?select=*&status=neq.hidden&order=name.asc,id.asc&limit=${pageSize}&offset=${offset}`,
        {
          method: "GET",
          headers: this.headers(),
        }
      );
      if (!res.ok) {
        // Never publish from a partial read: a truncated list would overwrite good
        // snapshots. Throwing fails the run and leaves the last good snapshots live.
        throw new Error(`Supabase faculty read failed (HTTP ${res.status})`);
      }
      const page = (await res.json()) as FacultyRow[];
      if (!Array.isArray(page) || page.length === 0) break;
      allFaculty.push(...page);
      if (page.length < pageSize) break;
      offset += pageSize;
    }

    return allFaculty;
  }

  /**
   * Fetch all reviews for aggregation (paginated across PostgREST 1000-row limit).
   */
  async fetchAllReviews(): Promise<RawReviewRow[]> {
    const allReviews: RawReviewRow[] = [];
    const pageSize = 1000;
    let offset = 0;

    while (true) {
      const res = await fetch(
        `${this.url}/rest/v1/reviews?select=*&order=id.asc&limit=${pageSize}&offset=${offset}`,
        {
          method: "GET",
          headers: this.headers(),
        }
      );
      if (!res.ok) {
        throw new Error(`Supabase reviews read failed (HTTP ${res.status})`);
      }
      const page = (await res.json()) as RawReviewRow[];
      if (!Array.isArray(page) || page.length === 0) break;
      allReviews.push(...page);
      if (page.length < pageSize) break;
      offset += pageSize;
    }

    return allReviews;
  }

  /**
   * Persist computed faculty_aggregates table in Supabase.
   */
  async upsertAggregatesBatch(aggregates: Array<{
    faculty_id: string;
    track: string;
    course_code: string;
    n_reviews: number;
    n_verified: number;
    grade: number | null;
    per_question: Record<string, unknown>;
    style: Record<string, unknown>;
    tag_counts: Record<string, unknown>;
  }>): Promise<void> {
    if (aggregates.length === 0) return;

    const res = await fetch(`${this.url}/rest/v1/faculty_aggregates`, {
      method: "POST",
      headers: this.headers("resolution=merge-duplicates"),
      body: JSON.stringify(aggregates),
    });

    if (!res.ok) {
      console.warn("[supabase] Failed to upsert faculty_aggregates table:", res.status, await safeErrorCode(res));
    }
  }
}
