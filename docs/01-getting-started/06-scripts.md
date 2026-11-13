---
title: "Scripts (every pnpm run verb)"
description: "dev for the workshop, test for truth, build for production — the rest are plumbing."
---

# Scripts (every `pnpm run` verb)

> **In one line:** `dev` for the workshop, `test` for truth, `build` for production — the rest
> are plumbing.
> **Reading time:** ~8 min.

## Daily drivers

| Command                     | What it does                                                                       | When to use                   |
| --------------------------- | ---------------------------------------------------------------------------------- | ----------------------------- |
| `pnpm dev`                  | HTTPS dev server on `:3001` (`--experimental-https`; accept the cert warning once) | default for feature work      |
| `pnpm dev:http`             | plain HTTP dev server on `:3001`                                                   | when certs get in the way     |
| `pnpm run typecheck`        | `tsc --noEmit` (plus `pretypecheck` codegen of `src/data/buildInfo.json`)          | after any non-trivial change  |
| `pnpm run lint`             | ESLint over the tree                                                               | before committing             |
| `pnpm run test`             | all Vitest suites                                                                  | after touching `src/`         |
| `pnpm run build`            | production export into `out/` (see [08](08-building-for-production.md))            | before shipping; CI runs this |
| `pnpm start` / `pnpm serve` | static file server for `out/` (`serve -s`)                                         | smoke-testing the export      |

## Quality & housekeeping

| Command                            | What it does                                  |
| ---------------------------------- | --------------------------------------------- |
| `pnpm run format` / `format:check` | Prettier write / verify (whole repo)          |
| `pnpm run test -- <pattern>`       | run a subset: `pnpm run test -- ffcsGenerate` |

## Data & assets tooling (rare; know they exist)

| Command                    | What it does                                                                                           | Cost                                          |
| -------------------------- | ------------------------------------------------------------------------------------------------------ | --------------------------------------------- |
| `pnpm run catalogue:build` | rebuilds `public/ffcs/codechef-vit-catalogue.csv` from the approved CodeChef-VIT FFCS-inator catalogue | needs network + source; rarely run            |
| `pnpm run scanner:dataset` | builds the OCR training corpus (`scripts/scanner-nn-dataset.jsonl`)                                    | scrapes public papers; days-long offline task |
| `pnpm run scanner:train`   | trains the tiny paper-classifier MLP → `src/lib/scanner/nn/weights.json`                               | minutes                                       |

## CI-equivalents

CI (`ci.yaml`) runs: `pnpm install --frozen-lockfile` → `lint` → `typecheck` → `test` →
`build` (with API hosts pinned explicitly). Locally, run the same sequence before pushing a PR.

## The small print (`pre*` hooks)

`predev`, `prebuild`, `pretypecheck` all run `node scripts/generate-build-info.js` first — it
rewrites `src/data/buildInfo.json` (sha, commit count, date) via git. If git is missing or the
working tree is weird, the script warns and proceeds with placeholders — builds still work.
