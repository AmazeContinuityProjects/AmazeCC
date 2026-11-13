---
title: "Decisions (Architecture Decision Records)"
description: "short, self-contained records of _why_ the app is shaped the way it is — you never re-derive them; you read them here first."
---

# Decisions (Architecture Decision Records)

> **In one line:** short, self-contained records of _why_ the app is shaped the way it is — you never re-derive them; you read them here first.

- [0001-static-export.md](0001-static-export.md) — why the app is plain files, not a server
- [0002-client-side-vtop-auth.md](0002-client-side-vtop-auth.md) — why credentials live on the device, encrypted
- [0003-jotai-and-localstorage.md](0003-jotai-and-localstorage.md) — why atoms + cache, not one store
- [0004-marks-sync-model.md](0004-marks-sync-model.md) — why marks pooling is opt-in, hashed, receipted
- [0005-service-worker-policy.md](0005-service-worker-policy.md) — why no asset precache, NetworkFirst pages
- [0006-unicc-fallback.md](0006-unicc-fallback.md) — why a third party may see your login sometimes
