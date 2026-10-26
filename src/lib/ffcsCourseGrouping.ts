import type { ManualLink, ParsedCourse } from "@/components/custom/exams/FFCS/types";
import { getTimetableSchema } from "@/lib/campusSchema";
import { MORNING_BEFORE_MIN, periodsForSlot, slotsOverlap, splitSlots, type SlotPeriod } from "@/lib/slots";
const getPeriodsForSlotOuter = (slotName: string) =>
  periodsForSlot(getTimetableSchema(), slotName);

const getPeriodsForSlotsOuter = (slotStr: string): SlotPeriod[] => {
  return splitSlots(slotStr)
    .filter((s) => s !== "NIL")
    .flatMap(getPeriodsForSlotOuter);
};


const isOverlap = (theorySlotStr: string, labSlotStr: string) =>
  slotsOverlap(theorySlotStr, labSlotStr, getTimetableSchema());

// Core morning lab slots (8:00 AM - 11:40 AM: periods 1 to 4)
const CORE_MORNING_LABS = new Set([
  "L1", "L2", "L3", "L4", "L7", "L8", "L9", "L10", "L13", "L14", "L15", "L16", "L19", "L20", "L21", "L22", "L25", "L26", "L27", "L28"
]);

// Core afternoon/evening lab slots (2:00 PM - 5:30 PM: periods 7 to 10)
const CORE_EVENING_LABS = new Set([
  "L31", "L32", "L33", "L34", "L37", "L38", "L39", "L40", "L43", "L44", "L45", "L46", "L49", "L50", "L51", "L52", "L55", "L56", "L57", "L58"
]);

// Late morning window lab slots (11:40 AM - 1:20 PM: periods 5 and 6)
const LATE_MORNING_LABS = new Set([
  "L5", "L6", "L11", "L12", "L17", "L18", "L23", "L24", "L29", "L30"
]);

// Late evening window lab slots (5:40 PM - 7:20 PM: periods 11 and 12)
const LATE_EVENING_LABS = new Set([
  "L35", "L36", "L41", "L42", "L47", "L48", "L53", "L54", "L59", "L60"
]);

const isCoreMorningLab = (slotStr: string) => {
  const parts = String(slotStr ?? "")
    .split("+")
    .map(s => s.trim().toUpperCase())
    .filter(Boolean);
  return parts.length > 0 && parts.every(s => CORE_MORNING_LABS.has(s));
};

const isCoreEveningLab = (slotStr: string) => {
  const parts = String(slotStr ?? "")
    .split("+")
    .map(s => s.trim().toUpperCase())
    .filter(Boolean);
  return parts.length > 0 && parts.every(s => CORE_EVENING_LABS.has(s));
};

const isLateMorningLab = (slotStr: string) => {
  const parts = String(slotStr ?? "")
    .split("+")
    .map(s => s.trim().toUpperCase())
    .filter(Boolean);
  return parts.length > 0 && parts.every(s => LATE_MORNING_LABS.has(s));
};

const isLateEveningLab = (slotStr: string) => {
  const parts = String(slotStr ?? "")
    .split("+")
    .map(s => s.trim().toUpperCase())
    .filter(Boolean);
  return parts.length > 0 && parts.every(s => LATE_EVENING_LABS.has(s));
};

