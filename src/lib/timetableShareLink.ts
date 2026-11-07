/**
 * A share link for the student's registered timetable.
 *
 * This replaces the old friend-timetable feature (handles, pairing, server
 * grants). A timetable is shared the way FFCS plans already are: as a "shape"
 * link that carries only the class ids, so anyone can open it, offline, with no
 * account and nothing stored on a server. The receiver's page resolves each id
 * against the semester's public registration report (`/share/ffcs/`).
 *
 * VTOP's registered class ids (`attendanceItem.classId`) live in the same
 * namespace as the report's, so a registered timetable encodes exactly like a
 * planned one.
 */

import type { attendanceRes } from "@/types/data/attendance";
import type { AddedCourse } from "@/lib/ffcsTypes";
import { mapToFinalSemesterId, type FinalFFCSSemesterId } from "@/lib/ffcsReports";
import {
  buildNumericTimetableShapeShareUrl,
  buildTimetableShapeShareUrl,
  encodeNumericTimetableShapeShare,
  encodeTimetableShapeShare,
} from "@/lib/ffcsShare";

const CLASS_ID_RE = /^CH\d{13}$/;

export type RegisteredShareLink = {
  url: string;
  semester: FinalFFCSSemesterId;
  /** Courses (components) the link carries. */
  classCount: number;
  /** Course codes that had no usable class id and are left out. */
  skipped: string[];
};

/**
 * Build the link, or return null when there is nothing shareable: no
 * attendance yet, no class ids, or a semester without a final report.
 */
export function buildRegisteredShareLink(
  attendance: attendanceRes | null | undefined,
  origin: string,
): RegisteredShareLink | null {
  const items = attendance?.attendance ?? [];
  const skipped: string[] = [];
  const ids: string[] = [];
  for (const item of items) {
    const id = String(item?.classId ?? "")
      .trim()
      .toUpperCase();
    if (CLASS_ID_RE.test(id)) ids.push(id);
    else if (item?.courseCode) skipped.push(item.courseCode);
  }
  if (!ids.length) return null;

  // A class id starts with its VTOP semester id (CH20262705…), which names the report.
  const semester = mapToFinalSemesterId(ids[0].slice(0, 10));
  if (!semester) return null;
  const sameTerm = [...new Set(ids.filter((id) => id.startsWith(ids[0].slice(0, 10))))].sort();

  const timetable = {
    name: "My timetable",
    courses: sameTerm.map((classId) => ({ classId, classIds: [classId] }) as AddedCourse),
  };

  // The numeric form is the shortest (it survives chat apps best); fall back
  // to the plain shape form for ids it cannot pack.
  const numeric = encodeNumericTimetableShapeShare(timetable, semester);
  if (numeric) {
    return { url: buildNumericTimetableShapeShareUrl(numeric, origin), semester, classCount: sameTerm.length, skipped };
  }
  const shape = encodeTimetableShapeShare(timetable, semester);
  if (shape) {
    return { url: buildTimetableShapeShareUrl(shape, origin), semester, classCount: sameTerm.length, skipped };
  }
  return null;
}
