# 09 — Postinstall Oddities & Build Hooks

> **In one line:** two files run on every build/install before you see any UI — `generate-build-info.js` and the Serwist bundle step.

- `generate-build-info.js` — needs `git` on PATH (skips gracefully without it)
- `husky` install hook — wires `.husky/pre-commit`; fresh clones without it get the wrong experience silently — document CI parity
- `sharp` — used by `compress-hero-artwork.mjs` and the asset pipeline only; absent in runtime
- `@napi-rs/canvas` — excluded from client bundle (server externals) but pulled by dev deps for canvas utilities
- `pnpm install` on Windows — long paths are fine; force case-insensitive FS rules if you see `Case sensitive` surprises in `.next`
