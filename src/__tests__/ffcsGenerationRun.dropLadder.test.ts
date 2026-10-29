import { describe, expect, it, vi, beforeEach } from "vitest";
import { renderHook } from "@testing-library/react";
import type { GenerateParams, GenerationHandle } from "../components/custom/exams/FFCS/logic/generator";
import type { TimetableState } from "../components/custom/exams/FFCS/types";

/**
 * The drop ladder's orchestration, pinned against a mocked worker.
 *
 * The pure policy has its own suite (`ffcsDropPolicy.test.ts`); what needs a
 * hook here is the *sequencing*: which failures retry, which do not, and the
 * promise that a retry never appends a second attempt's results beside the
 * first's.
 */

const startGeneration = vi.fn();

vi.mock("../components/custom/exams/FFCS/logic/generator", () => ({
  startGeneration: (...args: unknown[]) => startGeneration(...args),
}));

import { useGenerationRun } from "../components/custom/exams/FFCS/hooks/useGenerationRun";

const params = (codes: string[]): GenerateParams =>
  ({
    schema: {} as never,
    masterCourses: codes.map((code) => ({ CODE: code })),
    courseLocks: codes.map((code) => ({ code })),
    blockedSlots: [],
    friends: [],
  }) as unknown as GenerateParams;

const settle = (value: unknown): GenerationHandle =>
  ({ result: Promise.resolve(value), cancel: vi.fn() }) as unknown as GenerationHandle;

const ok = (codes: string[]): { kind: "ok"; timetables: TimetableState[]; capped: boolean } => ({
  kind: "ok",
  timetables: codes.map((code) => ({ courses: [{ code }] })) as unknown as TimetableState[],
  capped: false,
});

const fail = (code: string, subjectCode?: string) => ({
  kind: "error" as const,
  code,
  ...(subjectCode ? { subjectCode } : {}),
});

const nextMockResult = (value: unknown) => startGeneration.mockImplementation(() => settle(value));

beforeEach(() => {
  startGeneration.mockReset();
});

describe("useGenerationRun drop ladder", () => {
  it("runs once and drops nothing when All Subjects Mode is on (no options)", async () => {
    nextMockResult(ok(["A"]));
    const { result } = renderHook(() => useGenerationRun());
    const out = await result.current.run(params(["A", "B"]));
    expect(out.kind).toBe("ok");
    expect(out.droppedCourses).toBeUndefined();
    expect(startGeneration).toHaveBeenCalledTimes(1);
  });

  it("retries with the tail dropped after no_conflict_free, naming the drop", async () => {
    // Two failed attempts (dropping one, then two), then a plan with both left out.
    startGeneration
      .mockImplementationOnce(() => settle(fail("no_conflict_free")))
      .mockImplementationOnce(() => settle(fail("no_conflict_free")))
      .mockImplementationOnce(() => settle(ok(["A", "B"])));
    const { result } = renderHook(() => useGenerationRun());
    const out = await result.current.run(params(["A", "B"]), undefined, {
      drop: { courseOrder: ["A", "B"] },
    });
    expect(out.kind).toBe("ok");
    expect(out.droppedCourses).toEqual(["B", "A"]);
    expect(startGeneration).toHaveBeenCalledTimes(3);
    // The final attempt must not include the dropped courses — with both
    // dropped, no locks or courses remain for the solver to walk.
    const finalParams = startGeneration.mock.calls[2][0] as GenerateParams;
    expect(finalParams.courseLocks).toEqual([]);
    expect(finalParams.masterCourses).toEqual([]);
  });

  it("never retries a crash — a retry would hide a real bug", async () => {
    nextMockResult(fail("error"));
    const { result } = renderHook(() => useGenerationRun());
    const out = await result.current.run(params(["A", "B"]), undefined, {
      drop: { courseOrder: ["A", "B"] },
    });
    expect(out.kind).toBe("error");
    expect(startGeneration).toHaveBeenCalledTimes(1);
  });

  it("stops the ladder once the drop budget is spent and returns the first failure", async () => {
    nextMockResult(fail("no_conflict_free"));
    const { result } = renderHook(() => useGenerationRun());
    const out = await result.current.run(params(["A", "B", "C"]), undefined, {
      drop: { courseOrder: ["A", "B", "C"], maxDrops: 2 },
    });
    expect(out.kind).toBe("error");
    if (out.kind === "error") expect(out.code).toBe("no_conflict_free");
    // Initial attempt + two drops.
    expect(startGeneration).toHaveBeenCalledTimes(3);
    // A failure never claims a drop — there is no result to have dropped from.
    expect(out.droppedCourses).toBeUndefined();
  });

  it("never drops a protected course", async () => {
    nextMockResult(fail("no_conflict_free"));
    const { result } = renderHook(() => useGenerationRun());
    await result.current.run(params(["A", "B"]), undefined, {
      drop: { courseOrder: ["A", "B"], protectedCodes: ["B"] },
    });
    // Only A was droppable, so exactly one retry happened, with B intact.
    const finalParams = startGeneration.mock.calls[1][0] as GenerateParams;
    expect(finalParams.courseLocks.map((l) => l.code)).toEqual(["B"]);
  });

  it("does not retry once the caller has streamed batches", async () => {
    // The first attempt streams a batch and then settles empty — retrying
    // would append attempt two's options beside attempt one's on screen.
    startGeneration.mockImplementationOnce((p, hooks: { onBatch?: (b: unknown) => void } | undefined) => {
      hooks?.onBatch?.([{ courses: [] }]);
      return settle({ kind: "ok", timetables: [], capped: false });
    });
    const { result } = renderHook(() => useGenerationRun());
    const onBatch = vi.fn();
    const out = await result.current.run(params(["A", "B"]), onBatch, {
      drop: { courseOrder: ["A", "B"] },
    });
    expect(onBatch).toHaveBeenCalled();
    expect(startGeneration).toHaveBeenCalledTimes(1);
    expect(out.kind).toBe("ok");
    expect(out.droppedCourses).toBeUndefined();
  });

  it("drops the course the solver named under no_valid_slots, out of order", async () => {
    startGeneration
      .mockImplementationOnce(() => settle(fail("no_valid_slots", "A")))
      .mockImplementationOnce(() => settle(ok(["B"])));
    const { result } = renderHook(() => useGenerationRun());
    const out = await result.current.run(params(["A", "B"]), undefined, {
      drop: { courseOrder: ["A", "B"] },
    });
    expect(out.kind).toBe("ok");
    // A is named by the failure, so it goes first even though B is lower priority.
    expect(out.droppedCourses).toEqual(["A"]);
    const finalParams = startGeneration.mock.calls[1][0] as GenerateParams;
    expect(finalParams.courseLocks.map((l) => l.code)).toEqual(["B"]);
  });
});
