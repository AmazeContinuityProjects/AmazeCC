---
title: "Paper Scanner — Architecture (deep)"
description: "camera → detect → crop → enhance → OCR → classify — every stage on-device; no paper ever touches the network unless you explicitly share it."
---

# Paper Scanner — Architecture (deep)

> **In one line:** camera → detect → crop → enhance → OCR → classify — every stage on-device; no paper ever touches the network unless you explicitly share it.

## 1. The pipeline (`lib/scanner/pipeline.ts`)

```
camera frame
  → edge detection (sobel)        lib/scanner/imageOps.ts
  → perspective warp to A4        lib/scanner/imageOps.ts (homography)
  → binarization + deskew
  → OCR (tesseract.js, 'eng')     lib/scanner/ocr.ts
  → classification MLP (paper type, exam family)
  → persist IndexedDB             lib/scanner/store.ts
```

## 2. The NN classifier (`lib/scanner/nn/mlp.ts`)

~500-parameter MLP, trained offline (`scanner:train`); classifies exam family, not content —
used for auto-tagging in reports, never for surveillance. Weights ship in the bundle (4 KB).

## 3. Storage

- IndexedDB `papers` store: raster crops + PDFs — purge via Settings → Storage → Clear scanner cache
- Nothing syncs to cloud; no account is ever created

## 4. OCR quality

tesseract.js English-only at ~7 MB WASM; for STEM scans with symbols, upload cadence is unreliable
— feedback form attaches the raster for maintainer re-OCR where needed.
