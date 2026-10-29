import { afterEach, describe, expect, it, vi } from "vitest";
import { inflateSync, inflateRawSync } from "node:zlib";
import {
  CLASH_REPORT_COLUMNS,
  CLASH_REPORT_HEADERS,
  CURRICULUM_COLUMNS,
  CURRICULUM_HEADERS,
  buildCurriculumSessions,
  createClashReportPdf,
  downloadClashReportPdf,
  formatClashCell,
} from "../lib/exportClashReport";
import type { AddedCourse } from "../components/custom/exams/FFCS/types";
import { periodsForSlot } from "../lib/slots";
import chennai from "../data/campus/chennai.json";

/**
 * The clash report PDF, end to end under jsdom — jsPDF really runs here (the
 * dossier tests already prove it), so the assertions are on the actual bytes.
 *
 * Text is recovered by inflating the page content streams: jsPDF compresses
 * them with a plain zlib deflate, so `node:zlib` reads them straight back and
 * the report's own sentences can be asserted on without a PDF parser.
 */

const schema = chennai as never;

let sequence = 0;
const course = (over: Partial<AddedCourse> & Pick<AddedCourse, "code" | "slots">): AddedCourse => ({
  id: over.id ?? `course-${++sequence}`,
  code: over.code,
  title: over.title ?? `${over.code} Course`,
  slots: over.slots,
  faculty: over.faculty ?? "Dr Someone",
  venue: over.venue ?? "AB1-101",
  credits: over.credits ?? "3",
  type: over.type ?? "TH",
  color: over.color ?? "bg-blue-600",
});

/** Every inflated content stream, concatenated and latin1-decoded. */
const pdfText = (buffer: ArrayBuffer): string => {
  const bytes = Buffer.from(buffer);
  const decoder = new TextDecoder("latin1");
  const chunks: string[] = [];
  let from = 0;
  for (;;) {
    const marker = bytes.indexOf("stream", from);
    if (marker === -1) break;
    let start = marker + "stream".length;
    if (bytes[start] === 0x0d) start++;
    if (bytes[start] === 0x0a) start++;
    const end = bytes.indexOf("endstream", start);
    if (end === -1) break;
    try {
      chunks.push(decoder.decode(inflateSync(bytes.subarray(start, end))));
    } catch {
      try {
        chunks.push(decoder.decode(inflateRawSync(bytes.subarray(start, end))));
      } catch {
        // Not every "stream" keyword opens a deflate stream; skip what won't read.
      }
    }
    from = end + "endstream".length;
  }
  return chunks.join("\n");
};

const clashingPlan = (): AddedCourse[] => [
  course({ code: "BCSE101", slots: ["A1"], title: "Data Structures" }),
  course({ code: "BCSE102", slots: ["L1"], type: "LO", title: "Data Structures Lab" }),
];

describe("clash report column layout", () => {
  it("fits eight columns into the dossier's 171mm usable width", () => {
    expect(CLASH_REPORT_COLUMNS).toHaveLength(8);
    expect(CLASH_REPORT_HEADERS).toHaveLength(8);
    expect(CLASH_REPORT_HEADERS[7]).toBe("CLASHES WITH");
    const total = CLASH_REPORT_COLUMNS.reduce((sum, width) => sum + width, 0);
    expect(total).toBe(171);
    // Every column must be wide enough for its wrapped text padding.
    expect(CLASH_REPORT_COLUMNS.every((width) => width > 5)).toBe(true);
  });
});

describe("curriculum column layout", () => {
  it("fits seven columns into the dossier's 171mm usable width", () => {
    expect(CURRICULUM_COLUMNS).toHaveLength(7);
    expect(CURRICULUM_HEADERS).toHaveLength(7);
    expect(CURRICULUM_HEADERS[0]).toBe("DAY");
    expect(CURRICULUM_HEADERS[1]).toBe("TIME");
    expect(CURRICULUM_HEADERS[2]).toBe("TYPE");
    const total = CURRICULUM_COLUMNS.reduce((sum, width) => sum + width, 0);
    expect(total).toBe(171);
    expect(CURRICULUM_COLUMNS.every((width) => width > 5)).toBe(true);
  });
});

