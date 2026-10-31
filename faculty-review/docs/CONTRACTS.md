# Cross-repo contracts

Faculty Reviews has four shared contracts. Each has one source of truth, a
`schemaVersion`, tolerant consumers, and a test in each consuming repo that
fails if the shape drifts.

`schemaVersion` is semver. **Consumers accept any `1.x.y`** (older or newer
minor/patch) and **reject an unknown major**. A producer may add optional
fields in a minor version; consumers ignore fields they do not know.

| # | Contract | Source of truth | Producer to consumer | `schemaVersion` | Drift tests |
| --- | --- | --- | --- | --- | --- |
| 1 | Review question and scoring config | `AmazeCC-api/src/config/reviewQuestions.ts` | copied byte for byte to `AmazeCC/src/config/reviewQuestions.ts` and `AmazeCC/faculty-review/src/config/reviewQuestions.ts` | `schemaVersion` export and per track | `questionConfigDrift` / `reviewQuestionConfigDrift` tests in all three (shared pinned fingerprint) |
| 2 | Ingest payload (API to Worker) | `AmazeCC-api` (`submit/route.ts`, `signIngestPayload`) | Worker `POST /internal/ingest` | field `schemaVersion` | Worker `ingestValidation.test.ts`, API `contract.test.ts` |
| 3 | Snapshot JSON (Worker to frontend and API) | `AmazeCC/faculty-review/src/types.ts` (`FacultyCatalogSnapshot`, profile snapshot) | `GET /api/reviews/catalog`, `/api/reviews/faculty/:id`, also proxied by the API | field `schemaVersion` | Worker `contract.test.ts`, API `contract.test.ts`, frontend `reviewsSchemaContract.test.ts` |
| 4 | Public read API responses | same shapes as 3 (the API proxies the Worker and has a degraded Postgres fallback that must emit the same shape) | API to frontend | field `schemaVersion` | API `contract.test.ts` |

## Contract 1: the duplicated file

The same file exists in three repos. That is deliberate: the API and Worker
must not depend on a sibling folder or an unpublished package, because that
works on one machine and fails in CI.

**Sync step** when you change the question config:

1. Edit `AmazeCC-api/src/config/reviewQuestions.ts` (the source of truth).
2. Copy it unchanged to the two `AmazeCC` locations:
   `cp AmazeCC-api/src/config/reviewQuestions.ts AmazeCC/src/config/reviewQuestions.ts`
   `cp AmazeCC-api/src/config/reviewQuestions.ts AmazeCC/faculty-review/src/config/reviewQuestions.ts`
3. Run any one of the three drift tests; it prints the new fingerprint. Put the
   new value in all three tests (`CONTRACT_FINGERPRINT`).
4. If the shape changed incompatibly, bump the **major** `schemaVersion` and
   follow the version-bump plan below. For additive changes bump the minor.
5. Deploy order for a config change: Worker, then API, then frontend (consumers
   tolerate a newer minor, so each can lag briefly).

The fingerprint is a SHA-256 of the canonical JSON of both track configs plus the
`aggregation` and `limits` blocks. A stale copy fails its own repo's CI.

## Contract 2: ingest payload

Fields (all validated in `src/validation/ingest.ts`): `schemaVersion`,
`idempotencyKey`, `student_hash` (64 hex), `faculty_id` (UUID), `track`,
`course_code`/`semester` (teaching) or `project_term` (project), `verified`,
`answers` (known question ids, integers 1 to 5), `tags_green`/`tags_red` (from the
approved lists, max 3 each), `context` (allowlisted keys, approved option values),
`grade_bucket` (`high`, `mid`, `low`), `timestamp`.

- Signature: `HMAC-SHA256(secret, "<timestamp>.<raw body>")`, hex, headers
  `x-timestamp` and `x-signature`, accepted within +/- 5 minutes. The Worker also
  accepts `REVIEWS_INGEST_SECRET_PREVIOUS` during a rotation window.
- Unknown fields are **dropped** by the Worker (never forwarded to the queue or
  the database); an unknown major is rejected with 400.
- There is no free-text field anywhere in this contract. Every string is an
  identifier or comes from an approved list.

## Contracts 3 and 4: snapshots and read responses

- `GET /api/reviews/catalog`: `{ schemaVersion, faculty: [...], updated_at }`.
  When no snapshot exists yet the Worker returns an empty `faculty` list with the
  same envelope, so the frontend never sees a different shape.
- `GET /api/reviews/faculty/:id`: profile snapshot with `schemaVersion`.
- Responses never contain reviewer hashes, `authorizedID`, grade buckets or any
  per-review row. Distributions appear only when `n >= 5`; tags only at `>= 3` votes.
- The frontend skips an unknown-major snapshot and keeps showing legacy vitfac data.

## Bumping a major version

1. Ship consumers that understand both majors.
2. Switch the producer.
3. Remove old-major support in a later release.
