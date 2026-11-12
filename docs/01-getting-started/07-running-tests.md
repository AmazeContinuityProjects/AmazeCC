# 07 — Running Tests

> **In one line:** `pnpm run test` runs everything (204 suites, ~40k lines); scope it with a
> pattern when iterating.
> **Reading time:** ~7 min. Deeper truth: `docs/09-testing/`.

## The 60-second version

```bash
pnpm run test                           # everything; ~2–4 minutes on a laptop
pnpm run test -- ffcsGenerate           # suites whose filename matches
pnpm run test -- -t "share link"        # tests whose title matches
pnpm run test -- src/__tests__/marksSync.test.ts   # exactly one file
```

Watch mode is opt-in: `pnpm exec vitest` (no `run`).

## How suites are organized

All tests live in `src/__tests__/` — co-located flat, named `<thing>.test.ts(x)`:

- **Unit** — pure logic (`ffcsGenerate`, `slots`, `gradeBoundaries`, `marksSync`…)
- **Hook/render** — `*.render.test.tsx`, `*.hook.test.tsx` (Testing Library, no snapshots)
- **Integration-ish** — sync engine flows with mocked `fetch`

Two things about the harness surprise newcomers:

1. **No global test setup.** Suites import helpers explicitly
   (`src/__tests__/helpers/localStorage.ts` installs an in-memory `Storage`). Why? Some tests
   pin the _absence_ of localStorage — a global would break them.
2. **What runs where.** `testTimeout` = 30 s (some render suites are heavy); `maxWorkers: 4`.
   CI uses the same config.

## Writing your first test

```ts
// src/__tests__/example.test.ts
import { describe, it, expect } from "vitest";
import { installLocalStorage } from "./helpers/localStorage";

installLocalStorage();
describe("example", () => {
  it("adds", () => {
    expect(1 + 1).toBe(2);
  });
});
```

## What the suite protects

Share-link round-trips, the generator's drop ladder, marks-sync frozen receipts, credential
backoff, CSP contents, the `/~offline` page existence, the FFCS share-route components — see
`docs/09-testing/07-suite-map.md` for the full index.

## When tests fail after your change

1. Read the failing assertion, not the stack — the suite names usually say what invariant broke.
2. If it's a fixture mismatch, the fixture (`demoData.json`) or the code changed — ask which.
3. Never `--no-verify` or skip a suite to make CI pass. If it's genuinely wrong, fix the test
   in the same PR.
