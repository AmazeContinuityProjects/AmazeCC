# 01 — Sync Keeps Failing

> **In one line:** 90% of the time it's the wrong password, expired session, or VTOP having a bad day, in that order.

Decision tree:

```
Error mentions "password"/"captcha"     → credentials screen — re-enter password
Error: "VTOP is unreachable"            → wait 10 min, try again (try the official portal
                                          — if it's down, we are too)
Error: "HTTP 401/403"                   → session expired — any sync refreshes it (tap Refresh)
Error: "Too many attempts"              → wait 10 minutes (VTOP lockout)
Error: "Network"                        → campus Wi-Fi flaky — try mobile data
Error: "UniCC"                          → third-party fallback failed too — it's VTOP that's down
```

Still stuck? Check `settings → Advanced → forget credentials` → sign in fresh. Demo mode always
works — test your UI there (it never touches VTOP).
