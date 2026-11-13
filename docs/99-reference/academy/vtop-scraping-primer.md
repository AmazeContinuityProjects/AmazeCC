---
title: "VTOP Scraping Primer (how AmazeCC-API reads the portal)"
description: "VTOP serves HTML, not JSON — the API is a patient browser that reads pages on your behalf."
---

# VTOP Scraping Primer (how AmazeCC-API reads the portal)

> **In one line:** VTOP serves HTML, not JSON — the API is a patient browser that reads pages on your behalf.

## The pattern every scraper follows

```
1. POST /vtop/prelogin/setup       — cookies + _csrf
2. POST /vtop/login (+captcha)     — solve → cookies
3. GET  /vtop/open/page            — dashboard (authorizedID)
4. POST the target view URL        — response is HTML; cheerio parses tables/rows
5. Normalize → {success, …fields}  — JSON to the app
```

Tables arrive as `<tr class="tableContent even/odd">` rows; headers as `<tr class="tableHeader">`;
cell indices positionally mapped. When VIT changes a template, it breaks **one** scraper function
(not the whole API) — and the app shows "source unavailable" rather than bad data.
