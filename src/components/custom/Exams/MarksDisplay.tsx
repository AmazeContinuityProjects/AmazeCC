"use client";

import { useEffect, useState } from "react";
import { Info, Activity, GraduationCap, AlertTriangle } from "lucide-react";
import CircularProgress from "../shared/CircularProgress";
import Image from "next/image";
import { API_BASE } from "../Main";
import { motion } from "framer-motion";
import SubpageLayout from "../shared/SubpageLayout";
import PageHeader from "../shared/PageHeader";
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

const PREDICTED_BADGE_CLASSES: Record<string, string> = {
  S: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400 border-emerald-500/10',
  A: 'bg-green-50 text-green-700 dark:bg-green-950/30 dark:text-green-400 border-green-500/10',
  B: 'bg-blue-50 text-blue-700 dark:bg-blue-950/30 dark:text-blue-400 border-blue-500/10',
  C: 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950/30 dark:text-indigo-400 border-indigo-500/10',
  D: 'bg-purple-50 text-purple-700 dark:bg-purple-950/30 dark:text-purple-400 border-purple-500/10',
  E: 'bg-orange-50 text-orange-700 dark:bg-orange-950/30 dark:text-orange-400 border-orange-500/10',
  F: 'bg-red-50 text-red-700 dark:bg-red-950/30 dark:text-red-400 border-red-500/10'
};

const HOVER_BORDER_CLASSES: Record<string, string> = {
  S: 'hover:border-emerald-500/35 dark:hover:border-emerald-500/40',
  A: 'hover:border-green-500/35 dark:hover:border-green-500/40',
  B: 'hover:border-blue-500/35 dark:hover:border-blue-500/40',
  C: 'hover:border-indigo-500/35 dark:hover:border-indigo-500/40',
  D: 'hover:border-purple-500/35 dark:hover:border-purple-500/40',
  E: 'hover:border-orange-500/35 dark:hover:border-orange-500/40',
  F: 'hover:border-red-500/35 dark:hover:border-red-500/40'
};

