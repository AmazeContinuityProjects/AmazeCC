# AmazeCC Faculty Reviews Worker

Cloudflare Worker that serves anonymized faculty-review snapshots at the edge,
buffers submissions through a durable queue, and recomputes aggregates on a
cron. It is part of the `AmazeCC` repository (subdirectory `AmazeCC/faculty-review/`)
and is deployed from that repo with Wrangler environments.

**It does NOT touch `vitfac.amazecc.com`** — the legacy vitfac Worker and its
integration keep working. Routes here are pinned to exact custom domains:
`reviews-api.amazecc.com` (production) and
`reviews-api-staging.amazecc.com` (staging).

## Architecture

```
AmazeCC frontend ──(public reads: CDN-cached JSON)──────────────► Worker
        │  GET /api/reviews/catalog                │ KV | R2 snapshots
        │  GET /api/reviews/faculty/:id            ▼
AmazeCC-api ──(POST /internal/ingest, HMAC-signed)──► Cloudflare Queue ──► consumer → Supabase (batch upsert)
cron (every 10 min)                     */internal/recompute, HMAC-signed)
   └─ Supabase reads → aggregation → write-diffed snapshot publish (manifest)
```

- **Reads never hit Postgres.** They are answered from KV/R2 snapshot JSON with
  ETag/304 support.
- **Submissions are buffered.** `AmazeCC-api` validates + verifies eligibility,
  writes the review row directly to Supabase, then POSTs an HMAC-signed ingest
  message; the Worker enqueues it (`amazecc_reviews_queue`) and the consumer
  batch-upserts (idempotent).
- **Aggregation** runs every 10 min (cron) or on `/internal/recompute`, and
  publishes snapshots **write-diffed**: nothing is written when a snapshot's
  SHA-256 is unchanged (zero-write runs), capped by `MAX_KV_WRITES_PER_RUN`.

## Layout

| Path | Purpose |
| --- | --- |
| `src/index.ts` | `fetch` (reads + internal), `queue` (consumer), `scheduled` (cron) |
| `src/aggregation/engine.ts` | Weighted scoring, Bayesian shrinkage, snapshot build, write-diffing |
| `src/store/SnapshotStore.ts` | `SnapshotStore` interface — KV (default), R2, in-memory backends |
| `src/config/reviewQuestions.ts` | **Canonical** review question/weight config (`schemaVersion 1.0.0`) |
| `src/db/supabase.ts` | PostgREST client (faculty, reviews, faculty_aggregates) |
| `docs/` | DEPLOYMENT, RUNBOOK, ROLLOUT, CLEANUP_STEPS |

## Environments

| Env | Worker name | Domain | Queue | DLQ |
| --- | --- | --- | --- | --- |
| local (`wrangler dev`) | amazecc-reviews-worker | localhost:8787 (simulated) | simulated | simulated |
| `--env staging` | amazecc-reviews-worker-staging | reviews-api-staging.amazecc.com | amazecc-reviews-queue-staging | amazecc-reviews-dlq-staging |
| `--env production` | amazecc-reviews-worker | reviews-api.amazecc.com | amazecc-reviews-queue | amazecc-reviews-dlq |

All resource IDs in `wrangler.jsonc` are `REPLACE_WITH_*` placeholders — the
maintainer fills them during deployment (see **docs/DEPLOYMENT.md** for the
ordered steps and the exact create commands).

## Feature flags (independent)

| Flag | Default | Effect |
| --- | --- | --- |
| `ENABLE_AMAZE_REVIEWS` | **OFF** (`"false"` / unset) | Master switch; gates reads, ingest, recompute, cron |
| `READ_ONLY_MODE` | `false` | Blocks ingest/recompute during FFCS peak; reads keep serving |
| vitfac killswitch | frontend/api (`NEXT_PUBLIC_ENABLE_VITFAC_INTEGRATION`) | Legacy vitfac service is untouched by this Worker entirely |

All three operate independently and can be flipped from the dashboard
(Variables) without a redeploy.

## Snapshot backends

`SNAPSHOT_STORE` selects the backend — `kv` (default), `r2`
(bucket `amazecc-faculty-reviews`, binding `REVIEWS_BUCKET`), or `memory`
(tests). All backends implement the same `SnapshotStore` interface and pass the
same contract tests; switching is safe and documented in docs/RUNBOOK.md.

## Development

```bash
pnpm install          # or npm install
pnpm wrangler dev     # localhost:8787, simulated bindings, needs .dev.vars
pnpm test             # vitest (68 tests)
pnpm typecheck        # tsc --noEmit
```

`.dev.vars.example` documents the three local secrets
(`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `REVIEWS_INGEST_SECRET`).

## API surface

| Route | Auth | Notes |
| --- | --- | --- |
| `GET /api/reviews/catalog` | public | ETag/304, `s-maxage=300` SWR 1 day |
| `GET /api/reviews/faculty/:id` | public | per-faculty profile snapshot |
| `POST /internal/ingest` | HMAC (`x-signature`, `x-timestamp`) | ±5 min window, constant-time compare, schemaVersion guarded → 202 |
| `POST /internal/recompute` | HMAC (same secret) | triggers one aggregation run |

Internal routes are never CORS-exposed; CORS is an allowlist
(amazecc.com, www.amazecc.com, vitfac.amazecc.com + configurable extras).
