---
title: "Known Limits (enumerate them, won't surprise you later)"
---

# 05 — Known Limits (enumerate them, won't surprise you later)

1. **Single-campus** — Chennai slot model (`GLOBAL`) is the only supported timetable schema; AP/Bhopal JSON present but not wired UI
2. **No strictNullChecks** — `strictNullChecks: false`; type system weaker
3. **Static export** — no server-side redirects, CSP is meta not headers, no ISR/SSR at runtime
4. **No URL deep links inside the app** — only top-level routes; `?tab=` consumed once on mount
5. **Captcha-solve latency** — sign-in takes 4–10 s by design; nothing can make it faster
6. **PDF export fidelity** — jsPDF manual layout diverges from browser print on edge cases; compare carefully before claiming parity
7. **Demo ≠ production** — no code path exists in demo for captcha failure or failover
8. **One maintainer context** — many comments reference sessions of specific engineers; archive holds the raw plans for provenance
