"use client";
import ExpandableSection from "../shared/ExpandableSection";

export interface Creds { cookies: string[]; authorizedID: string; csrf: string; }

export const getNumericValue = (value: any, fallback = 0) => {
  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue : fallback;
};

export function formatSemesterName(semId: string): string {
  if (!semId || !semId.toUpperCase().startsWith("CH") || semId.length !== 10) return semId;
  const year1 = semId.substring(2, 6);
  const year2 = semId.substring(6, 8);
  const term = semId.substring(8, 10);
  let termName = "";
  if (term === "01") termName = "Fall";
  else if (term === "05") termName = "Winter";
  else if (term === "07") termName = "Summer";
  else termName = `Term ${term}`;
  return `${termName} ${year1}-${year2}`;
}

export const formatNumber = (num: any) => {
  const numericValue = Number(num);
  if (num == null || isNaN(numericValue)) return "-";
  return Number(numericValue.toFixed(2)).toString();
};

export const isJunkOrEmpty = (val: any) => {
  if (val == null) return true;
  const s = String(val).trim().toLowerCase();
  return (
    s === "" ||
    s === "nil" ||
    s === "null" ||
    s === "undefined" ||
    s === "n/a" ||
    s === "na" ||
    s === "-" ||
    s === "--" ||
    s === "none"
  );
};

export const sanitizeCourseCode = (code: any) => {
  if (isJunkOrEmpty(code)) return "";
  const cleaned = String(code).replace(/\s*\([LPT]\)$/i, "").trim();
  return isJunkOrEmpty(cleaned) ? "" : cleaned;
};

export const sanitizeCourseTitle = (title: any, fallbackCode: string) => {
  if (isJunkOrEmpty(title)) return fallbackCode;
  return String(title).trim();
};

