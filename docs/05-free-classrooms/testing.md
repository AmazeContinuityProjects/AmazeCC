---
title: "Free Classrooms — Testing"
---

# Free Classrooms — Testing

- `freeClassrooms.test.ts` — table round-trip (parse 2,357 rows, zero loss), silent-failure pinning,
  slot clash math exhaustive (every pair order)
- `roomMerge.test.ts` — client/server reconciliation: conflicts resolved, false-negatives flagged,
  both-missing → "unknown" not "free"
- `roomAvailability.test.ts` — server contract shape (skipped without VTOP)
- render: tab mounts empty → fills with fallback path