const computePairScore = (t: ParsedCourse, l: ParsedCourse): number => {
  let score = 0;
  const tPeriods = getPeriodsForSlotsOuter(t.SLOT);
  const lPeriods = getPeriodsForSlotsOuter(l.SLOT);

  const tMorning = tPeriods.some(p => p.startMin < MORNING_BEFORE_MIN);
  const tEvening = tPeriods.some(p => p.startMin >= MORNING_BEFORE_MIN);

  // Analyze whether the lab tokens are below 30 (morning) or above 30 (evening)
  const labParts = String(l.SLOT ?? "")
    .split("+")
    .map(s => parseInt(s.replace(/[^0-9]/g, ""), 10))
    .filter(n => !isNaN(n));
  const hasBelow30 = labParts.some(n => n <= 30);
  const hasAbove30 = labParts.some(n => n > 30);
  const isBelow30Only = labParts.length > 0 && labParts.every(n => n <= 30);
  const isAbove30Only = labParts.length > 0 && labParts.every(n => n > 30);

  // Priority 1: 8:00-11:40 morning lab for evening theory, and 2:00-5:30 evening lab for morning theory
  if ((tEvening && isCoreMorningLab(l.SLOT)) || (tMorning && isCoreEveningLab(l.SLOT))) {
    score += 2000;
  }
  // Priority 2: 11:40-1:20 morning lab for morning theory, and 5:30-7:20 evening lab for evening theory
  else if ((tMorning && isLateMorningLab(l.SLOT)) || (tEvening && isLateEveningLab(l.SLOT))) {
    score += 1000;
  }
  // Priority 3 (Current Priority 1 fallback): general cross-shift / above-30 & below-30
  // (e.g. evening theory with late morning lab, morning theory with late evening lab / mixed)
  else if ((tEvening && isBelow30Only) || (tMorning && isAbove30Only)) {
    score += 500;
  } else if (hasBelow30 && hasAbove30) {
    score += 200;
  }
  // Priority 4: strongly penalize same-shift pairings outside the permitted late-window slots
  else {
    score -= 1000;
  }

  // Penalize clustering theory and lab on the same day in the same half-day
  for (const tp of tPeriods) {
    for (const lp of lPeriods) {
      if (tp.day === lp.day) {
        const tpMorning = tp.startMin < MORNING_BEFORE_MIN;
        const lpMorning = lp.startMin < MORNING_BEFORE_MIN;
        if (tpMorning === lpMorning) {
          score -= 30;
        }
      }
    }
  }

  // If class numbers / IDs are available, reward proximity (sections registered together)
  if (t.CLASS_ID && l.CLASS_ID) {
    const tNum = parseInt(t.CLASS_ID.replace(/[^0-9]/g, ""), 10);
    const lNum = parseInt(l.CLASS_ID.replace(/[^0-9]/g, ""), 10);
    if (!isNaN(tNum) && !isNaN(lNum)) {
      const diff = Math.abs(tNum - lNum);
      if (diff <= 2) score += 20;
      else if (diff <= 10) score += 10;
    }
  }

  return score;
};

