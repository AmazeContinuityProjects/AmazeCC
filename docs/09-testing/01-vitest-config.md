---
title: "Vitest Configuration"
description: "jsdom + globals + explicit imports (no setup files on purpose) + 4 workers - 30 s timeout."
---

# Vitest Configuration

> **In one line:** jsdom + globals + explicit imports (no setup files on purpose) + 4 workers
>
> - 30 s timeout.

`vitest.config.ts` at repo root:

```ts
environment: "jsdom",
globals: true,              // describe/it/expect available without import (still preferred to import)
setupFiles: [],             // deliberately none
testTimeout: 30_000,
maxWorkers: 4,
alias: { "@": "/src" },     // plus amazeui CSS-stub PostCSS shim
```

## Why no setup files

Multiple suites pin the _absence_ of localStorage, and multiple suites need a _specific_ faked
Storage — a global installer would double-wrap and leak between files. Per-suite opt-in keeps
all three behaviors testable.

## CSS & module stubbing

Vitest doesn't parse Tailwind; stubs/CSS-normalizes imports via inline PostCSS plugin pinned
to `postcss-apply`/`postcss-nested` (no tailwind directives executed). `framer-motion`,
`react-circular-progressbar` inline in the config for the same reason.

## Worker count & flakes

4 workers default — heavy render suites stay under 30 s; if you see PTY/ENOTTY flakes locally,
drop `maxWorkers` to 2 via CLI override.
