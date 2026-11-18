/**
 * Dedicated Web Worker for Free Classroom Occupancy Matrix Computation.
 *
 * Scans thousands of timetable course rows and computes the weekly room
 * occupancy matrix (rooms, periods, blocks, course occurrences) off the main thread.
 */

import { buildWeekIndex, type CampusSchema, type FreeRoomCourse, type WeekMap } from "../freeClassrooms";

export interface FreeClassroomWorkerRequest {
  id: string;
  courses: FreeRoomCourse[];
  schema: CampusSchema;
}

export type FreeClassroomWorkerReply =
  { id: string; type: "success"; week: WeekMap } | { id: string; type: "error"; message: string };

self.onmessage = (event: MessageEvent<FreeClassroomWorkerRequest>) => {
  const data = event.data;
  if (!data || !data.id || !Array.isArray(data.courses) || !data.schema) {
    self.postMessage({
      id: data?.id ?? "unknown",
      type: "error",
      message: "Invalid free classroom worker request",
    });
    return;
  }

  try {
    const week = buildWeekIndex(data.courses, data.schema);
    self.postMessage({
      id: data.id,
      type: "success",
      week,
    });
  } catch (err) {
    self.postMessage({
      id: data.id,
      type: "error",
      message: err instanceof Error ? err.message : "Failed to build week index in worker",
    });
  }
};
