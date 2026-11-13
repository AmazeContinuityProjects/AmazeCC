# 08 — Building for Production

> **In one line:** `pnpm build` exports static files to `out/`; GitHub Pages serves them; the
> service worker makes them feel native.
> **Reading time:** ~7 min.

## What a production build is

A folder named **`out/`** containing everything the browser needs and nothing else — the
CompressedStaticExport you get from `output: "export"`. No server bundle, no API routes,
no database connection string in them beyond what's already public.

## It in 6 steps

1. `prebuild` → `src/data/buildInfo.json` refreshed from git.
2. `next build --webpack` type-checks, compiles, code-splits, emits `out/`.
   `.next/cache` speeds it up on repeat builds (cached in CI).
3. Serwist compiles `src/app/sw.ts → out/sw.js`; the precache manifest then includes the
   app shell but **no** images/CSV/JSON assets.
4. `scripts/prune-sw-precache.js` parses `out/sw.js` and **drops lazy JS chunks from the
   precache** — otherwise a first-time install would download megabytes of never-visited code.
5. CI uploads `out/` as the Pages artifact (`upload-pages-artifact`).
6. `actions/deploy-pages` publishes it; `CNAME` pins `amazecc.com`.

## How CI differs from your laptop

`nextjs.yml` pins all `NEXT_PUBLIC_*` at build time: API host, backup host, UniCC URL,
PostHog token, and (optionally) source-map upload secrets. Locally you'll get dev defaults —
never diff "broken local build" against "production" without knowing which host got baked in.

## Smoke-testing the export locally

```bash
pnpm run build
pnpm start    # serves out/ on :3001
```

Then open devtools → Application → Service Workers; confirm the SW registered, `/~offline/`
loads when offline, and a hard refresh shows your change (the SW can pin stale assets for a
session — see `08-pwa-platform/09-chunk-recovery.md`).

## Rollback

There is no server to roll back. Revert the commit on `main` → Pages deploys the previous
artifact. Students hold a service worker, though — their client may keep serving the reverted
version for up to ~30 days unless the new SW is picked up; this is why breaking changes to
shared caches must be treated like a migration, not a fix.
