# Test Data Cleanup Runbook & External Persistence Audit

**Document Version**: 1.0.0  
**Target Service**: AmazeCC Faculty Reviews System  
**Associated Script**: `_dev-archive/cleanup_test_reviews.sql`  
**Location**: `AmazeCC/faculty-review/docs/CLEANUP_STEPS.md`  
**Specification**: ORIGINAL_REQUEST.md Requirements R1 & R2  

---

## 1. Overview & Objective

During local feature development, integration testing, and staging verification, synthetic reviews and test enrollments are generated. Before releasing the Faculty Reviews feature to production, all test records must be purged without compromising official faculty records, course catalogs, or administrative tables.

This runbook provides the step-by-step operating procedure for database backup, preview verification, transactional execution with rollback defaults, edge cache invalidation, and external persistence audits.

---

## 2. Step 1: Pre-Cleanup Database Backup

Prior to executing any delete operations, create an isolated backup of all review-related tables.

### 2.1 Backup via PostgreSQL CLI (`pg_dump`)
Run `pg_dump` targeting the review tables specifically:

```bash
# Export review tables schema and data to timestamped SQL dump
pg_dump "$DATABASE_URL" \
  --table=reviews \
  --table=enrollments \
  --table=faculty_aggregates \
  --data-only \
  --file="backup_reviews_pre_cleanup_$(date +%Y%m%d_%H%M%S).sql"
```

### 2.2 Backup via Supabase Web Dashboard
1. Navigate to the **Supabase Dashboard** -> **Table Editor**.
2. Select table `reviews` -> click **Export data** -> download as CSV.
3. Select table `enrollments` -> click **Export data** -> download as CSV.
4. Select table `faculty_aggregates` -> click **Export data** -> download as CSV.
5. Store exported backups in a secure developer archive outside git history.

---

## 3. Step 2: Read-Only Preview Execution

Open `_dev-archive/cleanup_test_reviews.sql` in the Supabase SQL Editor or `psql`. Execute **SECTION 1** to inspect test data without modifying state.

1. **Review Count Preview**:
   ```sql
   SELECT 
       COUNT(*) AS test_reviews_count,
       COUNT(DISTINCT student_hash) AS distinct_test_students,
       COUNT(DISTINCT faculty_id) AS affected_faculty_count
   FROM reviews
   WHERE student_hash IN ('<TEST_HASH_1>', '<TEST_HASH_2>') OR student_hash LIKE 'test_%';
   ```
2. **Review the Output**:
   - Confirm that `test_reviews_count` matches the expected number of synthetic submissions.
   - Confirm that the `student_hash` list contains strictly test identifiers, and no production students.
   - Record the affected `faculty_id` list to verify aggregation recomputations later.

---

## 4. Step 3: Transactional Cleanup Execution

### 4.1 Dry-Run Execution (Default `ROLLBACK`)
1. Ensure the filter condition in **SECTION 2** matches your verified filter from Section 1.
2. Execute Section 2 with the default `ROLLBACK;`:
   ```sql
   BEGIN;
   -- Deletes execute inside transaction...
   ROLLBACK;
   ```
3. Inspect output counts:
   - Check `remaining_test_reviews`: must report `0` during the transaction.
   - Check `total_faculty_intact`: must confirm total count of faculty is unchanged.
   - Confirm transaction terminates with `ROLLBACK` (0 rows modified in database).

### 4.2 Permanent Execution (`COMMIT`)
1. Once dry-run counts match expectations exactly, comment out `ROLLBACK;` and uncomment `COMMIT;`:
   ```sql
   -- ROLLBACK;
   COMMIT;
   ```
2. Execute the block in the SQL Editor.
3. Confirm transaction status reports `COMMIT`.

---

## 5. Step 4: Aggregation Engine Trigger & Snapshot Rebuild

Deleting raw reviews leaves `faculty_aggregates` rows cleared or stale. The Cloudflare Worker Bayesian aggregation engine must now be triggered to rebuild clean aggregates and write new snapshots.

### 5.1 Trigger via Ingest API Recompute
Execute an authenticated `POST` to the worker's `/internal/recompute` route:

```bash
# Compute timestamp and HMAC signature using REVIEWS_INGEST_SECRET
TIMESTAMP=$(date +%s)
SIGNATURE=$(echo -n "${TIMESTAMP}." | openssl dgst -sha256 -hmac "$REVIEWS_INGEST_SECRET" | awk '{print $2}')

curl -s -X POST "https://reviews-api.amazecc.com/internal/recompute" \
  -H "Content-Type: application/json" \
  -H "x-timestamp: ${TIMESTAMP}" \
  -H "x-signature: ${SIGNATURE}"
```

