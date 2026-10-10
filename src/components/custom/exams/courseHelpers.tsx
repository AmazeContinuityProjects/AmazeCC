"use client";
import { useId, useState } from "react";
import { ChevronDown } from "lucide-react";
import { KeyValue, ListRowText, MiniBar, ToneDot } from "../shared/primitives";
import { LIST_ROW, TONE_BADGE, TONE_TEXT } from "@/lib/uiTokens";
import { toneForGrade } from "@/lib/gradeHistory";

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

/**
 * A score expressed as a percentage of what has actually been released.
 *
 * `earned` is a raw weightage-point total and `available` is the weightage points
 * published so far, so mid-term they are *not* out of 100 — they are out of whatever has
 * been assessed. The grade ladder, however, is a 0-100 percentage scale. Comparing the two
 * directly put a student on a genuine 90% into band D, because 54 >= 50 and 54 < 60.
 *
 * Shared with `getCourseStats` so the "Projected" tile and the ladder cannot drift apart.
 */
export const normalisedPct = (earned: number, available: number) =>
  available > 0 ? (earned / available) * 100 : 0;

export const getCourseStats = (group: any) => {
  const theoryTotals = getAssessmentTotals(group.theory?.assessments || []);
  const labTotals = getAssessmentTotals(group.lab?.assessments || []);
  if (!group.lab) {
    const pointsLost = theoryTotals.weightPercent - theoryTotals.weighted;
    return { maxPossible: 100 - pointsLost, projected: Math.round(normalisedPct(theoryTotals.weighted, theoryTotals.weightPercent)) };
  }
  if (!group.theory) {
    const pointsLost = labTotals.weightPercent - labTotals.weighted;
    return { maxPossible: 100 - pointsLost, projected: Math.round(normalisedPct(labTotals.weighted, labTotals.weightPercent)) };
  }
  const theoryCredits = getCourseCredits(group.theory);
  const labCredits = getCourseCredits(group.lab);
  if (theoryCredits < 0 || labCredits < 0) return { maxPossible: 0, projected: 0 };
  const creditsTotal = theoryCredits + labCredits;
  const combinedWeighted = (theoryCredits * theoryTotals.weighted + labCredits * labTotals.weighted) / creditsTotal;
  const combinedWeightPercent = (theoryCredits * theoryTotals.weightPercent + labCredits * labTotals.weightPercent) / creditsTotal;
  const pointsLost = combinedWeightPercent - combinedWeighted;
  return { maxPossible: 100 - pointsLost, projected: Math.round(normalisedPct(combinedWeighted, combinedWeightPercent)) };
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

/**
 * One assessment, as a row in the surrounding `ListShell`.
 *
 * This was a card, and it was built on amazeui's `ExpandableSection`. That
 * component's header is `justify-between`, which pinned a two-word title hard
 * left and the score hard right with a third of a screen of dead space between
 * them — and it carries its own border, padding and `hover:bg-gray-50`, so
 * dropping one inside a `ListShell` stacked card chrome inside card chrome.
 * Both problems go away by owning the row: `LIST_ROW` supplies the chrome, and
 * the expand is local state.
 *
 * The boundary arithmetic is unchanged from the version this replaced — only
 * the wrapper moved.
 */
export function AssessmentRow({ detail, typeLabel, aStat, isRelative }: {
  detail: any; typeLabel: string; aStat: any; isRelative: boolean;
}) {
  const [open, setOpen] = useState(false);
  const shortenedTitle = formatTitle(detail.title);
  const asmPct = detail.maxMark > 0 ? (getNumericValue(detail.scoredMark) / getNumericValue(detail.maxMark)) * 100 : 0;
  const scopeTone = typeLabel === "Theory" ? "blue" : "emerald";
  // From the title alone, because a theory half and a lab half can both publish
  // an assessment with the same VTOP title.
  const panelId = `asm-panel-${useId()}`;

  let gradePlacement = "?";
  let gradeBounds: { grade: string; range: string }[] = [];

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
        { grade: 'S', range: `>= ${sBoundaryCalc(sB, detail.maxMark)}` },
        { grade: 'A', range: `>= ${sBoundaryCalc(aB, detail.maxMark)}` },
        { grade: 'B', range: `>= ${sBoundaryCalc(bB, detail.maxMark)}` },
        { grade: 'C', range: `>= ${sBoundaryCalc(cB, detail.maxMark)}` },
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
      { grade: 'S', range: `>= ${sBoundaryCalc(90, detail.maxMark)}` },
      { grade: 'A', range: `>= ${sBoundaryCalc(80, detail.maxMark)}` },
      { grade: 'B', range: `>= ${sBoundaryCalc(70, detail.maxMark)}` },
      { grade: 'C', range: `>= ${sBoundaryCalc(60, detail.maxMark)}` },
    ];
  }

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls={panelId}
        className={`${LIST_ROW} cursor-pointer`}
      >
        <ToneDot tone={scopeTone} />

        <ListRowText
          title={shortenedTitle}
          titleTooltip={String(detail.title ?? "")}
          subtitle={`${formatNumber(detail.weightageMark)} / ${formatNumber(detail.weightagePercent)}% weightage`}
        />

        {/* Capped rather than flexing: this block is what drifted away from the
            title when the row was allowed to fill a 430px card. */}
        <span className="w-20 shrink-0 text-right">
          <span className="block text-sm font-black font-outfit tracking-tight leading-none text-text-heading">
            {formatNumber(detail.scoredMark)}
            <span className="text-[10px] font-bold text-text-muted"> / {formatNumber(detail.maxMark)}</span>
          </span>
          <span className="mt-1.5 block">
            <MiniBar pct={asmPct} tone={scopeTone === "blue" ? "bg-blue-500" : "bg-emerald-500"} />
          </span>
        </span>

        <ChevronDown
          className={`w-4 h-4 shrink-0 text-zinc-400 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <div id={panelId} className="px-4 pb-4 pt-3 bg-surface-tertiary/40 dark:bg-background/40 border-t border-border-muted dark:border-border">
          {isRelative && (!aStat || aStat.count === 0) ? (
            <p className="text-[11px] text-text-secondary dark:text-text-muted italic text-center py-2">
              Not enough data to calculate class statistics for this assessment yet.
            </p>
          ) : (
            <div className="space-y-3">
              {isRelative && aStat && (
                <div className="grid grid-cols-2 gap-2.5">
                  <KeyValue
                    label="Class avg"
                    value={`${sBoundaryCalc(aStat.mean, detail.maxMark)} (${formatNumber(aStat.mean)}%)`}
                  />
                  <KeyValue label="Std dev" value={`±${sBoundaryCalc(aStat.sd, detail.maxMark)}`} />
                </div>
              )}

              <div>
                <p className="text-text-muted text-[10px] uppercase font-bold tracking-wider mb-2">
                  {isRelative ? "Grade placement preview" : "Absolute grade range preview"}
                </p>
                <div className="flex gap-2">
                  {gradeBounds.map(b => {
                    const isPlacement = b.grade === gradePlacement;
                    return (
                      <span
                        key={b.grade}
                        className={`flex-1 rounded-lg border px-1.5 py-1.5 flex flex-col items-start gap-0.5 ${
                          isPlacement
                            ? `${TONE_BADGE[toneForGrade(b.grade)]} border-transparent ring-2 ring-indigo-500`
                            : TONE_BADGE.zinc
                        }`}
                      >
                        <span className="text-sm font-black">{b.grade}</span>
                        <span className="text-[9px] font-bold opacity-80">{b.range}</span>
                      </span>
                    );
                  })}
                </div>
                {gradePlacement !== "?" && (
                  <p className={`mt-2.5 text-[11px] font-bold ${TONE_TEXT[toneForGrade(gradePlacement)]}`}>
                    Hypothetical placement: Grade {gradePlacement}
                  </p>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
