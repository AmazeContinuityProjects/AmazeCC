import { afterEach, describe, expect, it, vi } from "vitest";
import { ShareInputError, loadShareInput, parseShareInput, resolveShareInput } from "../lib/ffcsShareInput";
import {
  buildShareUrl,
  buildCompactShareUrl,
  encodeCompactTimetableShare,
  encodeNumericTimetableShapeShare,
  encodeTimetableShapeShare,
  encodeTimetableShare,
} from "../lib/ffcsShare";
import type { AddedCourse, ParsedCourse } from "../components/custom/exams/FFCS/types";

/**
 * The add-friend input's contract: a pasted share URL *or* the bare TT-shape
 * code inside it identifies one of the four payloads, and any of them becomes
 * the same timetable the share page would have shown. What it must not do is
 * read a truncated or foreign string as a plan — an unreadable paste and a
 * network outage are different mistakes and get different error codes.
 */

const course = (code: string, slots: string[]): AddedCourse => ({
  id: `c-${code}`,
  code,
  title: `${code} title`,
  slots,
  faculty: "Dr. Example",
  venue: "AB1-101",
  credits: "3",
  type: "ETH",
  color: "bg-blue-500",
});

const plan = (name = "My Week") => ({
  name,
  courses: [course("CSE1001", ["A1", "TA1"]), course("MATH101", ["B1", "TB1"])],
});

/** A plan carrying report class IDs, so the short formats can encode it. */
const planWithClassIds = () => ({
  name: "Their Week",
  courses: [
    { ...course("CSE1001", ["A1", "TA1"]), classId: "CH2026270501234", classIds: ["CH2026270501234"] },
    { ...course("MATH101", ["B1", "TB1"]), classId: "CH2026270505678", classIds: ["CH2026270505678"] },
  ],
});

const reportRows = (): ParsedCourse[] => [
  {
    CODE: "CSE1001",
    TITLE: "CSE1001 title",
    TYPE: "ETH",
    CREDITS: "3",
    ROOM: "AB1-101",
    SLOT: "A1+TA1",
    FACULTY: "Dr. Example",
    CLASS_ID: "CH2026270501234",
  },
  {
    CODE: "MATH101",
    TITLE: "MATH101 title",
    TYPE: "ETH",
    CREDITS: "4",
    ROOM: "AB1-102",
    SLOT: "B1+TB1",
    FACULTY: "Dr. Example",
    CLASS_ID: "CH2026270505678",
  },
];

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("parseShareInput", () => {
  it("recognises a full link", () => {
    const encoded = encodeTimetableShare(plan());
    const parsed = parseShareInput(buildShareUrl(encoded, "https://example.com"))!;
    expect(parsed.format).toBe("full");
    expect(parsed.encoded).toBe(encoded);
  });

  it("recognises a compact link and its bare code", () => {
    const encoded = encodeCompactTimetableShare(planWithClassIds(), "winter-2026-2027")!;
    expect(parseShareInput(buildCompactShareUrl(encoded, "https://example.com"))?.format).toBe("compact");
    // The bare code is what a chat app delivers — it must parse too, and it
    // must read as compact rather than as a shape: the shape decoder also
    // accepts this payload's `p`/`i` keys, but would guess the semester from
    // the prefix instead of using the explicit one it carries.
    expect(parseShareInput(encoded)?.format).toBe("compact");
  });

  it("recognises a TT-shape link and its bare code", () => {
    const encoded = encodeTimetableShapeShare(planWithClassIds(), "winter-2026-2027")!;
    expect(parseShareInput(`https://example.com/share/ffcs/?q=${encoded}`)?.format).toBe("shape");
    expect(parseShareInput(encoded)?.format).toBe("shape");
  });

  it("recognises a numeric TT-shape link and its bare code", () => {
    const encoded = encodeNumericTimetableShapeShare(planWithClassIds(), "winter-2026-2027")!;
    expect(parseShareInput(`https://example.com/share/ffcs/?r=${encoded}`)?.format).toBe("numeric-shape");
    expect(parseShareInput(encoded)?.format).toBe("numeric-shape");
  });

  it("reads a pasted bare query as well as a whole URL", () => {
    const encoded = encodeTimetableShapeShare(planWithClassIds(), "winter-2026-2027")!;
    expect(parseShareInput(`?q=${encoded}`)?.format).toBe("shape");
    expect(parseShareInput(`q=${encoded}`)?.format).toBe("shape");
  });

  it("decodes a percent-encoded payload", () => {
    const encoded = encodeTimetableShare(plan());
    const parsed = parseShareInput(`https://example.com/share/ffcs/?d=${encodeURIComponent(encoded)}`)!;
    expect(parsed.format).toBe("full");
    expect(parsed.encoded).toBe(encoded);
  });

  it("returns null for anything that is none of the four shapes", () => {
    expect(parseShareInput("")).toBeNull();
    expect(parseShareInput("   ")).toBeNull();
    expect(parseShareInput("https://example.com/share/ffcs/")).toBeNull();
    expect(parseShareInput("not-a-share-code")).toBeNull();
    // A `d=` value that is not a valid payload is still *identified* as a
    // full payload here — resolution is what rejects it. But a query key the
    // feature does not use carries no format at all.
    expect(parseShareInput("?z=whatever")).toBeNull();
  });
});

