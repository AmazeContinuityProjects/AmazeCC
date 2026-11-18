import { describe, expect, it } from "vitest";
import {
  buildClashReportPdfInWorker,
  buildFormDossierPdfInWorker,
  buildPortraitDossierPdfInWorker,
  executeInPdfWorker,
} from "@/lib/pdfWorkerBridge";
import type { CampusSchema } from "@/lib/slots";

const testSchema: CampusSchema = {
  theory: [{ start: "08:00", end: "08:50", days: { mon: "A1" } }],
  lab: [{ start: "08:00", end: "08:50", days: { mon: "L1" } }],
};

const periods = [{ start: "08:00", end: "08:50", days: { mon: "A1" } }];

describe("pdfWorkerBridge", () => {
  it("gracefully falls back when Worker is unavailable in test environment", async () => {
    // Under Node/jsdom, typeof Worker is undefined
    const res = await executeInPdfWorker({
      type: "build_dossier_pdf",
      timetableName: "Test",
      theme: "light",
      isLight: true,
      dataUrl:
        "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
    });

    expect(res).toBeNull();
  });

  it("buildFormDossierPdfInWorker returns null when Worker is unavailable", async () => {
    const res = await buildFormDossierPdfInWorker({
      timetableName: "Test Plan",
      courses: [],
      theoryPeriods: periods,
      labPeriods: periods,
      schema: testSchema,
    });
    expect(res).toBeNull();
  });

  it("buildPortraitDossierPdfInWorker returns null when Worker is unavailable", async () => {
    const res = await buildPortraitDossierPdfInWorker({
      timetableName: "Test Plan",
      courses: [],
      theoryPeriods: periods,
      labPeriods: periods,
    });
    expect(res).toBeNull();
  });

  it("buildClashReportPdfInWorker returns null when Worker is unavailable", async () => {
    const res = await buildClashReportPdfInWorker({
      planName: "Test Plan",
      courses: [],
      schema: testSchema,
    });
    expect(res).toBeNull();
  });
});
