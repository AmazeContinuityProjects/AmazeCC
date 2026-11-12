# QBank — Known Issues

1. Papers uploaded before OCR support shipped show raw scans with no text index — search falls back to filename.
2. The VTOP-proxy download drops the session mid-stream if the tab is backgrounded — retry once.
3. KaTeX lags on course with heavy notation — LaTeX parse errors render raw rather than blank.
