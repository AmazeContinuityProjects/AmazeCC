-- Marks cohort statistics.
--
-- Run inside a transaction. Every statement is idempotent, so this is safe to re-run.
--
-- WHAT IS PRESERVED
--   class_overall_stats holds live cohort data (1918 classes at the time of writing) and
--   its shape is already what the new code writes, so it is NOT dropped. The only change
--   is tightening column constraints to match `AmazeCC-API/src/lib/marksStats.ts` and
--   repairing one row.
--
-- WHAT IS NOT PRESERVED
--   class_assessment_stats is keyed on a plaintext `assessment_title`, which merged
--   identically-named assessments across the theory and lab halves of an embedded course.
--   The rows cannot be carried across because the component is not recorded, so guessing it
--   would re-create the collision the new key exists to prevent. They are archived to
--   `class_assessment_stats_legacy` first. All 26 rows had `count = 1`, so no aggregate is
--   lost in any meaningful sense — they were each a single student standing in for a cohort.
--
-- NOTHING HERE STORES A MARK. `class_user_marks` holds `value_token`, an HMAC of the value
-- a student last contributed under a server-only salt. The server uses it to verify a
-- "here is what I last contributed" claim without keeping the claim itself.

BEGIN;

-- ── repair before constraining ────────────────────────────────────────────────
-- The old remove step subtracted two nearly-equal products and never clamped, so `m2`
-- could drift below zero. One class is in that state, which makes its standard deviation
-- NaN and silently collapses every grade band onto the mean. The contribution cannot be
-- recomputed — deliberately, no individual mark is kept — so the honest repair is to zero
-- the spread and report no spread rather than a negative one.
UPDATE class_overall_stats SET m2 = 0 WHERE m2 < 0;

-- Guard against the failure mode recurring. The application already clamps, so this is a
-- backstop: a future regression now fails the write instead of storing a NaN.
ALTER TABLE class_overall_stats DROP CONSTRAINT IF EXISTS m2_non_negative;
ALTER TABLE class_overall_stats ADD  CONSTRAINT m2_non_negative CHECK (m2 >= 0);

-- Match the column contract the code assumes, so a NULL can never be read as a real zero.
UPDATE class_overall_stats SET count = 0 WHERE count IS NULL;
UPDATE class_overall_stats SET mean  = 0 WHERE mean  IS NULL;
UPDATE class_overall_stats SET m2    = 0 WHERE m2    IS NULL;
ALTER TABLE class_overall_stats ALTER COLUMN count SET DEFAULT 0;
ALTER TABLE class_overall_stats ALTER COLUMN count SET NOT NULL;
ALTER TABLE class_overall_stats ALTER COLUMN mean  SET DEFAULT 0;
ALTER TABLE class_overall_stats ALTER COLUMN mean  SET NOT NULL;
ALTER TABLE class_overall_stats ALTER COLUMN m2    SET DEFAULT 0;
ALTER TABLE class_overall_stats ALTER COLUMN m2    SET NOT NULL;

-- ── per-assessment: archive, then replace ────────────────────────────────────
CREATE TABLE IF NOT EXISTS class_assessment_stats_legacy AS
  SELECT * FROM class_assessment_stats;
DROP TABLE IF EXISTS class_assessment_stats;

CREATE TABLE IF NOT EXISTS class_assessment_stats (
  class_id       TEXT NOT NULL,
  assessment_key TEXT NOT NULL,
  count          BIGINT NOT NULL,
  mean           DOUBLE PRECISION NOT NULL,
  m2             DOUBLE PRECISION NOT NULL,
  PRIMARY KEY (class_id, assessment_key)
);
ALTER TABLE class_assessment_stats DROP CONSTRAINT IF EXISTS m2_non_negative;
ALTER TABLE class_assessment_stats ADD  CONSTRAINT m2_non_negative CHECK (m2 >= 0);

-- ── per-student tokens ───────────────────────────────────────────────────────
-- Supersedes class_user_hashes, whose key was (class_id, user_hash) with no assessment
-- dimension. Checked inside the per-action loop, that made every per-assessment
-- contribution after the first one in a batch hit `continue` and be dropped.
CREATE TABLE IF NOT EXISTS class_user_marks (
  class_id       TEXT NOT NULL,
  user_key       TEXT NOT NULL,
  scope          TEXT NOT NULL,
  assessment_key TEXT NOT NULL,
  value_token    TEXT NOT NULL,
  updated_at     BIGINT NOT NULL,
  PRIMARY KEY (class_id, user_key, scope, assessment_key)
);
DROP TABLE IF EXISTS class_user_hashes;

-- ── dead table ───────────────────────────────────────────────────────────────
-- Written by nothing: `AddClassData`'s only two call sites are commented out in
-- `src/lib/marks.ts`. Held 0 rows. The unauthenticated GET that read it has been removed.
DROP TABLE IF EXISTS class_data;

-- ── unrelated, pre-existing ──────────────────────────────────────────────────
ALTER TABLE papers_archive ADD COLUMN IF NOT EXISTS exam_semester TEXT;
ALTER TABLE qbank_questions ADD COLUMN IF NOT EXISTS topic_name TEXT;

COMMIT;