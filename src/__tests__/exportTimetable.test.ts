import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  generateModernTimetableHtml,
  downloadModernTimetableImage,
  generateModernPrintableHtml,
  generateModernDossierInnerHtml,
  downloadModernTimetablePdf,
  compileDossierPdfInline,
  compileDossierPdf,
  generateModernDossierHtml,
  downloadModernDossierHtml,
  openModernPrintableDossier,
  openTimetablePrintablePage,
} from "../lib/exportTimetable";
import type { AddedCourse, TimetablePeriod, ParsedCourse } from "../components/custom/exams/FFCS/types";
import * as vitfacService from "../lib/vitfacService";

describe("Modern Timetable Export", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  const mockCourses: AddedCourse[] = [
    {
      id: "course-1",
      code: "BCSE202",
      title: "Data Structures",
      faculty: "Dr. Ramesh",
      employeeId: "10090",
      venue: "AB1-201",
      slots: ["A1", "TA1"],
      credits: "3",
      type: "TH",
      color: "bg-blue-600",
    },
    {
      id: "course-2",
      code: "BCSE202L",
      title: "Data Structures Lab",
      faculty: "Dr. Ramesh",
      employeeId: "10090",
      venue: "SJT-LAB1",
      slots: ["L31", "L32"],
      credits: "1",
      type: "LO",
      color: "bg-purple-600",
    },
  ];

  const mockMasterCourses: ParsedCourse[] = [
    {
      CODE: "BCSE202",
      TITLE: "Data Structures",
      FACULTY: "Dr. Ramesh",
      ERP_ID: "10090",
      ROOM: "AB1-201",
      SLOT: "A1+TA1",
      CREDITS: "3",
      TYPE: "TH",
    },
    {
      CODE: "BCSE202",
      TITLE: "Data Structures",
      FACULTY: "Dr. Suresh",
      ERP_ID: "10095",
      ROOM: "AB1-205",
      SLOT: "A1+TA1",
      CREDITS: "3",
      TYPE: "TH",
    },
  ];

  const mockTheoryPeriods: TimetablePeriod[] = [
    {
      slot: "P1",
      start: "8:00 AM",
      end: "8:50 AM",
      days: { mon: "A1", wed: "A1" },
    },
    {
      slot: "P2",
      start: "8:55 AM",
      end: "9:45 AM",
      days: { fri: "TA1" },
    },
    {
      lunch: true,
      slot: "LUNCH",
      start: "1:20 PM",
      end: "2:00 PM",
      days: {},
    },
  ];

  const mockLabPeriods: TimetablePeriod[] = [
    {
      slot: "L1",
      start: "8:00 AM",
      end: "8:50 AM",
      days: { mon: "L1" },
    },
    {
      slot: "L2",
      start: "8:50 AM",
      end: "9:40 AM",
      days: { mon: "L2" },
    },
    {
      lunch: true,
      slot: "LUNCH",
      start: "1:20 PM",
      end: "2:00 PM",
      days: {},
    },
  ];

  it("generates modern HTML for vertical view with review showcase", () => {
    const html = generateModernTimetableHtml({
      timetableName: "Draft Timetable",
      courses: mockCourses,
      theoryPeriods: mockTheoryPeriods,
      labPeriods: mockLabPeriods,
      viewMode: "vertical",
    });

    expect(html).toContain("Draft Timetable");
    expect(html).toContain("BCSE202");
    expect(html).toContain("Vertical Heatmap");
    expect(html).toContain("Vitfac");
    expect(html).toContain("Dr. Ramesh");
    expect(html).toContain("TIME");
    expect(html).toContain("MON");
  });

  it("generates modern HTML for horizontal grid view", () => {
    const html = generateModernTimetableHtml({
      timetableName: "Final Grid",
      courses: mockCourses,
      theoryPeriods: mockTheoryPeriods,
      labPeriods: mockLabPeriods,
      viewMode: "horizontal",
    });

    expect(html).toContain("Final Grid");
    expect(html).toContain("Horizontal University Grid");
    expect(html).toContain("BCSE202");
    expect(html).toContain("DAY");
    expect(html).toContain("LUNCH");
  });

  it("generates comprehensive modern printable dossier with faculty scores and drop-in replacements", () => {
    const html = generateModernPrintableHtml({
      timetableName: "Semester 5 Timetable",
      courses: mockCourses,
      theoryPeriods: mockTheoryPeriods,
      labPeriods: mockLabPeriods,
      viewMode: "horizontal",
      masterCourses: mockMasterCourses,
    });

    // Check header & executive summary
    expect(html).toContain("Semester 5 Timetable");
    expect(html).toContain("Official Registration Dossier");
    expect(html).toContain("Total Credits");

    // Check print toolbar & theme toggle
    expect(html).toContain("print-toolbar");
    expect(html).toContain("Print / Save PDF");
    expect(html).toContain("toggleTheme");
    expect(html).toContain("Ink-Saver Light");

    // Check schedule grid & lunch column
    expect(html).toContain("LUNCH");

    // Check Enrolled Courses reference table
    expect(html).toContain("ENROLLED COURSES");
    expect(html).toContain("BCSE202");
    expect(html).toContain("Data Structures");

    // Check Faculty Intelligence & Sentiment Dossier
    expect(html).toContain("FACULTY INTELLIGENCE &amp; SENTIMENT REPORT");
    expect(html).toContain("Dr. Ramesh");
    expect(html).toContain("10090");

    // Check Drop-In Replacements with 0 clash risk
    expect(html).toContain("EMERGENCY DROP-IN SLOT REPLACEMENTS");
    expect(html).toContain("Dr. Suresh");
    expect(html).toContain("AB1-205");
    expect(html).toContain("0 Clash Risk");
  });

  it("generates standalone responsive horizontal HTML without print controls or handlers", () => {
    const html = generateModernDossierHtml({
      timetableName: "Standalone Dossier",
      courses: mockCourses,
      theoryPeriods: mockTheoryPeriods,
      labPeriods: mockLabPeriods,
      masterCourses: mockMasterCourses,
      theme: "dark",
    });

    expect(html).toContain('<meta name="viewport"');
    expect(html).toContain('class="dark-theme"');
    expect(html).toContain("background: #090d16");
    expect(html).toContain("Horizontal University Grid");
    expect(html).toContain("lunch-column");
    expect(html).toContain("pdf-course-table");
    expect(html).toContain("viewport");
    expect(html).not.toContain("window.print");
    expect(html).not.toContain("print-toolbar");
    expect(html).not.toContain("@page");
    expect(html).not.toContain("<script");
    expect(html).toContain("FACULTY INTELLIGENCE &amp; SENTIMENT REPORT");
    expect(html).toContain("0 Clash Risk");
  });

  it("waits for VITFAC and downloads a standalone HTML dossier with theme filename", async () => {
    let resolveCatalog!: (catalog: Map<string, vitfacService.VitfacFaculty>) => void;
    const catalogPromise = new Promise<Map<string, vitfacService.VitfacFaculty>>(resolve => {
      resolveCatalog = resolve;
    });
    vi.spyOn(vitfacService, "loadVitfacCatalog").mockReturnValue(catalogPromise);
    const createObjectURL = vi.fn((_blob: Blob) => "blob:html-dossier");
    const revokeObjectURL = vi.fn();
    vi.stubGlobal("URL", { createObjectURL, revokeObjectURL });
    let downloadedFile = "";
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (this: HTMLAnchorElement) {
      downloadedFile = this.download;
    });
    const openSpy = vi.spyOn(window, "open").mockImplementation(() => null);

    const pending = downloadModernDossierHtml({
      timetableName: "Print Dossier",
      courses: mockCourses,
      theoryPeriods: mockTheoryPeriods,
      labPeriods: mockLabPeriods,
      masterCourses: mockMasterCourses,
      theme: "light",
    });

    expect(createObjectURL).not.toHaveBeenCalled();

    resolveCatalog(new Map());
    await pending;

    expect(openSpy).not.toHaveBeenCalled();
    expect(createObjectURL).toHaveBeenCalledOnce();
    const blob = createObjectURL.mock.calls[0][0] as Blob;
    expect(blob.type).toBe("text/html;charset=utf-8");
    expect(await blob.text()).toContain("Horizontal University Grid");
    expect(clickSpy).toHaveBeenCalledOnce();
    expect(downloadedFile).toBe("Print_Dossier_LIGHT_FFCS_Dossier.html");
  });

  it("embeds reduced VITFAC portraits as data URLs without external image URLs", async () => {
    vi.spyOn(vitfacService, "loadVitfacCatalog").mockResolvedValue(new Map([
      ["10090", {
        id: "MTAwOTA=",
        employeeId: "10090",
        name: "Dr. Ramesh",
        wPct: 80,
        reviews: 10,
        wCount: 8,
        lCount: 2,
        image_url: "data:image/png;base64,fixture-image",
      }],
    ]));
    vi.stubGlobal("fetch", vi.fn(async (_url: string, init?: RequestInit) => {
      expect(init?.mode).toBe("cors");
      return { ok: true, blob: async () => new Blob(["fixture-image"], { type: "image/png" }) };
    }));
    vi.stubGlobal("createImageBitmap", vi.fn(async () => ({
      width: 192,
      height: 128,
      close: vi.fn(),
    })));
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({ drawImage: vi.fn() } as unknown as CanvasRenderingContext2D);
    vi.spyOn(HTMLCanvasElement.prototype, "toDataURL").mockReturnValue("data:image/jpeg;base64,smallportrait");
    vi.stubGlobal("URL", { createObjectURL: vi.fn(() => "blob:portrait"), revokeObjectURL: vi.fn() });
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});

    await downloadModernDossierHtml({
      timetableName: "Portraits",
      courses: mockCourses,
      theoryPeriods: mockTheoryPeriods,
      labPeriods: mockLabPeriods,
      masterCourses: mockMasterCourses,
      theme: "dark",
    });

    const blob = (URL.createObjectURL as ReturnType<typeof vi.fn>).mock.calls[0][0] as Blob;
    const html = await blob.text();
    expect(html).toContain('<img src="data:image/jpeg;base64,smallportrait" alt="Dr. Ramesh" width="36" height="36"');
    expect(html).not.toContain('src="data:image/png;base64,fixture-image"');
    expect(html).not.toContain('<img src="https://');
  });

  it("opens printable window via openModernPrintableDossier and openTimetablePrintablePage", () => {
    const mockWindow = {
      document: {
        open: vi.fn(),
        write: vi.fn(),
        close: vi.fn(),
      },
    };
    const openSpy = vi.spyOn(window, "open").mockReturnValue(mockWindow as unknown as Window);

    const win1 = openModernPrintableDossier({
      timetableName: "Test TT",
      courses: mockCourses,
      theoryPeriods: mockTheoryPeriods,
      labPeriods: mockLabPeriods,
    });
    expect(openSpy).toHaveBeenCalledWith("", "_blank");
    expect(mockWindow.document.write).toHaveBeenCalled();
    expect(win1).toBe(mockWindow);

    // Test openTimetablePrintablePage delegation
    const win2 = openTimetablePrintablePage({
      timetableName: "Delegated TT",
      courses: mockCourses,
      theoryPeriods: mockTheoryPeriods,
      labPeriods: mockLabPeriods,
    });
    expect(win2).toBe(mockWindow);

    openSpy.mockRestore();
  });

  it("generates Light Mode and Dark Mode dossier HTML with appropriate tokens", () => {
    const lightHtml = generateModernDossierInnerHtml(
      {
        timetableName: "Winter 2026 Light",
        courses: mockCourses,
        theoryPeriods: mockTheoryPeriods,
        labPeriods: mockLabPeriods,
        masterCourses: mockMasterCourses,
      },
      true
    );

    const darkHtml = generateModernDossierInnerHtml(
      {
        timetableName: "Winter 2026 Dark",
        courses: mockCourses,
        theoryPeriods: mockTheoryPeriods,
        labPeriods: mockLabPeriods,
        masterCourses: mockMasterCourses,
      },
      false
    );

    // Light Mode tokens
    expect(lightHtml).toContain("background: #ffffff");
    expect(lightHtml).toContain("color: #0f172a");
    expect(lightHtml).toContain("Winter 2026 Light");

    // Dark Mode tokens
    expect(darkHtml).toContain("color: #ffffff");
    expect(darkHtml).toContain("Winter 2026 Dark");
  });

  describe("compileDossierPdfInline & compileDossierPdf", () => {
    /**
     * jsdom ships without the `canvas` package, so a real `Image` given a
     * `data:` URL fires neither `load` nor `error` — the inline compiler's
     * `await` on `img.onload` would hang until the 5s test timeout. This stub
     * answers on the next macrotask, which is after the caller has installed
     * its handlers (`src` is assigned before `onload` in the source).
     */
    class StubImage {
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      naturalWidth = 1400;
      naturalHeight = 2000;
      private _src = "";
      set src(value: string) {
        this._src = value;
        setTimeout(() => this.onload?.(), 0);
      }
      get src(): string {
        return this._src;
      }
    }

    beforeEach(() => {
      vi.stubGlobal("Image", StubImage);
    });

    // Runs even when a test fails or times out: the in-test
    // `vi.restoreAllMocks()` never executes on a timeout, and a leaked
    // `document.createElement` spy makes the *next* test recurse without end —
    // its `origCreateElement` binds the spy itself, so every createElement
    // call routes straight back into the active implementation.
    afterEach(() => {
      vi.restoreAllMocks();
      vi.unstubAllGlobals();
    });

    it("compiles PDF inline and returns ArrayBuffer and formatted filename", async () => {
      // Mock canvas getContext and toDataURL in jsdom
      const origCreateElement = document.createElement.bind(document);
      vi.spyOn(document, "createElement").mockImplementation((tagName: string) => {
        const el = origCreateElement(tagName);
        if (tagName.toLowerCase() === "canvas") {
          const canvas = el as HTMLCanvasElement;
          canvas.getContext = vi.fn().mockReturnValue({
            fillStyle: "",
            fillRect: vi.fn(),
            drawImage: vi.fn(),
          } as unknown as CanvasRenderingContext2D);
          canvas.toDataURL = vi.fn().mockReturnValue("data:image/jpeg;base64,mockjpegdata");
        }
        return el;
      });

      const dummy1x1DataUrl = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";

      const lightResult = await compileDossierPdfInline({
        timetableName: "Winter 2026",
        theme: "light",
        isLight: true,
        dataUrl: dummy1x1DataUrl,
        imgNaturalWidth: 1400,
        imgNaturalHeight: 2000,
      });

      expect(lightResult.fileName).toBe("Winter_2026_LIGHT_FFCS_Dossier.pdf");
      expect(lightResult.pdfBuffer).toBeInstanceOf(ArrayBuffer);
      expect(lightResult.pdfBuffer.byteLength).toBeGreaterThan(0);

      const darkResult = await compileDossierPdfInline({
        timetableName: "Winter 2026",
        theme: "dark",
        isLight: false,
        dataUrl: dummy1x1DataUrl,
        imgNaturalWidth: 1400,
        imgNaturalHeight: 2000,
      });

      expect(darkResult.fileName).toBe("Winter_2026_DARK_FFCS_Dossier.pdf");
      expect(darkResult.pdfBuffer).toBeInstanceOf(ArrayBuffer);
      expect(darkResult.pdfBuffer.byteLength).toBeGreaterThan(0);

      vi.restoreAllMocks();
    });

    it("compileDossierPdf falls back gracefully to inline when Worker is undefined", async () => {
      const origCreateElement = document.createElement.bind(document);
      vi.spyOn(document, "createElement").mockImplementation((tagName: string) => {
        const el = origCreateElement(tagName);
        if (tagName.toLowerCase() === "canvas") {
          const canvas = el as HTMLCanvasElement;
          canvas.getContext = vi.fn().mockReturnValue({
            fillStyle: "",
            fillRect: vi.fn(),
            drawImage: vi.fn(),
          } as unknown as CanvasRenderingContext2D);
          canvas.toDataURL = vi.fn().mockReturnValue("data:image/jpeg;base64,mockjpegdata");
        }
        return el;
      });

      const dummy1x1DataUrl = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";

      // In Node/JSDOM, Worker or OffscreenCanvas might be undefined or mockable
      const res = await compileDossierPdf({
        timetableName: "Fallback Test",
        theme: "dark",
        isLight: false,
        dataUrl: dummy1x1DataUrl,
        imgNaturalWidth: 1400,
        imgNaturalHeight: 2000,
      });

      expect(res.fileName).toBe("Fallback_Test_DARK_FFCS_Dossier.pdf");
      expect(res.pdfBuffer).toBeInstanceOf(ArrayBuffer);

      vi.restoreAllMocks();
    });
  });
});
