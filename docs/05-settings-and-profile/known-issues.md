# Settings & Profile — Known Issues

1. The settings atom migrates silently — a badly-typed key re-hydrates defaults; know the merge semantics.
2. Forgetting credentials does NOT wipe local data (we keep it) — this is documented behavior; don't "fix" without ADR.
3. API host picker is a power tool — friends sharing devices must not accidentally switch it.
