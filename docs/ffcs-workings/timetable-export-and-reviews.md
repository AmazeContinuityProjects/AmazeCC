# Timetable Export & Vitfac Reviews

This document describes how the FFCS timetable export view was modernized to leverage high-fidelity off-screen rendering, showcase Vitfac faculty reviews, and adapt dynamically to the user's active view mode (Vertical Heatmap vs. Horizontal University Grid).

---

## 1. Motivation & Architecture

### The Problem with Live DOM Capture
The legacy timetable download mechanism captured the live DOM element directly:
- Stripped `.overflow-x-auto` classes from scrollable containers on the screen, causing visible layout shifts for the user.
- Temporarily applied `transform: scale(...)` based on the user's current viewport width. On mobile phones, this caused severe text squishing, blurry exports, or cutoff columns.
- Rendered whichever view happened to be in the DOM without custom styling or standalone cheat-sheet metadata.

### The Modern Off-Screen Builder Pattern
Adopting the strategy proven in the **Faculty Slots Swapper** ([`SlotFacultySwapSheet.tsx`](file:///C:/Users/sugee/Github/AmazeContinuityProjects/AmazeCC/src/components/custom/exams/FFCS/components/SlotFacultySwapSheet.tsx)):
1. Generates a standalone, pixel-perfect HTML card tree in an off-screen container (`position: fixed; left: -9999px; top: 0; z-index: -1000`).
2. Renders with fixed, optimal desktop widths (`1280px` for Vertical, `1540px` for Horizontal) using high-contrast dark aesthetic styling (`#090d16` canvas, neon badges, translucent surfaces).
3. Uses `html-to-image` (`toJpeg` / `toPng`) configured with `pixelRatio: 2` (retina crispness) and `quality: 0.95`.
4. Automatically triggers the download and unmounts the container in `finally`, leaving the live user UI completely untouched.

---

## 2. Dynamic View Generation: Vertical vs. Horizontal

The export automatically detects the user's active timetable view mode via `useTimetableViewMode()` (`resolvedView: 'vertical' | 'horizontal'`) and builds the matching grid representation in the exported image.

### A. Vertical Timetable Heatmap (`viewMode === 'vertical'`)
- **Structure**: Columns for Days (`MON`, `TUE`, `WED`, `THU`, `FRI`) and rows for Time Bands (`8:00 AM – 8:50 AM`, etc.).
- **Merged Runs**: Uses the pure projection logic from [`buildVerticalGrid`](file:///C:/Users/sugee/Github/AmazeContinuityProjects/AmazeCC/src/components/custom/timetable/buildBands.ts) to merge continuous multi-hour lab sessions (e.g. `L31+L32`) into unified cells using HTML `rowspan`.
- **Lunch Spacer**: Features a distinct full-width `🍽️ LUNCH BREAK (1:20 PM – 2:00 PM)` separator.
- **Card Styling**: Each occupied block displays the Course Code, Slot Token pill, Course Title, Room Venue, and Instructor.

### B. Horizontal University Grid (`viewMode === 'horizontal'`)
- **Structure**: Rows for Days (`MON` through `FRI`) and columns for all 12 Periods + Central Lunch column.
- **Stacked Shift Cells**: Each period column splits into Theory (upper) and Lab (lower) blocks according to the VIT Chennai schema.
- **Visual Badges**: Occupied periods are rendered with high-contrast color pills matching the course's assigned palette, with room numbers and course codes. Free periods display subtle slot identifiers (e.g., `A1 / L1`).

---

## 3. Showcase of Vitfac Faculty Reviews

Underneath the timetable grid, the exported image includes an **Enrolled Courses & Faculty Reviews Reference Table**.

### Vitfac Sentiment Integration
For every enrolled course, the generator queries `getFacultyReview({ employeeId: c.employeeId, name: c.faculty })` from [`src/lib/vitfacService.ts`](file:///C:/Users/sugee/Github/AmazeContinuityProjects/AmazeCC/src/lib/vitfacService.ts):

1. **Win-Percentage Badge (`% W`)**:
   - $\ge 70\%$ W: Emerald Green pill (`#34d399` on `rgba(16,185,129,0.18)`).
   - $40\% – 69\%$ W: Amber Gold pill (`#fbbf24` on `rgba(245,158,11,0.18)`).
   - $< 40\%$ W: Crimson Red pill (`#f87171` on `rgba(239,68,68,0.18)`).
   - Student Review Count: `(${rev.reviews} reviews)`.
2. **Metrics Breakdown**:
   - If available, highlights average ratings: e.g. `Vibe: 4.8/5 · DA: 4.5/5`.
3. **Multi-Instructor Handling**:
   - If an embedded course lists multiple instructors (e.g., `Dr. Theory / Dr. Lab`), reviews for each instructor are displayed on separate badges.
4. **Fallback**:
   - If unreviewed, displays an elegant, muted `Unreviewed` tag.

---

## 4. UI Controls & Format Selection

In [`FFCSTimetableTab.tsx`](file:///C:/Users/sugee/Github/AmazeContinuityProjects/AmazeCC/src/components/custom/exams/FFCSTimetableTab.tsx):
- The primary action button dynamically reflects the active view mode:
  `Download JPG (Vertical)` or `Download JPG (Horizontal)`.
- The hover/tap dropdown provides granular options:
  - `Download JPG (Current View)`
  - `Download JPG (Vertical Heatmap)`
  - `Download JPG (Horizontal Grid)`
  - `Download PNG (Current View)`
- If modern off-screen rendering encounters an unexpected browser error, the system automatically falls back to live DOM capture as a safety net.
