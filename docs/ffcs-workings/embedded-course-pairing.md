# Embedded Course Pairing & Priorities

## Overview

In the VIT FFCS system, embedded courses (e.g. `Embedded Theory (ETH)` + `Embedded Lab (ELA)`) are reported as separate offering rows in the master timetable course database. For students to register or generate timetables, each theory offering must be paired with an appropriate lab offering taught under the same course code and faculty.

When a faculty teaches multiple theory sections (e.g., a Morning section `A1+TA1` and an Evening section `A2+TA2`) alongside multiple lab sections (e.g., Morning `L11+L12` and Afternoon `L15+L16`), greedy matching often binds sections sub-optimally (or illegally across prohibited time windows), leading to false clashes or invalid student schedules.

The engine resolves this in `processParsedCourses` in `src/components/custom/exams/FFCSTimetableTab.tsx` using a **4-tier scored branch-and-bound optimization algorithm**.

---

## The VIT Chennai Timetable Shift Model

The weekly schedule is divided by the lunch boundary (2:00 PM / 840 minutes from midnight):

| Half | Theory Timing Window | Lab Timing Window | Lab Slot IDs |
|---|---|---|---|
| **Morning Shift** | Period 1–4 (8:00 AM – 11:35 AM)<br>Late: Period 5–6 (11:40 AM – 1:25 PM) | Core: 8:00 AM – 11:30 AM<br>Late: 11:40 AM – 1:20 PM | `L1`–`L30`<br>(`L1`–`L4`, `L7`–`L10`, `L13`–`L16`, `L19`–`L22`, `L25`–`L28` = Core)<br>(`L5`–`L6`, `L11`–`L12`, `L17`–`L18`, `L23`–`L24`, `L29`–`L30` = Late) |
| **Afternoon / Evening Shift** | Period 7–10 (2:00 PM – 5:35 PM)<br>Late: Period 11–12 (5:40 PM – 7:25 PM) | Core: 2:00 PM – 5:30 PM<br>Late: 5:40 PM – 7:20 PM | `L31`–`L60`<br>(`L31`–`L34`, `L37`–`L40`, `L43`–`L46`, `L49`–`L52`, `L55`–`L58` = Core)<br>(`L35`–`L36`, `L41`–`L42`, `L47`–`L48`, `L53`–`L54`, `L59`–`L60` = Late) |

### Permissible Lab Configurations

Students cannot attend morning theory while scheduled in core morning lab periods (8:00–11:30 AM), nor evening theory during core evening lab periods (2:00–5:30 PM). However:
- **Morning Theory** students can take **Afternoon Lab (2:00–5:30 PM)** or **Late Morning Lab (11:40 AM–1:20 PM)**.
- **Evening Theory** students can take **Morning Lab (8:00–11:40 AM)** or **Late Evening Lab (5:40–7:20 PM)**.

---

## 4-Tier Pairing Priority Hierarchy

Pairs are evaluated using `computePairScore(theoryCourse, labCourse)`:

### 1. Priority 1 (Weight: +2000) — Shift-Complementary Core Pairing
- **Evening Theory** paired with **Core Morning Lab (8:00 AM – 11:40 AM)**.
- **Morning Theory** paired with **Core Afternoon Lab (2:00 PM – 5:30 PM)**.
- *Rationale*: This is the standard, preferred university schedule configuration where students dedicate one half of the day to theory and the complementary half to practicals.

### 2. Priority 2 (Weight: +1000) — Permitted Same-Half Edge Slots
- **Morning Theory** paired with **Late Morning Lab (11:40 AM – 1:20 PM)**.
- **Evening Theory** paired with **Late Evening Lab (5:40 PM – 7:20 PM)**.
- *Rationale*: Allows single-shift students to complete labs immediately following their theory block without crossing into the opposite core session.

### 3. Priority 3 (Weight: +500) — General Cross-Shift Fallback (Above-30 / Below-30)
- **Morning Theory** paired with any remaining **Above-30 Lab (`L31`+)**.
- **Evening Theory** paired with any remaining **Below-30 Lab (`L1`–`L30`)**.
- *Rationale*: Satisfies the fundamental above/below 30 cross-shift rule if a non-core slot is involved.

### 4. Priority 4 (Weight: -1000) — Penalized Same-Half Pairing
- Same-half pairings outside the approved Priority 2 window.
- Heavily penalized to prevent greedy matchers from binding same-half slots when valid cross-shift combinations exist.

### Secondary Tie-Breakers
- **Same-day penalty (`-30`)**: Discourages booking theory and lab on the same day when alternative free days exist.
- **Class ID proximity (`+20`)**: Bonus for matching class numbers (e.g. `VL2024250100101` and `VL2024250100102`), which university timetables often assign to parallel sections.

---

## Algorithm: Branch-and-Bound Backtracking

To guarantee optimal global pairings rather than local greedy traps:

```typescript
function processParsedCourses(rawCourses, manualLinks) {
  // Group raw courses by CODE + FACULTY
  // Identify separate theory offerings and lab offerings
  
  // For each faculty group:
  const maxPossible = Math.min(theorySlots.length, labSlots.length);
  
  // 1. Sort candidate lab matches descending by pair score
  // 2. Backtrack with bounding:
  const backtrack = (tIdx, currentMatch, currentScore, usedLabs) => {
    // Prune branch if theoretical maximum cannot beat bestScore
    const maxRemaining = (maxPossible - currentMatch.length) * 2100;
    if (bestMatch.length === maxPossible && currentScore + maxRemaining <= bestScore) {
      return;
    }
    
    // Test each candidate non-overlapping lab
    for (const { l, j, score } of candidates) {
      if (usedLabs.has(j) || slotsOverlap(t.SLOT, l.SLOT)) continue;
      usedLabs.add(j);
      currentMatch.push({ t, l, score });
      backtrack(tIdx + 1, currentMatch, currentScore + score, usedLabs);
      currentMatch.pop();
      usedLabs.delete(j);
    }
    
    // Also consider skipping tIdx (unpaired) if needed
    backtrack(tIdx + 1, currentMatch, currentScore, usedLabs);
  };
}
```

### Key Guarantees
1. **Compound Token Resolution**: All compound slots (e.g., `A1+TA1` or `L15+L16`) are tokenized by `+` before period lookup.
2. **Conflict Invariant**: No pair is ever created if `slotsOverlap(theorySlot, labSlot)` returns `true`.
3. **Universality**: Because `masterCourses` is computed in `FFCSTimetableTab` and passed directly as a prop to both the manual schedule picker and `<FFCSGeneratorSubpage masterCourses={masterCourses} />`, this priority ranking and pairing guarantee applies universally to both the interactive planner and the automated generator engine.
