# Removing test reviews before launch

Test reviews submitted during development must be removed before real students
use the feature. This is a **manual** procedure. Nothing in this repo or its CI
runs it, and no agent or workflow should ever hold the database credentials
needed for it.

The SQL script is kept **outside every repo** by design (it can contain
hand-edited reviewer hashes): `_dev-archive/cleanup_test_reviews.sql` in the
maintainer's local workspace. If you do not have it, the logic is summarised in
section 3 so it can be re-created.

## 1. What the script clears and what it never touches

| Table | Action | Why |
|---|---|---|
| `reviews` | Delete rows matching the FILTER | Raw submissions. Holds the reviewer hash, `answers` (JSONB), `tags_green`/`tags_red`, `context`. Idempotency is the unique index on this table, so there is no separate idempotency table. |
| `faculty_aggregates` | Delete rows for every faculty touched by the filter | Derived grades. Rebuilt by the recompute path (section 5). |
| `faculty` | **Never** | Catalog. Deleting cascades into reviews, enrollments and aggregates. |
| `enrollments` | **Never** | Eligibility snapshots. Needed so your fresh post-cleanup test submission (and real students) still pass the Teaching eligibility check. |
| `unmatched_faculty` | **Never** | Admin resolution queue. |
| `admin_users`, `app_config`, all other tables | **Never** | RBAC and app config. |

Foreign keys: `reviews.faculty_id` and `faculty_aggregates.faculty_id` both
reference `faculty(id)`. Nothing references `reviews` or `faculty_aggregates`,
so they have no dependants and can be deleted in either order. The script
deletes reviews first, then aggregates, in a single statement.

Schema, RLS, indexes, triggers and sequences are never changed.

## 2. Back up first

Supabase dashboard: **Table Editor -> reviews -> Export data -> CSV**, and the
same for `faculty_aggregates`. Or, with a connection string you supply
yourself (never commit it):

```bash
pg_dump "$SUPABASE_DB_URL" --data-only --table=reviews --table=faculty_aggregates \
  --file=backup_reviews_before_cleanup.sql
```

Store the backup outside git.

## 3. Run the script (preview, rollback, commit)

The script is one transaction and ends in `ROLLBACK` by default.

1. **FILTER section.** The only editable condition. Default is `WHERE TRUE`
   (every review). To keep real student reviews, replace it with a
   `created_at` range, a list of reviewer hashes to remove, or `NOT IN` a
   list of hashes to keep. Examples are in the script comments.
2. **PREVIEW output.** Row counts per table, earliest and latest `created_at`,
   and the number of distinct reviewer hashes, for all rows, matched rows and
   kept rows. Confirm the matched rows are only yours. The script never prints
   the hashes themselves.
3. **First run: leave `ROLLBACK`.** Check `reviews_deleted`, `aggregate_rows_deleted`
   and the post-delete check (faculty, enrollments and unmatched counts must
   equal what you expect). Nothing persists.
4. **Second run: swap to `COMMIT`.** Comment out `ROLLBACK;`, uncomment
   `COMMIT;`, run the whole script again. Do not run it in parts: the temp
   table only lives for one transaction.

If you must re-create the script, the delete is:

```sql
BEGIN;
CREATE TEMP TABLE cleanup_target ON COMMIT DROP AS
  SELECT id, faculty_id FROM reviews WHERE TRUE;  -- FILTER
WITH del_reviews AS (
  DELETE FROM reviews WHERE id IN (SELECT id FROM cleanup_target) RETURNING id
), del_aggregates AS (
  DELETE FROM faculty_aggregates
  WHERE faculty_id IN (SELECT DISTINCT faculty_id FROM cleanup_target) RETURNING faculty_id
)
SELECT (SELECT count(*) FROM del_reviews) AS reviews_deleted,
       (SELECT count(*) FROM del_aggregates) AS aggregates_deleted;
ROLLBACK;  -- change to COMMIT deliberately
```

## 4. Rebuild aggregates with the repo's own path

Do not recompute by hand. Use the Worker:

```bash
TS=$(date +%s)
SIG=$(printf '%s.' "$TS" | openssl dgst -sha256 -hmac "$REVIEWS_INGEST_SECRET" | awk '{print $NF}')
curl -sS -X POST "https://reviews-api.amazecc.com/internal/recompute" \
  -H "x-timestamp: $TS" -H "x-signature: $SIG"
```

The signed payload is `<timestamp>.<raw body>`; the body is empty here. The
timestamp must be within 5 minutes. Or wait for the `*/10 * * * *` cron. The
source is `src/aggregation/engine.ts` (`runAggregationAndSnapshotSync`).

## 5. Snapshots, caches, and the "Not enough reviews yet" check

1. The recompute writes only snapshots whose content hash changed
   (write-diffing). After a full cleanup, every profile with no reviews gets
   rewritten to the no-grade state. Confirm the response lists written keys.
2. Purge the edge cache if you cached snapshot URLs (Cloudflare dashboard ->
   Caching -> Purge by URL for `/api/reviews/catalog` and the profile routes).
3. Open the catalog: every faculty must show **"Not enough reviews yet"** (no
   grade) unless real reviews remain above the minimum-review threshold.
4. Clear browser state in your own browser: `sessionStorage` keys
   `amaze_faculty_catalog_v3` and `amaze_faculty_catalog_ts_v3`.

## 6. Prove it end to end

1. Submit one fresh test review through the UI (flag on, staging).
2. Confirm it appears in the queue, then in `reviews`, and after the next
   recompute in the profile snapshot.
3. Remove it with the same script, using a `student_hash IN (...)` or
   `created_at` FILTER, then recompute again. The profile must return to
   "Not enough reviews yet".

## 7. Places test data can survive that the script does not cover

- **Workers KV / R2 snapshots** in your own Cloudflare account (staging and any
  earlier personal namespaces). Delete keys with
  `wrangler kv key delete --binding=REVIEWS_SNAPSHOTS <key> --env <env>` or empty
  the R2 bucket. The production namespace is rebuilt from the database.
- **Queue contents**: `amazecc-reviews-queue` and `amazecc-reviews-dlq`
  (and the `-staging` pair). Messages not yet consumed would re-insert reviews.
  Drain or purge before running the script.
- **Edge cache** entries (`s-maxage=300`) until they expire or are purged.
- **Browser state**: `sessionStorage` catalog keys, service-worker caches.
- **Local caches** on dev machines (`.wrangler/` state, `.next/` caches).
- **Exported CSV / SQL backups** from step 2.
- **Scratch and fixture files** that contain real faculty or reviewer
  identifiers. The old `patch_*.js` and `test_*.js` scripts were moved to the
  `_dev-archive/` folder outside the repos. Check `git grep` in each repo for
  leftover identifiers before the first push.
- **Application logs** are designed not to contain reviewer hashes or
  identifiers, but check any logs captured while debugging locally.
