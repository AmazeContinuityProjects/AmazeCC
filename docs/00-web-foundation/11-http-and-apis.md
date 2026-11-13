---
title: "HTTP & APIs"
description: "every conversation between the app and AmazeCC-API is a POST with a JSON envelope: often just credentials + what you want."
---

# HTTP & APIs

> **In one line:** every conversation between the app and AmazeCC-API is a POST with a JSON
> envelope: often just credentials + what you want.
> **Audience:** everyone. **Reading time:** ~8 min.

## The shape of (almost) every call this app makes

```http
POST https://api.amazecc.com/api/attendance
Content-Type: application/json

{ "semesterId": "CH20262705",
  "cookies": "JSESSIONID=…",
  "authorizedID": "25BCE1234",
  "csrf": "abc123" }
```

Response:

```json
{ "success": true, "attRes": { … }, "marksRes": { … } }
```

Failure conventions handled in `sync-engine/errors.ts`:

- `HTTP 200` + `{success: false}` → treated as failure (`assertApiSuccess`).
- `401/403` with an auth-flavored message → `AuthError` (no retries; surface to user as
  "VTOP login expired — sign in again").
- timeouts / network resets → `TransientError`, retried with backoff (usually ≤2 retries).
- wrong password / captcha fail → **no auto-retry**; fail closed.

## Reading the headers that matter

| Header                           | Why you care                                                                                      |
| -------------------------------- | ------------------------------------------------------------------------------------------------- |
| `Content-Type: application/json` | every POST here is JSON; the API calls `req.json()`                                               |
| `Referer`                        | server checks it for some endpoints (VTOP expects it on scrape targets)                           |
| `cache-control`                  | the API sets this on cacheable answers (buses, changelog) — we respect it via `fetchWithFailover` |

## Timeouts & cancellation

`apiRequest()` enforces a per-call timeout (default 60 s; VTOP login 120 s) and supports
abort signals via the global controller (`cancelAllRequests`, used by the "stop sync" button).
Fiddling — e.g. adding a `fetch` outside the layer — breaks both.

## CORS in one paragraph

The browser blocks cross-origin reads unless the server says so. AmazeCC-API sends
`Access-Control-Allow-Origin: *` because it's an open API carrying no ambient cookies,
while credentials travel in the body (never in cookies-from-our-domain). That's why a
plain `<script>` or another website can call it too — documented in the API repo's proxy
and mirrored in `08-pwa-platform/…` notes.

## Quiz

1. Why is `success: false` with HTTP 200 a failure?
2. Why do we never retry a 401 automatically?
3. Where in the code does a user press "Cancel sync", and what does it do?
