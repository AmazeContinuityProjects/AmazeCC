---
title: "ADR-0006: UniCC Fallback (scoped, opt-out-able)"
---

# ADR-0006: UniCC Fallback (scoped, opt-out-able)

**Status:** accepted
**Context:** VTOP scrapes fail under load on exam seasons; users need their own data NOW; a third party already offers a working path.
**Decision:** UniCC receives real VTOP credentials for a strict allowlist of read endpoints, only after the primary + backup both failed, never on auth errors, never without explicit build-time opt-out. `NEXT_PUBLIC_UNICC_FALLBACK=off` disables globally.
**Consequences:** exam-season continuity; third-party exposure limited to approved paths; documented, measurable, and reversible by deploy flag.
**Revisit when:** AmazeCC-API reaches all-campus SLA; or UniCC terms change; or VIT publishes an official OAuth.
