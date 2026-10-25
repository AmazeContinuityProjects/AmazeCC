import { describe, expect, it } from "vitest";
import {
  FFCS_SHARE_VERSION,
  FFCS_SHARE_WARN_LENGTH,
  buildShareUrl,
  buildCompactShareUrl,
  decodeCompactTimetableShare,
  decodeTimetableShare,
  encodeCompactTimetableShare,
  encodeTimetableShare,
  isOversizedShareLink,
} from "../lib/ffcsShare";
import type { AddedCourse, TimetableState } from "../components/custom/exams/FFCS/types";

/**
 * The share codec's contract: a plan survives the round trip exactly as it
 * was shared, and *nothing else* decodes — truncated, tampered, or written by
 * a version this one does not know. A link that half-parses into the wrong
 * timetable is worse than one that says it cannot be read, because the
 * student has no way to tell the difference.
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

const plan = (name = "My Week"): Pick<TimetableState, "name" | "courses"> => ({
  name,
  courses: [course("CSE1001", ["A1", "TA1"]), course("MATH101", ["B1", "TB1"])],
});

describe("encode/decode", () => {
  it("round-trips a plan with its courses intact", () => {
    const decoded = decodeTimetableShare(encodeTimetableShare(plan()));
    expect(decoded).not.toBeNull();
    expect(decoded!.timetable.name).toBe("My Week");
    expect(decoded!.timetable.courses).toEqual(plan().courses);
    expect(decoded!.campus).toBe("chennai");
  });

  it("gives each decode a fresh id, so importing twice yields two plans", () => {
    const encoded = encodeTimetableShare(plan());
    const first = decodeTimetableShare(encoded)!;
    const second = decodeTimetableShare(encoded)!;
    expect(first.timetable.id).not.toBe(second.timetable.id);
  });

  it("stays a URL — the whole point is that the plan travels in the link", () => {
    const encoded = encodeTimetableShare(plan("A considerably longer plan name"));
    expect(encoded).toMatch(/^[A-Za-z0-9+$/=-]+$/);
    expect(encoded.length).toBeLessThan(500);
  });

  it("keeps a course id fallback when one is missing", () => {
    const encoded = encodeTimetableShare({
      name: "x",
      courses: [{ ...course("CSE1001", ["A1"]), id: "" }],
    });
    const decoded = decodeTimetableShare(encoded)!;
    expect(decoded.timetable.courses[0].id).toBe("share-CSE1001");
  });

  it("encodes only the shared semester class-id prefix and selected suffixes", () => {
    const planWithClassIds = {
      name: "Winter plan",
      courses: [
        { ...course("CSE1001", ["A1"]), classId: "CH2026270500002" },
        { ...course("MATH101", ["B1"]), classId: "CH2026270500108" },
      ],
    };
    const encoded = encodeCompactTimetableShare(planWithClassIds, "winter-2026-2027");

    expect(encoded).not.toBeNull();
    expect(decodeCompactTimetableShare(encoded!)).toEqual({
      v: FFCS_SHARE_VERSION,
      s: "winter-2026-2027",
      p: "CH2026270500",
      i: ["002", "108"],
      n: "Winter plan",
    });
    expect(encoded!.length).toBeLessThan(encodeTimetableShare(planWithClassIds).length);
    expect(
      buildCompactShareUrl(encoded!, "https://example.com/")
    ).toContain("/share/ffcs/?x=");
  });

  it("does not offer compact encoding when report class IDs are missing or ambiguous", () => {
    expect(encodeCompactTimetableShare(plan(), "winter-2026-2027")).toBeNull();
    expect(
      encodeCompactTimetableShare(
        {
          name: "duplicate",
          courses: [
            { ...course("CSE1001", ["A1"]), classId: "CH2026270500002" },
            { ...course("CSE1001", ["A1"]), classId: "CH2026270500002" },
          ],
        },
        "winter-2026-2027"
      )
    ).toBeNull();
  });
});

describe("refusals", () => {
  it("refuses the empty, the garbage and the truncated", () => {
    expect(decodeTimetableShare("")).toBeNull();
    expect(decodeTimetableShare("not-a-share-link")).toBeNull();
    const encoded = encodeTimetableShare(plan());
    expect(decodeTimetableShare(encoded.slice(0, Math.floor(encoded.length / 2)))).toBeNull();
  });

  it("refuses a plan from a version it does not understand", () => {
    // Built by hand rather than through the encoder: the encoder only ever
    // writes the current version, which is the point of checking it here.
    const future = encodeTimetableShare(plan());
    const decoded = decodeTimetableShare(future);
    expect(decoded).not.toBeNull();
    // Sanity: the check exists on the wire value, so a bumped v decodes null.
    // (Simulated by re-encoding the wire with a different v via lz-string.)
    const { compressToEncodedURIComponent } = require("lz-string") as typeof import("lz-string");
    const bumped = compressToEncodedURIComponent(
      JSON.stringify({ v: FFCS_SHARE_VERSION + 1, c: "chennai", n: "x", k: plan().courses })
    );
    expect(decodeTimetableShare(bumped)).toBeNull();
  });

  it("refuses a payload with no real courses in it", () => {
    const { compressToEncodedURIComponent } = require("lz-string") as typeof import("lz-string");
    const empty = compressToEncodedURIComponent(
      JSON.stringify({ v: FFCS_SHARE_VERSION, c: "chennai", n: "x", k: [] })
    );
    expect(decodeTimetableShare(empty)).toBeNull();

    const notCourses = compressToEncodedURIComponent(
      JSON.stringify({ v: FFCS_SHARE_VERSION, c: "chennai", n: "x", k: [{ nope: true }] })
    );
    expect(decodeTimetableShare(notCourses)).toBeNull();
  });
});

describe("the URL", () => {
  it("honours the configured base path so a Pages build does not 404", () => {
    const previous = process.env.NEXT_PUBLIC_BASE_PATH;
    process.env.NEXT_PUBLIC_BASE_PATH = "/AmazeCC";
    try {
      expect(buildShareUrl("abc", "https://example.com/")).toBe(
        "https://example.com/AmazeCC/share/ffcs/?d=abc"
      );
    } finally {
      if (previous === undefined) delete process.env.NEXT_PUBLIC_BASE_PATH;
      else process.env.NEXT_PUBLIC_BASE_PATH = previous;
    }
  });

  it("builds at the root when no base path is configured", () => {
    const previous = process.env.NEXT_PUBLIC_BASE_PATH;
    process.env.NEXT_PUBLIC_BASE_PATH = "";
    try {
      expect(buildShareUrl("abc", "https://example.com")).toBe(
        "https://example.com/share/ffcs/?d=abc"
      );
    } finally {
      process.env.NEXT_PUBLIC_BASE_PATH = previous;
    }
  });

  it("encodes compact payloads for safe query-string transport", () => {
    const previous = process.env.NEXT_PUBLIC_BASE_PATH;
    process.env.NEXT_PUBLIC_BASE_PATH = "";
    try {
      expect(buildCompactShareUrl("a+b", "https://example.com")).toBe(
        "https://example.com/share/ffcs/?x=a%2Bb"
      );
    } finally {
      process.env.NEXT_PUBLIC_BASE_PATH = previous;
    }
  });

  it("flags a link long enough to get mangled in transit", () => {
    expect(isOversizedShareLink("x".repeat(FFCS_SHARE_WARN_LENGTH))).toBe(false);
    expect(isOversizedShareLink("x".repeat(FFCS_SHARE_WARN_LENGTH + 1))).toBe(true);
  });
});
