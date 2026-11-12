# 06 — Dependency Hygiene

> **In one line:** ~110 runtime deps, mostly UI — scanned, minimally trusted, and pinned by the lockfile.
> **Reading time:** ~6 min. Governance notes for the inherited app.

## Posture, plainly

- **Pinned** every build by `pnpm-lock.yaml` (content-addressed; `--frozen-lockfile` in CI).
- **No second-tier registries** in `.npmrc` (`auto-install-peers=true`, strict peers); default npm.
- **Native modules** are tiny and deliberate: `sharp` (asset pipeline, scripts), `@napi-rs/canvas`
  (server-side bundle exclusion only), `tesseract.js` + WASM (OCR; wasm-unsafe-eval in CSP).
- **Security-critical deps** (`crypto-js` absent — Web Crypto used directly; `lz-string` for share
  payloads — no decompress bomb more than ~1 MB) — each is boring, audited by thousands of apps.

## What CI does _not_ enforce (and what we do about it)

- No automatic `pnpm audit` gating — advisory follow-through happens quarterly; the runbook says
  **patch before minor before major**, verify demo mode after any bump, especially React 19
  patches (every app behavior is client-side).
- No license checker — accepted (project is MIT; deps are predominantly MIT/Apache/ISC).

## Inheritance notes for the next maintainer

- `@amazecontinuityprojects/amazeui` — the org's own UI kit, pinned, transpiled; upgrades are
  coordinated releases, not drive-by bumps. Changelogs live in that repo.
- `next` — **read `node_modules/next/dist/docs/` before upgrading**; this app's AGENTS.md exists
  because this Next.js has breaking changes vs training-data Next.
- Any dep with 300+ KB unpacked should come with a justification in the PR that adds it.

## Quiz

1. Why are `NEXT_PUBLIC_*` values the only configuration allowed to change between environments?
2. What is the correct order when integrating a `next` major bump here?
