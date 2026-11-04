import { formatSemesterName } from "@/lib/formatSemesterName";

/**
 * Pure lookup tables and formatters for CourseDetailSubpage: the attendance
 * tone/dot maps and the grade-history letter/score/bar helpers, extracted so
 * the 2600-line component stops defining its own constants up top. Each is a
 * plain function or record with no component state behind it.
 */

/** Attendance status -> insight tone, so the tile colours itself. */
export const ATT_TONE: Record<string, string> = {
  Safe: "emerald",
  Warning: "amber",
  "N/A": "zinc",
  Critical: "red",
};

/** Attendance status -> the row's filled dot. Written out because a
 *  `bg-${tone}-500` template would never be seen by Tailwind's scanner. */
export const ATT_DOT: Record<string, string> = {
  present: "bg-emerald-500",
  absent: "bg-red-500",
  "on duty": "bg-amber-500",
};
/**
 * One history entry's letter, score and bar tone. Shared by the hero tiles,
 * the across-terms list and the detail below so the three cannot disagree.
 */
export function historyLetter(h: any): string {
  return h.grade || h.courseGrade || "";
}

export function historyScore(h: any): number | null {
  const g = Number(h.grandTotal);
  if (Number.isFinite(g) && g > 0) return g;
  const details = Array.isArray(h.details) ? h.details : [];
  let scored = 0;
  let max = 0;
  for (const d of details) {
    const s = Number(d.scoredMark);
    const m = Number(d.maxMark);
    if (Number.isFinite(s) && Number.isFinite(m) && m > 0) {
      scored += s;
      max += m;
    }
  }
  return max > 0 ? (scored / max) * 100 : null;
}

export function historyTermLabel(semester: string): string {
  if (semester === "Current") return "Current semester";
  return formatSemesterName(semester || "") || "Unknown semester";
}

export function scoreBarTone(score: number | null): string {
  if (score == null) return "bg-zinc-300 dark:bg-zinc-700";
  if (score >= 80) return "bg-emerald-500";
  if (score >= 65) return "bg-amber-500";
  return "bg-red-500";
}
