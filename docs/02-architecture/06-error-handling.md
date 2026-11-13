---
title: "Error Handling & Failure Taxonomy"
description: 'errors are classified first (auth vs transient vs bug) and only then rendered — because "your password is wrong" and "VTOP''s captcha broke" need different UI.'
---

# Error Handling & Failure Taxonomy

> **In one line:** errors are classified first (auth vs transient vs bug) and only then
> rendered — because "your password is wrong" and "VTOP's captcha broke" need different UI.
> **Reading time:** ~9 min.

## The four buckets

| Bucket                                | Detection                                             | User-facing                                                   | Example                                                            |
| ------------------------------------- | ----------------------------------------------------- | ------------------------------------------------------------- | ------------------------------------------------------------------ |
| **Auth** (student's fault or expired) | `AuthError`; HTTP 401/403; `assertApiSuccess` on body | "VTOP session expired — sign in again" (or credential editor) | VTOP password rotated this morning                                 |
| **Transient** (world's fault)         | `TransientError`, timeouts, 5xx                       | "Couldn't reach VTOP — will retry" with manual retry button   | campus Wi-Fi drops mid-sync                                        |
| **Rate-limited / captcha lockout**    | backend `success:false` + message sniff               | "Too many attempts — wait 10 minutes"                         | VTOP froze login after 3 bad tries (backoff in credential-manager) |
| **Bug** (ours)                        | anything else                                         | error boundary + PostHog capture                              | `Cannot read properties of undefined`                              |

## Where each is caught

- `sync-engine/errors.ts` — `classifyAuthFailure`, `assertApiSuccess`, `toEngineError`
- `sync-engine/index.ts` — records failure, emits progress event, rethrows to caller
- Feature screens — catch → `reportError(err, {context})` (posthog.ts) + keep last-good data
- `app/error.tsx` — route-level boundary; inspects `isChunkLoadError` (`lib/chunkRecovery.ts`),
  throttled 10-second purge+reload; else renders `ErrorDiagnosticCard` with details
- `app/global-error.tsx` — same when the root layout itself throws
- `not-found.tsx` — 404 page

## What the student sees — design rule

Honesty, preserved data, one clear action:

- **Preserved data** — we never blank a screen on a failed refresh; stale + banner.
- **One action** — Retry / Sign in again / Wait & retry. Never both.
- **Failure counter** — `LastSynced.tsx` retry paths drive from `recordSyncFailure/openFailure`.
- **No stack traces** in production UI; PostHog gets them instead (see `12-operations/03-posthog-runbook.md`).

## What developers see

PostHog → Error tracking: `ErrorDiagnosticCard` submits automatically with stack, digest,
component context, and build SHA (`buildInfo.json`). That's the bug-report pipeline — the same
one used by the in-app "Report a bug" button and the floating bug-recording bar.

## Quiz

1. A student signs in and marks the semester — VTOP returns 200 with `success:false, message:"Invalid Username / Password"`. Walk every step from `request-layer.ts` to the UI.
2. Why does the boundary purge the SW cache at most once every 10 seconds?
3. Which file decides Auth vs Transient, and where is it consulted?
