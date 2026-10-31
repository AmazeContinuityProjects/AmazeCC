import type { Env, ReviewSubmissionMessage } from "../types";
import type { FacultyRow, RawReviewRow } from "../aggregation/engine";

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
      const errText = await res.text();
      console.error("[supabase] Failed to upsert reviews batch:", res.status, errText);
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
        `${this.url}/rest/v1/faculty?select=*&status=neq.hidden&order=name.asc&limit=${pageSize}&offset=${offset}`,
        {
          method: "GET",
          headers: this.headers(),
        }
      );
      if (!res.ok) {
        console.error("[supabase] Failed to fetch faculty list:", res.status);
        break;
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
        `${this.url}/rest/v1/reviews?select=*&limit=${pageSize}&offset=${offset}`,
        {
          method: "GET",
          headers: this.headers(),
        }
      );
      if (!res.ok) {
        console.error("[supabase] Failed to fetch reviews:", res.status);
        break;
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
      const err = await res.text();
      console.warn("[supabase] Failed to upsert faculty_aggregates table:", res.status, err);
    }
  }
}
