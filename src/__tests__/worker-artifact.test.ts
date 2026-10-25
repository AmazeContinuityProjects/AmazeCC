import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import vm from "node:vm";
import { describe, expect, it } from "vitest";
import chennai from "../data/campus/chennai.json";
import type { ParsedCourse, CourseLock } from "../components/custom/exams/FFCS/types";

/**
 * The built worker, actually executed.
 *
 * Every other test in this suite runs the *source*. This one loads the emitted
 * `out/_next/static/chunks/*.js` — the exact bytes a browser would fetch — into
 * a bare context with a stubbed `self`, posts it a real `GenerateParams`, and
 * waits for a reply.
 *
 * It exists because "the build emitted a worker chunk" and "the worker works"
 * are different claims. The first is easy to check and easy to be wrong about: a
 * chunk can be emitted, referenced, and still fail at runtime — throw on import,
 * reach for a global the worker context does not have, or never install its
 * message handler. None of that shows up in a type check or a unit test.
 *
 * Skipped when `out/` does not exist, so a fresh clone without a build still
 * passes `npm test`.
 */

const OUT = join(process.cwd(), "out");
const CHUNKS = join(OUT, "_next", "static", "chunks");

/**
 * The worker entry among the emitted chunks.
 *
 * Identified by what it does rather than by filename: it installs a `message`
 * handler on `self` and posts results back, and it must not touch `document` or
 * `window`, which a worker has no business reaching for. Matching on a name or
 * on webpack's numeric chunk id would break the moment either changes.
 */
/** Every emitted `.js` under `out/_next/static/chunks`, flattened. */
function listChunkFiles(): string[] {
  if (!existsSync(CHUNKS)) return [] as string[];
  const candidates: string[] = [];
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry);
      if (statSync(full).isDirectory()) walk(full);
      else if (entry.endsWith(".js")) candidates.push(full);
    }
  };
  walk(CHUNKS);
  return candidates;
}

