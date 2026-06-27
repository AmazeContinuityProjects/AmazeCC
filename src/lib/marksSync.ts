import { API_BASE } from "@/components/custom/Main";
const getNumericValue = (value: any, fallback = 0) => {
  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue : fallback;
};

const getAssessmentTotals = (assessments: any[]) => {
  return assessments.reduce(
    (acc, asm) => {
      acc.max += getNumericValue(asm.maxMark);
      acc.scored += getNumericValue(asm.scoredMark);
      acc.weightPercent += getNumericValue(asm.weightagePercent);
      acc.weighted += getNumericValue(asm.weightageMark);
      return acc;
    },
    { max: 0, scored: 0, weightPercent: 0, weighted: 0 }
  );
};

const getCourseCredits = (course: any) => {
  const credits = getNumericValue(course?.credits, -1);
  return credits > 0 ? credits : -1;
};

const getCourseStats = (group: any) => {
  const theoryTotals = getAssessmentTotals(group.theory?.assessments || []);
  const labTotals = getAssessmentTotals(group.lab?.assessments || []);
  
  if (!group.lab) {
    const projected = theoryTotals.weightPercent > 0 ? Math.round((theoryTotals.weighted / theoryTotals.weightPercent) * 100) : 0;
    return { projected };
  }
  
  if (!group.theory) {
    const projected = labTotals.weightPercent > 0 ? Math.round((labTotals.weighted / labTotals.weightPercent) * 100) : 0;
    return { projected };
  }
  
  const theoryCredits = getCourseCredits(group.theory);
  const labCredits = getCourseCredits(group.lab);
  
  if (theoryCredits < 0 || labCredits < 0) {
    return { projected: 0 };
  }
  
  const creditsTotal = theoryCredits + labCredits;
  const combinedWeighted = (theoryCredits * theoryTotals.weighted + labCredits * labTotals.weighted) / creditsTotal;
  const combinedWeightPercent = (theoryCredits * theoryTotals.weightPercent + labCredits * labTotals.weightPercent) / creditsTotal;
  
  const projected = combinedWeightPercent > 0 ? Math.round((combinedWeighted / combinedWeightPercent) * 100) : 0;
  
  return { projected };
};

const hashString = async (str: string) => {
    const encoder = new TextEncoder();
    const data = encoder.encode(str);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
};

export const syncMarksDiff = async (oldMarksData: any, newMarksData: any, username: string) => {
    if (!username || !newMarksData?.courses) return;

    try {
        const hasSyncedBefore = localStorage.getItem("hasSyncedMarksV2");
        if (!hasSyncedBefore) {
            oldMarksData = {};
        }

        const buildMap = (marksData: any) => {
            const map = new Map();
            if (!marksData || !marksData.courses) return map;
            marksData.courses.forEach((c: any) => {
                const isLab = c.courseType.toLowerCase().includes("lab") || c.slot?.toLowerCase().startsWith("l");
                if (!map.has(c.courseCode)) {
                    map.set(c.courseCode, {
                        courseCode: c.courseCode,
                        theory: !isLab ? c : null,
                        lab: isLab ? c : null,
                    });
                } else {
                    const existing = map.get(c.courseCode);
                    if (isLab) existing.lab = c;
                    else existing.theory = c;
                }
            });
            return map;
        };

        const oldMap = buildMap(oldMarksData);
        const newMap = buildMap(newMarksData);
        const actions: any[] = [];

        newMap.forEach((newGroup, courseCode) => {
            const oldGroup = oldMap.get(courseCode) || {};
            const mainCourse = newGroup.theory || newGroup.lab;
            const classId = mainCourse.classNbr;

            const oldStats = oldGroup.theory || oldGroup.lab ? getCourseStats(oldGroup) : { projected: undefined };
            const newStats = getCourseStats(newGroup);

            if (newStats.projected > 0) {
                if (oldStats.projected === undefined || oldStats.projected === 0) {
                    actions.push({ type: 'add', classId, assessmentTitle: 'OVERALL', mark: newStats.projected });
                } else if (oldStats.projected !== newStats.projected) {
                    actions.push({ type: 'update', classId, assessmentTitle: 'OVERALL', oldMark: oldStats.projected, mark: newStats.projected });
                }
            }

            const checkAssessments = (oldAsms: any[] = [], newAsms: any[] = []) => {
                const oldAsmMap = new Map(oldAsms.map(a => [a.title, a]));
                newAsms.forEach(newAsm => {
                    const newPct = newAsm.maxMark > 0 ? (getNumericValue(newAsm.scoredMark) / getNumericValue(newAsm.maxMark)) * 100 : 0;
                    if (newPct > 0) {
                        const oldAsm = oldAsmMap.get(newAsm.title);
                        if (!oldAsm) {
                            actions.push({ type: 'add', classId, assessmentTitle: newAsm.title, mark: newPct });
                        } else {
                            const oldPct = oldAsm.maxMark > 0 ? (getNumericValue(oldAsm.scoredMark) / getNumericValue(oldAsm.maxMark)) * 100 : 0;
                            if (oldPct !== newPct) {
                                actions.push({ type: 'update', classId, assessmentTitle: newAsm.title, oldMark: oldPct, mark: newPct });
                            }
                        }
                    }
                });
            };

            checkAssessments(oldGroup.theory?.assessments, newGroup.theory?.assessments);
            checkAssessments(oldGroup.lab?.assessments, newGroup.lab?.assessments);
        });

        if (actions.length > 0) {
            const userHash = await hashString(username);
            const res = await fetch(`${API_BASE}/api/marks/sync`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    actions,
                    userHash,
                    timestamp: Date.now()
                })
            });
            if (res.ok) {
                localStorage.setItem("hasSyncedMarksV2", "true");
            }
        } else if (!hasSyncedBefore) {
            // Even if actions is 0 (somehow no courses), mark as synced so we don't keep trying
            localStorage.setItem("hasSyncedMarksV2", "true");
        }
    } catch (e) {
        console.error("Error during background sync:", e);
    }
};
