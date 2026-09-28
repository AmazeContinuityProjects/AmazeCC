# API Contract

All routes are `POST` except where noted. All routes live in `../AmazeCC-API/src/app/api/social/`.

`credentials` is the established VTOP-forwarding body shape used by ~30 existing routes: `{ cookies, authorizedID, csrf }`. It is never a URL parameter, because URLs end up in access logs and referrers.

Every route returns `success: true|false`. The `success` flag is inconsistent across the existing API — some routes omit it on errors — but new routes set it always.

---

## `POST /api/social/identity/sync`

Derives and stores the caller's own identity and current-semester timetable. **The only write path for timetable data.**

**Request**

| Field | Type | Required | Notes |
|---|---|---|---|
| `cookies` | `string \| string[]` | yes | Joined with `"; "`; both forms are accepted, as everywhere else |
| `authorizedID` | `string` | yes | Used for VTOP calls, never for identity |
| `csrf` | `string` | yes | |
| `proposedSemesterId` | `string` | no | Only consulted when VTOP marks no option `selected`. Validated against the scraped list, never trusted |

**Response 200**

```jsonc
{
  "success": true,
  "identity": {
    "handle": "AMZ-4F7K-2Q9X",
    "displayName": "Aarav Sharma",
    "semesterId": "CH20262701",
    "semesterLabel": "Fall 2026-27",
    "derivedAt": "2026-09-27T10:14:02.000Z",
    "slotmapVersion": "a1f3c9"
  },
  "busyMap": { "MON:A1": { "c": "CSSE1001", "t": "Computer Programming", "v": "AB1-101" } },
  "courses": [ { "code": "CSSE1001", "title": "Computer Programming", "venue": "AB1-101",
                 "ltpjc": "3-0-0-3-0", "category": "Theory Only and Lab",
                 "classId": "12345", "faculty": "Dr X" } ],
  "peers": [ { "handle": "AMZ-9K2P-7T4M", "name": "Neha Patel", "visibility": "coarse",
               "shared": true, "lastPublishedAt": "2026-09-26T08:02:00.000Z",
               "semesterId": "CH20262701", "isSelf": false } ],
  "grantSecrets": [ { "grantId": "gr_…", "secret": "…" } ]
}
```

`grantSecrets` carries the plaintext secrets for grants where the caller is a participant. They are returned **only** on this route, and only for the caller's own grants — there is no route that hands out a secret for a third party.

**Errors**

| Status | `error` | Meaning |
|---|---|---|
| 400 | `missing_credentials` | `csrf` or `authorizedID` absent |
| 401 | `vtop_session_expired` | VTOP rejected the session |
| 401 | `vtop_identity_unresolved` | Page parsed but no `REGISTER NO` — the cookies are not this student's |
| 422 | `semester_not_offered` | `proposedSemesterId` is not in VTOP's list |
| 429 | `rate_limited` | Includes `Retry-After` |
| 502 | `vtop_unavailable` | VTOP unreachable or 5xx |
| 502 | `semester_list_unavailable` | Semester dropdown could not be parsed |
| 400 | `unknown_slot` | Payload contained a `(day, slotId)` outside the vocabulary |
| 503 | `database_unavailable` | From the existing `db.ts` pool mapping |

---

## `POST /api/social/pair/claim`

Creates the mutual grant. Idempotent: re-claiming an existing pair returns the existing `grantId` and **does not** rotate the secret, because the peer may already be storing it.

**Request** — credentials, plus `handle: string`.

**Response 200** — `{ success, grantId, secret, peer: { handle, name, semesters: string[] } }`

**Errors** — `400 invalid_handle_format` · `404 handle_not_found` · `409 already_self` · `409 grant_limit_reached` · `429 rate_limited`

A `404 handle_not_found` is returned for a non-existent *and* an unpaired-but-validly-formed handle is **not** returned; existence is not disclosed beyond what pairing already grants. Enumeration is bounded by the 30/hour claim limit regardless.

