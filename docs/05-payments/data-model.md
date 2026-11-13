---
title: "Payments — Data Model"
---

# Payments — Data Model

`PaymentTransaction = { id, date, description, amount, type, status }` · `Receipt = { receiptNo, date, amount, method, utr? }` · `Wallet = { balance, transactions[] }` — types in `types/payments.ts`.
