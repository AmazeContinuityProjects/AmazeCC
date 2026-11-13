# 05 — Deploying to GitHub Pages (nextjs.yml)

> **In one line:** on every push to main, build → upload artifact → deploy to Pages; the site is static files, there is no server to restart.

```
on: push(main) + workflow_dispatch
build:
  checkout → pnpm → node 22 → cache .next/cache
  → pnpm install --frozen-lockfile
  → pnpm run build   (env: NEXT_PUBLIC_API_URL from vars, …)
  → upload-pages-artifact (./out)
deploy:
  needs build → deploy-pages (estate: github-pages)
```

## Invariants

- **`out/` must exist and contain `index.html`** — the artifact upload fails otherwise
- **`CNAME: amazecc.com`** is what keeps the custom domain from being reset
- **Permissions**: `pages: write`, `id-token: write`, no `.env` file is needed in-repo (vars in repo settings)
- **Concurrency**: `pages` group with `cancel-in-progress: false` — never interrupt an in-flight deploy

## Rollback

Revert the offending commit → Pages deploys last known-good build. The Service Worker may hold
students' devices on the old shell for up to ~30 days regardless — bump the SW version early
when the rollback must be effective sooner.
