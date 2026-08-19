/**
 * Academic utility functions for semester formatting, GPA calculations, and grade points.
 */

export const GRADE_POINT_MAP: Record<string, number> = {
  S: 10,
  A: 9,
  B: 8,
  C: 7,
  D: 6,
  E: 5,
  F: 0,
  N: 0,
};

export function getGradePoint(grade: string): number {
  const normalized = (grade || "").trim().toUpperCase();
  return GRADE_POINT_MAP[normalized] ?? 9;
}

export function getGradeColor(grade: string): string {
  const normalized = (grade || "").trim().toUpperCase();
  switch (normalized) {
    case "S":
      return "text-emerald-500 bg-emerald-500/10 border-emerald-500/20";
    case "A":
      return "text-sky-500 bg-sky-500/10 border-sky-500/20";
    case "B":
      return "text-blue-500 bg-blue-500/10 border-blue-500/20";
    case "C":
      return "text-amber-500 bg-amber-500/10 border-amber-500/20";
    case "D":
      return "text-orange-500 bg-orange-500/10 border-orange-500/20";
    case "E":
      return "text-yellow-600 bg-yellow-500/10 border-yellow-500/20";
    case "F":
    case "N":
      return "text-red-500 bg-red-500/10 border-red-500/20";
    default:
      return "text-muted-foreground bg-muted border-border";
  }
}

export function formatSemesterName(semId: string): string {
  if (!semId || !semId.toUpperCase().startsWith("CH") || semId.length !== 10) {
    return semId || "Unknown Semester";
  }

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

export interface CourseGradeItem {
  credits: number | string;
  grade: string;
}

export function calculateGPA(courses: CourseGradeItem[]): number {
  let totalCredits = 0;
  let totalGradePoints = 0;

  for (const course of courses) {
    const credits = typeof course.credits === "number" ? course.credits : parseFloat(course.credits) || 0;
    if (credits <= 0) continue;
    const gp = getGradePoint(course.grade);
    totalCredits += credits;
    totalGradePoints += credits * gp;
  }

  if (totalCredits === 0) return 0;
  return Math.round((totalGradePoints / totalCredits) * 100) / 100;
}

export interface SemesterGpaItem {
  gpa: number | string;
  credits: number | string;
}

export function calculateCGPA(semesters: SemesterGpaItem[]): number {
  let totalCredits = 0;
  let weightedGpaSum = 0;

  for (const sem of semesters) {
    const credits = typeof sem.credits === "number" ? sem.credits : parseFloat(String(sem.credits)) || 0;
    const gpa = typeof sem.gpa === "number" ? sem.gpa : parseFloat(String(sem.gpa)) || 0;
    if (credits <= 0 || gpa <= 0) continue;
    totalCredits += credits;
    weightedGpaSum += gpa * credits;
  }

  if (totalCredits === 0) return 0;
  return Math.round((weightedGpaSum / totalCredits) * 100) / 100;
}
