# Payments — Testing

> No dedicated suite exists today — an honest registered gap.

- finance adapter coverage lives inside `sync-engine` op suites (`sync-modes.test.ts`, `marksSync.test.ts`);
  there is no `payments.test.ts` in `src/__tests__/` at the time of writing
- UI behavior is exercised manually; the demo-mode fixture drives the render path
- **Action item:** if you touch finance logic, add a suite — it's the highest-anxiety surface in the repo
