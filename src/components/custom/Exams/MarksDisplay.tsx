import { useEffect, useState } from "react";
import { Info, Activity } from "lucide-react";
import CircularProgress from "../shared/CircularProgress";
import Image from "next/image";
import { API_BASE } from "../Main";
import { motion } from "framer-motion";
import SubpageLayout from "../shared/SubpageLayout";
import Badge from "../shared/Badge";
import ExpandableSection from "../shared/ExpandableSection";

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
  const theoryTotals = getAssessmentTotals(course.assessments || []);
  if (!labCourse) {
    return Math.round(theoryTotals.weighted * 100) / 100 + "/" + formatNumber(theoryTotals.weightPercent);
  }

  const labTotals = getAssessmentTotals(labCourse.assessments || []);
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

const checkIsRelative = (courseSystem, courseType) => {
    const isACE = courseSystem === "ACE";
    if (isACE) {
        return (courseType === "Embedded Theory" || courseType === "Embedded Lab" || courseType === "Embedded" || courseType === "Theory Only");
    } else {
        return courseType === "Theory Only";
    }
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
  const [allStats, setAllStats] = useState({});

  useEffect(() => {
    if (!data || !data.courses || data.courses.length === 0) return;

    const uniqueCourses = [];
    const codeMap = new Map();
    data.courses.forEach(c => {
      const isLab = c.courseType.toLowerCase().includes("lab") || c.slot?.toLowerCase().startsWith("l");
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

    const fetchStats = async () => {
      try {
        const classIds = uniqueCourses.map(g => (g.theory || g.lab).classNbr).join(',');
        if (!classIds) return;

        const res = await fetch(`${API_BASE}/api/marks/stats?classes=${classIds}`);
        if (res.ok) {
          const statsData = await res.json();
          setAllStats(statsData);
        } else {
          console.error("Failed to fetch marks stats:", res.status, res.statusText);
        }
      } catch (error) {
        console.error("Fetch stats error:", error);
      }
    };

    fetchStats();
  }, [data]);

  if (!data || !data.courses || data.courses.length === 0) {
    return (
      <div className="p-2">
        <h1 className="text-xl md:text-3xl font-bold mb-4 text-center md:text-left text-gray-900  dark:text-gray-100">
          Academic Marks
        </h1>
        <Image src="/images/chepu/chepu_says_sup.png" alt="No Data" width={300} height={300} className="mx-auto" />
      </div>
    );
  }

  const uniqueCourses = [];
  const codeMap = new Map();
  data.courses.forEach(c => {
    const isLab = c.courseType.toLowerCase().includes("lab") || c.slot?.toLowerCase().startsWith("l");
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
    return <MarksSubpage group={selectedGroup} allStats={allStats} onBack={() => setOpenCourseId(null)} />;
  }

  return (
    <motion.div 
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="p-2"
    >
      <h1 className="text-xl md:text-3xl font-bold mb-4 text-center md:text-left text-gray-900  dark:text-gray-100">
        Academic Marks
      </h1>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {uniqueCourses.map((group, idx) => {
          const mainCourse = group.theory || group.lab;
          const courseType = (group.theory && group.lab) ? "Embedded" : mainCourse.courseType;
          const isRelative = checkIsRelative(mainCourse.courseSystem, courseType);
          
          const courseTotalString = getCourseTotal(group.theory || group.lab, group.theory ? group.lab : null);
          const courseStats = getCourseStats(group);
          
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

          let predictedGrade = "?";
          if (isRelative) {
              const statInfo = allStats[mainCourse.classNbr]?.overall;
              if (statInfo && statInfo.count > 0 && courseStats.projected > 0) {
                const mean = statInfo.mean;
                const sd = statInfo.sd;
                const proj = courseStats.projected;
                if (proj >= Math.min(Math.max(mean + 1.5 * sd, 80), 100)) predictedGrade = "S";
                else if (proj >= mean + 0.5 * sd) predictedGrade = "A";
                else if (proj >= mean - 0.5 * sd) predictedGrade = "B";
                else if (proj >= mean - 1.0 * sd) predictedGrade = "C";
                else if (proj >= mean - 1.5 * sd) predictedGrade = "D";
                else if (proj >= Math.min(mean - 2.0 * sd, 50)) predictedGrade = "E";
                else predictedGrade = "F";
              }
          } else {
              // Absolute Grading Prediction
              const proj = courseStats.projected;
              if (proj >= 90) predictedGrade = "S";
              else if (proj >= 80) predictedGrade = "A";
              else if (proj >= 70) predictedGrade = "B";
              else if (proj >= 60) predictedGrade = "C";
              else if (proj >= 50) predictedGrade = "D";
              else if (proj >= 40) predictedGrade = "E";
              else predictedGrade = "F";
          }

          return (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.05 }}
              key={group.courseCode}
              className="p-4 rounded-2xl shadow-sm bg-white  dark:bg-black border border-gray-100  dark:border-gray-800 cursor-pointer hover:shadow-md hover:-translate-y-0.5 transition-all"
              onClick={() => setOpenCourseId(group.courseCode)}
            >
              <div className="flex justify-between items-start gap-4">
                <div className="flex flex-col items-start min-w-0 flex-1">
                  <span className="font-bold text-gray-900  dark:text-gray-100 text-sm sm:text-base break-words line-clamp-2 leading-tight">
                    {group.courseCode} <br className="hidden md:block" />
                    <span className="font-medium text-gray-600  dark:text-gray-400">{group.courseTitle}</span>
                  </span>

                  <div className="flex gap-2 items-center mt-3">
                    <Badge variant="default" className="rounded-md uppercase font-bold tracking-wider">
                      {courseType}
                    </Badge>
                    {predictedGrade !== "?" && (
                      <Badge variant="default" className="rounded-md font-bold bg-indigo-50  dark:bg-indigo-900/30 text-indigo-700  dark:text-indigo-300 uppercase tracking-wider">
                        Pred: {predictedGrade}
                      </Badge>
                    )}
                  </div>
                </div>

                <div className="w-16 h-16 sm:w-20 sm:h-20 flex-shrink-0 flex flex-col items-center justify-center">
                  <CircularProgress
                    value={percent}
                    text={text}
                    size={80}
                    threshold={25}
                    midThreshold={75}
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

function AssessmentCard({ detail, typeLabel, aStat, isRelative }) {
  const shortenedTitle = formatTitle(detail.title);
  const asmPct = detail.maxMark > 0 ? (getNumericValue(detail.scoredMark) / getNumericValue(detail.maxMark)) * 100 : 0;
  
  let gradePlacement = "?";
  let gradeBounds = [];

  if (isRelative) {
      if (aStat && aStat.count > 0) {
          const sB = Math.min(Math.max(aStat.mean + 1.5 * aStat.sd, 80), 100);
          const aB = aStat.mean + 0.5 * aStat.sd;
          const bB = aStat.mean - 0.5 * aStat.sd;
          const cB = aStat.mean - 1.0 * aStat.sd;
          const dB = aStat.mean - 1.5 * aStat.sd;
          const eB = Math.min(aStat.mean - 2.0 * aStat.sd, 50);

          if (asmPct >= sB) gradePlacement = "S";
          else if (asmPct >= aB) gradePlacement = "A";
          else if (asmPct >= bB) gradePlacement = "B";
          else if (asmPct >= cB) gradePlacement = "C";
          else if (asmPct >= dB) gradePlacement = "D";
          else if (asmPct >= eB) gradePlacement = "E";
          else gradePlacement = "F";

          gradeBounds = [
            { grade: 'S', range: `>= ${sBoundaryCalc(sB, detail.maxMark)}`, color: 'text-emerald-600  dark:text-emerald-400 bg-emerald-50  dark:bg-emerald-900/20' },
            { grade: 'A', range: `>= ${sBoundaryCalc(aB, detail.maxMark)}`, color: 'text-green-600  dark:text-green-400 bg-green-50  dark:bg-green-900/20' },
            { grade: 'B', range: `>= ${sBoundaryCalc(bB, detail.maxMark)}`, color: 'text-blue-600  dark:text-blue-400 bg-blue-50  dark:bg-blue-900/20' },
            { grade: 'C', range: `>= ${sBoundaryCalc(cB, detail.maxMark)}`, color: 'text-indigo-600  dark:text-indigo-400 bg-indigo-50  dark:bg-indigo-900/20' },
          ];
      }
  } else {
      // Absolute
      if (asmPct >= 90) gradePlacement = "S";
      else if (asmPct >= 80) gradePlacement = "A";
      else if (asmPct >= 70) gradePlacement = "B";
      else if (asmPct >= 60) gradePlacement = "C";
      else if (asmPct >= 50) gradePlacement = "D";
      else if (asmPct >= 40) gradePlacement = "E";
      else gradePlacement = "F";

      gradeBounds = [
        { grade: 'S', range: `>= ${sBoundaryCalc(90, detail.maxMark)}`, color: 'text-emerald-600  dark:text-emerald-400 bg-emerald-50  dark:bg-emerald-900/20' },
        { grade: 'A', range: `>= ${sBoundaryCalc(80, detail.maxMark)}`, color: 'text-green-600  dark:text-green-400 bg-green-50  dark:bg-green-900/20' },
        { grade: 'B', range: `>= ${sBoundaryCalc(70, detail.maxMark)}`, color: 'text-blue-600  dark:text-blue-400 bg-blue-50  dark:bg-blue-900/20' },
        { grade: 'C', range: `>= ${sBoundaryCalc(60, detail.maxMark)}`, color: 'text-indigo-600  dark:text-indigo-400 bg-indigo-50  dark:bg-indigo-900/20' },
      ];
  }

  function sBoundaryCalc(boundPct, maxMark) {
    const rawMark = (boundPct / 100) * maxMark;
    return rawMark.toFixed(1);
  }

  return (
    <ExpandableSection
      title={shortenedTitle}
      badge={
        <div className="text-right">
          <p className="text-xl font-black text-gray-800  dark:text-gray-100">
            {formatNumber(detail.scoredMark)} <span className="text-sm text-gray-400 font-semibold">/ {formatNumber(detail.maxMark)}</span>
          </p>
          <p className={`text-xs mt-1 font-semibold ${typeLabel === 'Theory' ? 'text-blue-600  dark:text-blue-400' : 'text-emerald-600  dark:text-emerald-400'}`}>
            Wtg: {formatNumber(detail.weightageMark)} / {formatNumber(detail.weightagePercent)}%
          </p>
        </div>
      }
      className="bg-gray-50  dark:bg-slate-800/50 rounded-xl border border-gray-100  dark:border-gray-800 overflow-hidden"
      headerClassName="text-xs text-gray-500  dark:text-gray-400 font-bold uppercase tracking-wider"
      contentClassName="border-t border-gray-200  dark:border-gray-800 bg-white  dark:bg-black"
    >
            {(isRelative && (!aStat || aStat.count === 0)) ? (
              <p className="text-sm text-gray-500  dark:text-gray-400 italic text-center py-2">
                Not enough data to calculate class statistics for this assessment yet.
              </p>
            ) : (
              <div className="space-y-4">
                {isRelative && aStat && (
                    <div className="flex justify-between items-center text-sm">
                      <div>
                        <p className="text-gray-500  dark:text-gray-400 text-xs uppercase font-bold tracking-wider">Class Avg</p>
                        <p className="font-bold text-gray-900  dark:text-gray-100">{sBoundaryCalc(aStat.mean, detail.maxMark)} <span className="text-xs font-normal text-gray-500">({formatNumber(aStat.mean)}%)</span></p>
                      </div>
                      <div className="text-right">
                        <p className="text-gray-500  dark:text-gray-400 text-xs uppercase font-bold tracking-wider">Std Dev</p>
                        <p className="font-bold text-gray-900  dark:text-gray-100">±{sBoundaryCalc(aStat.sd, detail.maxMark)}</p>
                      </div>
                    </div>
                )}

                <div>
                  <p className="text-gray-500  dark:text-gray-400 text-[10px] uppercase font-bold tracking-wider mb-2">
                    {isRelative ? "Grade Placement Preview" : "Absolute Grade Range Preview"}
                  </p>
                  <div className="flex gap-2">
                    {gradeBounds.map(b => (
                      <div key={b.grade} className={`flex-1 rounded-md p-1.5 flex flex-col items-center justify-center border border-transparent ${b.grade === gradePlacement ? 'ring-2 ring-indigo-500' : ''} ${b.color}`}>
                        <span className="font-black text-sm">{b.grade}</span>
                        <span className="text-[10px] font-bold">{b.range}</span>
                      </div>
                    ))}
                  </div>
                  {gradePlacement !== "?" && (
                    <p className="text-center text-xs mt-3 text-indigo-600  dark:text-indigo-400 font-bold">
                      Hypothetical Placement: Grade {gradePlacement}
                    </p>
                  )}
                </div>
              </div>
            )}
    </ExpandableSection>
  );
}

function MarksSubpage({ group, allStats, onBack }) {
  const [targetGrade, setTargetGrade] = useState("A");
  const mainCourse = group.theory || group.lab;

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const courseTotalString = getCourseTotal(group.theory || group.lab, group.theory ? group.lab : null);
  const courseType = (group.theory && group.lab) ? "Embedded" : mainCourse.courseType;
  const courseStats = getCourseStats(group);
  
  const isRelative = checkIsRelative(mainCourse.courseSystem, courseType);

  const stats = allStats[mainCourse.classNbr]?.overall;
  const asmStats = allStats[mainCourse.classNbr]?.assessments || {};
  const dataPoints = stats ? (stats.count ?? 0) : 0;
  
  const renderAssessmentTable = (assessments, typeLabel, icon) => {
    if (!assessments || assessments.length === 0) return null;
    const totals = getAssessmentTotals(assessments);

    return (
      <div className="bg-white  dark:bg-black border border-gray-100  dark:border-gray-800 rounded-2xl p-5 shadow-sm mt-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between mb-4 gap-2">
          <h3 className="text-lg font-bold text-gray-900  dark:text-gray-100 flex items-center gap-2">
            {icon} {typeLabel} Assessments
          </h3>
          <div className="flex items-center justify-between md:justify-end gap-3">
            <Badge variant={typeLabel === 'Theory' ? 'info' : 'success'} className="font-bold border rounded-full">
              {formatNumber(totals.weighted)} / {formatNumber(totals.weightPercent)}
            </Badge>
            <div className={`md:hidden font-bold text-sm ${typeLabel === 'Theory' ? 'text-blue-600  dark:text-blue-400' : 'text-emerald-600  dark:text-emerald-400'}`}>
              {totals.weightPercent > 0 ? Math.round((totals.weighted / totals.weightPercent) * 100) : 0}%
            </div>
          </div>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {assessments.map((detail, idx) => {
            const aStat = asmStats[detail.title];
            return <AssessmentCard key={idx} detail={detail} typeLabel={typeLabel} aStat={aStat} isRelative={isRelative} />;
          })}
        </div>
        <div className="mt-4 pt-3 border-t border-gray-100  dark:border-gray-800 flex justify-end">
          <p className="text-sm font-semibold text-gray-700  dark:text-gray-300">
            Max Possible Score: <span className="font-bold text-gray-900  dark:text-gray-100">{formatNumber(100 - (totals.weightPercent - totals.weighted))}</span>
          </p>
        </div>
      </div>
    );
  };

  return (
    <motion.div 
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 20 }}
      className="p-2 space-y-6 max-w-5xl mx-auto"
    >
      <SubpageLayout title={group.courseCode} subtitle={group.courseTitle} onBack={onBack}>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mt-6">
        <div className="bg-white  dark:bg-black border border-gray-100  dark:border-gray-800 rounded-2xl p-4 shadow-sm text-center">
          <p className="text-[10px] text-gray-500 uppercase font-bold tracking-wider mb-1">Course Type</p>
          <p className="text-sm font-semibold text-gray-900  dark:text-gray-100 line-clamp-1">{courseType}</p>
        </div>
        <div className="bg-white  dark:bg-black border border-gray-100  dark:border-gray-800 rounded-2xl p-4 shadow-sm text-center">
          <p className="text-[10px] text-gray-500 uppercase font-bold tracking-wider mb-1">Total Score</p>
          <p className="text-sm font-bold text-blue-600  dark:text-blue-400">{courseTotalString}</p>
        </div>
        <div className="bg-white  dark:bg-black border border-gray-100  dark:border-gray-800 rounded-2xl p-4 shadow-sm text-center">
          <p className="text-[10px] text-gray-500 uppercase font-bold tracking-wider mb-1">Projected %</p>
          <p className="text-sm font-bold text-indigo-600  dark:text-indigo-400">{courseStats.projected}%</p>
        </div>
        <div className="bg-white  dark:bg-black border border-gray-100  dark:border-gray-800 rounded-2xl p-4 shadow-sm text-center">
          <p className="text-[10px] text-gray-500 uppercase font-bold tracking-wider mb-1">Max Grade Achievable</p>
          <p className="text-sm font-bold text-orange-600  dark:text-orange-400">{formatNumber(courseStats.maxPossible)}%</p>
        </div>
        <div className="bg-white  dark:bg-black border border-gray-100  dark:border-gray-800 rounded-2xl p-4 shadow-sm text-center">
          <p className="text-[10px] text-gray-500 uppercase font-bold tracking-wider mb-1">Grading Mode</p>
          <p className={`text-sm font-bold ${isRelative ? 'text-indigo-600  dark:text-indigo-400' : 'text-emerald-600  dark:text-emerald-400'}`}>
              {isRelative ? "Relative" : "Absolute"}
          </p>
        </div>
        <div className="bg-white  dark:bg-black border border-gray-100  dark:border-gray-800 rounded-2xl p-4 shadow-sm text-center">
          <p className="text-[10px] text-gray-500 uppercase font-bold tracking-wider mb-1">Slot</p>
          <p className="text-sm font-medium text-gray-900  dark:text-gray-100">{mainCourse.slot}</p>
        </div>
      </div>

      {renderAssessmentTable(group.theory?.assessments, "Theory", <Activity className="w-5 h-5 text-blue-500" />)}
      {renderAssessmentTable(group.lab?.assessments, "Lab", <Activity className="w-5 h-5 text-emerald-500" />)}

      <div className="bg-white  dark:bg-black border border-gray-100  dark:border-gray-800 rounded-2xl overflow-hidden shadow-sm mt-6">
        <div className="p-5 border-b border-gray-100  dark:border-gray-800">
          <h3 className="text-lg font-bold text-gray-900  dark:text-gray-100 flex items-center gap-2">
            Grade Insights <Badge variant="info" className="bg-blue-100 text-blue-700   dark:bg-blue-900/30 dark:text-blue-400 font-bold">BETA</Badge>
          </h3>
          
          <details className="text-xs text-gray-500  dark:text-gray-400 mt-2 leading-relaxed cursor-pointer group">
            <summary className="font-semibold text-indigo-600  dark:text-indigo-400 hover:underline list-none inline-flex items-center gap-1">
              <Info size={14} /> How this works & why it is safe
            </summary>
            <div className="mt-3 p-4 bg-gray-50  dark:bg-slate-800 rounded-lg border border-gray-200  dark:border-gray-700 space-y-2">
              <p>
                <strong>Proof of Concept:</strong> To calculate an accurate class curve, we need to know the class average and standard deviation. 
                This requires aggregating the marks of all students in the class. It is mathematically impossible to do this securely strictly on your local device, 
                because your device needs access to the rest of the class's performance to determine your relative rank.
              </p>
              <p>
                <strong>Privacy First:</strong> When you download fresh marks from VTOP, your client securely transmits only the changes (using a scrambled, anonymous hash of your ID to prevent duplicate updates). The server strictly processes the numbers in-memory using Welford's Algorithm, updates the class-wide statistics, and then
                <strong> immediately discards</strong> your individual marks. We do not store your exact marks in any database.
              </p>
            </div>
          </details>
          
          {(isRelative && dataPoints > 0 && dataPoints < 30) && (
            <p className="text-xs text-red-500 font-medium mt-2">
              Warning: Low data samples ({dataPoints}). Relative predictions may not be fully accurate until more peers sync their marks.
            </p>
          )}
        </div>
        
        <div className="p-5 bg-gray-50/50  dark:bg-black/50">
          {isRelative ? (
              <div className="flex flex-wrap gap-4 mb-6 text-sm">
                <div className="flex-1 bg-white  dark:bg-gray-900 border border-gray-200  dark:border-gray-800 rounded-lg p-3 text-center">
                  <p className="text-[10px] text-gray-500  dark:text-gray-400 uppercase font-bold">Samples</p>
                  <p className="font-bold text-gray-900  dark:text-gray-100">{dataPoints}</p>
                </div>
                <div className="flex-1 bg-white  dark:bg-gray-900 border border-gray-200  dark:border-gray-800 rounded-lg p-3 text-center">
                  <p className="text-[10px] text-gray-500  dark:text-gray-400 uppercase font-bold">Mean</p>
                  <p className="font-bold text-gray-900  dark:text-gray-100">{stats ? formatNumber(stats.mean) : "N/A"}</p>
                </div>
                <div className="flex-1 bg-white  dark:bg-gray-900 border border-gray-200  dark:border-gray-800 rounded-lg p-3 text-center">
                  <p className="text-[10px] text-gray-500  dark:text-gray-400 uppercase font-bold">Std Dev</p>
                  <p className="font-bold text-gray-900  dark:text-gray-100">{stats ? formatNumber(stats.sd) : "N/A"}</p>
                </div>
              </div>
          ) : (
              <div className="mb-6 p-4 rounded-xl bg-emerald-50  dark:bg-emerald-900/20 border border-emerald-200  dark:border-emerald-800/50 flex flex-col md:flex-row items-center gap-4 text-emerald-800  dark:text-emerald-400">
                  <div className="p-3 bg-white  dark:bg-emerald-950 rounded-full shadow-sm">
                      <Activity size={24} className="text-emerald-500" />
                  </div>
                  <div>
                      <h4 className="font-bold">Absolute Grading Enforced</h4>
                      <p className="text-sm mt-1 opacity-90">This course uses an absolute grading system. Your grade is based purely on predefined percentage boundaries, irrespective of class performance.</p>
                  </div>
              </div>
          )}

          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-2">
            {(() => {
              const mean = isRelative ? (stats?.mean || 0) : 0;
              const sd = isRelative ? (stats?.sd || 0) : 0;

              let sBoundary, aLower, bLower, cLower, dLower, eLower;

              if (isRelative && stats) {
                  sBoundary = Math.min(Math.max(Math.round(mean + 1.5 * sd), 80), 100);
                  aLower = Math.round(mean + 0.5 * sd);
                  bLower = Math.round(mean - 0.5 * sd);
                  cLower = Math.round(mean - 1.0 * sd);
                  dLower = Math.round(mean - 1.5 * sd);
                  eLower = Math.min(Math.round(mean - 2.0 * sd), 50);
              } else {
                  sBoundary = 90;
                  aLower = 80;
                  bLower = 70;
                  cLower = 60;
                  dLower = 50;
                  eLower = 40;
              }

              const boundaries = [
                { grade: 'S', limit: sBoundary, color: 'bg-emerald-50 text-emerald-700 border-emerald-200    dark:bg-emerald-900/20 dark:text-emerald-400 dark:border-emerald-800/50', range: `>= ${sBoundary.toFixed(0)}` },
                { grade: 'A', limit: aLower, color: 'bg-green-50 text-green-700 border-green-200    dark:bg-green-900/20 dark:text-green-400 dark:border-green-800/50', range: `>= ${aLower.toFixed(0)}` },
                { grade: 'B', limit: bLower, color: 'bg-blue-50 text-blue-700 border-blue-200    dark:bg-blue-900/20 dark:text-blue-400 dark:border-blue-800/50', range: `>= ${bLower.toFixed(0)}` },
                { grade: 'C', limit: cLower, color: 'bg-indigo-50 text-indigo-700 border-indigo-200    dark:bg-indigo-900/20 dark:text-indigo-400 dark:border-indigo-800/50', range: `>= ${cLower.toFixed(0)}` },
                { grade: 'D', limit: dLower, color: 'bg-purple-50 text-purple-700 border-purple-200    dark:bg-purple-900/20 dark:text-purple-400 dark:border-purple-800/50', range: `>= ${dLower.toFixed(0)}` },
                { grade: 'E', limit: eLower, color: 'bg-orange-50 text-orange-700 border-orange-200    dark:bg-orange-900/20 dark:text-orange-400 dark:border-orange-800/50', range: `>= ${eLower.toFixed(0)}` },
                { grade: 'F', limit: 0, color: 'bg-red-50 text-red-700 border-red-200    dark:bg-red-900/20 dark:text-red-400 dark:border-red-800/50', range: `< ${eLower.toFixed(0)}` },
              ];
              
              const targetBoundary = boundaries.find(b => b.grade === targetGrade)?.limit || 0;
              
              let theoryScored = 0, theoryPercent = 0;
              let labScored = 0, labPercent = 0;
              
              if (group.theory) {
                  const t = getAssessmentTotals(group.theory.assessments || []);
                  theoryScored = t.weighted;
                  theoryPercent = t.weightPercent;
              }
              if (group.lab) {
                  const t = getAssessmentTotals(group.lab.assessments || []);
                  labScored = t.weighted;
                  labPercent = t.weightPercent;
              }
              
              const theoryCredits = group.theory ? getCourseCredits(group.theory) : 0;
              const labCredits = group.lab ? getCourseCredits(group.lab) : 0;
              const totalCredits = theoryCredits + labCredits;
              
              const currentWeightedScore = totalCredits > 0 ? ((theoryCredits * theoryScored) + (labCredits * labScored)) / totalCredits : theoryScored;
              const currentWeightPercent = totalCredits > 0 ? ((theoryCredits * theoryPercent) + (labCredits * labPercent)) / totalCredits : theoryPercent;

              const remainingWeightagePoints = targetBoundary - currentWeightedScore;

              return (
                <>
                  {boundaries.map((b, i) => (
                    <div key={i} className={`rounded-xl border p-3 flex flex-col items-center justify-center ${b.color} ${(isRelative && !stats) ? 'opacity-50 grayscale' : ''}`}>
                      <span className="text-xl font-black mb-1">{b.grade}</span>
                      <span className="text-[10px] font-bold tracking-wider">{b.range}</span>
                    </div>
                  ))}
                  <div className="col-span-full mt-4 bg-white  dark:bg-slate-800 border border-gray-200  dark:border-gray-700 rounded-xl p-4 flex flex-col md:flex-row gap-4 items-center justify-between">
                      <div>
                          <h4 className="font-bold text-gray-900  dark:text-gray-100">Target Grade Calculator</h4>
                          <p className="text-xs text-gray-500  dark:text-gray-400 mt-1">See how many weightage points you need for your goal.</p>
                      </div>
                      <div className="flex items-center gap-3">
                          <select 
                              value={targetGrade} 
                              onChange={(e) => setTargetGrade(e.target.value)}
                              className="px-3 py-1.5 rounded-lg border border-gray-300  dark:border-gray-600 bg-gray-50  dark:bg-black text-gray-900  dark:text-gray-100 font-bold"
                          >
                              {['S', 'A', 'B', 'C', 'D', 'E'].map(g => <option key={g} value={g}>Grade {g}</option>)}
                          </select>
                          
                          {remainingWeightagePoints <= 0 ? (
                              <div className="px-4 py-2 bg-emerald-100 text-emerald-800   dark:bg-emerald-900/50 dark:text-emerald-300 font-bold rounded-lg text-sm">
                                  Target Achieved! 🎉
                              </div>
                          ) : remainingWeightagePoints > (100 - currentWeightPercent) ? (
                              <div className="px-4 py-2 bg-red-100 text-red-800   dark:bg-red-900/50 dark:text-red-300 font-bold rounded-lg text-sm">
                                  Impossible to achieve
                              </div>
                          ) : (
                              <div className="px-4 py-2 bg-indigo-100 text-indigo-800   dark:bg-indigo-900/50 dark:text-indigo-300 font-bold rounded-lg text-sm">
                                  Need <span className="text-lg">{remainingWeightagePoints.toFixed(1)}</span> more weightage pts
                              </div>
                          )}
                      </div>
                  </div>
                </>
              );
            })()}
          </div>
        </div>
      </div>
    </SubpageLayout>
    </motion.div>
  );
}