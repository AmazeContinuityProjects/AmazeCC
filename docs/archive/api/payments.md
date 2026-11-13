---
title: "Finance Endpoint"
---

> ⚠️ **ARCHIVED — historical context, not authoritative.**
> This file was moved to `docs/archive/` during the handoff docs rebuild. It may describe
> a previous architecture. If it contradicts the code in `src/` or the live `docs/`, the code wins.
> See `docs/index.md` for current documentation.

# Finance Endpoint

The previous `/api/payments`, `/api/payment-receipts`, `/api/wallet`, `/api/library-due`, and `/api/bank-info` routes were consolidated into `POST /api/finance`.

## POST /api/finance

Unified endpoint for finance-related VTOP data.

**Request body (JSON):**

- `cookies` (string | string[])
- `authorizedID` (string)
- `csrf` (string)
- `section` (optional): `all` (default), `dues`, `receipts`, `receipt`, `wallet`, `bank`, or `library`
- `applNo` (optional): receipt/application number for receipt detail lookups

**Examples:**

- `section: "all"` — fetches dues, receipts, wallet, bank, and library sections (best-effort; per-section errors reported in `errors`)
- `section: "dues"` — fee/payment dues
- `section: "receipts"` — receipts list
- `section: "receipt"` + `applNo` — receipt detail
- `section: "wallet"` — wallet ledgers (INR/USD)
- `section: "bank"` — bank info
- `section: "library"` — library dues

**Response (200):**

```json
{
  "success": true,
  "dues": { "hasDues": false },
  "receipts": { "receipts": [] },
  "wallet": { "ledgerINR": [], "ledgerUSD": [] },
  "bank": {},
  "library": {}
}
```

Notes:

- Response fields depend on requested `section`.
- When `section: "all"`, individual section fetch failures may appear under `errors` while other sections still succeed.
