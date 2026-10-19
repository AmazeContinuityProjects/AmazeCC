"use client";

import { useEffect, useMemo, useState } from "react";
import { remapCohortStats } from "@/lib/marksSync";
import {
  computeCoursePrediction,
  createPredictorAssessmentsFromVTOP,
  safeNumber,
} from "@/lib/marksPredictor";
import {
  getCoursePredictorState,
  resetCoursePredictorState,
  saveCoursePredictorState,
  type StoredCourseState,
  type CustomCourseMock,
} from "@/lib/marksPredictorStorage";

/**
 * A single enrolled course, as the predictor sees it.
 *
 * `theoryCourse` / `labCourse` are the raw VTOP payloads. An embedded course
 * carries both — VTOP emits the two halves as separate rows sharing one
 * course code, the lab identified by its `L` slot — and the predictor blends
 * them, exactly as the course marks subpage records one blended grade.
 * A custom subject carries neither and gets its regimen entirely from storage.
 */
export interface EnrolledCourseItem {
  courseCode: string;
  courseTitle: string;
  courseType: string;
  credits: number;
  /**
   * VTOP's grading system field ("ACE" or otherwise), carried for the shared
   * curve rule. Older dumps may not publish one — the item stays without it
   * and the ladder resolves exactly like the marks subpage does for the same
   * payload: "Theory Only" under a non-ACE system is still curve-eligible.
   */
  courseSystem?: string;
  theoryCourse?: any;
  labCourse?: any;
  isCustom?: boolean;
}

export interface CourseConfig {
  theory: any[];
  lab: any[];
  theoryCredits: number;
  labCredits: number;
}

const stripComponentMarker = (code: unknown): string =>
  String(code ?? "")
    .replace(/\s*\([LPT]\)$/i, "")
    .trim();

/**
 * Build a course's assessment configuration from its stored overrides, falling
 * back to VTOP's published assessments and finally to the built-in preset.
 *
 * Same resolution the old inline tab code used, extracted so the per-course
 * page and the global list cannot disagree on what "the regimen" is.
 *
 * The credit defaults are payload-driven rather than label-only: a merged
 * "Embedded Theory" item carries both payloads, and its lab half needs its own
 * credit to pull any weight in the blended prediction — a lab analysed at zero
 * credits is a lab the grade predictor pretends does not exist.
 */
export function buildCourseConfig(
  course: EnrolledCourseItem | null,
  saved?: StoredCourseState | null
): CourseConfig {
  if (!course) return { theory: [], lab: [], theoryCredits: 3, labCredits: 1 };

  const type = course.courseType.toLowerCase();
  const isLabOnly = type.includes("lab only");
  const hasLabText = type.includes("lab");
  const hasTheoryPayload = Boolean(course.theoryCourse);
  const hasLabPayload = Boolean(course.labCourse);
  const isEmbedded = type.includes("embedded") || (hasTheoryPayload && hasLabPayload);

  const theoryCredits =
    saved?.theoryCredits ?? (isLabOnly && !hasTheoryPayload ? 0 : 3);
  const labCredits =
    saved?.labCredits ?? (hasLabText || isEmbedded || hasLabPayload ? 1 : 0);

  let theory = saved?.theoryAssessments;
  let lab = saved?.labAssessments;

  if (!theory && !isLabOnly) {
    theory = createPredictorAssessmentsFromVTOP(course.theoryCourse, "theory");
  }
  if (!lab && (hasLabText || hasLabPayload)) {
    lab = createPredictorAssessmentsFromVTOP(course.labCourse, "lab");
  }

  return { theory: theory || [], lab: lab || [], theoryCredits, labCredits };
}

/**
 * Parse every enrolled course out of the VTOP payloads.
 *
 * The marks route (see the API's `marks.ts`) emits each component of an
 * embedded course as its own row — same `courseCode`, the lab's `slot` starts
 * with "L" — and older dumps tag the component onto the code itself
 * (`CSE1001 (L)`). Both are folded back into the parent here, because grade
 * history, the course subpage and vtop itself treat an embedded course as one
 * blended grade, not two subjects. Anything with no parent (a true lab-only
 * elective) stays its own row.
 *
 * Merged items also carry the summed credits — theory 3 + lab 1 = 4 — so the
 * SGPA aggregation weights the course once at full mass instead of only the
 * half that happened to arrive first.
 */