---

## `POST /api/social/timetable`

The read. **Not a `GET`.** The grant secret is a bearer credential, and a credential in a query string ends up in access logs, browser history and `Referer` headers. It travels in the JSON body instead, alongside the forwarded VTOP session.

| Body field | Notes |
|---|---|
| `secret` | required; the shared grant secret |
| `handle` | required; the peer to read. There is deliberately **no** `regNumber` parameter anywhere in this contract — that omission is the point. A valid secret authorises only the people named in that grant. |
| `semester` | optional; defaults to the server's current semester |

**Session** — the VTOP session is required and verified, so the caller is a known student. The read itself needs no VTOP call; the session is checked so the server knows *who* is asking, not so it can scrape on their behalf.

**Response 200** — `identity` (handle, displayName, semesterId, semesterLabel, publishedAt, slotmapVersion) · `visibility` · `stale` (true when `publishedAt` is over 14 days old) · `version` · `busyMap` · `courses`. `identity.owner_key` is **not** returned; the client keys peers by handle, so the internal pseudonym would only be one more correlatable identifier. On a `coarse` grant, `busyMap` keys are returned with every entry emptied, `courses` is `[]`, and the course detail is never serialised in the first place — the redaction happens server-side.

**Errors** — `403 grant_invalid` (unknown, revoked or expired secret) · `403 not_a_participant` (returned identically whether the caller or the target is outside the grant, so it is not an oracle) · `404 handle_not_found` · `404 no_timetable_for_semester` · `401 vtop_session_expired`

---

## `POST /api/social/grant/revoke`, `POST /api/social/grant/visibility`

Both take `{ grantId, secret }` plus the forwarded session. Revoke sets `revoked_at`; visibility sets the `coarse`/`full` flag. Either participant may call either. Both are idempotent, and neither is a `GET` even though revoke is a state change with no body — a revocation that could be triggered by a prefetch or a link preview is not a revocation.

Re-pairing after a revoke is `POST /api/social/pair/claim` again. Because there is one row per pair, the claim **reactivates** that row with a new `grant_id` and a new secret rather than inserting a second one, so the previous secret is definitively dead.

---

## `GET /api/social/semester`

Returns `{ semesterId, semesterLabel, resolvedAt }` from `app_config`, for the client's semester switch. No credentials required — semester ids are not private.

---

## `POST /api/social/people`

`{ handle }` → `{ person: { handle, displayName, alreadyPaired } }`. Exact-match handle lookup, so the pairing UI can confirm a handle before claiming. **Not a `GET`**, so the handle does not land in access logs, and it requires a live session, so an unauthenticated caller cannot walk handles at all.

There is deliberately **no name search**. A handle system that also answers "who is called Neha Patel" is a student directory, which is a different and much larger privacy decision than the one this feature makes. Enumeration is additionally bounded to 20/minute. `owner_key` is not returned.

---

## Client-side integration

The sync engine's `ctx.request` has no `query` and no `parse` option (`request-layer.ts:5-14`), so the read is issued with `apiRequest` (`import { api } from "@/lib/sync-engine"`), which does. `auth: "vtop"` merges the session into the body automatically on `apiRequest`; on `ctx.request` it does the same for `POST`.

**`socialUtils.ts:514,535` must be corrected as part of this work.** They read `process.env.NEXT_PUBLIC_API_BASE_URL`, which is defined nowhere in the repo, and pass absolute URLs, which short-circuits `apiRequest`'s `API_BASE` (`request-layer.ts:166-171`) and defeats both the user's custom-API-url setting and origin-based failover. The new code passes bare paths.

## Registering with the repo

- `@openapi` JSDoc block above each handler, as every other route has.
- `ROUTE_TRACKER.md` entry.
- `docs/api/social.md`, and a row in `docs/api/overview.md`'s endpoint table — which currently has no social entry at all.
- No registration with `swagger.ts` beyond what the JSDoc block provides.
