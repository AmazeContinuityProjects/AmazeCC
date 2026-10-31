import { TEACHING_CONFIG, PROJECT_CONFIG } from "../config/reviewQuestions";
import type { ReviewSubmissionMessage } from "../types";

/**
 * Defence-in-depth validation of an ingest message, run AFTER the HMAC check.
 *
 * The API already validates, but the Worker is the last gate before the queue
 * and the database, and the HMAC secret is the only thing proving the sender.
 * If that secret ever leaks, this keeps arbitrary data (and free text) out of
 * the queue payload and every database column.
 *
 * Versioning: any `1.x.y` schemaVersion is accepted (older and newer minor/patch
 * versions from a rolling deploy). Unknown FIELDS are dropped, never forwarded.
 * An unknown MAJOR version is rejected.
 */

export const SUPPORTED_SCHEMA_MAJOR = 1;

const SEMVER = /^(\d+)\.(\d+)\.(\d+)$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const HASH_HEX = /^[0-9a-f]{64}$/i;
const COURSE_CODE = /^[A-Z0-9][A-Z0-9()\- ]{1,24}$/;
const SEMESTER = /^[A-Z0-9][A-Z0-9\-]{2,24}$/;
const IDEMPOTENCY_KEY = /^[A-Za-z0-9:_\-. ()]{1,400}$/;
const MAX_ANSWERS = 40;

export type IngestValidation =
  | { ok: true; message: ReviewSubmissionMessage }
  | { ok: false; error: string };

export function isSupportedSchemaVersion(v: unknown): boolean {
  if (typeof v !== "string") return false;
  const m = SEMVER.exec(v);
  return !!m && parseInt(m[1], 10) === SUPPORTED_SCHEMA_MAJOR;
}

function fail(error: string): IngestValidation {
  return { ok: false, error };
}

export function validateIngestMessage(input: unknown): IngestValidation {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return fail("Payload must be a JSON object");
  }
  const d = input as Record<string, unknown>;

  if (!isSupportedSchemaVersion(d.schemaVersion)) {
    return fail("Invalid or missing schemaVersion: expected 1.x.y");
  }
  if (typeof d.idempotencyKey !== "string" || !IDEMPOTENCY_KEY.test(d.idempotencyKey)) {
    return fail("Invalid idempotencyKey");
  }
  if (typeof d.student_hash !== "string" || !HASH_HEX.test(d.student_hash)) {
    return fail("Invalid student_hash");
  }
  if (typeof d.faculty_id !== "string" || !UUID.test(d.faculty_id)) {
    return fail("Invalid faculty_id");
  }
  if (d.track !== "teaching" && d.track !== "project") {
    return fail("Invalid track");
  }
  const track = d.track;
  const config = track === "teaching" ? TEACHING_CONFIG : PROJECT_CONFIG;

  let course_code: string | null = null;
  let semester: string | null = null;
  let project_term: string | null = null;

  if (track === "teaching") {
    if (typeof d.course_code !== "string" || !COURSE_CODE.test(d.course_code)) {
      return fail("Invalid course_code");
    }
    if (typeof d.semester !== "string" || !SEMESTER.test(d.semester)) {
      return fail("Invalid semester");
    }
    course_code = d.course_code;
    semester = d.semester;
  } else if (d.project_term !== undefined && d.project_term !== null && d.project_term !== "") {
    const term = typeof d.project_term === "string" ? d.project_term : "";
    const types = PROJECT_CONFIG.contextFields.projectTypes ?? [];
    const type = types.find((t) => term.endsWith(` ${t}`));
    const prefix = type ? term.slice(0, term.length - type.length - 1) : "";
    if (!type || !SEMESTER.test(prefix)) return fail("Invalid project_term");
    project_term = term;
  }

  if (typeof d.verified !== "boolean") return fail("Invalid verified");

  // Answers: known question ids only, integers 1..5.
  if (!d.answers || typeof d.answers !== "object" || Array.isArray(d.answers)) {
    return fail("Invalid answers");
  }
  const known = new Set<string>([
    ...config.qualityQuestions.map((q) => q.id),
    ...config.styleQuestions.map((s) => s.id),
  ]);
  const answers: Record<string, number> = {};
  const entries = Object.entries(d.answers as Record<string, unknown>);
  if (entries.length > MAX_ANSWERS) return fail("Too many answers");
  for (const [k, v] of entries) {
    if (!known.has(k)) return fail("Unknown question id");
    if (typeof v !== "number" || !Number.isInteger(v) || v < 1 || v > 5) {
      return fail("Invalid answer value");
    }
    answers[k] = v;
  }

  const readTags = (raw: unknown, allowed: readonly string[]): string[] | null => {
    if (raw === undefined || raw === null) return [];
    if (!Array.isArray(raw) || raw.length > 3) return null;
    const out: string[] = [];
    for (const t of raw) {
      if (typeof t !== "string" || !allowed.includes(t)) return null;
      out.push(t);
    }
    return out;
  };
  const tags_green = readTags(d.tags_green, config.tags.green);
  const tags_red = readTags(d.tags_red, config.tags.red);
  if (!tags_green || !tags_red) return fail("Invalid tags");

  // Context: allowlisted keys, values from the approved option lists only.
  const context: Record<string, unknown> = {};
  if (d.context !== undefined && d.context !== null) {
    if (typeof d.context !== "object" || Array.isArray(d.context)) return fail("Invalid context");
    const c = d.context as Record<string, unknown>;
    const opts = PROJECT_CONFIG.contextFields;
    const pick = (key: string, allowed: readonly string[]): boolean => {
      const v = c[key];
      if (v === undefined || v === null || v === "") return true;
      if (typeof v !== "string" || !allowed.includes(v)) return false;
      context[key] = v;
      return true;
    };
    if (
      !pick("component", ["Theory", "Lab", "Embedded"]) ||
      !pick("project_type", opts.projectTypes ?? []) ||
      !pick("team_size", opts.teamSizes ?? []) ||
      !pick("how_assigned", opts.howAssigned ?? [])
    ) {
      return fail("Invalid context");
    }
    if (c.outcomes !== undefined && c.outcomes !== null) {
      const allowedOutcomes = opts.outcomes ?? [];
      if (
        !Array.isArray(c.outcomes) ||
        c.outcomes.length > allowedOutcomes.length ||
        c.outcomes.some((o) => typeof o !== "string" || !allowedOutcomes.includes(o))
      ) {
        return fail("Invalid context");
      }
      context.outcomes = Array.from(new Set(c.outcomes as string[]));
    }
  }

  let grade_bucket: string | null = null;
  if (d.grade_bucket !== undefined && d.grade_bucket !== null) {
    if (d.grade_bucket !== "high" && d.grade_bucket !== "mid" && d.grade_bucket !== "low") {
      return fail("Invalid grade_bucket");
    }
    grade_bucket = d.grade_bucket;
  }

  const timestamp = typeof d.timestamp === "number" && Number.isFinite(d.timestamp) ? d.timestamp : Date.now();

  // Rebuilt from validated parts: unknown fields are not carried over.
  const message: ReviewSubmissionMessage = {
    schemaVersion: "1.0.0",
    idempotencyKey: d.idempotencyKey,
    student_hash: d.student_hash.toLowerCase(),
    faculty_id: d.faculty_id,
    track,
    course_code,
    semester,
    project_term,
    verified: d.verified,
    answers,
    tags_green,
    tags_red,
    context,
    grade_bucket,
    timestamp,
  };
  return { ok: true, message };
}
