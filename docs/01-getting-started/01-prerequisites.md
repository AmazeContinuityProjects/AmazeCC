# 01 — Prerequisites

> **In one line:** you need git, Node.js 22, and pnpm — use whatever package manager you like,
> but use exactly these three tools.
> **Reading time:** ~5 min.

| Tool    | Version                 | Why                                                                              |
| ------- | ----------------------- | -------------------------------------------------------------------------------- |
| Git     | any recent              | source control; `prebuild` also shells out to it for `buildInfo.json`            |
| Node.js | **22 LTS** (matches CI) | the build runtime; `pnpm dev` uses `--experimental-https`                        |
| pnpm    | 10.x                    | see `package.json#packageManager`-area and `.npmrc`; npm will corrupt the layout |

Optional but recommended:

- **VS Code** — this repo ships `.vscode/` settings and matches recommended extensions
  (TypeScript, ESLint, Prettier)
- **Chrome/Edge** — service-worker tooling is first-class only in Chromium browsers

## Install (the short version)

```bash
# Node 22 via any version manager, e.g. nvm / nvm-windows / fnm / Volta
nvm install 22 && nvm use 22

# pnpm (recommended via Corepack)
corepack enable
corepack prepare pnpm@latest --activate
pnpm --version

# or via npm:
npm install -g pnpm
```

Windows uses `nvm-windows` or `fnm`; everything else in this guide is identical.

## Sanity check

```bash
node --version   # v22.x.x
pnpm --version   # 10.x (any recent)
git --version    # anything modern
```

If `pnpm --version` prints something wildly different, your shell is resolving a stale shim —
fix `PATH` before proceeding.
