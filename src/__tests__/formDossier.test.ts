import { afterEach, describe, expect, it, vi } from "vitest";
import { inflateSync, inflateRawSync } from "node:zlib";
import {
  FORM_INK,
  PRINT_COURSE_COLUMNS,
  PRINT_COURSE_HEADERS,
  PRINT_DROPIN_COLUMNS,
  PRINT_DROPIN_HEADERS,
  PRINT_FACULTY_COLUMNS,
  PRINT_FACULTY_HEADERS,
  createPrintDossierPdf,
  downloadPrintDossierPdf,
  printSafe,
} from "../lib/formDossier";
import { setVitfacIntegrationEnabled } from "@/lib/vitfacService";
import type { AddedCourse } from "@/lib/ffcsTypes";
import type { PrintDossierParams } from "../lib/formDossier";
import chennai from "../data/campus/chennai.json";

/**
 * The print dossier, end to end under jsdom — jsPDF really runs here, so the
 * assertions are on the actual bytes. Text is recovered by inflating the page
 * content streams (jsPDF compresses them with plain zlib), the same trick the
 * clash-report tests use, which lets the report's own sentences and the
 * monochrome rules be asserted without a PDF parser.
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

/** A morning block plus an afternoon period, so `ensureLunchPeriod` fires. */
const baseParams = (): PrintDossierParams => ({
  timetableName: "Winter 2026",
  courses: [course({ code: "CSE1001", slots: ["A1"], title: "Foundations of Computing", faculty: "Dr Ada Lovelace" })],
  theoryPeriods: [
    { start: "08:00 AM", end: "08:50 AM", days: { mon: "A1", wed: "A1" } },
    { start: "08:50 AM", end: "09:40 AM", days: {} },
    { start: "02:00 PM", end: "02:50 PM", days: {} },
  ],
  labPeriods: [
    { start: "08:00 AM", end: "08:50 AM", days: {} },
    { start: "08:50 AM", end: "09:40 AM", days: {} },
  ],
  schema,
  generatedAt: new Date("2026-01-05T10:00:00"),
});

