# FFCS Engine Architecture & Workings

This directory documents the inner workings of the **Fully Flexible Credit System (FFCS)** timetable builder and generator in AmazeCC.

## Documents

1. [**Embedded Course Pairing & Priorities**](./embedded-course-pairing.md)
   - Embedded theory + lab course representation (`masterCourses`).
   - The 4-tier priority hierarchy for theory-to-lab pairing.
   - Session shift compatibility (VIT Chennai schema).
   - Branch-and-bound combinatorial optimization algorithm.

2. [**Clash Detection & Campus Schema Engine**](./clash-detection-and-schema.md)
   - How campus schema (`src/data/campus/*.json`) defines weekly periods.
   - Mathematical model for clash detection (`Math.max(start) < Math.min(end)`).
   - Validation flow in the interactive Timetable Tab (`FFCSTimetableTab.tsx`).
   - Validation flow in the Autogenerator (`generate.ts` and background worker).
   - Edge case analysis and correctness evaluation.

3. [**Timetable Export & Vitfac Reviews**](./timetable-export-and-reviews.md)
   - Modern off-screen image builder pattern (matching the faculty slots swapper).
   - Dynamic layout building based on selected view (Vertical Heatmap vs Horizontal Grid).
   - Vitfac student review & sentiment showcase in exported images.
