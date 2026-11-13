---
title: "The Build Step (node, pnpm, next build)"
description: "you never ship the code you write; you ship its optimized output, produced by a build pipeline that type-checks, bundles, minifies and precaches."
---

# The Build Step (node, pnpm, next build)

> **In one line:** you never ship the code you write; you ship its optimized output, produced
> by a build pipeline that type-checks, bundles, minifies and precaches.
> **Audience:** everyone. **Reading time:** ~9 min.

## The problem

Browsers don't understand TypeScript, JSX, `import x from "@/…"` aliases, or Tailwind
directives. And nobody wants to ship 10,000-line unminified source files. So we **build**.

## The pieces

**Node.js** — the JavaScript runtime used _at build time_ (not part of the app the student
runs). It runs `next` (the Next.js compiler), the TypeScript compiler, and the tools in
`scripts/`.

**pnpm** — the package manager (not npm/yarn). Two reasons it matters to you:

- It stores every package once in a content-addressed store and links it — fast, disk-cheap,
  and it makes **phantom dependencies** impossible (you can only import what you declare).
- `.npmrc` sets `package-manager=pnpm` and friends; using `npm install` will rewrite the world
  and you'll regret it. Always use `pnpm`.

**Lockfile** — `pnpm-lock.yaml` (~378 KB). Never hand-edit. `pnpm install --frozen-lockfile`
is what CI uses to guarantee the exact same versions everywhere.

## What `pnpm run build` does, in order

1. `prebuild` runs `scripts/generate-build-info.js` → writes `src/data/buildInfo.json`
   (commit SHA + date + last 5 subjects). Used by the About/Changelog screens.
2. `next build --webpack` — the Next.js compiler:
   - type-checks (`ignoreBuildErrors: false` — builds fail on type errors),
   - compiles Tailwind CSS,
   - bundles JS into chunks (code-splitting = smaller first paint),
   - embeds `NEXT_PUBLIC_*` env vars **as literal strings** (that's why they must be public),
   - emits the static site into **`out/`** (because `output: "export"`).
3. `scripts/prune-sw-precache.js` — rewrites the service-worker precache manifest inside
   `out/sw.js` so we don't precache lazy chunks nobody visits.

## Why you must care

- `.next/` and `out/` are disposable artifacts (gitignored). Source lives in `src/`.
- Chunk load errors (blank app after deploy) are a _known_ failure mode; `src/lib/chunkRecovery.ts`
  detects and self-heals them. See `08-pwa-platform/09-chunk-recovery.md`.
- You cannot "just edit a file on the server" — the site is static files, no server, no hot patch.

## Commands you'll use weekly

```bash
pnpm dev          # dev server at https://localhost:3001 (self-signed cert; :http runs http)
pnpm run lint     # ESLint
pnpm run typecheck# tsc --noEmit
pnpm run test     # Vitest
pnpm run build    # production build into out/
pnpm start        # serve out/ on :3001
```

## Quiz

1. Where do `NEXT_PUBLIC_*` values end up, and why can't one be a secret?
2. Why does this repo use pnpm instead of npm?
3. What does `prune-sw-precache.js` protect the student's phone from?
