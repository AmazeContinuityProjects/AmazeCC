# QBank — Architecture (deep)

> **In one line:** question bank of past papers — searchable, filterable by course/component — served from a curated static corpus, rendered with KaTeX math.

## 1. Storage model

- **Static corpus** — `data/qbank/` ships in the bundle (PDFs + metadata); no network required
- **Upload path** — contributions flow through AmazeCC-API (Moderation queue → maintainer approves → ships in next release)

## 2. Rendering

- KaTeX for math blocks; dangerouslySetInnerHTML inside a scoped component only, never raw HTML strings from the network
- MCQ options randomized per visit? No — kept stable (grading integrity); selection just toggles highlight

## 3. Upload pipeline (high-level)

```
PDF form → POST /api/qbank (verify branch/semester, size cap)
→ server parses, stores in B2 + DB row
→ manual review → release ships in next bundle (or monthly ingest)
```

## 4. Why not serve papers live from the API

Bundle-carrying keeps exam-time load off the API and off the Campus Wi-Fi; students open these
on paper, offline-capable devices prep year-round.
