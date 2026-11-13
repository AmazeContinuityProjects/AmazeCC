# Payments — Architecture (deep)

> **In one line:** VIT's fee portal scraped on your behalf — dues, receipts, wallet — read-only; we never initiate a payment.

## 1. The pipeline

```
finance op (section=all | dues | receipts | wallet)
  → API scrapes the finance portal HTML → tables → JSON
  → adaptFinanceResults() → typed sections
  → rendered directly — no localStorage, no atoms (money must never be stale)
```

## 2. What the app never does

- never triggers "pay now" — only deep-links the portal for checkout
- never caches fee balances, even "temporarily"
- never holds card detail of any kind

## 3. Receipt PDFs

jsPDF client-side; table snapshotted off the API response — no network after generation.