export const getAssessmentTotals = (assessments: any[]) => {
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

export const getCourseCredits = (course: any) => {
  const credits = getNumericValue(course?.credits, -1);
  return credits > 0 ? credits : -1;
};

export const getCourseTotal = (course: any, labCourse: any) => {
  const theoryTotals = getAssessmentTotals(course?.assessments || []);
  if (!labCourse) {
    return Math.round(theoryTotals.weighted * 100) / 100 + "/" + formatNumber(theoryTotals.weightPercent);
  }
  const labTotals = getAssessmentTotals(labCourse?.assessments || []);
  const theoryCredits = getCourseCredits(course);
  const labCredits = getCourseCredits(labCourse);
  if (theoryCredits < 0 || labCredits < 0) return "Reload Required";
  const creditsTotal = theoryCredits + labCredits;
  const combinedWeightPercent = (theoryCredits * theoryTotals.weightPercent + labCredits * labTotals.weightPercent) / creditsTotal;
  if (combinedWeightPercent <= 0) return theoryTotals.weighted;
  const res = Math.round(((theoryCredits * theoryTotals.weighted) + (labCredits * labTotals.weighted)) / creditsTotal * 100) / 100;
  return res + "/" + combinedWeightPercent;
};

export const getCourseStats = (group: any) => {
  const theoryTotals = getAssessmentTotals(group.theory?.assessments || []);
  const labTotals = getAssessmentTotals(group.lab?.assessments || []);
  if (!group.lab) {
    const pointsLost = theoryTotals.weightPercent - theoryTotals.weighted;
    return { maxPossible: 100 - pointsLost, projected: theoryTotals.weightPercent > 0 ? Math.round((theoryTotals.weighted / theoryTotals.weightPercent) * 100) : 0 };
  }
  if (!group.theory) {
    const pointsLost = labTotals.weightPercent - labTotals.weighted;
    return { maxPossible: 100 - pointsLost, projected: labTotals.weightPercent > 0 ? Math.round((labTotals.weighted / labTotals.weightPercent) * 100) : 0 };
  }
  const theoryCredits = getCourseCredits(group.theory);
  const labCredits = getCourseCredits(group.lab);
  if (theoryCredits < 0 || labCredits < 0) return { maxPossible: 0, projected: 0 };
  const creditsTotal = theoryCredits + labCredits;
  const combinedWeighted = (theoryCredits * theoryTotals.weighted + labCredits * labTotals.weighted) / creditsTotal;
  const combinedWeightPercent = (theoryCredits * theoryTotals.weightPercent + labCredits * labTotals.weightPercent) / creditsTotal;
  const pointsLost = combinedWeightPercent - combinedWeighted;
  return { maxPossible: 100 - pointsLost, projected: combinedWeightPercent > 0 ? Math.round((combinedWeighted / combinedWeightPercent) * 100) : 0 };
};

export const checkIsRelative = (courseSystem: string, courseType: string) => {
  const isACE = courseSystem === "ACE";
  if (isACE) return ["Embedded Theory", "Embedded Lab", "Embedded", "Theory Only"].includes(courseType);
  return courseType === "Theory Only";
};

export const formatTitle = (title: string) => {
  if (!title) return "";
  let shortened = title;
  shortened = shortened.replace(/Continuous Assessment Test/gi, 'CAT');
  shortened = shortened.replace(/Final Assessment Test/gi, 'FAT');
  shortened = shortened.replace(/Digital Assignment/gi, 'DA');
  return shortened;
};

export const Card = ({ children, className = "" }: { children: React.ReactNode; className?: string }) => (
  <div className={`solid-card mb-5 ${className}`}>
    {children}
  </div>
);

export const TypeBadge = ({ label }: { label: string }) => {
  const colors: Record<string, string> = {
    "Embedded": "bg-indigo-100 text-indigo-700   dark:bg-indigo-900/30 dark:text-indigo-300",
    "Theory Only": "bg-blue-100 text-blue-700   dark:bg-blue-900/30 dark:text-blue-300",
    "Lab Only": "bg-emerald-100 text-emerald-700   dark:bg-emerald-900/30 dark:text-emerald-300",
    "Embedded Theory": "bg-purple-100 text-purple-700   dark:bg-purple-900/30 dark:text-purple-300",
    "Embedded Lab": "bg-teal-100 text-teal-700   dark:bg-teal-900/30 dark:text-teal-300",
  };
  return (
    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md uppercase tracking-wider ${colors[label] || "bg-gray-100 text-gray-600   dark:bg-gray-800 dark:text-gray-400"}`}>
      {label}
    </span>
  );
};

export function AssessmentCard({ detail, typeLabel, aStat, isRelative }: {
  detail: any; typeLabel: string; aStat: any; isRelative: boolean;
}) {
  const shortenedTitle = formatTitle(detail.title);
  const asmPct = detail.maxMark > 0 ? (getNumericValue(detail.scoredMark) / getNumericValue(detail.maxMark)) * 100 : 0;

  let gradePlacement = "?";
  let gradeBounds: { grade: string; range: string; color: string }[] = [];

  const sBoundaryCalc = (boundPct: number, maxMark: number) => {
    const rawMark = (boundPct / 100) * maxMark;
    return rawMark.toFixed(1);
  };

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

  return (
    <div className="relative overflow-hidden rounded-2xl bg-white/60 dark:bg-black/40 backdrop-blur-xl border border-gray-200/50 dark:border-gray-800/50 shadow-sm transition-all hover:shadow-md">
      <div className={`absolute left-0 top-0 bottom-0 w-1 ${typeLabel === 'Theory' ? 'bg-blue-500' : 'bg-emerald-500'}`} />
      <ExpandableSection
        title={shortenedTitle}
        badge={
          <div className="text-right">
            <p className="text-xl font-black text-gray-900 dark:text-gray-100">
              {formatNumber(detail.scoredMark)} <span className="text-xs text-gray-400 dark:text-gray-500 font-bold">/ {formatNumber(detail.maxMark)}</span>
            </p>
            <div className="flex items-center justify-end gap-2 mt-1">
              <div className="w-16 h-1.5 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                <div className={`h-full rounded-full ${typeLabel === 'Theory' ? 'bg-blue-500' : 'bg-emerald-500'}`} style={{ width: `${Math.min(100, Math.max(0, asmPct))}%` }} />
              </div>
              <p className={`text-[10px] font-black uppercase tracking-widest ${typeLabel === 'Theory' ? 'text-blue-600 dark:text-blue-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                {formatNumber(detail.weightageMark)} / {formatNumber(detail.weightagePercent)}%
              </p>
            </div>
          </div>
        }
        className="bg-transparent border-none overflow-hidden"
        headerClassName="text-[11px] text-gray-500 dark:text-gray-400 font-black uppercase tracking-widest pl-3"
        contentClassName="border-t border-gray-200/50 dark:border-gray-800/50 bg-white/40 dark:bg-black/20 backdrop-blur-md p-4"
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
    </div>
  );
}
