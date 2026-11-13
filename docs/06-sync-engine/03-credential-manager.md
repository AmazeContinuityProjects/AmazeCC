---
title: "The Credential Manager"
description: "the only module allowed to know VTOP's 10-minute session exists — it logs in, remembers the cookies, and refuses to burn captchas when it shouldn't."
---

# 03 — The Credential Manager

> **In one line:** the only module allowed to know VTOP's 10-minute session exists — it logs in,
> remembers the cookies, and refuses to burn captchas when it shouldn't.
> **Read:** `src/lib/sync-engine/credential-manager.ts`.

## The seven invariants

1. **Restore on load** — constructor reads `storage.vtopSession` (persisted on each login) and
   adopts it if fresh (<10 min); missing `fetchedAt` ⇒ stale ⇒ one re-login.
2. **Single-flight refresh** — `refreshingVtop` promise shared by all callers; N parallel
   fetches trigger **one** captcha solve, not N.
3. **Missing session ≠ auto-fix** — `getCreds("vtop")` returns null rather than solving a
   captcha "because someone called it"; only `ensureVtopSession` (an explicit caller) logs in.
   That's attribution discipline: the captcha is charged to the action that caused it.
4. **Back-off** — consecutive failures mark the credential pair failed and refuse retries to
   protect the VTOP account (`isBlocked`); user must re-enter password (Edit-credentials flow).
5. **Demo stub** — `VTOP_SESSION_MAX_AGE_MS=600000`; demo returns `{cookies: [], authorizedID: "DEMO123"…}`.
6. **Persistence** — `vtopSession` key keeps last good creds; cleared on logout
   (`credential-manager.logout()` wipes both stores).
7. **EventHub/jsessionid** — same shape under `eventhub`; separate store, same semantics.

## Inside one refresh (walked)

```
isVtopStale()? yes → ensureVtopSession()
  in-flight? join it : loginVtop(ids)
    pingVtopDirectly(4s) — fast-fail when VTOP down (before burning a captcha)
    POST /api/login (auth:none) — API solves captcha
    res.success===false → markFailed (backoff) → throw AuthError
    else this.vtop = {cookies, authorizedID, csrf, fetchedAt: Date.now()}
    storage.vtopSession.set(…) + dispatch VTOP_LOGIN_EVENT
```

## The 10-minute TTL mystery (students ask every semester)

VTOP itself rotates the session server-side; we mirror it _client-side_ to avoid paying
captcha solves for every single tap. When the TTL lapses, the _next_ credentialed request —
not app boot — notices and re-authenticates. That's by design (app boot must not wake the
captcha solver at 7:59 am).

## Quiz

1. Student taps Refresh right after boot, session is stale — walk the login path step-by-step.
2. Two screens request marks simultaneously — what guarantees one captcha?
3. Why does a wrong password lock you out of the retry loop, and how does a human recover?
