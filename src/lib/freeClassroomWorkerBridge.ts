/**
 * Bridge for offloading weekly classroom occupancy calculations to `freeClassroom.worker.ts`.
 *
 * Keeps the UI thread responsive when switching semesters or loading thousands
 * of timetable courses. Automatically falls back to synchronous inline execution
 * if Web Workers are unavailable (e.g. during SSR, in unit tests, or in older browsers).
 */

import { buildWeekIndex, type CampusSchema, type FreeRoomCourse, type WeekMap } from "./freeClassrooms";
import type { FreeClassroomWorkerReply, FreeClassroomWorkerRequest } from "./workers/freeClassroom.worker";

let nextRequestId = 0;
function uniqueId(): string {
  return `fc-req-${Date.now()}-${++nextRequestId}`;
}

function createFreeClassroomWorker(): Worker | null {
  if (typeof window === "undefined" || typeof Worker === "undefined") return null;
  try {
    return new Worker(new URL("./workers/freeClassroom.worker.ts", import.meta.url), { type: "module" });
  } catch (err) {
    console.warn("[FreeClassroomWorker] Worker creation failed, using main thread fallback:", err);
    return null;
  }
}

/**
 * Builds the complete 5-day classroom occupancy matrix asynchronously on a background worker thread.
 * Automatically falls back to synchronous inline execution when Web Workers are unavailable or error.
 */
export async function buildWeekIndexAsync(
  courses: readonly FreeRoomCourse[],
  schema: CampusSchema,
  timeoutMs = 15000,
): Promise<WeekMap> {
  const worker = createFreeClassroomWorker();
  if (!worker) {
    return buildWeekIndex(courses, schema);
  }

  const id = uniqueId();
  return new Promise<WeekMap>((resolve) => {
    let resolved = false;

    const timer = setTimeout(() => {
      if (resolved) return;
      resolved = true;
      worker.terminate();
      console.warn(`[FreeClassroomWorker] Request ${id} timed out after ${timeoutMs}ms, using fallback`);
      resolve(buildWeekIndex(courses, schema));
    }, timeoutMs);

    worker.onmessage = (event: MessageEvent<FreeClassroomWorkerReply>) => {
      if (resolved) return;
      const msg = event.data;
      if (!msg || msg.id !== id) return;

      resolved = true;
      clearTimeout(timer);
      worker.terminate();

      if (msg.type === "success" && msg.week) {
        resolve(msg.week);
      } else {
        const errMsg = msg.type === "error" ? msg.message : "Unknown error";
        console.warn(`[FreeClassroomWorker] Worker returned error: ${errMsg}, using fallback`);
        resolve(buildWeekIndex(courses, schema));
      }
    };

    worker.onerror = (err) => {
      if (resolved) return;
      resolved = true;
      clearTimeout(timer);
      worker.terminate();
      console.warn("[FreeClassroomWorker] Worker error, using fallback:", err);
      resolve(buildWeekIndex(courses, schema));
    };

    try {
      worker.postMessage({ id, courses: [...courses], schema } satisfies FreeClassroomWorkerRequest);
    } catch (postErr) {
      if (resolved) return;
      resolved = true;
      clearTimeout(timer);
      worker.terminate();
      console.warn("[FreeClassroomWorker] Failed to postMessage, using fallback:", postErr);
      resolve(buildWeekIndex(courses, schema));
    }
  });
}