// Only exported for the tests; callers inside the app go through masterCourses.
export const processParsedCourses = (parsed: ParsedCourse[], manualLinks: ManualLink[] = []): ParsedCourse[] => {
  // 1. Find all codes that end with L or P
  const hasL = new Set<string>();
  const hasP = new Set<string>();
  parsed.forEach(c => {
    const code = c.CODE.trim().toUpperCase();
    if (code.endsWith('L')) {
      hasL.add(code.slice(0, -1));
    } else if (code.endsWith('P')) {
      hasP.add(code.slice(0, -1));
    }
  });

  // 2. Identify mergeable base codes (must have both L and P)
  const mergeableBases = new Set<string>();
  hasL.forEach(base => {
    if (hasP.has(base)) {
      mergeableBases.add(base);
    }
  });

  const mappedParsed = parsed.map(c => {
    let resultCourse = { ...c };
    const code = c.CODE.trim().toUpperCase();
    const base = (code.endsWith('L') || code.endsWith('P')) ? code.slice(0, -1) : code;
    if (mergeableBases.has(base)) {
      resultCourse = {
        ...resultCourse,
        ORIGINAL_CODE: c.CODE, // Keep reference to original code ending in L or P
        CODE: base
      };
    }

    // Attach LINK_ID if matching manual rule
    const linkMatch = manualLinks.find(
      l => l.CODE === c.CODE && l.TYPE === c.TYPE && l.SLOT === c.SLOT && l.FACULTY === c.FACULTY
    );
    if (linkMatch) {
      resultCourse.LINK_ID = linkMatch.LINK_ID;
    }

    return resultCourse;
  });

  // Combine embedded theory and lab
  const combined: ParsedCourse[] = [];
  const byCode = new Map<string, ParsedCourse[]>();
  mappedParsed.forEach(c => {
    if (!byCode.has(c.CODE)) byCode.set(c.CODE, []);
    byCode.get(c.CODE)!.push(c);
  });

  byCode.forEach((coursesList, codeKey) => {
    const isMergedLPBase = mergeableBases.has(codeKey);
    // A blank type is embedded too: the winter report carries no TYPE column at
    // all, so its rows are unlabeled halves, and the pairing below is what
    // infers which theory belongs to which lab.
    const hasEmbedded = isMergedLPBase || coursesList.some(c => {
      const t = c.TYPE.trim().toUpperCase();
      return !t || t === "ETH" || t === "ELA" || t === "EPJ" || t.includes("EMBEDDED");
    });

    if (hasEmbedded) {
      // 1. Cross-faculty manual pairing
      const remainingCourses = [...coursesList];
      
      const manualTheories = remainingCourses.filter(c => {
        const t = c.TYPE.trim().toUpperCase();
        const origCode = (c as any).ORIGINAL_CODE || c.CODE;
        return c.LINK_ID && (t === "ETH" || t === "TH" || origCode.endsWith('L') || (!c.SLOT.startsWith('L') && c.SLOT !== 'NIL'));
      });
      const manualLabs = remainingCourses.filter(c => {
        const t = c.TYPE.trim().toUpperCase();
        const origCode = (c as any).ORIGINAL_CODE || c.CODE;
        return c.LINK_ID && (t === "ELA" || t === "LO" || origCode.endsWith('P') || c.SLOT.startsWith('L'));
      });

      const linkIds = new Set<string>();
      manualTheories.forEach(t => linkIds.add(t.LINK_ID!));
      manualLabs.forEach(l => linkIds.add(l.LINK_ID!));

      linkIds.forEach(id => {
        const tMatches = manualTheories.filter(t => t.LINK_ID === id);
        const lMatches = manualLabs.filter(l => l.LINK_ID === id);

        if (tMatches.length > 0 && lMatches.length > 0) {
          tMatches.forEach(t => {
            lMatches.forEach(l => {
              const tType = t.TYPE.trim().toUpperCase();
              const lType = l.TYPE.trim().toUpperCase();
              const combinedType = tType && lType ? `${tType}+${lType}` : "ETH+ELA";

              let combinedTitle = t.TITLE;
              if ((t as any).ORIGINAL_CODE?.endsWith('L') && (l as any).ORIGINAL_CODE?.endsWith('P')) {
                const typeLabel = (tType === "ETH" || tType.includes("EMBEDDED") || lType === "ELA" || lType.includes("EMBEDDED")) 
                  ? "Embedded Theory and Lab" 
                  : "Theory + Lab";
                combinedTitle = `${t.TITLE} [${typeLabel}]`;
              } else {
                combinedTitle = `${t.TITLE} [Embedded Theory and Lab]`;
              }

              let combinedFac = t.FACULTY;
              if (t.FACULTY !== l.FACULTY) {
                combinedFac = `${t.FACULTY} / ${l.FACULTY}`;
              }

              combined.push({
                ...t,
                TYPE: combinedType,
                TITLE: combinedTitle,
                CREDITS: String((tType.includes("EMBEDDED") && lType.includes("EMBEDDED")) ? 
                                Math.max(parseFloat(t.CREDITS || "0"), parseFloat(l.CREDITS || "0")) : 
                                parseFloat(t.CREDITS || "0") + parseFloat(l.CREDITS || "0")),
                SLOT: `${t.SLOT}+${l.SLOT}`,
                CLASS_IDS: Array.from(new Set([t.CLASS_ID, l.CLASS_ID].filter((id): id is string => Boolean(id)))),
                ROOM: t.ROOM && l.ROOM ? `${t.ROOM} / ${l.ROOM}` : (t.ROOM || l.ROOM),
                ORIGINAL_CODE: (t as any).ORIGINAL_CODE || t.CODE,
                FACULTY: combinedFac
              } as any);
            });
          });

          // Remove all matched theories and labs from remainingCourses
          tMatches.forEach(t => {
            const idx = remainingCourses.indexOf(t);
            if (idx > -1) remainingCourses.splice(idx, 1);
          });
          lMatches.forEach(l => {
            const idx = remainingCourses.indexOf(l);
            if (idx > -1) remainingCourses.splice(idx, 1);
          });
        }
      });

      // 2. Normal processing for the rest
      const byFac = new Map<string, ParsedCourse[]>();
      remainingCourses.forEach(c => {
        // The employee id decides who "the same faculty" is wherever the report
        // has one; without it a name keys the grouping, as it always has.
        const facKey = c.ERP_ID || c.FACULTY;
        if (!byFac.has(facKey)) byFac.set(facKey, []);
        byFac.get(facKey)!.push(c);
      });

      byFac.forEach((facCourses) => {
        // The code-suffix branches describe the L/P lab variant, and only
        // carry meaning where the report labels rows the old way (a typed
        // row, any report before winter) or where the merge above rewrote
        // the code (ORIGINAL_CODE). A lone `P` code with a blank type — the
        // winter report's pooled thesis lists, no `L` sibling anywhere — is
        // otherwise a theory half by slot shape and a lab half by suffix on
        // every row at once, which blows the matching below up into an
        // unbounded search; unlabeled rows stand on their slot shape alone.
        const theorySlots = facCourses.filter(c => {
          const t = c.TYPE.trim().toUpperCase();
          const origCode = (c as any).ORIGINAL_CODE || c.CODE;
          return t === "ETH" || t === "TH" || ((c as any).ORIGINAL_CODE || t) && origCode.endsWith('L') || (!c.SLOT.startsWith('L') && c.SLOT !== 'NIL');
        });
        const labSlots = facCourses.filter(c => {
          const t = c.TYPE.trim().toUpperCase();
          const origCode = (c as any).ORIGINAL_CODE || c.CODE;
          return t === "ELA" || t === "LO" || ((c as any).ORIGINAL_CODE || t) && origCode.endsWith('P') || c.SLOT.startsWith('L');
        });

        if (theorySlots.length > 0 && labSlots.length > 0) {
          let bestMatch: { tIdx: number; lIdx: number }[] = [];
          let bestScore = -Infinity;
          const maxPossible = Math.min(theorySlots.length, labSlots.length);
          let steps = 0;

          const backtrack = (
            tIdx: number,
            currentMatch: { tIdx: number; lIdx: number }[],
            usedLabs: Set<number>,
            currentScore: number
          ) => {
            if (
              currentMatch.length > bestMatch.length ||
              (currentMatch.length === bestMatch.length && currentScore > bestScore)
            ) {
              bestMatch = [...currentMatch];
              bestScore = currentScore;
            }
            if (tIdx >= theorySlots.length) return;
            if (currentMatch.length + (theorySlots.length - tIdx) < bestMatch.length) return;
            const maxRemaining = (maxPossible - currentMatch.length) * 2100;
            if (bestMatch.length === maxPossible && currentScore + maxRemaining <= bestScore) return;
            if (++steps > 20000) return;

            const t = theorySlots[tIdx];

            const candidates = labSlots
              .map((l, j) => ({ l, j, score: computePairScore(t, l) }))
              .filter(({ l, j }) => !usedLabs.has(j) && !isOverlap(t.SLOT, l.SLOT))
              .sort((a, b) => b.score - a.score);

            for (const { j, score } of candidates) {
              usedLabs.add(j);
              currentMatch.push({ tIdx, lIdx: j });
              backtrack(tIdx + 1, currentMatch, usedLabs, currentScore + score);
              currentMatch.pop();
              usedLabs.delete(j);
            }
            
            backtrack(tIdx + 1, currentMatch, usedLabs, currentScore);
          };

          backtrack(0, [], new Set<number>(), 0);

          if (bestMatch.length > 0) {
            const matchedT = new Set(bestMatch.map(m => m.tIdx));
            const matchedL = new Set(bestMatch.map(m => m.lIdx));
            
            bestMatch.forEach(m => {
              const t = theorySlots[m.tIdx];
              const l = labSlots[m.lIdx];
              
              const tType = t.TYPE.trim().toUpperCase();
              const lType = l.TYPE.trim().toUpperCase();
              const combinedType = tType && lType ? `${tType}+${lType}` : "ETH+ELA";

              let combinedTitle = t.TITLE;
              if ((t as any).ORIGINAL_CODE?.endsWith('L') && (l as any).ORIGINAL_CODE?.endsWith('P')) {
                const typeLabel = (tType === "ETH" || tType.includes("EMBEDDED") || lType === "ELA" || lType.includes("EMBEDDED")) 
                  ? "Embedded Theory and Lab" 
                  : "Theory + Lab";
                combinedTitle = `${t.TITLE} [${typeLabel}]`;
              } else {
                combinedTitle = `${t.TITLE} [Embedded Theory and Lab]`;
              }

              combined.push({
                ...t,
                TYPE: combinedType,
                TITLE: combinedTitle,
                CREDITS: String((tType.includes("EMBEDDED") && lType.includes("EMBEDDED")) ? 
                                Math.max(parseFloat(t.CREDITS || "0"), parseFloat(l.CREDITS || "0")) : 
                                parseFloat(t.CREDITS || "0") + parseFloat(l.CREDITS || "0")),
                SLOT: `${t.SLOT}+${l.SLOT}`,
                CLASS_IDS: Array.from(new Set([t.CLASS_ID, l.CLASS_ID].filter((id): id is string => Boolean(id)))),
                ROOM: t.ROOM && l.ROOM ? `${t.ROOM} / ${l.ROOM}` : (t.ROOM || l.ROOM),
                ORIGINAL_CODE: (t as any).ORIGINAL_CODE || t.CODE
              } as any);
            });

            theorySlots.forEach((t, i) => { if (!matchedT.has(i)) combined.push(t); });
            labSlots.forEach((l, i) => { if (!matchedL.has(i)) combined.push(l); });
          } else {
            combined.push(...facCourses);
          }
        } else {
          combined.push(...facCourses);
        }
      });
    } else {
      combined.push(...coursesList);
    }
  });

  return combined;
};

