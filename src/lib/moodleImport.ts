import { sanitizeCourseCode } from "./taskMatch";
import { createTask, getTasks } from "./tasksStorage";
import type { Task } from "@/types/tasks";

export interface MoodleAssignmentPreview {
  raw: any;
  title: string;
  courseCode: string;
  dueDate?: string;
  url: string;
  alreadyImported: boolean;
  isPast: boolean;
}

/**
 * Parses raw LMS / Moodle assignments and checks against existing tasks by `moodleUrl`.
 */
export function previewMoodleImport(
  assignments: any[],
  existingTasks: Task[] = getTasks()
): MoodleAssignmentPreview[] {
  if (!Array.isArray(assignments)) return [];

  const existingUrls = new Set(
    existingTasks
      .map((t) => t.moodleUrl)
      .filter((url): url is string => Boolean(url))
  );

  const previews: MoodleAssignmentPreview[] = [];
  const now = Date.now();

  for (const item of assignments) {
    if (!item) continue;
    // Skip if hidden or marked done in LMS
    if (item.hidden || item.done) continue;

    const rawName = String(item.name || item.title || "").trim();
    if (!rawName) continue;

    // e.g. "BCSE203E/Theory/DA 1" or "BCSE203E/DA 1" or "DA 1"
    const parts = rawName.split("/").map((p) => p.trim());
    let courseCode = "";
    let title = rawName;

    if (parts.length >= 3) {
      courseCode = sanitizeCourseCode(parts[0]);
      title = parts.slice(2).join(" / ");
    } else if (parts.length === 2) {
      courseCode = sanitizeCourseCode(parts[0]);
      title = parts[1];
    } else {
      // Single name, try item.courseName or courseCode
      courseCode = sanitizeCourseCode(item.courseName || item.courseCode || "");
    }

    const rawDue = item.due || item.dueDate;
    let dueDate: string | undefined;
    let isPast = false;

    if (rawDue) {
      const d = new Date(rawDue);
      if (!isNaN(d.getTime())) {
        dueDate = d.toISOString();
        isPast = d.getTime() < now;
      }
    }

    const url = String(item.url || "");
    const alreadyImported = url ? existingUrls.has(url) : false;

    previews.push({
      raw: item,
      title,
      courseCode,
      dueDate,
      url,
      alreadyImported,
      isPast,
    });
  }

  return previews;
}

/**
 * Imports selected Moodle assignments as Digital Assignment tasks.
 */
export function importMoodleTasks(
  selected: MoodleAssignmentPreview[]
): Task[] {
  let latestTasks = getTasks();

  for (const item of selected) {
    if (item.alreadyImported) continue;

    latestTasks = createTask({
      title: item.title,
      kind: "digital-assignment",
      status: "pending",
      courseCode: item.courseCode,
      component: "both",
      dueDate: item.dueDate,
      moodleUrl: item.url || undefined,
      notes: item.url ? `Imported from LMS: ${item.url}` : "Imported from LMS",
    });
  }

  return latestTasks;
}
