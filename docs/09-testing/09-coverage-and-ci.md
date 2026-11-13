---
title: "Coverage & CI"
description: "there is no coverage gate — we pin contracts, not lines; CI fails on lint, type, tests, or build, never on coverage."
---

# Coverage & CI

> **In one line:** there is no coverage gate — we pin contracts, not lines; CI fails on lint,
> type, tests, or build, never on coverage.

## What CI does (ci.yaml)

```
checkout → pnpm install --frozen-lockfile → lint → typecheck → test → build
```

Node 22, pnpm pinned, cache restored from GH. Releases run the same via nextjs.yml plus deploy.

## Flaky suites (expect these to move)

- `FFCSGuidedSelector.render` — heavy (~30 s); CI races sometimes; locally it usually passes
- Beware of `"--experimental-https"`; use `pnpm dev:http` for signals
- Anything with `worker: true` — real Worker spawn in jsdom; keep these rare

## If CI fails on "files changed" after a docs PR

Docs are markdown only — no linted code changed. The failure is in lint/markdownlint tooling
or unexpected source drift under the PR. Check `eslint.config.mjs` extensions before assuming.
