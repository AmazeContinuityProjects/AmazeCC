# 06 — Console Errors, Decoded

| Message                                           | Meaning                               | What to do                                                                        |
| ------------------------------------------------- | ------------------------------------- | --------------------------------------------------------------------------------- |
| `ChunkLoadError: Loading chunk N failed`          | Deploy-time staleness                 | hard refresh; auto-heals once                                                     |
| `Your connection is not private`                  | dev-mode self-signed cert on HTTPS    | `pnpm dev:http` instead; or proceed in the cert warning once (dev only)           |
| `VTOP captcha failed` (from API)                  | captcha solve failed server-side      | try again; wait for the API backlog to clear                                      |
| `Service Worker: cache quota exceeded`            | storage full                          | Settings → footer → LocalStorage inspector → delete cruft                         |
| `ResizeObserver loop limit exceeded`              | cosmetic browser warning              | ignore — normal on dense grids                                                    |
| `Loading chunk failed` inside a Suspense boundary | never blocking — hydration will catch | check !sw; usually fixed by SW update                                             |
| `UniCC request rejected`                          | fallback path refused (by design)     | if VTOP is confirmed up, this is fine — it means the primary delivered the answer |
| `hydration mismatch` warning in dev               | client/server HTML differs            | report it — usually conditional class based on localStorage                       |