describe("buildCurriculumSessions", () => {
  it("expands a theory slot into one session per day, Monday first", () => {
    const sessions = buildCurriculumSessions(
      [course({ code: "BCSE101", slots: ["A1"], title: "Data Structures" })],
      schema,
    );

    // Chennai's A1: Monday 8:00-8:50 and Wednesday 8:55-9:45.
    expect(periodsForSlot(schema, "A1")).toHaveLength(2);
    expect(sessions.map((s) => `${s.day} ${s.startMin}-${s.endMin}`)).toEqual(["Mon 480-530", "Wed 535-585"]);
    expect(sessions.every((s) => s.type === "theory")).toBe(true);
    expect(sessions[0]).toMatchObject({
      code: "BCSE101",
      title: "Data Structures",
      faculty: "Dr Someone",
      venue: "AB1-101",
    });
  });

  it("merges a lab pair's consecutive periods into one class block", () => {
    const sessions = buildCurriculumSessions([course({ code: "BCSE102", slots: ["L1", "L2"], type: "LO" })], schema);

    // Chennai's L1 and L2 are back to back on Monday: 8:00-8:50 and 8:50-9:40.
    expect(sessions).toHaveLength(1);
    expect(sessions[0]).toMatchObject({ day: "Mon", type: "lab", startMin: 480, endMin: 580 });
  });

  it("collapses duplicate slot tokens and drops NIL and unknown slots", () => {
    const sessions = buildCurriculumSessions(
      [course({ code: "BCSE101", slots: ["A1", "A1"] }), course({ code: "GENED01", slots: ["NIL", "ZZ99"] })],
      schema,
    );

    expect(sessions).toHaveLength(2);
    expect(new Set(sessions.map((s) => s.code))).toEqual(new Set(["BCSE101"]));
  });

  it("orders the week day-major, then by start time, then by code", () => {
    const sessions = buildCurriculumSessions(
      [
        course({ code: "BCSE102", slots: ["L1"], type: "LO" }), // Mon 8:00
        course({ code: "BCSE101", slots: ["A1"] }), // Mon 8:00 + Wed 8:55
        course({ code: "BCSE103", slots: ["C1"] }), // Wed 8:00 + Fri 8:55
      ],
      schema,
    );

    expect(sessions.map((s) => `${s.day}:${s.code}`)).toEqual([
      "Mon:BCSE101",
      "Mon:BCSE102",
      "Wed:BCSE103",
      "Wed:BCSE101",
      "Fri:BCSE103",
    ]);
  });
});

describe("formatClashCell", () => {
  it("renders a dash when there is nothing to report", () => {
    expect(formatClashCell(undefined)).toBe("-");
    expect(formatClashCell([])).toBe("-");
  });

  it("renders one code with every clashing day, start time only", () => {
    expect(
      formatClashCell([
        { code: "CSE3001", title: "OS", day: "Mon", timeRange: "10:00-11:35" },
        { code: "CSE3001", title: "OS", day: "Wed", timeRange: "10:45-11:35" },
        { code: "MAT2005", title: "DM", day: "Tue", timeRange: "08:00-08:50" },
      ]),
    ).toBe("CSE3001 (Mon 10:00, Wed 10:45); MAT2005 (Tue 08:00)");
  });

  it("drops repeated identical windows", () => {
    expect(
      formatClashCell([
        { code: "CSE3001", title: "OS", day: "Mon", timeRange: "10:00-11:35" },
        { code: "CSE3001", title: "OS", day: "Mon", timeRange: "10:00-11:35" },
      ]),
    ).toBe("CSE3001 (Mon 10:00)");
  });
});

