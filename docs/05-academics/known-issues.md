# Academics — Known Issues

1. Effective grade reconciliation — VTOP's "effective vs declared" semantics differ by batch; `gradesEffective.ts` carries batch-conditionals. Verify against live semester response when in doubt.
2. Curriculum categories drift — institutional plan changes land without notice; the UI expects VIT to fix sources, not us.
3. Exam series naming — "CAT2" vs "CAT - II" handled by `examSeries.ts` canonicalization; add variants, never fork.
