# Settings & Profile — Architecture

State owner: `settingsAtom` with migration-on-read shim (never delete fields without a deprecation path).
Delegates: every update funnels via `updateSetting(key, value)` in ProfilePage — computed side effects
(e.g. switching semester → `broadcastGlobalSemesterChange`) live there, not in the JSX.
