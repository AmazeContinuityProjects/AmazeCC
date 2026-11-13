---
title: "Marks Sync Trouble"
description: "receipts don't match → server state moved → client says so out loud; do not silence it."
---

# Marks Sync Trouble

> **In one line:** receipts don't match → server state moved → client says so out loud; do not silence it.

- "N cohort receipts changed unexpectedly" — VIT re-uploaded a paper or fixed a typo; the app counts drift for you; the numbers aren't corrupt, they're honest
- Contribution never registers — check Settings toggle is actually on; the op logs nothing on failure
- Boundary case grade predictions off — boundaries may have changed; table in `gradeBoundaries.ts` is the source of truth, check if you're seeing a Table-1 mismatch