export default function MarksDisplay({ data }) {
  const [openCourseId, setOpenCourseId] = useState<string | null>(null);
  const [allStats, setAllStats] = useState({});

  useEffect(() => {
    if (!data || !data.courses || data.courses.length === 0) return;

    const uniqueCourses: any[] = [];
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
      <div className="p-4 sm:p-6 max-w-7xl mx-auto">
        <PageHeader
          icon={<GraduationCap className="w-5 h-5 text-indigo-500" />}
          title="Academic Marks"
          meta={<Badge variant="default" className="rounded-xl border border-zinc-200/50 font-semibold dark:border-zinc-800/80 bg-zinc-55/20 text-zinc-650 dark:text-zinc-300">Marks OS</Badge>}
        />
        <div className="mt-8 flex flex-col items-center justify-center text-center">
          <Image src="/images/chepu/chepu_says_sup.png" alt="No Data Available" width={220} height={220} className="mb-4 opacity-80" />
          <h3 className="text-sm font-black text-zinc-700 dark:text-zinc-300">No marks record found</h3>
          <p className="text-xs text-zinc-400 dark:text-zinc-500 mt-1 max-w-xs">Reload grades from the home tab to synchronize your marks data.</p>
        </div>
      </div>
    );
  }

  const uniqueCourses: any[] = [];
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
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 10 }}
      className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6"
    >
      <PageHeader
        icon={<GraduationCap className="w-5 h-5 text-indigo-500" />}
        title="Academic Marks"
        meta={<Badge variant="default" className="rounded-xl border border-zinc-200/50 font-semibold dark:border-zinc-800/80 bg-zinc-55/20 text-zinc-650 dark:text-zinc-300">Marks OS</Badge>}
      />

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
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.04 }}
              key={group.courseCode}
              className={`p-5 rounded-3xl shadow-2xs border border-zinc-200/60 bg-gradient-to-br from-white to-zinc-55/20 dark:border-zinc-800/80 dark:bg-gradient-to-br dark:from-zinc-900/60 dark:to-zinc-950/40 cursor-pointer transition-all duration-300 hover:shadow-xs active:scale-[0.99] group ${HOVER_BORDER_CLASSES[predictedGrade] || 'hover:border-zinc-350 dark:hover:border-zinc-700'}`}
              onClick={() => setOpenCourseId(group.courseCode)}
            >
              <div className="flex justify-between items-start gap-4">
                <div className="flex flex-col items-start min-w-0 flex-1">
                  <span className="font-black text-zinc-800 dark:text-zinc-100 text-xs sm:text-sm tracking-wide leading-tight group-hover:text-indigo-500 transition-colors">
                    {group.courseCode}
                  </span>
                  <span className="font-bold text-[10px] sm:text-xs text-zinc-400 dark:text-zinc-500 mt-1 line-clamp-2 pr-1 leading-normal">
                    {group.courseTitle}
                  </span>

                  <div className="flex gap-2 items-center mt-4">
                    <Badge variant="default" className="rounded-lg uppercase font-bold tracking-wider text-[9px] bg-zinc-100 text-zinc-700 dark:bg-zinc-850 dark:text-zinc-300 border-zinc-200/30">
                      {courseType}
                    </Badge>
                    {predictedGrade !== "?" && (
                      <Badge variant="default" className={`rounded-lg font-bold uppercase tracking-wider text-[9px] border ${PREDICTED_BADGE_CLASSES[predictedGrade] || 'bg-indigo-50 text-indigo-700'}`}>
                        Pred: {predictedGrade}
                      </Badge>
                    )}
                  </div>
                </div>

                <div className="w-16 h-16 sm:w-18 sm:h-18 flex-shrink-0 flex flex-col items-center justify-center">
                  <CircularProgress
                    value={percent}
                    text={text}
                    size={72}
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
  let gradeBounds: any[] = [];

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
        { grade: 'S', range: `>= ${sBoundaryCalc(sB, detail.maxMark)}`, color: 'text-emerald-600 dark:text-emerald-400 bg-emerald-50/70 dark:bg-emerald-950/20 border-emerald-500/10' },
        { grade: 'A', range: `>= ${sBoundaryCalc(aB, detail.maxMark)}`, color: 'text-green-600 dark:text-green-400 bg-green-50/70 dark:bg-green-950/20 border-green-500/10' },
        { grade: 'B', range: `>= ${sBoundaryCalc(bB, detail.maxMark)}`, color: 'text-blue-600 dark:text-blue-400 bg-blue-50/70 dark:bg-blue-950/20 border-blue-500/10' },
        { grade: 'C', range: `>= ${sBoundaryCalc(cB, detail.maxMark)}`, color: 'text-indigo-600 dark:text-indigo-400 bg-indigo-50/70 dark:bg-indigo-950/20 border-indigo-500/10' },
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
      { grade: 'S', range: `>= ${sBoundaryCalc(90, detail.maxMark)}`, color: 'text-emerald-600 dark:text-emerald-400 bg-emerald-50/70 dark:bg-emerald-950/20 border-emerald-500/10' },
      { grade: 'A', range: `>= ${sBoundaryCalc(80, detail.maxMark)}`, color: 'text-green-600 dark:text-green-400 bg-green-50/70 dark:bg-green-950/20 border-green-500/10' },
      { grade: 'B', range: `>= ${sBoundaryCalc(70, detail.maxMark)}`, color: 'text-blue-600 dark:text-blue-400 bg-blue-50/70 dark:bg-blue-950/20 border-blue-500/10' },
      { grade: 'C', range: `>= ${sBoundaryCalc(60, detail.maxMark)}`, color: 'text-indigo-600 dark:text-indigo-400 bg-indigo-50/70 dark:bg-indigo-950/20 border-indigo-500/10' },
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
        <div className="text-right flex flex-col justify-center">
          <p className="text-base font-black text-zinc-800 dark:text-zinc-100">
            {formatNumber(detail.scoredMark)} <span className="text-xs text-zinc-400 font-bold">/ {formatNumber(detail.maxMark)}</span>
          </p>
          <p className={`text-[10px] mt-1 font-bold ${typeLabel === 'Theory' ? 'text-indigo-500' : 'text-emerald-500'}`}>
            Wtg: {formatNumber(detail.weightageMark)} / {formatNumber(detail.weightagePercent)}%
          </p>
        </div>
      }
      className="bg-zinc-55/30 dark:bg-zinc-950/10 rounded-2xl border border-zinc-200/50 dark:border-zinc-800/80 overflow-hidden shadow-3xs"
      headerClassName="text-[10px] text-zinc-400 dark:text-zinc-500 font-black uppercase tracking-wider p-4"
      contentClassName="border-t border-zinc-150 dark:border-zinc-850 bg-white dark:bg-black/20 p-4.5"
    >
      {(isRelative && (!aStat || aStat.count === 0)) ? (
        <p className="text-xs text-zinc-400 dark:text-zinc-500 italic text-center py-2">
          Not enough class sync data to preview statistics yet.
        </p>
      ) : (
        <div className="space-y-4">
          {isRelative && aStat && (
            <div className="flex justify-between items-center text-xs">
              <div>
                <p className="text-zinc-400 dark:text-zinc-500 text-[10px] uppercase font-black tracking-widest leading-none mb-1">Class Avg</p>
                <p className="font-extrabold text-zinc-800 dark:text-zinc-250">{sBoundaryCalc(aStat.mean, detail.maxMark)} <span className="text-[10px] font-normal text-zinc-400">({formatNumber(aStat.mean)}%)</span></p>
              </div>
              <div className="text-right">
                <p className="text-zinc-400 dark:text-zinc-500 text-[10px] uppercase font-black tracking-widest leading-none mb-1">Std Dev</p>
                <p className="font-extrabold text-zinc-800 dark:text-zinc-250">±{sBoundaryCalc(aStat.sd, detail.maxMark)}</p>
              </div>
            </div>
          )}

          <div className="border-t border-zinc-150/80 dark:border-zinc-900 pt-3">
            <p className="text-zinc-400 dark:text-zinc-500 text-[9px] uppercase font-black tracking-widest mb-2 leading-none">
              {isRelative ? "Grade Placement Preview" : "Absolute Grade Range Preview"}
            </p>
            <div className="grid grid-cols-4 gap-1.5">
              {gradeBounds.map(b => (
                <div key={b.grade} className={`rounded-xl p-2 flex flex-col items-center justify-center border border-transparent transition-all ${b.grade === gradePlacement ? 'ring-2 ring-indigo-500 shadow-2xs font-extrabold' : 'opacity-85'} ${b.color}`}>
                  <span className="font-black text-xs">{b.grade}</span>
                  <span className="text-[9px] font-extrabold mt-0.5">{b.range}</span>
                </div>
              ))}
            </div>
            {gradePlacement !== "?" && (
              <p className="text-center text-[10px] mt-3.5 text-indigo-500 dark:text-indigo-400 font-extrabold leading-none">
                Hypothetical Component Placement: Grade {gradePlacement}
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
      <div className="bg-gradient-to-br from-white to-zinc-55/20 dark:border-zinc-800/80 dark:bg-gradient-to-br dark:from-zinc-900/60 dark:to-zinc-950/40 border border-zinc-200/50 rounded-3xl p-5 shadow-2xs mt-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between mb-4 gap-2.5">
          <h3 className="text-sm font-black text-zinc-800 dark:text-zinc-150 flex items-center gap-2">
            {icon} {typeLabel} Assessments
          </h3>
          <div className="flex items-center justify-between md:justify-end gap-3">
            <Badge variant={typeLabel === 'Theory' ? 'info' : 'success'} className="font-black border rounded-full px-2.5 py-0.5 text-[10px]">
              {formatNumber(totals.weighted)} / {formatNumber(totals.weightPercent)}
            </Badge>
            <div className={`md:hidden font-black text-xs ${typeLabel === 'Theory' ? 'text-indigo-500' : 'text-emerald-500'}`}>
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
        <div className="mt-4 pt-3.5 border-t border-zinc-150 dark:border-zinc-850 flex justify-end">
          <p className="text-xs font-black text-zinc-500 dark:text-zinc-400">
            Total Points Lost: <span className="font-extrabold text-red-500">{(totals.weightPercent - totals.weighted).toFixed(2)}</span> · Max Possible Score: <span className="font-black text-zinc-800 dark:text-zinc-150">{formatNumber(100 - (totals.weightPercent - totals.weighted))}</span>
          </p>
        </div>
      </div>
    );
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="p-4 sm:p-6 space-y-6 max-w-5xl mx-auto"
    >
      <SubpageLayout title={group.courseCode} subtitle={group.courseTitle} onBack={onBack}>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mt-6">
          {[
            ["Course Type", courseType, "text-zinc-800 dark:text-zinc-100"],
            ["Total Score", courseTotalString, "text-indigo-500 dark:text-indigo-400 font-extrabold"],
            ["Projected %", `${courseStats.projected}%`, "text-indigo-500 dark:text-indigo-400 font-extrabold"],
            ["Max Achievable", `${formatNumber(courseStats.maxPossible)}%`, "text-orange-500 dark:text-orange-400 font-extrabold"],
            ["Grading Mode", isRelative ? "Relative" : "Absolute", isRelative ? 'text-indigo-500 dark:text-indigo-400' : 'text-emerald-500 dark:text-emerald-400'],
            ["Slot", mainCourse.slot, "text-zinc-800 dark:text-zinc-100"],
          ].map(([label, value, valueClass]: any) => (
            <div key={label} className="bg-gradient-to-br from-white to-zinc-55/20 dark:border-zinc-800/80 dark:bg-gradient-to-br dark:from-zinc-900/60 dark:to-zinc-950/40 border border-zinc-200/50 rounded-2xl p-4 shadow-3xs text-center flex flex-col justify-center min-w-0">
              <p className="text-[9px] text-zinc-400 dark:text-zinc-550 uppercase font-black tracking-widest mb-1.5 truncate">{label}</p>
              <p className={`text-xs truncate ${valueClass}`}>{value}</p>
            </div>
          ))}
        </div>

        {renderAssessmentTable(group.theory?.assessments, "Theory", <Activity className="w-4 h-4 text-indigo-500" />)}
        {renderAssessmentTable(group.lab?.assessments, "Lab", <Activity className="w-4 h-4 text-emerald-500" />)}

        {/* Grade Insights and Boundaries */}
        <div className="bg-gradient-to-br from-white to-zinc-55/20 dark:border-zinc-800/80 dark:bg-gradient-to-br dark:from-zinc-900/60 dark:to-zinc-950/40 border border-zinc-200/50 rounded-3xl overflow-hidden shadow-2xs mt-6">
          <div className="p-5 border-b border-zinc-150 dark:border-zinc-850 bg-white/40 dark:bg-zinc-900/30">
            <h3 className="text-sm font-black text-zinc-800 dark:text-zinc-100 flex items-center gap-2">
              Grade Distribution Curves <Badge variant="info" className="bg-indigo-50 text-indigo-600 dark:bg-indigo-950/30 dark:text-indigo-400 font-black text-[9px] rounded-md px-1.5 py-0.5">BETA</Badge>
            </h3>
            
            <details className="text-xs text-zinc-400 dark:text-zinc-500 mt-2 leading-relaxed cursor-pointer group">
              <summary className="font-extrabold text-indigo-500 dark:text-indigo-400 hover:underline list-none inline-flex items-center gap-1">
                <Info size={13} /> How class curves are compiled
              </summary>
              <div className="mt-3.5 p-4 bg-zinc-50 dark:bg-zinc-950/40 rounded-2xl border border-zinc-200/50 dark:border-zinc-850 space-y-2.5">
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
              <p className="text-[10px] text-red-500 font-bold mt-2.5 flex items-center gap-1 animate-pulse">
                <AlertTriangle size={12} /> Low data samples ({dataPoints}). Relative predictions may not be fully accurate until more peers sync.
              </p>
            )}
          </div>
          
          <div className="p-5 bg-zinc-55/20 dark:bg-black/30 space-y-5">
            {isRelative ? (
              <div className="flex flex-wrap gap-3 text-xs">
                <div className="flex-1 bg-white/70 dark:bg-zinc-950/40 border border-zinc-200/40 dark:border-zinc-850 rounded-xl p-3.5 text-center min-w-[80px]">
                  <p className="text-[9px] text-zinc-400 dark:text-zinc-550 uppercase font-black tracking-widest leading-none mb-1">Samples</p>
                  <p className="font-black text-sm text-zinc-800 dark:text-zinc-200">{dataPoints}</p>
                </div>
                <div className="flex-1 bg-white/70 dark:bg-zinc-950/40 border border-zinc-200/40 dark:border-zinc-850 rounded-xl p-3.5 text-center min-w-[80px]">
                  <p className="text-[9px] text-zinc-400 dark:text-zinc-550 uppercase font-black tracking-widest leading-none mb-1">Class Mean</p>
                  <p className="font-black text-sm text-zinc-800 dark:text-zinc-200">{stats ? formatNumber(stats.mean) : "N/A"}</p>
                </div>
                <div className="flex-1 bg-white/70 dark:bg-zinc-950/40 border border-zinc-200/40 dark:border-zinc-850 rounded-xl p-3.5 text-center min-w-[80px]">
                  <p className="text-[9px] text-zinc-400 dark:text-zinc-550 uppercase font-black tracking-widest leading-none mb-1">Std Dev (SD)</p>
                  <p className="font-black text-sm text-zinc-800 dark:text-zinc-200">±{stats ? formatNumber(stats.sd) : "N/A"}</p>
                </div>
              </div>
            ) : (
              <div className="p-4 rounded-2xl bg-emerald-500/5 border border-emerald-500/10 flex flex-col sm:flex-row items-center gap-3.5 text-emerald-800 dark:text-emerald-400">
                <div className="p-3 bg-white dark:bg-zinc-900 rounded-xl shadow-3xs shrink-0">
                  <Activity size={20} className="text-emerald-500" />
                </div>
                <div className="min-w-0">
                  <h4 className="font-black text-xs">Absolute Grading System</h4>
                  <p className="text-[10px] mt-1 font-medium text-emerald-600/90 dark:text-emerald-400/80 leading-relaxed">
                    This course utilizes fixed grade boundaries. Grades are assigned based purely on absolute percentage benchmarks, independent of classmate statistics.
                  </p>
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 xs:grid-cols-3 md:grid-cols-4 lg:grid-cols-7 gap-2">
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
                  { grade: 'S', limit: sBoundary, color: 'bg-emerald-50/70 text-emerald-700 border-emerald-500/10 dark:bg-emerald-950/20 dark:text-emerald-400', range: `>= ${sBoundary.toFixed(0)}` },
                  { grade: 'A', limit: aLower, color: 'bg-green-50/70 text-green-700 border-green-500/10 dark:bg-green-950/20 dark:text-green-400', range: `>= ${aLower.toFixed(0)}` },
                  { grade: 'B', limit: bLower, color: 'bg-blue-50/70 text-blue-700 border-blue-500/10 dark:bg-blue-950/20 dark:text-blue-400', range: `>= ${bLower.toFixed(0)}` },
                  { grade: 'C', limit: cLower, color: 'bg-indigo-50/70 text-indigo-700 border-indigo-500/10 dark:bg-indigo-950/20 dark:text-indigo-400', range: `>= ${cLower.toFixed(0)}` },
                  { grade: 'D', limit: dLower, color: 'bg-purple-50/70 text-purple-700 border-purple-500/10 dark:bg-purple-950/20 dark:text-purple-400', range: `>= ${dLower.toFixed(0)}` },
                  { grade: 'E', limit: eLower, color: 'bg-orange-50/70 text-orange-700 border-orange-500/10 dark:bg-orange-950/20 dark:text-orange-400', range: `>= ${eLower.toFixed(0)}` },
                  { grade: 'F', limit: 0, color: 'bg-red-50/70 text-red-700 border-red-500/10 dark:bg-red-950/20 dark:text-red-400', range: `< ${eLower.toFixed(0)}` },
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
                      <div key={i} className={`rounded-xl border p-3 flex flex-col items-center justify-center transition-all ${b.color} ${(isRelative && !stats) ? 'opacity-40 grayscale' : ''}`}>
                        <span className="text-base font-black mb-1">{b.grade}</span>
                        <span className="text-[9px] font-bold tracking-wider">{b.range}</span>
                      </div>
                    ))}
                    
                    <div className="col-span-full mt-4 bg-white/70 dark:bg-zinc-950/30 border border-zinc-200/50 dark:border-zinc-850 rounded-2xl p-4.5 flex flex-col sm:flex-row gap-4 items-center justify-between shadow-3xs">
                      <div>
                        <h4 className="font-black text-xs text-zinc-800 dark:text-zinc-150">Target Grade Calculator</h4>
                        <p className="text-[10px] text-zinc-400 dark:text-zinc-500 mt-0.5">Calculate the required weightage points left to secure your target grade.</p>
                      </div>
                      <div className="flex items-center gap-3.5 w-full sm:w-auto justify-between sm:justify-end">
                        <select 
                          value={targetGrade} 
                          onChange={(e) => setTargetGrade(e.target.value)}
                          className="px-3 py-1.5 rounded-xl border border-zinc-200/60 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-800 dark:text-zinc-200 font-bold text-xs cursor-pointer shadow-3xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
                        >
                          {['S', 'A', 'B', 'C', 'D', 'E'].map(g => <option key={g} value={g}>Grade {g}</option>)}
                        </select>
                        
                        {remainingWeightagePoints <= 0 ? (
                          <div className="px-3.5 py-1.5 bg-emerald-500/10 border border-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-bold rounded-xl text-xs shadow-3xs">
                            Target Secured! 🎉
                          </div>
                        ) : remainingWeightagePoints > (100 - currentWeightPercent) ? (
                          <div className="px-3.5 py-1.5 bg-red-500/10 border border-red-500/10 text-red-500 font-bold rounded-xl text-xs shadow-3xs">
                            Mathematically Impossible
                          </div>
                        ) : (
                          <div className="px-3.5 py-1.5 bg-indigo-500/10 border border-indigo-500/10 text-indigo-500 dark:text-indigo-400 font-bold rounded-xl text-xs shadow-3xs">
                            Need <span className="text-sm font-black">{remainingWeightagePoints.toFixed(1)}</span> more wtg pts
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