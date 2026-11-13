---
title: "Paper Scanner — Known Issues (full)"
---

# Paper Scanner — Known Issues (full)

1. **OCR on colored paper** — red/cream paper yields weaker OCR; grayscale binarization works, dark sepia doesn't — pre-fill lamp with gray filter
2. **Fold marks confuse edge detect** — fold a CAT paper in four before scanning = bad warp — flatten it
3. **Camera overheats** — sustained torch use heats the phone; torch auto-cuts at 5 minutes
4. **One-at-a-time only** — multi-page PDF assembly overwrites in memory; don't exit mid-flow with 20 pages scanned
5. **No cloud sync** — the scan lives on the device; device swap = scans gone; export to PDF before wiping