Expected response:
```json
{
  "success": true,
  "writtenKeys": ["catalog.json", "profile/b49bf45d-b417-4044-a91b-53e5ad109a79.json"],
  "skippedKeys": ["profile/c12...json"]
}
```

### 5.2 Trigger via Scheduled Cron
Alternatively, wait for the Worker's 10-minute cron trigger (`*/10 * * * *`) to automatically run `runAggregationAndSnapshotSync()`.

---

## 6. Step 5: Edge Cache & Client Flush

Because Edge snapshots have cache headers (`s-maxage=300, stale-while-revalidate=86400`), caches must be purged to immediately reflect the cleaned review data.

### 6.1 Cloudflare Edge Cache Purge
1. Open Cloudflare Dashboard -> **Caching** -> **Configuration**.
2. Click **Purge Cache** -> **Custom Purge**.
3. Enter the public API endpoints:
   - `https://reviews-api.amazecc.com/api/reviews/catalog`
   - `https://reviews-api.amazecc.com/api/reviews/faculty/*`
4. Click **Purge**.

### 6.2 Browser Client Cache Flush
The frontend Next.js app (`AmazeCC`) caches the catalog in browser `sessionStorage` under `amaze_faculty_catalog_v3`.
To clear this during verification:
```js
// In browser developer tools console:
sessionStorage.removeItem("amaze_faculty_catalog_v3");
sessionStorage.removeItem("amaze_faculty_catalog_ts_v3");
window.location.reload();
```

---

## 7. Step 6: Audit of External Test Data Persistence Locations

Test review data can persist in several distinct locations outside the primary PostgreSQL database. All six locations must be audited during cleanup:

| # | Persistence Location | Mechanism / Path | Data Format | Purge Procedure |
|---|---|---|---|---|
| 1 | **Cloudflare Workers KV** | Namespace: `REVIEWS_SNAPSHOTS`<br>Keys: `catalog.json`, `profile/<id>.json`, `manifest` | JSON strings with SHA-256 ETag metadata | Automatically updated when write-diffing recomputes; or manual purge via `wrangler kv:key delete --binding=REVIEWS_SNAPSHOTS <key>`. |
| 2 | **Cloudflare Edge Cache** | `caches.default` edge cache via `Cache-Control: public, s-maxage=300` | HTTP Response cache | Purged via Cloudflare Dashboard Custom Purge or API cache purge call. |
| 3 | **Cloudflare Queues** | Queue: `amazecc-reviews-queue`<br>DLQ: `amazecc-reviews-dlq` | Ingest message JSON: `ReviewSubmissionMessage` | Check queue backlog via Cloudflare Dashboard. If messages are in-flight during cleanup, drain or delete dead-letter queue messages. |
| 4 | **Browser Storage** | Browser `sessionStorage`: `amaze_faculty_catalog_v3`, `amaze_faculty_catalog_ts_v3` | Compressed catalog JSON (5m/24h TTL) | Client versioning bump (incremented from `v1`/`v2` to `v3`); automatically purged on browser session restart or manual clear. |
| 5 | **Local Development Scripts** | Root files moved to `_dev-archive/`: `test_*.js`, `patch_*.js`, `scratch_*.mjs`, `sync_vtop.mjs` | Local JavaScript files with test hashes and parameters | Relocated into `_dev-archive/` outside all git repositories; credentials sanitized. |
| 6 | **Degraded Mode In-Memory Cache** | Next.js API server (`AmazeCC-api`) degraded route handler memory | In-memory query cache | Cleared when Next.js API service restarts or worker resumes primary serving. |

---

## 8. Step 7: Post-Cleanup Verification Checklist

- [ ] Query `SELECT COUNT(*) FROM reviews WHERE student_hash IN (...)` returns `0`.
- [ ] Query `SELECT COUNT(*) FROM enrollments WHERE student_hash IN (...)` returns `0`.
- [ ] Query `SELECT COUNT(*) FROM faculty` confirms 100% of faculty records are intact.
- [ ] Query `SELECT COUNT(*) FROM faculty_aggregates` shows clean aggregate state matching remaining real reviews.
- [ ] GET `https://reviews-api.amazecc.com/api/reviews/catalog` returns HTTP 200 with `schemaVersion: "1.0.0"` and 0 test review references.
- [ ] GET `https://reviews-api.amazecc.com/api/reviews/faculty/:id` returns verified profile snapshots without test ratings.
