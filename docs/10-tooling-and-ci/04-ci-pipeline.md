# 04 — The CI Pipeline (ci.yaml)

> **In one line:** lint → typecheck → test → build — four gates; no merge without all four green.

```
on: push(main), PR(main)
jobs.frontend:
  checkout → setup pnpm@latest-ish (via action-setup) → node 22
  → cache pnpm store → install --frozen-lockfile
  → lint → typecheck → test → build (with NEXT_PUBLIC_* pinned:
    API, backup, UNICC, VAPI, PostHog token/host)
```

Notes:

- Env at build time only — vars not baked into runtime bundles (static export)
- `pnpm exec tsc --noEmit` is the actual command (via `pretypecheck` → `pretypecheck` runs codegen too — remember it)
- No install of optional deps beyond slice — keep CI lean
- Anything red on main → the deploy workflow blocks on a fresh green build anyway (nextjs.yml runs independently though — keep both green)
