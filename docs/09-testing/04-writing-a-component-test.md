---
title: "Writing a Component Test"
description: "render with Testing Library, fire events, waitFor async paint — asserting what a student would _see_."
---

# 04 — Writing a Component Test

> **In one line:** render with Testing Library, fire events, `waitFor` async paint — asserting
> what a student would _see_.

```tsx
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import DemoBadge from "@/components/custom/shared/DemoBadge";

it("says demo mode", async () => {
  render(<DemoBadge />);
  await waitFor(() => expect(screen.getByText(/demo/i)).toBeTruthy());
});
```

Rules of the house:

- **No `@testing-library/jest-dom`** — assert with `toBeTruthy()`, `toBe(text)`, or attribute checks
  on `.toBeTruthy()` — superset matchers not installed on purpose
- **No snapshots.** Query by role/text, not tree shape
- **Mock at module boundaries**: `vi.mock("@/lib/sync-engine")` at the top of the file — never
  monkey-patch `global.fetch` (the helper `installLocalStorage` is the approved storage shim)
- **Timers**: fake them explicitly (`vi.useFakeTimers`) for reminder/pomodoro tests
- **Cleanup**: Testing Library auto-cleans if `globals: true` (it is) — keep that on
