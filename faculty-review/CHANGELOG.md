# Changelog — faculty-review (Cloudflare Worker)

## Unreleased (feature/faculty-reviews, 2026-10-31)

### Added
- Worker component `faculty-review/` (moved from standalone
  `amazecc-reviews-worker/` per handover decision — no separate repository).
- `fetch` handler: edge-cached reads (`/api/reviews/catalog`,
  `/api/reviews/faculty/:id`) with ETag/If-None-Match 304 support and
  `stale-while-revalidate` caching; PII-scrubbed structured logging.
- `queue` consumer: batch idempotent upserts to Supabase (`max_batch_size=25`),
  ack/retry semantics.
- `scheduled` (cron `*/10`) aggregation: weighted scoring, Bayesian shrinkage
  (m=8), verified/unverified weights, recency decay, outlier trimming,
  deterministic ordering, and **write-diffed snapshot publication** with a
  manifest (`MAX_KV_WRITES_PER_RUN` budget).
- `SnapshotStore` abstraction with KV (default), **R2**
  (`REVIEWS_BUCKET` / `amazecc-faculty-reviews`) and in-memory backends;
  identical contract tests for all backends.
- Internal HMAC-secured routes (`/internal/ingest`, `/internal/recompute`):
  body-inclusive signature, constant-time compare, ±5 min replay window,
  dual-secret (`REVIEWS_INGEST_SECRET_PREVIOUS`) rotation window.
- `wrangler.jsonc` with `env.staging` / `env.production`: custom domains
  (`reviews-api(-staging).amazecc.com`, `custom_domain: true`), per-env KV/
  queues/DLQ/cron/R2, `REPLACE_WITH_*` placeholders (no real IDs).
- Feature flags (independent): `ENABLE_AMAZE_REVIEWS` (default OFF),
  `READ_ONLY_MODE`; vitfac service untouched.
- CORS origin allowlist + security headers (nosniff, DENY,
  strict-origin-when-cross-origin) on all responses.
- Tests: 68 covering contract/schema, endpoints/HMAC, flags, CORS,
  SnapshotStore backends, aggregation/diffing.

### Security
- Correctness guard: `ENABLE_AMAZE_REVIEWS` strictly opt-in — an UNSET
  variable means OFF (was: only the literal `"false"` disabled).
- R2 selected without a binding now fails loudly instead of silently serving
  in-memory snapshots.
