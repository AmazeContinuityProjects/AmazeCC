---
title: "Configuration Catalog"
description: "every root-level config file, what it configures, what breaks if you edit it wrong."
---

# 10 — Configuration Catalog

> **In one line:** every root-level config file, what it configures, what breaks if you edit it wrong.
> **Audience:** everyone shipping. **Reading time:** ~8 min.

| File                                                | What it configures                                                                    | Break it wrong and…                                             |
| --------------------------------------------------- | ------------------------------------------------------------------------------------- | --------------------------------------------------------------- |
| `package.json`                                      | scripts (incl. `pre*` hooks), ~110 deps, pnpm enforcement                             | installs or scripts silently do something else                  |
| `pnpm-lock.yaml`                                    | exact dependency versions                                                             | `--frozen-lockfile` fails in CI                                 |
| `pnpm-workspace.yaml`                               | workspace root declaration                                                            | mis-installed linked deps                                       |
| `.npmrc`                                            | `package-manager=pnpm`, auto-install-peers, strict-peer-dependencies                  | npm/yarn hijack; peer dep conflicts                             |
| `.env.example`                                      | the env catalog; never executed                                                       | copy-paste errors caused by reading docs, not code              |
| `config.json`                                       | `semesterIDs` (CH2023…CH20262705), campus constants, credits                          | wrong semester appears app-wide                                 |
| `next.config.mjs`                                   | static export, webpack aliases, Serwist wrap, PostHog sourcemaps, `transpilePackages` | no deploy / no SW / leaked `.next`                              |
| `tsconfig.json`                                     | strictNullChecks OFF, `@/* → src/*` paths                                             | editor vs CI disagree on what compiles                          |
| `eslint.config.mjs`                                 | flat config; `no-explicit-any` = warn; react plugin                                   | commits lint locally but fail in CI                             |
| `.prettierrc` / `.prettierignore`                   | printWidth, semicolons, quotes; ignore paths                                          | unreadable diffs                                                |
| `vitest.config.ts`                                  | jsdom, workers=4, 30s timeout, aliases, CSS stub                                      | suites pass locally, die in CI                                  |
| `.husky/` + `lint-staged` (in package.json)         | pre-commit Prettier/ESLint                                                            | badly formatted commits land on main                            |
| `.github/workflows/ci.yaml`                         | push/PR gate: lint→typecheck→test→build                                               | main goes red immediately                                       |
| `.github/workflows/nextjs.yml`                      | main → Pages deploy; pins NEXT_PUBLIC_*                                               | prod points at whatever default shipped in source               |
| `vercel.json`                                       | legacy Vercel shape (static)                                                          | unused, but don't delete — a stray deploy target still reads it |
| `CNAME`                                             | `amazecc.com` custom domain                                                           | GitHub Pages drops the custom domain                            |
| `components.json`                                   | amazeui registry metadata                                                             | amazeui imports resolve badly                                   |
| `postcss.config.mjs`                                | Tailwind v4 PostCSS plugin                                                            | no CSS output at all                                            |
| `globals.css`                                       | Tailwind import + theme variables                                                     | design tokens absent; white page, black text                    |
| `certificates/`                                     | VIT TLS chains (referenced by `vitfacService.ts` notes)                               | faculty photo proxy breaks at the edge                          |
| `.gitignore`                                        | built artifacts, `.env*`, sw.js, buildInfo excluded-or-tracked per file               | secrets leak in public repo                                     |
| `CNAME` / `vercel.json` / `vercel`-shaped leftovers | keep vs legacy — don't remove casually                                                | see above                                                       |

## Rule of engagement

Before editing any of these, ask: _which artifact does it feed?_ — source, build,
CI, or the hosted page? Each tier has different failure blast radius. When adding a new
`NEXT_PUBLIC_*`, update: `.env.example`, `03-getting-started/03-env-vars.md`, the two
workflows, and `99-reference/env-var-reference.md` — in the same PR.
