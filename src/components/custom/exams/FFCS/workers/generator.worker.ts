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
 *
 * ## The two request shapes
 *
 * A plain `GenerateParams` is a one-shot request: it answers with a single
 * `{ type: "success" }` and nothing before it. That shape is what the built-artifact
 * test posts, and it is what a caller who does not want to watch should send.
 *
 * `{ type: "stream", params }` asks to be watched: the same solve, with
 * `{ type: "batch" }` and `{ type: "progress" }` messages interleaved ahead of
 * the terminal one. Streaming is opt-in because the first reply a caller sees
 * has to be the one it dispatches on — emitting progress to a caller that only
 * reads `replies[0]` would make a working worker look broken.
 *
 * ## Why there is no `cancel` message
 *
 * The walk is synchronous. A message posted from the page while this thread is
 * mid-backtrack would not be read until the backtrack finished, which is not a
 * cancellation. The page cancels with `worker.terminate()`, which is immediate,
 * needs no cooperation from this side, and cannot leave a half-built result.
 */

import { generateTimetablesStream, type GenerateParams } from "../logic/generate";

/** What the main thread may send. */
type WorkerRequest = { type: "stream"; params: GenerateParams } | GenerateParams;

/** What this thread posts back. `success` is unchanged from the one-shot shape. */
type WorkerReply =
  | { type: "success"; timetables: unknown[]; capped?: boolean }
  | { type: "batch"; timetables: unknown[] }
  | { type: "progress"; nodes: number; found: number; accepted: number }
  | { type: "cancelled"; timetables: unknown[] }
  | { type: "error"; code: string; subjectCode?: string; message?: string };

const post = (reply: WorkerReply) => self.postMessage(reply);

self.onmessage = (event: MessageEvent<WorkerRequest>) => {
  const data = event.data;
  // A request is streaming only if it says so explicitly. Anything else —
  // including `{ nonsense: true }` and including every payload the artifact test
  // has ever sent — is treated as a bare `GenerateParams`, which is what the
  // original handler always assumed.
  const isStream =
    !!data && typeof data === "object" && (data as { type?: string }).type === "stream";
  const params = isStream
    ? (data as { type: "stream"; params: GenerateParams }).params
    : (data as GenerateParams);

  try {
    const result = generateTimetablesStream(
      params,
      isStream
        ? {
            // Every batch is its own message. `generateTimetablesStream` has
            // already decided when a flush is worth sending, so buffering here
            // again would only delay the first thing a student gets to look at.
            onBatch: (batch) => post({ type: "batch", timetables: batch }),
            onProgress: (progress) => post({ type: "progress", ...progress }),
          }
        : undefined
    );

    if (result.kind === "ok") {
      post({ type: "success", timetables: result.timetables, capped: result.capped });
      return;
    }
    if (result.kind === "cancelled") {
      post({ type: "cancelled", timetables: result.timetables });
      return;
    }
    post({ type: "error", code: result.code, subjectCode: result.subjectCode });
  } catch (error) {
    post({
      type: "error",
      code: "error",
      message: error instanceof Error ? error.message : "Unknown worker error",
    });
  }
};
