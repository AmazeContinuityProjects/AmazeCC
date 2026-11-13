---
title: "Paper Scanner — Data Model"
---

# Paper Scanner — Data Model

`Scan = { id, images: Raster[], ocrText, classifier: { label, confidence }, pdfBytes?, createdAt }`
Store: IndexedDB store `scans` — device-local; clearing site data deletes all papers.
