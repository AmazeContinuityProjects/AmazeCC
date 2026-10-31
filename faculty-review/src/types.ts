export interface Env {
  // Bindings
  REVIEWS_SNAPSHOTS?: KVNamespace;
  AMAZE_REVIEWS_KV?: KVNamespace;
  AMAZE_REVIEWS_R2?: R2Bucket;
  SNAPSHOT_BUCKET?: R2Bucket;
  REVIEWS_BUCKET?: R2Bucket;
  amazecc_reviews_queue?: Queue<ReviewSubmissionMessage>;
  REVIEWS_QUEUE?: Queue<ReviewSubmissionMessage>;

  // Variables
  SNAPSHOT_STORE?: string; // "kv" (default) | "r2" | "memory"
  READ_ONLY_MODE?: string; // "true" | "false"
  ENABLE_AMAZE_REVIEWS?: string; // "true" | "false" (default OFF)
  MAX_KV_WRITES_PER_RUN?: string; // default "200"
  VITFAC_ENABLED?: string; // "true" | "false"
  // Comma-separated CORS allowlist, e.g. "https://amazecc.com,https://www.amazecc.com"
  ALLOWED_ORIGINS?: string;

  // Secrets (.dev.vars or wrangler secret)
  SUPABASE_URL: string;
  // Preferred name for the privileged Supabase key (service role).
  SUPABASE_SERVICE_ROLE_KEY?: string;
  // Legacy names kept for backward compatibility; migrate to SUPABASE_SERVICE_ROLE_KEY.
  SUPABASE_SECRET_KEY?: string;
  SUPABASE_PUBLISHABLE_KEY?: string;
  REVIEWS_INGEST_SECRET: string;
  REVIEWS_INGEST_SECRET_PREVIOUS?: string; // Dual-secret acceptance window
}

export interface ReviewSubmissionMessage {
  schemaVersion: "1.0.0";
  idempotencyKey: string;
  student_hash: string;
  faculty_id: string;
  track: "teaching" | "project";
  course_code?: string | null;
  semester?: string | null;
  project_term?: string | null;
  verified: boolean;
  answers: Record<string, number>;
  tags_green: string[];
  tags_red: string[];
  context: Record<string, unknown>;
  grade_bucket?: string | null;
  timestamp: number;
}

export interface FacultyCatalogItem {
  id: string; // UUID
  employee_id: string | null;
  name: string;
  name_norm: string;
  school: string | null;
  designation: string | null;
  image_url: string | null;
  vitfac_id: string | null;
  teaching_grade: number | null;
  teaching_reviews: number;
  teaching_verified_ratio: number;
  project_grade: number | null;
  project_reviews: number;
  updated_at: string;
}

export interface FacultyCatalogSnapshot {
  schemaVersion: "1.0.0";
  faculty: FacultyCatalogItem[];
  updated_at: string;
}

export interface QuestionStat {
  avg: number;
  dist?: [number, number, number, number, number]; // 1..5 counts (only when n >= 5)
}

export interface StyleStat {
  avg: number;
  dist?: [number, number, number, number, number];
}

export interface TagStat {
  tag: string;
  count: number;
}

export interface TrackAggregateProfile {
  track: "teaching" | "project";
  course_code: string; // "" for global summary
  n_reviews: number;
  n_verified: number;
  grade: number | null; // null if n_eff < 3
  is_early: boolean; // 3 <= n_eff <= 7
  per_question: Record<string, QuestionStat>;
  style: Record<string, StyleStat>;
  top_tags_green: TagStat[]; // min 3 votes
  top_tags_red: TagStat[]; // min 3 votes
  courses?: string[]; // courses taught
}

export interface FacultyProfileSnapshot {
  schemaVersion: "1.0.0";
  faculty: {
    id: string;
    employee_id: string | null;
    name: string;
    school: string | null;
    designation: string | null;
    image_url: string | null;
    vitfac_id?: string | null;
  };
  teaching: TrackAggregateProfile | null;
  project: TrackAggregateProfile | null;
  teaching_by_course?: Record<string, TrackAggregateProfile>;
  updated_at: string;
}

export interface ManifestData {
  hashes: Record<string, string>; // snapshotKey -> sha256
  last_updated: string;
}
