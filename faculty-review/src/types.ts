export interface Env {
  // Bindings
  REVIEWS_SNAPSHOTS: KVNamespace;
  amazecc_reviews_queue: Queue<ReviewSubmissionMessage>;

  // Variables
  SNAPSHOT_STORE?: string; // "kv" | "memory" | "r2"
  READ_ONLY_MODE?: string; // "true" | "false"
  MAX_KV_WRITES_PER_RUN?: string; // default "50"

  // Secrets (.dev.vars or wrangler secret)
  SUPABASE_URL: string;
  SUPABASE_PUBLISHABLE_KEY?: string;
  SUPABASE_SECRET_KEY?: string;
  REVIEWS_INGEST_SECRET: string;
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
