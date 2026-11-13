---
title: "ADR-0002: Client-Side VTOP Authentication"
---

# ADR-0002: Client-Side VTOP Authentication

**Status:** accepted
**Context:** VTOP credentials are VIT's system; trifling with them server-side creates liability for us and transparency for our users.
**Decision:** VTOP login happens exactly where the user types — their browser. AmazeCC-API solves the captcha, VTOP sessions live in memory + vault (AES-GCM, IndexedDB key). Server stores nothing credentialed; the API cannot log in as you because it does not keep anything.
**Consequences:** no account theft via our breach; offline logins impossible (by design); password resets go to VIT.
**Revisit when:** VIT publishes an OAuth/OIDC story.
