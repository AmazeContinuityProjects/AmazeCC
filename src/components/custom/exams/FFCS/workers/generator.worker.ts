/**
 * The worker bridge.
 *
 * This used to be a third copy of the generator: its own colour list, its own id
 * helper, its own copy of the metrics, its own sort. All of it duplicated because
 * it could not import the version on the main thread — and none of it ever ran,
 * because the only importer was a function the modal imported and never called.
 *
 * Now it is a bridge. The solve lives in `../logic/generate` and is pure, so the
 * same code answers here and on the main thread, and there is nothing left in
 * this file that can drift from it.
 *
 * ## Module worker
 *
 * `{ type: 'module' }`, which is what lets the import above be a normal import.
 * The cost is Safari 15+ (2021). This app is an installable PWA served over
 * HTTPS, so that floor is known and accepted rather than discovered later.
 */

import { generateTimetables, type GenerateParams } from "../logic/generate";

self.onmessage = (event: MessageEvent<GenerateParams>) => {
  try {
    const result = generateTimetables(event.data);
    if (result.kind === "ok") {
      self.postMessage({ type: "success", timetables: result.timetables });
      return;
    }
    self.postMessage({
      type: "error",
      code: result.code,
      subjectCode: result.subjectCode,
    });
  } catch (error) {
    self.postMessage({
      type: "error",
      code: "error",
      message: error instanceof Error ? error.message : "Unknown worker error",
    });
  }
};
