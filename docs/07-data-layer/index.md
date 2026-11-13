---
title: "The Data Layer"
description: "one localStorage cache, one IndexedDB vault, one service-worker cache — this section is the inventory of what the app caches and why."
---

# 07 — The Data Layer

> **In one line:** one localStorage cache, one IndexedDB vault, one service-worker cache —
> this section is the inventory of what the app caches and why.

1. [01-storage-overview.md](01-storage-overview.md) — the three stores and what each is for
2. [02-storage.ts-catalog.md](02-storage.ts-catalog.md) — every typed accessor in `lib/storage.ts`
3. [03-local-storage-key-catalog.md](03-local-storage-key-catalog.md) — every raw key used anywhere (grep-driven)
4. [04-atoms-catalog.md](04-atoms-catalog.md) — all 59 atoms, writers, readers, persistence
5. [05-settings-atom.md](05-settings-atom.md) — the ~70-field settings object & migration shim
6. [06-credential-vault.md](06-credential-vault.md) — the AES-GCM at-rest encryption boundary
7. [07-session-snapshot.md](07-session-snapshot.md) — pre-paint session detection
8. [08-caches-and-ttl.md](08-caches-and-ttl.md) — staleness table for every cache_* key
9. [09-demo-data.md](09-demo-data.md) — the fixture that powers demo mode
10. [10-worker-data.md](10-worker-data.md) — what cache.amazecc.com serves
11. [11-cdn.md](11-cdn.md) — cdn.amazecc.com and image rewriting

> 💡 If you are debugging "why does the app show yesterday's data?" — start here, specifically
> 03 and 08.