describe("resolveShareInput", () => {
  it("resolves a full link with no report and no network", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    const encoded = encodeTimetableShare(plan());
    const resolved = await resolveShareInput(parseShareInput(encoded)!, {
      reportCourses: reportRows(),
      reportSemesterId: "winter-2026-2027",
    });
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(resolved.timetable.name).toBe("My Week");
    expect(resolved.timetable.courses.map((c) => c.code)).toEqual(["CSE1001", "MATH101"]);
  });

  it("resolves a shape code against the caller's report without fetching", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    const encoded = encodeTimetableShapeShare(planWithClassIds(), "winter-2026-2027")!;
    const resolved = await resolveShareInput(parseShareInput(encoded)!, {
      reportCourses: reportRows(),
      reportSemesterId: "winter-2026-2027",
    });
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(resolved.timetable.name).toBe("Shared timetable");
    expect(resolved.timetable.courses.map((c) => c.classId)).toEqual(["CH2026270501234", "CH2026270505678"]);
    // Slots come back split the way the planner stores them, not as the
    // report's `A1+TA1` string.
    expect(resolved.timetable.courses[0].slots).toEqual(["A1", "TA1"]);
  });

  it("ignores a caller report written for a different semester and fetches", async () => {
    const fetchSpy = vi.fn(async () => {
      throw new TypeError("offline");
    });
    vi.stubGlobal("fetch", fetchSpy);
    const encoded = encodeTimetableShapeShare(planWithClassIds(), "winter-2026-2027")!;
    await expect(
      resolveShareInput(parseShareInput(encoded)!, {
        reportCourses: reportRows(),
        reportSemesterId: "previous",
      }),
    ).rejects.toMatchObject({ code: "network" });
    expect(fetchSpy).toHaveBeenCalled();
  });

  it("reports a class ID the semester's list does not contain", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    const encoded = encodeTimetableShapeShare(planWithClassIds(), "winter-2026-2027")!;
    const partial = reportRows().slice(0, 1);
    await expect(
      resolveShareInput(parseShareInput(encoded)!, {
        reportCourses: partial,
        reportSemesterId: "winter-2026-2027",
      }),
    ).rejects.toMatchObject({ code: "report" });
  });

  it("distinguishes an unreadable payload from a network failure", async () => {
    const input = parseShareInput("d=definitely-not-a-payload")!;
    await expect(resolveShareInput(input)).rejects.toBeInstanceOf(ShareInputError);
    await expect(resolveShareInput(input)).rejects.toMatchObject({ code: "unreadable" });
  });
});

describe("loadShareInput", () => {
  it("rejects an unrecognised paste as unreadable", async () => {
    await expect(loadShareInput("come check my timetable")).rejects.toMatchObject({
      code: "unreadable",
    });
  });

  it("parses and resolves in one call", async () => {
    vi.stubGlobal("fetch", vi.fn());
    const encoded = encodeCompactTimetableShare(planWithClassIds(), "winter-2026-2027")!;
    const resolved = await loadShareInput(encoded, {
      reportCourses: reportRows(),
      reportSemesterId: "winter-2026-2027",
    });
    expect(resolved.timetable.name).toBe("Their Week");
    expect(resolved.timetable.courses).toHaveLength(2);
  });
});