describe("print dossier layout", () => {
  it("keeps every ink value pure gray - no hue anywhere", () => {
    for (const [name, hex] of Object.entries(FORM_INK)) {
      expect(hex, `${name} must be a hex color`).toMatch(/^#[0-9a-f]{6}$/);
      const r = parseInt(hex.slice(1, 3), 16);
      const g = parseInt(hex.slice(3, 5), 16);
      const b = parseInt(hex.slice(5, 7), 16);
      expect(r, `${name} (${hex}) must be gray`).toBe(g);
      expect(g, `${name} (${hex}) must be gray`).toBe(b);
    }
  });

  it("fits the course register into the 178mm content box", () => {
    expect(PRINT_COURSE_HEADERS).toHaveLength(PRINT_COURSE_COLUMNS.length);
    expect(PRINT_COURSE_HEADERS[0]).toBe("CODE");
    expect(PRINT_COURSE_COLUMNS.reduce((sum, width) => sum + width, 0)).toBe(178);
    expect(PRINT_COURSE_COLUMNS.every((width) => width > 5)).toBe(true);
  });

  it("fits the faculty and drop-in tables into the same box", () => {
    expect(PRINT_FACULTY_HEADERS).toHaveLength(PRINT_FACULTY_COLUMNS.length);
    expect(PRINT_DROPIN_HEADERS).toHaveLength(PRINT_DROPIN_COLUMNS.length);
    expect(PRINT_FACULTY_COLUMNS.reduce((sum, width) => sum + width, 0)).toBe(178);
    expect(PRINT_DROPIN_COLUMNS.reduce((sum, width) => sum + width, 0)).toBe(178);
    expect(PRINT_DROPIN_HEADERS[3]).toBe("DROP-IN ALTERNATIVES");
  });
});

describe("printSafe", () => {
  it("folds typographic punctuation to its ASCII twin", () => {
    expect(printSafe("A \u2013 B \u2014 C \u2018x\u2019 \u201cok\u201d \u2026")).toBe("A - B - C 'x' \"ok\" ...");
    expect(printSafe("\u2605 4.4 \u2022 note")).toBe("* 4.4 - note");
  });

  it("keeps Latin-1 names and drops what the standard fonts cannot draw", () => {
    expect(printSafe("Jos\u00e9 Garc\u00eda")).toBe("Jos\u00e9 Garc\u00eda");
    expect(printSafe("emoji \u{1F600} gone")).toBe("emoji  gone");
    expect(printSafe("\u4e2d\u6587 name")).toBe(" name");
  });
});

describe("createPrintDossierPdf", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    setVitfacIntegrationEnabled(true);
  });

  it("returns a real PDF laid out as a form with numbered sections", async () => {
    const buffer = await createPrintDossierPdf(baseParams());

    expect(buffer).toBeInstanceOf(ArrayBuffer);
    expect(buffer.byteLength).toBeGreaterThan(1500);
    expect(String.fromCharCode(...new Uint8Array(buffer).slice(0, 5))).toBe("%PDF-");

    const text = pdfText(buffer);
    expect(text).toContain("FFCS REGISTRATION DOSSIER - Winter 2026");
    expect(text).toContain("PLAN NAME");
    expect(text).toContain("VIT Chennai");
    expect(text).toContain("CLASH STATUS");
    expect(text).toContain("None - all fit");
    expect(text).toContain("1. WEEKLY CLASS SCHEDULE");
    expect(text).toContain("2. COURSE REGISTER");
    expect(text).toContain("4. DROP-IN REPLACEMENTS");
    expect(text).toContain("CSE1001");
    expect(text).toContain("Dr Ada Lovelace");
    expect(text).toContain("LUNCH");
    expect(text).toContain("Page 1 of");
    expect(text).toContain("Print-friendly dossier generated by AmazeCC - amazecc.com");
  });

  it("reports a clash in the header field when the plan has one", async () => {
    const buffer = await createPrintDossierPdf({
      ...baseParams(),
      courses: [
        course({ code: "BCSE101", slots: ["A1"] }),
        course({ code: "BCSE102", slots: ["L1"], type: "LO", title: "Data Structures Lab" }),
      ],
    });
    expect(pdfText(buffer)).toContain("1 clash detected");
  });

  it("carries the faculty assessment with win rates when Vitfac is on", async () => {
    const buffer = await createPrintDossierPdf(baseParams());
    const text = pdfText(buffer);
    expect(text).toContain("3. FACULTY ASSESSMENT");
    expect(text).toContain("WIN RATE");
    expect(text).toContain("Unreviewed");
  });

  it("omits the assessment section entirely when Vitfac is off", async () => {
    setVitfacIntegrationEnabled(false);
    const buffer = await createPrintDossierPdf(baseParams());
    const text = pdfText(buffer);
    expect(text).not.toContain("FACULTY ASSESSMENT");
    expect(text).toContain("2. COURSE REGISTER");
  });

  it("lists same-slot drop-in alternatives when the master catalog is loaded", async () => {
    const buffer = await createPrintDossierPdf({
      ...baseParams(),
      masterCourses: [
        {
          CODE: "CSE1001",
          TITLE: "Foundations of Computing",
          TYPE: "TH",
          CREDITS: "4",
          ROOM: "AB1-205",
          SLOT: "A1",
          FACULTY: "Dr Grace Hopper",
          ERP_ID: "10042",
        },
      ],
    });
    const text = pdfText(buffer);
    expect(text).toContain("DROP-IN ALTERNATIVES");
    expect(text).toContain("Dr Grace Hopper");
    expect(text).toContain("AB1-205");
  });

  it("says so instead of printing an empty matrix when no catalog is loaded", async () => {
    const buffer = await createPrintDossierPdf(baseParams());
    expect(pdfText(buffer)).toContain("Load the master FFCS catalog");
  });

  it("splits a long register across pages and stamps every page footer", async () => {
    const courses = Array.from({ length: 40 }, (_, i) =>
      course({
        code: `BCSE${100 + i}`,
        slots: [`L${(i % 60) + 1}`],
        title: `A deliberately long course title for wrapping number ${i + 1}`,
        faculty: `Faculty Member With A Long Name ${i + 1}`,
      }),
    );

    const buffer = await createPrintDossierPdf({ ...baseParams(), courses });

    const raw = Buffer.from(buffer).toString("latin1");
    const pageCount = raw.match(/\/Type\s*\/Page[^s]/g)?.length ?? 0;
    expect(pageCount).toBeGreaterThan(1);
    expect(pdfText(buffer).match(/Print-friendly dossier generated by AmazeCC/g)?.length).toBe(pageCount);
  });

  it("handles an empty plan without crashing", async () => {
    const buffer = await createPrintDossierPdf({ ...baseParams(), courses: [] });
    const text = pdfText(buffer);
    expect(new Uint8Array(buffer)[0]).toBe(0x25); // "%"
    expect(text).toContain("No courses on this plan yet.");
  });
});

describe("downloadPrintDossierPdf", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("downloads the buffer as a PDF named after the plan", async () => {
    const createObjectURL = vi.fn((_blob: Blob) => "blob:print-dossier");
    const revokeObjectURL = vi.fn();
    vi.stubGlobal("URL", { createObjectURL, revokeObjectURL });
    let downloadedFile = "";
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (
      this: HTMLAnchorElement,
    ) {
      downloadedFile = this.download;
    });

    await downloadPrintDossierPdf(baseParams());

    expect(createObjectURL).toHaveBeenCalledOnce();
    const blob = createObjectURL.mock.calls[0][0] as Blob;
    expect(blob.type).toBe("application/pdf");
    expect(clickSpy).toHaveBeenCalledOnce();
    expect(downloadedFile).toBe("Winter_2026_FFCS_Print_Dossier.pdf");
  });
});
