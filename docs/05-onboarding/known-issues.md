# Onboarding — Known Issues (full)

1. **Cancel mid-sync** — offers "continue without attendance" — the app never hard-blocks refresh paths after that choice is made (safety net).
2. **Captcha failures** — VIT captcha print poor-quality variants; the login surfacing "try again" as the common failure; 5s backoff.
3. **Legacy sessions** — users with old jsessionid never re-See onboarding; the gate is atom-only, not VTOP-aware.
4. **Demo → full upgrade path** — switching from demo to real student wipes demo atoms; cached attendance from demo evaporates — intended.
