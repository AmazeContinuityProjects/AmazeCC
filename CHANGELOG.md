# Changelog

## Unreleased (feature/faculty-reviews)

### Added
- Faculty Reviews: first-party review UI (catalog badges, faculty profiles,
  write-review flow, compare view, FFCS priority helpers) behind
  `NEXT_PUBLIC_ENABLE_AMAZE_REVIEWS` (**default off**).
- `faculty-review/`: Cloudflare Worker (queue ingest, aggregation, KV/R2
  snapshots) with staging and production environments. See
  `faculty-review/README.md`.
- Reviews admin UI gated by `NEXT_PUBLIC_REVIEW_ADMIN_IDS` (UX only; the API
  enforces RBAC).
- Legacy vitfac profile ids are resolved by name. vitfac integration and its
  killswitch (`NEXT_PUBLIC_ENABLE_VITFAC_INTEGRATION`) are unchanged.
- CI: `faculty-review-ci`, staging and production deploy workflows, and a
  tracked-files secrets scan in `ci.yaml`.
- Contract tests: snapshot `schemaVersion` tolerance (any `1.x.y`) and a pinned
  fingerprint of the shared question config.

### Security
- The client identity travels only in the `x-authorized-id` header, never a URL.
  Person-specific hardcoded id mappings were removed.
- With the flag off, the attendance sync no longer posts the timetable or
  identity to the reviews API.

### Notes
- No change to existing FFCS or review pills when the flag is off.
- The root `vitest` and `eslint` configs exclude `faculty-review/` (its own
  pnpm project and CI job).