describe("createClashReportPdf", () => {
  it("returns a real PDF carrying the plan name, the clash verdict and the footer", async () => {
    const buffer = await createClashReportPdf({
      planName: "My Plan",
      courses: clashingPlan(),
      schema,
      generatedAt: new Date("2026-01-05T10:00:00"),
    });

    expect(buffer).toBeInstanceOf(ArrayBuffer);
    expect(buffer.byteLength).toBeGreaterThan(1000);
    const bytes = new Uint8Array(buffer);
    expect(String.fromCharCode(...bytes.slice(0, 5))).toBe("%PDF-");

    const text = pdfText(buffer);
    expect(text).toContain("My Plan");
    expect(text).toContain("1 clash detected");
    // jsPDF escapes the parentheses of the cell on the content stream.
    expect(text).toContain("BCSE102 \\(Mon 08:00\\)");
    expect(text).toContain("Clash report generated by AmazeCC - amazecc.com");
  });

  it("says so when the plan is clash-free", async () => {
    const buffer = await createClashReportPdf({
      planName: "Clean Plan",
      courses: [course({ code: "BCSE101", slots: ["A1"] }), course({ code: "BCSE103", slots: ["C1"] })],
      schema,
    });

    expect(pdfText(buffer)).toContain("No clashes - all courses fit");
  });

  it("prints the weekly curriculum with a day and clock window per class", async () => {
    const buffer = await createClashReportPdf({
      planName: "Curriculum Plan",
      courses: [
        course({ code: "BCSE101", slots: ["A1"], title: "Data Structures" }),
        course({ code: "BCSE102", slots: ["L1", "L2"], type: "LO", title: "Data Structures Lab" }),
      ],
      schema,
    });

    const text = pdfText(buffer);
    expect(text).toContain("Weekly Curriculum");
    expect(text).toContain("08:00-08:50"); // A1, Monday
    expect(text).toContain("08:55-09:45"); // A1, Wednesday
    expect(text).toContain("08:00-09:40"); // the merged L1+L2 lab block
    expect(text).toContain("Theory");
    expect(text).toContain("Lab");
  });

  it("splits a long course list across pages and repeats the credit line", async () => {
    const courses = Array.from({ length: 40 }, (_, i) =>
      course({
        code: `BCSE${100 + i}`,
        slots: [`L${(i % 60) + 1}`],
        title: `A deliberately long course title for wrapping number ${i + 1}`,
        faculty: `Faculty Member With A Long Name ${i + 1}`,
      }),
    );

    const buffer = await createClashReportPdf({ planName: "Big Plan", courses, schema });

    const raw = Buffer.from(buffer).toString("latin1");
    const pageCount = raw.match(/\/Type\s*\/Page[^s]/g)?.length ?? 0;
    expect(pageCount).toBeGreaterThan(1);
    expect(pdfText(buffer).match(/Clash report generated by AmazeCC/g)?.length).toBe(pageCount);
  });

  it("handles an empty plan without crashing", async () => {
    const buffer = await createClashReportPdf({ planName: "Empty", courses: [], schema });
    expect(new Uint8Array(buffer)[0]).toBe(0x25); // "%"
  });
});

describe("downloadClashReportPdf", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("downloads the buffer as a PDF named after the plan", async () => {
    const createObjectURL = vi.fn((_blob: Blob) => "blob:clash-report");
    const revokeObjectURL = vi.fn();
    vi.stubGlobal("URL", { createObjectURL, revokeObjectURL });
    let downloadedFile = "";
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (
      this: HTMLAnchorElement,
    ) {
      downloadedFile = this.download;
    });

    await downloadClashReportPdf({ planName: "My Plan!", courses: clashingPlan(), schema });

    expect(createObjectURL).toHaveBeenCalledOnce();
    const blob = createObjectURL.mock.calls[0][0] as Blob;
    expect(blob.type).toBe("application/pdf");
    expect(clickSpy).toHaveBeenCalledOnce();
    expect(downloadedFile).toBe("My_Plan__FFCS_Clash_Report.pdf");
  });
});
