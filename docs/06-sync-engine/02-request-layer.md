---
title: "The Request Layer (apiRequest)"
description: "one fetch wrapper for the whole app — JSON in/out, credentials attached, identical across every feature."
---

# The Request Layer (`apiRequest`)

> **In one line:** one fetch wrapper for the whole app — JSON in/out, credentials attached,
> identical across every feature.
> **Read:** `src/lib/sync-engine/request-layer.ts`.

## Signature

```ts
apiRequest(path, {
  method?: "GET" | "POST",        // default POST
  body?: unknown,                  // object → JSON; string → form-url-encoded; FormData passthrough
  query?: Record<string, string>,  // appended as ?a=b
  auth?: "vtop" | "eventhub" | "none",
  parse?: "json" | "raw" | "text" | "blob",   // default json
  signal?: AbortSignal,
  timeoutMs?: number,             // default 60s
  retry?: { max?: number; baseMs?: number },
}): Promise<any>
```

`resolveApiRoute` maps the short path (`"ffcs"`) to a full URL — Worker routes (`buses`,
`fresher-resources`) never see credentials by construction.

## The auth merge (do not skip this understanding)

If `auth === "vtop"`, the body is rebuilt:

```ts
finalBody = { ...body, cookies, authorizedID, csrf }; // from credential-manager
```

The caller _never_ passes credentials — it can
`apiRequest("ffcs", { body: { semesterId }, auth: "vtop" })` and the engine injects them.
That means **every credentialed request goes through `getCreds("vtop")`**, which as needed
refreshes a stale session — with a captcha solving pass if the server demands one.
(That's why the "attendance refresh" button takes 4–10 s cold.)

## Retry & dedupe

- `AbortController` cancels the in-flight map (`cancelAllRequests` — the Stop button)
- inflight de-dup key = `METHOD:path:canonical(body)` — double-clicks coalesce
- retries: `AuthError` never retried; everything else backs off (`baseMs × 2^attempt`)

## Failure conventions

```ts
json.success === false && isAuthFailMessage(json.message) → throw AuthError(…, domain)
!res.ok                                                   → TransientError(HTTP status)
parse == "raw"                                            → return Response
```

## Why not `fetch` directly?

LocalStorage, dedupe, auth injection, cancellation, telemetry — all handled here once. New
contributors: import `syncEngine` (or `api`) only — never `fetch` in app code outside
`lib/scanner/rasterIO`, SW registration, and approved public-cache cases.

## Quiz

1. What does an unauthenticated POST with `{auth:"vtop"}` return / throw, and exactly when?
2. What does the dedupe key consist of, and how does it leak nothing sensitive?
