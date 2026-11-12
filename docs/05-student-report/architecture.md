# Student Report — Architecture

`studentReportPdf.ts` (1,901 lines) — jsPDF manual layout engine (no templates library on purpose — deterministic print).
Input: all atoms + grade history + predictor results; math: `gradeHistory.ts` (cumulative figure), prediction ladder.
privacy: everything happens in-browser; export never passes the network — verified by airplane-mode generation test.