/**
 * Rebuild the planner's selected course list from report rows in a share link.
 * Share payloads carry class IDs, not local LINK_ID settings, so an otherwise
 * unambiguous embedded theory/lab pair from different faculties needs a
 * temporary link before the shared planner grouping pass runs.
 */
export function groupSharedReportCourses(selected: readonly ParsedCourse[]): ParsedCourse[] {
  const prepared = selected.map((course) => ({ ...course }));
  const softSkills = prepared
    .filter((course) => course.CODE.trim().toUpperCase().startsWith("BASTS"))
    .map((course) => ({ ...course, TYPE: "SS" }));
  const regularCourses = prepared.filter(
    (course) => !course.CODE.trim().toUpperCase().startsWith("BASTS")
  );
  const byCode = new Map<string, ParsedCourse[]>();

  for (const course of regularCourses) {
    const code = course.CODE.trim().toUpperCase();
    const rows = byCode.get(code) ?? [];
    rows.push(course);
    byCode.set(code, rows);
  }

  for (const [code, rows] of byCode) {
    const theories = rows.filter((course) => {
      const type = course.TYPE.trim().toUpperCase();
      return type === "ETH" || type === "TH" || (!type && course.SLOT !== "NIL" && !course.SLOT.startsWith("L"));
    });
    const labs = rows.filter((course) => {
      const type = course.TYPE.trim().toUpperCase();
      return type === "ELA" || type === "LO" || (!type && course.SLOT.startsWith("L"));
    });

    if (theories.length !== 1 || labs.length !== 1) continue;
    const [theory] = theories;
    const [lab] = labs;
    if ((theory.ERP_ID || theory.FACULTY) === (lab.ERP_ID || lab.FACULTY)) continue;

    const linkId = `shared:${code}:${theory.CLASS_ID ?? "theory"}:${lab.CLASS_ID ?? "lab"}`;
    theory.LINK_ID = linkId;
    lab.LINK_ID = linkId;
  }

  const grouped = [...processParsedCourses(regularCourses), ...softSkills];
  const selectedOrder = new Map(
    selected.flatMap((course, index) =>
      (course.CLASS_IDS?.length ? course.CLASS_IDS : course.CLASS_ID ? [course.CLASS_ID] : [])
        .map((classId) => [classId, index] as const)
    )
  );
  const orderOf = (course: ParsedCourse) => {
    const classIds = course.CLASS_IDS?.length
      ? course.CLASS_IDS
      : course.CLASS_ID
        ? [course.CLASS_ID]
        : [];
    return Math.min(...classIds.map((classId) => selectedOrder.get(classId) ?? Number.MAX_SAFE_INTEGER));
  };
  return grouped.sort((a, b) => orderOf(a) - orderOf(b));
}