export function buildEnrolledCourses(
  marksData: any,
  attendance: readonly any[] | undefined,
  customCourses: readonly CustomCourseMock[]
): EnrolledCourseItem[] {
  const map = new Map<string, EnrolledCourseItem>();

  const classCreditsFor = (payload: any, isLab: boolean) => {
    const credits = safeNumber(payload?.credits, 0);
    if (credits > 0) return credits;
    return isLab ? 1 : 3;
  };

  const componentSum = (item: EnrolledCourseItem): number => {
    if (item.isCustom) return item.credits;
    const theory = item.theoryCourse
      ? classCreditsFor(item.theoryCourse, false)
      : 0;
    const lab = item.labCourse ? classCreditsFor(item.labCourse, true) : 0;
    return theory + lab;
  };

  const upsert = (
    rawCode: string,
    payload: any,
    sourceTitle: string,
    fromAttendance = false
  ) => {
    const baseCode = stripComponentMarker(rawCode) || stripComponentMarker(sourceTitle);
    if (!baseCode) return;

    const rawTitle = String(sourceTitle ?? "").trim();
    const courseTitle = rawTitle || baseCode;
    const slotText = String(payload?.slot ?? payload?.slotName ?? "");
    const isLab =
      String(payload?.courseType ?? "")
        .toLowerCase()
        .includes("lab") || slotText.toLowerCase().startsWith("l");

    if (!map.has(baseCode)) {
      map.set(baseCode, {
        courseCode: baseCode,
        courseTitle,
        courseType: String(payload?.courseType ?? "").trim() || (isLab ? "Lab Only" : "Theory Only"),
        credits: classCreditsFor(payload, isLab),
        courseSystem: String(payload?.courseSystem ?? "").trim() || undefined,
        theoryCourse: !isLab ? payload : undefined,
        labCourse: isLab ? payload : undefined,
      });
      return;
    }

    const existing = map.get(baseCode)!;
    if (isLab) {
      // Spread-merge like the course subpage: an attendance row fills the
      // fields the marks row lacked without discarding its class id.
      existing.labCourse = { ...(existing.labCourse ?? {}), ...payload, ...(fromAttendance ? { classNbr: payload?.classId || payload?.classNbr || existing.labCourse?.classNbr } : {}), courseCode: baseCode, courseTitle };
    } else {
      existing.theoryCourse = { ...(existing.theoryCourse ?? {}), ...payload, courseCode: baseCode, courseTitle };
      // The theory half's title is the course's name; a lab-first arrival can
      // have parked a "... Lab" label on the parent.
      if (
        existing.courseTitle.toLowerCase().endsWith("lab") &&
        courseTitle &&
        !courseTitle.toLowerCase().endsWith("lab")
      ) {
        existing.courseTitle = courseTitle;
      }
    }
    // A blended pair is declared by its composition, not by whoever arrived:
    // relabel to "Embedded Theory" only once the item truly carries both
    // halves. VTOP's own row already said what a course is, and every course
    // gets an attendance row under the same code — the forced relabel used to
    // fire on that twin, so real "Lab Only" electives read as ETL on the list
    // and even gained curve eligibility their lab halves don't hold.
    if (
      existing.theoryCourse &&
      existing.labCourse &&
      !existing.courseType.toLowerCase().includes("embedded")
    ) {
      existing.courseType = "Embedded Theory";
    }
    // A merged course's system is whichever half published one — the theory
    // half is VTOP's canonical carrier, so an arriving theory wins.
    existing.courseSystem =
      String(existing.theoryCourse?.courseSystem ?? "").trim() ||
      existing.courseSystem ||
      String(existing.labCourse?.courseSystem ?? "").trim() ||
      undefined;
    existing.credits = componentSum(existing);
  };

  const rawCourses = Array.isArray(marksData?.courses) ? marksData.courses : [];
  rawCourses.forEach((c: any) => {
    if (!c) return;
    const rawCode = String(c.courseCode || c.code || "").trim();
    const rawTitle = String(c.courseTitle || c.title || "").trim();
    if (!rawCode && !rawTitle) return;
    upsert(rawCode, c, rawTitle);
  });

  if (Array.isArray(attendance)) {
    attendance.forEach((att: any) => {
      if (!att?.courseCode) return;
      upsert(String(att.courseCode), att, String(att.courseTitle || "").trim(), true);
    });
  }

  customCourses.forEach((custom) => {
    map.set(custom.courseCode, {
      courseCode: custom.courseCode,
      courseTitle: custom.courseTitle,
      courseType: custom.courseType,
      credits: custom.theoryCredits + custom.labCredits,
      isCustom: true,
    });
  });

  return Array.from(map.values());
}

