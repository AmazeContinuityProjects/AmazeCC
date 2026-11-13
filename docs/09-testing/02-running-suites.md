---
title: "Running Suites"
description: "pnpm run test is the whole suite; filter with a bare substring; watch with pnpm exec vitest."
---

# 02 — Running Suites

> **In one line:** `pnpm run test` is the whole suite; filter with a bare substring; watch with `pnpm exec vitest`.

```bash
pnpm run test                 # everything (~2–4 min)
pnpm run test -- ffcs         # filename substring filter (path segments count)
pnpm run test -- -t "drop"    # test-name filter
CI=true pnpm run test         # same thing, reporter off (what ci.yaml uses)
```

Report modes: default (tty), CI auto-detects, `--reporter=verbose` for per-test lines.
Coverage: not enforced today — deliberately (we pin _contracts_, not line counts); if you add
a coverage gate, expect it to explode on `FFCSGuidedSelector.tsx`.
