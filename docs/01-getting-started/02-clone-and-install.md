---
title: "Clone & Install"
description: "git clone, pnpm install, done — the repo is self-contained, with secrets filled in only on CI."
---

# Clone & Install

> **In one line:** `git clone`, `pnpm install`, done — the repo is self-contained, with
> secrets filled in only on CI.
> **Reading time:** ~5 min.

```bash
git clone https://github.com/AmazeContinuityProjects/AmazeCC.git
cd AmazeCC
pnpm install
```

What just happened:

1. Git downloaded the source + history (~190k lines of TS/TSX plus docs).
2. pnpm read `package.json`/`pnpm-lock.yaml` and restored the exact pinned dependency tree
   into its global store.
3. `husky` (install hook) wired up the pre-commit lint-staged runner.

Expected time: 1–4 minutes depending on network. **No env file is required** to run the
app in demo mode — missing `.env*` is a valid configuration.

## The `.env` question

`.env` is **gitignored** on purpose — it may contain a developer's local overrides. The repo
ships `.env.example`. Copy it if you need to change defaults; otherwise skip it entirely.
The important thing: blank values fall back to **production defaults compiled into the app**
(`https://api.amazecc.com`). See [03-env-vars](03-env-vars.md).

## Common install failures

| Symptom                                                | Fix                                                                                |
| ------------------------------------------------------ | ---------------------------------------------------------------------------------- |
| `ERR_PNPM_BAD_PM_VERSION`                              | Use pnpm ≥ 9; run `corepack enable` or upgrade                                     |
| `Cannot find module 'sharp'`-ish warnings during build | `pnpm install` re-resolves; CI passes with frozen lockfile                         |
| `pnpm dev` fails on HTTPS cert                         | use `pnpm dev:http` (port 3001, plain HTTP), accepting a browser cert warning once |

## Verify the install

```bash
pnpm run typecheck
```

If this prints nothing (no errors), the install is healthy.
