# Paper Scanner — Architecture

Pipeline: camera frame → `ScannerCamera.tsx` → `imageOps.ts` (edge detect, perspective warp, denoise) → `pipeline.ts` (processScan) → `store.ts` (IndexedDB, local-first) → `pdf.ts` (page stitching).
OCR: `ocr.ts` (tesseract.js WASM, on-device by default; optional cloud key for accuracy tier).
NN classifier: `scanner/nn/mlp.ts` — tiny MLP weights (trained offline from real papers via `scanner:train`) classifies "which exam this is".
