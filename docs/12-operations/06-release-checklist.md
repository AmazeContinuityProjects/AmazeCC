---
title: "Release Checklist"
description: 'the five minutes before you hit "deploy".'
---

# Release Checklist

> **In one line:** the five minutes before you hit "deploy".

```
[ ] pnpm run lint / typecheck / test all green
[ ] pnpm run build — check out/ size (should not grow >10% without reason)
[ ] demo mode smoke: every tab + attendance refresh + FFCS export
[ ] changelog.json updated for the release
[ ] notice bulletin board in repo README or changelog
[ ] CI + Pages both green post-merge
[ ] PostHog spot check 30 min after deploy (errors? sync failures?)
[ ] If the release touches SW/caching: watch for "old chunks" errors for a day
[ ] Announce on campus channels if user-facing
```
