# Payments — Architecture

`/api/finance` core endpoint (sections: dues/receipts/wallet) — returns VTOP-built tables.
`adaptFinanceResults()` normalizes bulk-section responses into single-purpose payloads.
Never cached client-side — financial figures must never be stale. PDF generation client-side.