/**
 * The cohort statistics in the shape the predictor reads.
 *
 * The sync engine's atom stores the server payload verbatim: the entry is
 * flat — `{ count, mean, sd, assessments }`, with assessment rows keyed by
 * digest. The pages read `marksStats[classNbr].overall` plus a map keyed by
 * VTOP title, so this re-keys the payload with the same `remapCohortStats`
 * the marks subpage runs before its ladder can find a class distribution.
 * Reading the raw atom directly found no `overall` anywhere — that is what
 * silently forced the global subject list onto the fixed ladder while the
 * per-course pages (fed the remapped map by the subpage) curved correctly.
 */
export function useRemappedCourseStats(
  marksStats?: Record<string, any>,
  courses: readonly EnrolledCourseItem[] = []
): Record<string, any> {
  const [remapped, setRemapped] = useState<Record<string, any>>({});

  useEffect(() => {
    let cancelled = false;
    const stored = marksStats as Record<string, any> | undefined;

    if (!stored || Object.keys(stored).length === 0) {
      setRemapped({});
      return;
    }

    // `remapCohortStats` groups by `theory`/`lab`, so project the items onto
    // its group shape — the payloads carry the class ids and assessment
    // titles it joins digests against.
    const groups = courses.map((course) => ({
      theory: course.theoryCourse,
      lab: course.labCourse,
    }));

    remapCohortStats(stored, groups as any)
      .then((next) => {
        if (!cancelled) setRemapped(next);
      })
      .catch(() => {
        if (!cancelled) setRemapped({});
      });

    return () => {
      cancelled = true;
    };
  }, [marksStats, courses]);

  return remapped;
}

/**
 * One course's predictor state: its regimen, its prediction, and the cohort
 * statistics that match it.
 *
 * The global subject list and the course subpage's "Grade Predictor" entry both
 * land on `CoursePredictorPage`, which mounts this keyed by course code — so a
 * course switch is a fresh mount, and unsaved edits to another course's regimen
 * can never leak into this one's hero numbers.
 *
 * `marksStats` must come in REMAPPED (`useRemappedCourseStats`): entries carry
 * an `overall` distribution and assessment stats keyed by VTOP title. A
 * custom subject has no class id — those get null and the hero renders the
 * "not enough data" row rather than an invented number.
 */
export function useCoursePredictionScope(
  course: EnrolledCourseItem | null,
  marksStats?: Record<string, any>
) {
  const courseCode = course?.courseCode ?? "";

  const [config, setConfig] = useState<CourseConfig>(() =>
    buildCourseConfig(course, getCoursePredictorState(courseCode))
  );

  const updateConfig = (next: CourseConfig) => {
    setConfig(next);
    saveCoursePredictorState(courseCode, {
      theoryAssessments: next.theory,
      labAssessments: next.lab,
      theoryCredits: next.theoryCredits,
      labCredits: next.labCredits,
    });
  };

  // Reset = drop this course's stored overrides and rebuild from VTOP. The
  // course page is the only caller, and remounting is never needed because the
  // build is synchronous from the same inputs the initial state used.
  const reset = () => {
    resetCoursePredictorState(courseCode);
    setConfig(buildCourseConfig(course, null));
  };

  // One course's class ladder: the class distribution VTOP exposed for its
  // class id, read the same way the marks subpage reads it — theory half's
  // class id first. Under a curve (`isRelativeGrading`) these mean/σ shift the
  // grade boundaries so "67% can be an A" reads identically on both screens.
  const classStats = useMemo(() => {
    const classNbr = course?.theoryCourse?.classNbr || course?.labCourse?.classNbr;
    if (!classNbr) return null;
    const overall = marksStats?.[classNbr]?.overall;
    return overall && Number.isFinite(overall.mean) ? overall : null;
  }, [course, marksStats]);

  const prediction = useMemo(
    () =>
      course
        ? computeCoursePrediction({
            courseCode: course.courseCode,
            courseTitle: course.courseTitle,
            courseType: course.courseType,
            theoryAssessments: config.theory,
            labAssessments: config.lab,
            theoryCredits: config.theoryCredits,
            labCredits: config.labCredits,
            // Always a key (null when absent) so the prediction resolves the
            // ladder like the marks subpage does for the same payload rather
            // than defaulting to the fixed one.
            courseSystem: course.courseSystem ?? null,
            classStats,
          })
        : null,
    [course, config, classStats]
  );

  // Cohort statistics for this course's assessments, keyed the same way the
  // course marks subpage reads them: by the class id VTOP stamps on either the
  // theory or the lab payload.
  const assessmentStats = useMemo(() => {
    const classNbr = course?.theoryCourse?.classNbr || course?.labCourse?.classNbr;
    if (!classNbr) return null;
    return marksStats?.[classNbr]?.assessments ?? null;
  }, [course, marksStats]);

  return { config, updateConfig, reset, prediction, assessmentStats, classStats };
}
