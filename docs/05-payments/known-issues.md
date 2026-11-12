# Payments — Known Issues (full)

1. **Portal downtime during fee windows** — finance tab must say "portal busy" with retry, never blank totals or $0 due.
2. **Receipts ZIP pulling slow** — client-side PDF is multi-hundred KB per receipt; many pages = heavy generation on mobile; show progress bar.
3. **Wrong semester card selected** in the picker → zero dues shown for _this_ term; display semester badge on the card bold red if not matching `settings.currSemesterID`.
4. **Refund tracking** — VIT refund pipeline often lags our refresh; receipt refresh needed for confirmation.
