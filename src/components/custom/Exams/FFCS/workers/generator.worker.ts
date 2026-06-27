import { ParsedCourse, AddedCourse } from "../types";
import { calculateTimetableMetrics } from "../logic/metrics";
import { calculatePairwiseSocialScore } from "../logic/socialScoring";

// Polyfill/mock for COLORS used in TT generation
const COLORS = [
  "bg-red-500", "bg-orange-500", "bg-amber-500", "bg-green-500", 
  "bg-emerald-500", "bg-teal-500", "bg-cyan-500", "bg-blue-500", 
  "bg-indigo-500", "bg-violet-500", "bg-purple-500", "bg-fuchsia-500", 
  "bg-pink-500", "bg-rose-500"
];

const generateId = () => crypto.randomUUID();

self.onmessage = async (e: MessageEvent) => {
  const {
    targetCodes,
    optionsPerCourseWithPeriods,
    schema,
    friends,
    socialScoreGroupMethod,
    generatorNoLimit,
    generatorMinHalfDays,
    generatorSortBy
  } = e.data;

  try {
    const results: ParsedCourse[][] = [];
    const MAX_RESULTS = generatorNoLimit ? 999999 : 50;

    const backtrack = (courseIndex: number, currentCombo: ParsedCourse[], currentPeriods: {day: string, startMin: number, endMin: number}[]) => {
      if (results.length >= MAX_RESULTS) return;
      if (courseIndex === targetCodes.length) {
        results.push([...currentCombo]);
        return;
      }

      const options = optionsPerCourseWithPeriods[courseIndex];
      for (const opt of options) {
        let hasConflict = false;
        for (const np of opt.periods) {
          for (const ep of currentPeriods) {
            if (np.day === ep.day && Math.max(np.startMin, ep.startMin) < Math.min(np.endMin, ep.endMin)) {
              hasConflict = true;
              break;
            }
          }
          if (hasConflict) break;
        }

        if (!hasConflict) {
          currentCombo.push(opt);
          backtrack(courseIndex + 1, currentCombo, currentPeriods.concat(opt.periods));
          currentCombo.pop();
        }
      }
    };

    // Run the solver
    backtrack(0, [], []);

    if (results.length === 0) {
      self.postMessage({ type: "error", error: "Could not generate any conflict-free timetables from the selected options." });
      return;
    }

    // Process results
    const newTts = results.map((combo, idx) => {
      const tId = generateId();
      const mappedCourses: AddedCourse[] = combo.map((c, i) => ({
        id: generateId(),
        code: c.CODE,
        title: c.TITLE,
        faculty: c.FACULTY,
        venue: c.ROOM,
        slots: c.SLOT.split('+').map(s => s.trim().toUpperCase()),
        credits: c.CREDITS,
        type: c.TYPE,
        color: COLORS[i % COLORS.length]
      }));
      
      const metrics = calculateTimetableMetrics(mappedCourses, schema);

      let socialScore = 0;
      if (friends && friends.length > 0) {
        if (socialScoreGroupMethod === "cumulative") {
          friends.forEach(f => {
            const fCourses = f.timetables?.[0]?.courses || [];
            if (fCourses.length > 0) {
              socialScore += calculatePairwiseSocialScore(mappedCourses, fCourses, schema).actualScore;
            }
          });
        } else {
          let scoreSum = 0;
          friends.forEach(f => {
            const fCourses = f.timetables?.[0]?.courses || [];
            if (fCourses.length > 0) {
              scoreSum += calculatePairwiseSocialScore(mappedCourses, fCourses, schema).percentage;
            }
          });
          socialScore = Math.round(scoreSum / friends.length);
        }
      }

      return {
        id: tId,
        name: `Generated TT ${idx + 1}`,
        courses: mappedCourses,
        lockedCourses: [],
        metrics: {
          ...metrics,
          socialScore
        }
      };
    });

    const validTts = newTts.filter(tt => tt.metrics.halfDays >= generatorMinHalfDays);
    
    if (validTts.length === 0) {
      self.postMessage({ type: "error", error: `No timetables met the minimum half-days requirement (${generatorMinHalfDays}). Try lowering it.` });
      return;
    }

    // Sort valid timetables
    validTts.sort((a, b) => {
      const am = a.metrics;
      const bm = b.metrics;
      if (generatorSortBy === 'social') return bm.socialScore - am.socialScore;
      if (generatorSortBy === 'halfdays') return bm.halfDays - am.halfDays;
      if (generatorSortBy === 'compactness') return am.gaps - bm.gaps;
      
      const aBalanced = (am.halfDays * 10) + ((20 - am.gaps) * 5) + (am.socialScore);
      const bBalanced = (bm.halfDays * 10) + ((20 - bm.gaps) * 5) + (bm.socialScore);
      return bBalanced - aBalanced;
    });

    self.postMessage({ type: "success", results: validTts });

  } catch (error: any) {
    self.postMessage({ type: "error", error: error.message || "An error occurred during generation." });
  }
};