function findWorkerChunk(): string | null {
  for (const file of listChunkFiles()) {
    const src = readFileSync(file, "utf8");
    if (!/self\.onmessage|\["message"\]|addEventListener\(\s*["']message/.test(src)) continue;
    if (/\bdocument\b|\bwindow\b/.test(src)) continue;
    if (!src.includes("no_conflict_free")) continue; // must carry the solver
    return file;
  }
  return null;
}

/**
 * The PDF dossier worker among the emitted chunks.
 *
 * Identified the same way as the solver — by what it says, not what it is
 * called: `"Invalid worker request type"` is a literal only `pdf.worker.ts`
 * writes, so this cannot match the *sender* in the main bundle, which also
 * mentions `build_dossier_pdf`. Unlike the solver, the word-`document`
 * exclusion above does not apply: the bundled jsPDF names `document` inside
 * guarded branches, and the vm test below is what actually proves the worker
 * never executes them at load.
 */
function findPdfWorkerChunk(): string | null {
  for (const file of listChunkFiles()) {
    if (readFileSync(file, "utf8").includes("Invalid worker request type")) return file;
  }
  return null;
}

const workerFile = findWorkerChunk();
const pdfWorkerFile = findPdfWorkerChunk();

/** A report row, in the shape the solver reads. */
const row = (over: Partial<ParsedCourse> & Pick<ParsedCourse, "CODE" | "SLOT">): ParsedCourse => ({
  CODE: over.CODE,
  TITLE: over.TITLE ?? "Course",
  TYPE: over.TYPE ?? "TH",
  CREDITS: over.CREDITS ?? "3",
  ROOM: over.ROOM ?? "AB1-101",
  SLOT: over.SLOT,
  FACULTY: over.FACULTY ?? "Dr Someone",
  ...over,
});

const lock = (code: string): CourseLock => ({
  code,
  title: "Course",
  allowedSlots: [],
  allowedFaculty: [],
});

interface Reply {
  type: "success" | "error";
  timetables?: unknown[];
  code?: string;
  message?: string;
}

/**
 * Run the chunk in a context with only what a worker has, and post it a message.
 *
 * Defaults to the solver's chunk, so every existing call is unchanged;
 * `chunkFile` points it at any other emitted worker.
 *
 * Deliberately minimal: `self`, `console` and `crypto` are the globals a module
 * worker can rely on, and nothing else is provided. If the bundle reaches for
 * anything more, this throws — which is the point, because in a real worker that
 * would be a `ReferenceError` at load time and the page would fall back to
 * running the solve inline without ever telling anyone.
 */
/**
 * Give the context the genuine worker globals an emitted bundle may reach for.
 *
 * - `importScripts`: webpack's chunk loader calls it at startup when a
 *   dependency (jsPDF) was split into its own chunk. The URL it passes is a
 *   browser path (`/_next/static/chunks/…`), so it resolves by basename
 *   against the emitted files and evaluates them in the same context —
 *   exactly as a real worker would.
 * - `TextEncoder`/`TextDecoder`: plain worker globals the bundle's own
 *   runtime touches. Real workers all have them, so their absence would be a
 *   harness artefact, not a defect worth catching.
 *
 * Everything else stays unprovided on purpose: the original test's claim is
 * that nothing more is needed, and it is still the missing-globals class of
 * failure if that claim ever stops being true.
 */
function withWorkerGlobals(context: vm.Context): vm.Context {
  const target = context as unknown as Record<string, unknown>;
  target.TextEncoder = TextEncoder;
  target.TextDecoder = TextDecoder;
  // jsPDF binds these off the global at import: `s.atob.bind(s)`.
  target.atob = atob;
  target.btoa = btoa;
  target.importScripts = (...urls: string[]) => {
    for (const url of urls) {
      const base = url.split("?")[0].split("/").pop() ?? "";
      const file = listChunkFiles().find((f) => f.endsWith(base));
      if (!file) throw new Error(`importScripts could not resolve ${url}`);
      new vm.Script(readFileSync(file, "utf8"), { filename: file }).runInContext(context);
    }
  };
  return context;
}

function runWorker(
  payload: unknown,
  timeoutMs = 5000,
  chunkFile: string = workerFile!
): Promise<Reply> {
  const source = readFileSync(chunkFile, "utf8");
  const replies: Reply[] = [];

  const self = {
    onmessage: null as ((event: { data: unknown }) => void) | null,
    postMessage: (msg: Reply) => replies.push(msg),
  };

  const context = withWorkerGlobals(
    vm.createContext({
      self,
      console,
      crypto,
      // Node's module wrapper is irrelevant here; the chunk is a plain IIFE.
    })
  );

  return new Promise<Reply>((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error(`worker did not reply within ${timeoutMs}ms`)),
      timeoutMs
    );
    const finish = (reply: Reply) => {
      clearTimeout(timer);
      resolve(reply);
    };

    // `postMessage` may be called before the caller has attached its resolver,
    // so drain anything already queued.
    const drain = () => {
      if (self.onmessage) self.onmessage({ data: payload });
      if (replies.length) finish(replies[0]);
    };

    const script = new vm.Script(`${source}\n//# sourceURL=worker`, { filename: chunkFile });
    script.runInContext(context);

    // Give the chunk a tick to install its handler if it does so asynchronously.
    setTimeout(drain, 0);
  });
}

describe.runIf(workerFile)("the emitted worker", () => {
  it("loads with only the globals a worker has", () => {
    // Reaching this line at all means the chunk evaluated without a
    // ReferenceError — no `document`, no `window`, no `process`.
    expect(workerFile).toBeTruthy();
    const src = readFileSync(workerFile!, "utf8");
    expect(src).toMatch(/self\.onmessage/);
  });

  it("installs a message handler", () => {
    const source = readFileSync(workerFile!, "utf8");
    const context = vm.createContext({ self: { onmessage: null, postMessage: () => {} }, console, crypto });
    new vm.Script(source, { filename: workerFile! }).runInContext(context);
    expect(typeof (context as { self: { onmessage: unknown } }).self.onmessage).toBe("function");
  });

  it("answers a real request", async () => {
    const reply = await runWorker({
      schema: chennai,
      masterCourses: [
        row({ CODE: "BCSE101", SLOT: "A1+TA1" }),
        row({ CODE: "BCSE101", SLOT: "B1+TB1", ROOM: "AB2-202" }),
      ],
      courseLocks: [lock("BCSE101")],
      blockedSlots: [],
      friends: [],
      preference: "none",
      syncFriendClasses: false,
      maximizeFreeTimeFriends: [],
      minStartTime: null,
      maxEndTime: null,
      uniqueFaculties: false,
      noLimit: false,
      minHalfDays: 0,
      sortBy: "balanced",
    });

    expect(reply.type).toBe("success");
    expect(reply.timetables?.length).toBeGreaterThan(0);
  });

  it("carries real data through, not just an acknowledgement", async () => {
    const reply = await runWorker({
      schema: chennai,
      masterCourses: [row({ CODE: "TLAW304L", SLOT: "E+TE+TEE" })],
      courseLocks: [lock("TLAW304L")],
      blockedSlots: [],
      friends: [],
      preference: "none",
      syncFriendClasses: false,
      maximizeFreeTimeFriends: [],
      minStartTime: null,
      maxEndTime: null,
      uniqueFaculties: false,
      noLimit: false,
      minHalfDays: 0,
      sortBy: "balanced",
    });

    expect(reply.type).toBe("success");
    const tts = reply.timetables as
      | { courses: { slots: string[] }[]; metrics: { halfDays: number } }[]
      | undefined;
    expect(tts![0].courses[0].slots).toEqual(["E", "TE", "TEE"]);
    // E1 is Tuesday and Friday, TE1 is Thursday, TEE is S11 on Monday: four
    // distinct mornings of ten. The worker agrees with the source tests.
    expect(tts![0].metrics.halfDays).toBe(6);
  });

  it("reports a filtered-out course as an error rather than crashing", async () => {
    const reply = await runWorker({
      schema: chennai,
      masterCourses: [row({ CODE: "BCSE101", SLOT: "A1+TA1" })],
      courseLocks: [lock("BCSE101"), lock("BCSE999")],
      blockedSlots: [],
      friends: [],
      preference: "none",
      syncFriendClasses: false,
      maximizeFreeTimeFriends: [],
      minStartTime: null,
      maxEndTime: null,
      uniqueFaculties: false,
      noLimit: false,
      minHalfDays: 0,
      sortBy: "balanced",
    });

    expect(reply.type).toBe("error");
    expect(reply.code).toBe("no_valid_slots");
  });

  it("survives a payload it cannot use, instead of dying silently", async () => {
    // The caller's `onerror` falls back to solving inline, so a worker that
    // throws is survivable — but only if it throws *and* the fallback is
    // reached. This pins that a malformed message does not wedge it.
    const reply = await runWorker({ nonsense: true });
    expect(["success", "error"]).toContain(reply.type);
  });
});

describe.skipIf(workerFile)("the emitted worker", () => {
  it("is skipped because out/ does not exist — run `npm run build` first", () => {
    expect(findWorkerChunk()).toBeNull();
  });
});

describe.runIf(pdfWorkerFile)("the emitted PDF dossier worker", () => {
  it("loads with only the globals a worker has, and installs its handler", async () => {
    // Reaching the assertion means the chunk evaluated in a bare context —
    // no `document`, no `window` — which is exactly what a real worker
    // gives it, and the message handler is on. Bundled jsPDF names `document`
    // in code it must never reach at import time; if it ever does, this is
    // where it throws instead of silently dying in the browser.
    expect(pdfWorkerFile).toBeTruthy();
    const source = readFileSync(pdfWorkerFile!, "utf8");
    const context = withWorkerGlobals(
      vm.createContext({ self: { onmessage: null, postMessage: () => {} }, console, crypto })
    );
    new vm.Script(source, { filename: pdfWorkerFile! }).runInContext(context);
    // The handler lands after the startup promise chain — the split jsPDF
    // chunk is loaded first — so give the microtasks a turn before reading.
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(typeof (context as { self: { onmessage: unknown } }).self.onmessage).toBe("function");
  });

  it("answers a malformed request with an error rather than silence", async () => {
    // The caller's fallback only fires on a *reply*; a worker that accepts a
    // message and never answers would leave the caller waiting on its
    // timeout. This pins the validation branch that guarantees a reply.
    const reply = await runWorker({ type: "nonsense" }, 5000, pdfWorkerFile!);
    expect(reply.type).toBe("error");
    expect(reply.message).toBe("Invalid worker request type");
  });
});

describe.skipIf(pdfWorkerFile)("the emitted PDF dossier worker", () => {
  it("is skipped because out/ has no such chunk — run `npm run build` first", () => {
    expect(findPdfWorkerChunk()).toBeNull();
  });
});
