import { ParsedCourse, ManualLink } from "../types";

const getPeriodsForSlotOuter = (slot: string, schema: any) => {
  const matchedPeriods: { day: string, startMin: number, endMin: number }[] = [];
  schema.timetable.forEach((day: any) => {
    day.periods.forEach((p: any) => {
      if (p.slots && p.slots.includes(slot)) {
        matchedPeriods.push({ day: day.id, startMin: timeToMinutes(p.start), endMin: timeToMinutes(p.end) });
      }
    });
  });
  return matchedPeriods;
};

const timeToMinutes = (timeStr: string) => {
  if (!timeStr) return 0;
  const [time, period] = timeStr.trim().split(" ");
  let [hours, minutes] = time.split(":").map(Number);
  if (period === "PM" && hours !== 12) hours += 12;
  if (period === "AM" && hours === 12) hours = 0;
  return hours * 60 + minutes;
};

const isOverlap = (theorySlotStr: string, labSlotStr: string, schema: any) => {
  const tSlots = theorySlotStr.split('+').map(s => s.trim().toUpperCase());
  const lSlots = labSlotStr.split('+').map(s => s.trim().toUpperCase());
  
  const tPeriods = tSlots.flatMap(s => getPeriodsForSlotOuter(s, schema));
  const lPeriods = lSlots.flatMap(s => getPeriodsForSlotOuter(s, schema));

  for (const t of tPeriods) {
    for (const l of lPeriods) {
      if (t.day === l.day && Math.max(t.startMin, l.startMin) < Math.min(t.endMin, l.endMin)) {
        return true;
      }
    }
  }
  return false;
};

export const processParsedCourses = (
  parsed: ParsedCourse[], 
  schema: any,
  manualLinks: ManualLink[] = []
): ParsedCourse[] => {
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
    const hasEmbedded = isMergedLPBase || coursesList.some(c => {
      const t = c.TYPE.trim().toUpperCase();
      return t === "ETH" || t === "ELA" || t === "EPJ" || t.includes("EMBEDDED");
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
              const combinedType = `${tType}+${lType}`;

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
                ROOM: `${t.ROOM} / ${l.ROOM}`,
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
        if (!byFac.has(c.FACULTY)) byFac.set(c.FACULTY, []);
        byFac.get(c.FACULTY)!.push(c);
      });

      byFac.forEach((facCourses) => {
        const theorySlots = facCourses.filter(c => {
          const t = c.TYPE.trim().toUpperCase();
          const origCode = (c as any).ORIGINAL_CODE || c.CODE;
          return t === "ETH" || t === "TH" || origCode.endsWith('L') || (!c.SLOT.startsWith('L') && c.SLOT !== 'NIL');
        });
        const labSlots = facCourses.filter(c => {
          const t = c.TYPE.trim().toUpperCase();
          const origCode = (c as any).ORIGINAL_CODE || c.CODE;
          return t === "ELA" || t === "LO" || origCode.endsWith('P') || c.SLOT.startsWith('L');
        });

        if (theorySlots.length > 0 && labSlots.length > 0) {
          let bestMatch: { tIdx: number, lIdx: number }[] = [];

          const backtrack = (tIdx: number, currentMatch: { tIdx: number, lIdx: number }[], usedLabs: Set<number>) => {
            if (currentMatch.length > bestMatch.length) {
              bestMatch = [...currentMatch];
            }
            if (tIdx >= theorySlots.length) return;

            const t = theorySlots[tIdx];

            for (let j = 0; j < labSlots.length; j++) {
              if (usedLabs.has(j)) continue;
              const l = labSlots[j];

              if (!isOverlap(t.SLOT, l.SLOT, schema)) {
                usedLabs.add(j);
                currentMatch.push({ tIdx, lIdx: j });
                backtrack(tIdx + 1, currentMatch, usedLabs);
                currentMatch.pop();
                usedLabs.delete(j);
              }
            }
            
            backtrack(tIdx + 1, currentMatch, usedLabs);
          };

          backtrack(0, [], new Set<number>());

          if (bestMatch.length > 0) {
            const matchedT = new Set(bestMatch.map(m => m.tIdx));
            const matchedL = new Set(bestMatch.map(m => m.lIdx));
            
            bestMatch.forEach(m => {
              const t = theorySlots[m.tIdx];
              const l = labSlots[m.lIdx];
              
              const tType = t.TYPE.trim().toUpperCase();
              const lType = l.TYPE.trim().toUpperCase();
              const combinedType = `${tType}+${lType}`;

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
                ROOM: `${t.ROOM} / ${l.ROOM}`,
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
