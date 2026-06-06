import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { ChevronLeft, Info, Activity } from "lucide-react";
import { CircularProgressbar, buildStyles } from "react-circular-progressbar";
import Image from "next/image";
import { API_BASE } from "../Main";
import { motion, AnimatePresence } from "framer-motion";

const formatNumber = (num) => {
  const numericValue = Number(num);
  if (num == null || isNaN(numericValue)) {
    return "-";
  }
  return Number(numericValue.toFixed(2)).toString();
};

const getNumericValue = (value, fallback = 0) => {
  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue : fallback;
};

const getAssessmentTotals = (assessments) => {
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

const getCourseCredits = (course) => {
  const credits = getNumericValue(course?.credits, -1);
  return credits > 0 ? credits : -1;
};

const getCourseTotal = (course, labCourse) => {
  const theoryTotals = getAssessmentTotals(course.assessments);
  if (!labCourse) {
    return Math.round(theoryTotals.weighted * 100) / 100 + "/" + formatNumber(theoryTotals.weightPercent);
  }

  const labTotals = getAssessmentTotals(labCourse.assessments);
  const theoryCredits = getCourseCredits(course);
  const labCredits = getCourseCredits(labCourse);
  if(theoryCredits < 0 || labCredits < 0) {
    return "Reload Required";
  }
  const creditsTotal = theoryCredits + labCredits;
  const combinedWeightPercent = (theoryCredits * theoryTotals.weightPercent + labCredits * labTotals.weightPercent)/creditsTotal;

  if (combinedWeightPercent <= 0) {
    return theoryTotals.weighted;
  }

  const res = Math.round(((theoryCredits * theoryTotals.weighted) + (labCredits * labTotals.weighted)) / creditsTotal * 100) / 100;

  return res + "/" + combinedWeightPercent;
};

const getCourseStats = (group) => {
  const theoryTotals = getAssessmentTotals(group.theory?.assessments || []);
  const labTotals = getAssessmentTotals(group.lab?.assessments || []);
  
  if (!group.lab) {
    const pointsLost = theoryTotals.weightPercent - theoryTotals.weighted;
    const maxPossible = 100 - pointsLost;
    const projected = theoryTotals.weightPercent > 0 ? Math.round((theoryTotals.weighted / theoryTotals.weightPercent) * 100) : 0;
    return { maxPossible, projected };
  }
  
  if (!group.theory) {
    const pointsLost = labTotals.weightPercent - labTotals.weighted;
    const maxPossible = 100 - pointsLost;
    const projected = labTotals.weightPercent > 0 ? Math.round((labTotals.weighted / labTotals.weightPercent) * 100) : 0;
    return { maxPossible, projected };
  }
  
  const theoryCredits = getCourseCredits(group.theory);
  const labCredits = getCourseCredits(group.lab);
  
  if (theoryCredits < 0 || labCredits < 0) {
    return { maxPossible: 0, projected: 0 };
  }
  
  const creditsTotal = theoryCredits + labCredits;
  const combinedWeighted = (theoryCredits * theoryTotals.weighted + labCredits * labTotals.weighted) / creditsTotal;
  const combinedWeightPercent = (theoryCredits * theoryTotals.weightPercent + labCredits * labTotals.weightPercent) / creditsTotal;
  
  const pointsLost = combinedWeightPercent - combinedWeighted;
  const maxPossible = 100 - pointsLost;
  const projected = combinedWeightPercent > 0 ? Math.round((combinedWeighted / combinedWeightPercent) * 100) : 0;
  
  return { maxPossible, projected };
};

const formatTitle = (title) => {
  if (!title) return "";
  let shortened = title;
  shortened = shortened.replace(/Continuous Assessment Test/gi, 'CAT');
  shortened = shortened.replace(/Final Assessment Test/gi, 'FAT');
  shortened = shortened.replace(/Digital Assignment/gi, 'DA');
  return shortened;
};

export default function MarksDisplay({ data }) {
  const [openCourseId, setOpenCourseId] = useState(null);

  if (!data || !data.courses || data.courses.length === 0) {
    return (
      <div className="p-2">
        <h1 className="text-xl md:text-3xl font-bold mb-4 text-center md:text-left text-gray-900 dark:text-gray-100 midnight:text-gray-100">
          Academic Marks
        </h1>
        <Image src="/chepu/chepu_says_sup.png" alt="No Data" width={300} height={300} className="mx-auto" />
      </div>
    );
  }

  // Group courses by courseCode to combine Embedded Theory and Embedded Lab
  const uniqueCourses = [];
  const codeMap = new Map();
  data.courses.forEach(c => {
    const isLab = c.courseType.toLowerCase().includes("lab");
    if (!codeMap.has(c.courseCode)) {
      codeMap.set(c.courseCode, {
        courseCode: c.courseCode,
        courseTitle: c.courseTitle,
        theory: !isLab ? c : null,
        lab: isLab ? c : null,
      });
    } else {
      const existing = codeMap.get(c.courseCode);
      if (isLab) existing.lab = c;
      else existing.theory = c;
    }
  });
  uniqueCourses.push(...Array.from(codeMap.values()));

  if (openCourseId) {
    const selectedGroup = uniqueCourses.find(c => c.courseCode === openCourseId);
    return <MarksSubpage group={selectedGroup} onBack={() => setOpenCourseId(null)} />;
  }

  return (
    <motion.div 
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="p-2"
    >
      <h1 className="text-xl md:text-3xl font-bold mb-4 text-center md:text-left text-gray-900 dark:text-gray-100 midnight:text-gray-100">
        Academic Marks
      </h1>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {uniqueCourses.map((group, idx) => {
          const courseType = (group.theory && group.lab) ? "Embedded" : (group.theory ? group.theory.courseType : group.lab.courseType);
          const courseTotalString = getCourseTotal(group.theory || group.lab, group.theory ? group.lab : null);
          
          let percent = 0;
          let text = "0/0";
          if (courseTotalString === "Reload Required") {
            text = "N/A";
          } else if (typeof courseTotalString === "string" && courseTotalString.includes("/")) {
             const [w, wp] = courseTotalString.split("/");
             if (Number(wp) > 0) percent = (Number(w) / Number(wp)) * 100;
             text = `${formatNumber(w)}/${formatNumber(wp)}`;
          } else {
             text = String(courseTotalString);
          }

          return (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.05 }}
              key={group.courseCode}
              className="p-4 rounded-2xl shadow-sm bg-white dark:bg-slate-900 midnight:bg-black border border-gray-100 dark:border-gray-800 midnight:border-gray-800 cursor-pointer hover:shadow-md hover:-translate-y-0.5 transition-all"
              onClick={() => setOpenCourseId(group.courseCode)}
            >
              <div className="flex justify-between items-start gap-4">
                <div className="flex flex-col items-start min-w-0 flex-1">
                  <span className="font-bold text-gray-900 dark:text-gray-100 midnight:text-gray-100 text-sm sm:text-base break-words line-clamp-2 leading-tight">
                    {group.courseCode} <br className="hidden md:block" />
                    <span className="font-medium text-gray-600 dark:text-gray-400 midnight:text-gray-400">{group.courseTitle}</span>
                  </span>

                  <div className="px-2.5 py-1 flex items-center justify-center bg-gray-100 dark:bg-slate-800 midnight:bg-gray-900 text-gray-700 dark:text-gray-300 midnight:text-gray-300 text-[10px] uppercase font-bold tracking-wider rounded-md mt-3">
                    {courseType}
                  </div>
                </div>

                <div className="w-16 h-16 sm:w-20 sm:h-20 flex-shrink-0 flex flex-col items-center justify-center">
                  <CircularProgressbar
                    value={percent}
                    text={text}
                    styles={buildStyles({
                      pathColor: percent > 75 ? "#10b981" : percent > 50 ? "#3b82f6" : percent > 25 ? "#f59e0b" : "#ef4444",
                      textColor: "currentColor",
                      trailColor: "transparent",
                      strokeLinecap: "round",
                      textSize: "18px",
                      pathTransitionDuration: 0.5,
                    })}
                    className="text-gray-800 dark:text-gray-200 midnight:text-gray-200 drop-shadow-sm"
                  />
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>
    </motion.div>
  );
}

function MarksSubpage({ group, onBack }) {
  const [stats, setStats] = useState(null);
  const mainCourse = group.theory || group.lab;

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
    const fetchStats = async () => {
      try {
        const response = await fetch(`${API_BASE}/api/attendance/marks?classId=${mainCourse.classNbr}`);
        const data = await response.json();
        if(response.ok) {
          setStats(data);
        }
      } catch (error) {
        console.error("Error fetching class statistics:", error);
      }
    };
    fetchStats();
  }, [mainCourse.classNbr]);

  const courseTotalString = getCourseTotal(group.theory || group.lab, group.theory ? group.lab : null);
  const dataPoints = stats ? (stats.dataPoints ?? stats.count ?? 0) : 0;
  
  const courseType = (group.theory && group.lab) ? "Embedded" : (group.theory ? group.theory.courseType : group.lab.courseType);
  const courseStats = getCourseStats(group);

  return (
    <motion.div 
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 20 }}
      className="p-2 space-y-6 max-w-5xl mx-auto"
    >
      <div className="flex items-center gap-3">
        <Button 
          variant="ghost" 
          size="icon" 
          onClick={onBack}
          className="rounded-full hover:bg-gray-200 dark:hover:bg-slate-800 midnight:hover:bg-gray-900"
        >
          <ChevronLeft className="w-6 h-6" />
        </Button>
        <div>
          <h1 className="text-xl md:text-3xl font-bold text-gray-900 dark:text-gray-100 midnight:text-gray-100 leading-tight">
            {group.courseCode}
          </h1>
          <p className="text-sm md:text-base font-medium text-gray-600 dark:text-gray-400 midnight:text-gray-400">
            {group.courseTitle}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="bg-white dark:bg-slate-900 midnight:bg-black border border-gray-100 dark:border-gray-800 midnight:border-gray-800 rounded-2xl p-4 shadow-sm text-center">
          <p className="text-[10px] text-gray-500 uppercase font-bold tracking-wider mb-1">Course Type</p>
          <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 midnight:text-gray-100 line-clamp-1">{courseType}</p>
        </div>
        <div className="bg-white dark:bg-slate-900 midnight:bg-black border border-gray-100 dark:border-gray-800 midnight:border-gray-800 rounded-2xl p-4 shadow-sm text-center">
          <p className="text-[10px] text-gray-500 uppercase font-bold tracking-wider mb-1">Total Score</p>
          <p className="text-sm font-bold text-blue-600 dark:text-blue-400">{courseTotalString}</p>
        </div>
        <div className="bg-white dark:bg-slate-900 midnight:bg-black border border-gray-100 dark:border-gray-800 midnight:border-gray-800 rounded-2xl p-4 shadow-sm text-center">
          <p className="text-[10px] text-gray-500 uppercase font-bold tracking-wider mb-1">Projected %</p>
          <p className="text-sm font-bold text-indigo-600 dark:text-indigo-400">{courseStats.projected}%</p>
        </div>
        <div className="bg-white dark:bg-slate-900 midnight:bg-black border border-gray-100 dark:border-gray-800 midnight:border-gray-800 rounded-2xl p-4 shadow-sm text-center">
          <p className="text-[10px] text-gray-500 uppercase font-bold tracking-wider mb-1">Max Possible</p>
          <p className="text-sm font-bold text-orange-600 dark:text-orange-400">{formatNumber(courseStats.maxPossible)}</p>
        </div>
        <div className="bg-white dark:bg-slate-900 midnight:bg-black border border-gray-100 dark:border-gray-800 midnight:border-gray-800 rounded-2xl p-4 shadow-sm text-center">
          <p className="text-[10px] text-gray-500 uppercase font-bold tracking-wider mb-1">Faculty</p>
          <p className="text-sm font-medium text-gray-900 dark:text-gray-100 midnight:text-gray-100 line-clamp-1">{mainCourse.faculty}</p>
        </div>
        <div className="bg-white dark:bg-slate-900 midnight:bg-black border border-gray-100 dark:border-gray-800 midnight:border-gray-800 rounded-2xl p-4 shadow-sm text-center">
          <p className="text-[10px] text-gray-500 uppercase font-bold tracking-wider mb-1">Slot</p>
          <p className="text-sm font-medium text-gray-900 dark:text-gray-100 midnight:text-gray-100">{mainCourse.slot}</p>
        </div>
      </div>

      <div className="space-y-6">
        {group.theory && (
          <div className="bg-white dark:bg-slate-900 midnight:bg-black border border-gray-100 dark:border-gray-800 midnight:border-gray-800 rounded-2xl p-5 shadow-sm">
            <div className="flex flex-col md:flex-row md:items-center justify-between mb-4 gap-2">
              <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 midnight:text-gray-100 flex items-center gap-2">
                <Activity className="w-5 h-5 text-blue-500" /> Theory Assessments
              </h3>
              <div className="flex items-center justify-between md:justify-end gap-3">
                <div className="px-3 py-1 bg-blue-50 dark:bg-blue-900/30 midnight:bg-blue-900/20 text-blue-700 dark:text-blue-400 font-bold text-sm rounded-full border border-blue-200 dark:border-blue-800/50">
                  {formatNumber(getAssessmentTotals(group.theory.assessments || []).weighted)} / {formatNumber(getAssessmentTotals(group.theory.assessments || []).weightPercent)}
                </div>
                <div className="md:hidden font-bold text-sm text-blue-600 dark:text-blue-400">
                  {getAssessmentTotals(group.theory.assessments || []).weightPercent > 0 ? Math.round((getAssessmentTotals(group.theory.assessments || []).weighted / getAssessmentTotals(group.theory.assessments || []).weightPercent) * 100) : 0}%
                </div>
              </div>
            </div>
            {group.theory.assessments && group.theory.assessments.length > 0 ? (
              <>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {group.theory.assessments.map((detail, idx) => {
                    const shortenedTitle = formatTitle(detail.title);
                    return (
                      <div key={idx} className="bg-gray-50 dark:bg-slate-800/50 midnight:bg-slate-800/50 rounded-xl p-3 text-center border border-gray-100 dark:border-gray-700 midnight:border-gray-800 flex flex-col justify-between h-full">
                        <p className="text-[10px] text-gray-500 dark:text-gray-400 midnight:text-gray-400 font-bold uppercase tracking-wider mb-2 line-clamp-2 leading-tight">
                          {shortenedTitle}
                        </p>
                        <div>
                          <p className="text-lg font-black text-gray-800 dark:text-gray-200 midnight:text-gray-100">
                            {formatNumber(detail.scoredMark)} <span className="text-xs text-gray-400 font-semibold">/ {formatNumber(detail.maxMark)}</span>
                          </p>
                          <p className="text-[10px] text-blue-600 dark:text-blue-400 midnight:text-blue-400 mt-1 font-semibold">
                            Wtg: {formatNumber(detail.weightageMark)} / {formatNumber(detail.weightagePercent)}%
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div className="mt-4 pt-3 border-t border-gray-100 dark:border-gray-800 midnight:border-gray-800 flex justify-end">
                  <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 midnight:text-gray-300">
                    Max Possible Score: <span className="font-bold text-gray-900 dark:text-gray-100 midnight:text-gray-100">{formatNumber(100 - (getAssessmentTotals(group.theory.assessments).weightPercent - getAssessmentTotals(group.theory.assessments).weighted))}</span>
                  </p>
                </div>
              </>
            ) : (
              <p className="text-sm text-gray-500 dark:text-gray-400 midnight:text-gray-500 italic text-center py-4">No theory assessments uploaded yet.</p>
            )}
          </div>
        )}

        {group.lab && (
          <div className="bg-white dark:bg-slate-900 midnight:bg-black border border-gray-100 dark:border-gray-800 midnight:border-gray-800 rounded-2xl p-5 shadow-sm">
            <div className="flex flex-col md:flex-row md:items-center justify-between mb-4 gap-2">
              <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 midnight:text-gray-100 flex items-center gap-2">
                <Activity className="w-5 h-5 text-emerald-500" /> Lab Assessments
              </h3>
              <div className="flex items-center justify-between md:justify-end gap-3">
                <div className="px-3 py-1 bg-emerald-50 dark:bg-emerald-900/30 midnight:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 font-bold text-sm rounded-full border border-emerald-200 dark:border-emerald-800/50">
                  {formatNumber(getAssessmentTotals(group.lab.assessments || []).weighted)} / {formatNumber(getAssessmentTotals(group.lab.assessments || []).weightPercent)}
                </div>
                <div className="md:hidden font-bold text-sm text-emerald-600 dark:text-emerald-400">
                  {getAssessmentTotals(group.lab.assessments || []).weightPercent > 0 ? Math.round((getAssessmentTotals(group.lab.assessments || []).weighted / getAssessmentTotals(group.lab.assessments || []).weightPercent) * 100) : 0}%
                </div>
              </div>
            </div>
            {group.lab.assessments && group.lab.assessments.length > 0 ? (
              <>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {group.lab.assessments.map((detail, idx) => {
                    const shortenedTitle = formatTitle(detail.title);
                    return (
                      <div key={idx} className="bg-gray-50 dark:bg-slate-800/50 midnight:bg-slate-800/50 rounded-xl p-3 text-center border border-gray-100 dark:border-gray-700 midnight:border-gray-800 flex flex-col justify-between h-full">
                        <p className="text-[10px] text-gray-500 dark:text-gray-400 midnight:text-gray-400 font-bold uppercase tracking-wider mb-2 line-clamp-2 leading-tight">
                          {shortenedTitle}
                        </p>
                        <div>
                          <p className="text-lg font-black text-gray-800 dark:text-gray-200 midnight:text-gray-100">
                            {formatNumber(detail.scoredMark)} <span className="text-xs text-gray-400 font-semibold">/ {formatNumber(detail.maxMark)}</span>
                          </p>
                          <p className="text-[10px] text-emerald-600 dark:text-emerald-400 midnight:text-emerald-400 mt-1 font-semibold">
                            Wtg: {formatNumber(detail.weightageMark)} / {formatNumber(detail.weightagePercent)}%
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div className="mt-4 pt-3 border-t border-gray-100 dark:border-gray-800 midnight:border-gray-800 flex justify-end">
                  <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 midnight:text-gray-300">
                    Max Possible Score: <span className="font-bold text-gray-900 dark:text-gray-100 midnight:text-gray-100">{formatNumber(100 - (getAssessmentTotals(group.lab.assessments).weightPercent - getAssessmentTotals(group.lab.assessments).weighted))}</span>
                  </p>
                </div>
              </>
            ) : (
              <p className="text-sm text-gray-500 dark:text-gray-400 midnight:text-gray-500 italic text-center py-4">No lab assessments uploaded yet.</p>
            )}
          </div>
        )}
      </div>

      {/* Grade Insights */}
      {stats && (
        <div className="bg-white dark:bg-slate-900 midnight:bg-black border border-gray-100 dark:border-gray-800 midnight:border-gray-800 rounded-2xl overflow-hidden shadow-sm mt-6">
          <div className="p-5 border-b border-gray-100 dark:border-gray-800 midnight:border-gray-800">
            <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 midnight:text-gray-100 flex items-center gap-2">
              Grade Insights <span className="text-[10px] bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 px-2 py-0.5 rounded-full font-bold">BETA</span>
            </h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 midnight:text-gray-400 mt-2 leading-relaxed">
              Based on anonymous class statistics. <span className={dataPoints > 0 && dataPoints < 30 ? 'text-red-500 font-medium' : ''}>
                {dataPoints > 0 && dataPoints < 30 ? `Warning: Low data samples (${dataPoints}). ` : ''}
              </span>
              Predictions may not be fully accurate.
            </p>
          </div>
          
          <div className="p-5 bg-gray-50/50 dark:bg-slate-900/50 midnight:bg-black/50">
            <div className="flex flex-wrap gap-4 mb-6 text-sm">
              <div className="flex-1 bg-white dark:bg-slate-800 midnight:bg-gray-900 border border-gray-200 dark:border-gray-700 midnight:border-gray-800 rounded-lg p-3 text-center">
                <p className="text-[10px] text-gray-500 dark:text-gray-400 midnight:text-gray-400 uppercase font-bold">Samples</p>
                <p className="font-bold text-gray-900 dark:text-gray-100">{dataPoints}</p>
              </div>
              <div className="flex-1 bg-white dark:bg-slate-800 midnight:bg-gray-900 border border-gray-200 dark:border-gray-700 midnight:border-gray-800 rounded-lg p-3 text-center">
                <p className="text-[10px] text-gray-500 dark:text-gray-400 midnight:text-gray-400 uppercase font-bold">Mean</p>
                <p className="font-bold text-gray-900 dark:text-gray-100">{formatNumber(stats.mean)}</p>
              </div>
              <div className="flex-1 bg-white dark:bg-slate-800 midnight:bg-gray-900 border border-gray-200 dark:border-gray-700 midnight:border-gray-800 rounded-lg p-3 text-center">
                <p className="text-[10px] text-gray-500 dark:text-gray-400 midnight:text-gray-400 uppercase font-bold">Std Dev</p>
                <p className="font-bold text-gray-900 dark:text-gray-100">{formatNumber(stats.sd)}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-2">
              {(() => {
                const mean = stats.mean || 0;
                const sd = stats.sd || 0;

                const sBoundary = Math.min(Math.max(Math.round(mean + 1.5 * sd), 80), 100);
                const aLower = Math.round(mean + 0.5 * sd);
                const bLower = Math.round(mean - 0.5 * sd);
                const cLower = Math.round(mean - 1.0 * sd);
                const dLower = Math.round(mean - 1.5 * sd);
                const eLower = Math.min(Math.round(mean - 2.0 * sd), 50);

                const boundaries = [
                  { grade: 'S', color: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-400 dark:border-emerald-800/50 midnight:bg-emerald-900/20 midnight:text-emerald-400', range: `>= ${sBoundary.toFixed(0)}` },
                  { grade: 'A', color: 'bg-green-50 text-green-700 border-green-200 dark:bg-green-900/20 dark:text-green-400 dark:border-green-800/50 midnight:bg-green-900/20 midnight:text-green-400', range: `>= ${aLower.toFixed(0)}` },
                  { grade: 'B', color: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/20 dark:text-blue-400 dark:border-blue-800/50 midnight:bg-blue-900/20 midnight:text-blue-400', range: `>= ${bLower.toFixed(0)}` },
                  { grade: 'C', color: 'bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-900/20 dark:text-indigo-400 dark:border-indigo-800/50 midnight:bg-indigo-900/20 midnight:text-indigo-400', range: `>= ${cLower.toFixed(0)}` },
                  { grade: 'D', color: 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-900/20 dark:text-purple-400 dark:border-purple-800/50 midnight:bg-purple-900/20 midnight:text-purple-400', range: `>= ${dLower.toFixed(0)}` },
                  { grade: 'E', color: 'bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-900/20 dark:text-orange-400 dark:border-orange-800/50 midnight:bg-orange-900/20 midnight:text-orange-400', range: `>= ${eLower.toFixed(0)}` },
                  { grade: 'F', color: 'bg-red-50 text-red-700 border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800/50 midnight:bg-red-900/20 midnight:text-red-400', range: `< ${eLower.toFixed(0)}` },
                ];

                return boundaries.map((b, i) => (
                  <div key={i} className={`rounded-xl border p-3 flex flex-col items-center justify-center ${b.color}`}>
                    <span className="text-xl font-black mb-1">{b.grade}</span>
                    <span className="text-[10px] font-bold tracking-wider">{b.range}</span>
                  </div>
                ));
              })()}
            </div>
          </div>
        </div>
      )}
    </motion.div>
  );
}