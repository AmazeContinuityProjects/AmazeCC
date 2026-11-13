# 07 — FAQ (week-1 questions)

**Q: Do I need a VIT account?** A: No. Demo mode (from the landing page) is fully functional mock data — develop there entirely.

**Q: Where does the app get my data?** A: AmazeCC-API scrapes VTOP on your behalf — your password is typed on this device but sent to AmazeCC's servers for the captcha solve (that's how it logs in). Nothing is shared beyond that solver.

**Q: Why not cookies-inventory on both ends?** A: static hosting can't set cookies; the vault stores secrets locally, device-bound.

**Q: My friend sees a different layout.** A: simplified vs classic interface picker at first sign-in (AmazeOnboardingFlow), changeable later.

**Q: Can I contribute marks to class stats?** A: Yes, opt-in in Settings. Off by default. Anonymous class-level aggregates.

**Q: Why is /ffcs a separate app?** A: it needs a full-page canvas, its own icon set, and personal link sharing without the chrome — same code, different entry.

**Q: The site broke after the deploy — when will it return?** A: Revert-merge to main redeploys instantly; SW staleness may hold clients for hours — bump SW caches for emergencies.
