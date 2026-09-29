/**
 * The app's one attendance-percentage formula.
 *
 * Every page that shows a headline attendance number must show the *same*
 * number, and this is the rule: sum VTOP's own `attendedClasses` and
 * `totalClasses` across the enrolled courses, unweighted, and divide.
 *
 * It was being written out inline, and one of those copies was wrong.
 * `SimplifiedMobileHome` summed the per-course totals; the rebuilt calendar page
 * counted the individual `viewLink` records it happened to have. Those are not
 * the same figure — `viewLink` does not necessarily cover every class a course
 * has held, and the two drift further the longer an app sits unopened — so the
 * calendar showed 91% on a day when the home screen showed 87% for the same
 * student on the same data. A user comparing two screens of the same app does
 * not conclude "ah, different definitions", they conclude one of them is wrong.
 *
 * So the rule lives here and both pages call it. The unweighted sum is
 * deliberate: a lab is worth two hours against the *requirement* elsewhere in
 * the app, but weighting it here would move the headline figure away from the
 * one the institute prints, which is the number people reconcile against.
 */
export type AttendanceStatus = "Safe" | "Warning" | "Critical" | "N/A";

export interface AttendanceSummary {
  /** 0-100, unrounded. 0 when no course has held a class. */
  percentage: number;
  attended: number;
  total: number;
  status: AttendanceStatus;
}

/** Below `target` is Critical, within 5 points of it is Warning. */
export function statusForPercentage(
  percentage: number,
  total: number,
  targetPct: number
): AttendanceStatus {
  if (total <= 0) return "N/A";
  return percentage >= targetPct + 5 ? "Safe" : percentage >= targetPct ? "Warning" : "Critical";
}

export function summariseAttendance(
  attendance: any[] | null | undefined,
  targetPct: number
): AttendanceSummary {
  let attended = 0;
  let total = 0;

  (attendance ?? []).forEach((course) => {
    total += Number(course?.totalClasses) || 0;
    attended += Number(course?.attendedClasses) || 0;
  });

  const percentage = total > 0 ? (attended / total) * 100 : 0;
  return { percentage, attended, total, status: statusForPercentage(percentage, total, targetPct) };
}
