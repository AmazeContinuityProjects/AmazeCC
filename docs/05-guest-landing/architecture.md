# Guest Landing — Architecture

`GuestExperience.tsx` — separate path from Main (never pays for app code until login).
`LandingSections.tsx` (dynamic import, below-the-fold only) · `homeEntryController` gate decides render order.
