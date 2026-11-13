---
title: "Blank or Stale App"
description: "your browser is holding yesterday's service worker — force it to update."
---

# Blank or Stale App

> **In one line:** your browser is holding yesterday's service worker — force it to update.

1. Hard refresh: Ctrl/Cmd+Shift+R
2. Still broken → DevTools → Application → Service Workers → Unregister → reload
3. Still broken → clear site data (Application → Storage → Clear) — you'll re-sign-in
4. "ChunkLoadError" in console → this is exact post-deploy staleness; `chunkRecovery.ts` handles it
   once automatically; if it keeps happening: clear SW + reload
5. If absolutely nothing renders → check console for blocked domains — your school/office firewall
   might block PostHog/GA; the app renders anyway (it's only telemetry)
