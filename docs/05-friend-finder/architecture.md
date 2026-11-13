---
title: "Friend Finder — Architecture (deep)"
description: "a public funnel — anyone hits the page; only verified VTOP students enter the finder; no data leaves without pair intent."
---

# Friend Finder — Architecture (deep)

> **In one line:** a public funnel — anyone hits the page; only verified VTOP students enter the finder; no data leaves without pair intent.

## 1. Two faces, one page

- **Unauthenticated** — hero with explains: "find classmates you already sit next to"
- **Verified** — handle resolution, subject-picker UI, classmate list (privacy-filtered server-side)

Behind the scenes: same `/api/social/ffcs-match` endpoint the app uses; the public route just has
a friendlier wrapper and the disclaimer gate.

## 2. The VTOP modal login

The public route doesn't use Browser localStorage for VTOP credentials; the modal mints a scoped
request to `/api/social/verify-session` — no cookies cached past the modal session. Verified flag is
kept in-memory; refreshing the page re-verifies from scratch (acceptable friction for a public route).

## 3. The disclaimer gate

`/friend-finder/disclaimer` is mandatory — users cannot skip it. Text renders verbatim from
`FriendFinderDisclaimerView.tsx` — the legal text is maintained carefully; changing it requires
release notes.

## 4. What ships in the search response

Only `{ handle, sharedCourseCount, branch, displayName? }` — no ids, no emails, no section detail
without mutual consent.
