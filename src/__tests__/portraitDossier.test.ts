import * as htmlToImage from "html-to-image";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createPortraitDossierPdf } from "@/lib/portraitDossier";

const sample = {
  timetableName: "Winter 2026",
  theme: "light" as const,
  courses: [{
    id: "sample-course",
    code: "CSE1001",
    title: "Foundations of Computing",
    slots: ["A1"],
    faculty: "Dr. Ada Lovelace",
    venue: "AB1-101",
    credits: "4",
    type: "TH",
    color: "bg-blue-600",
  }],
  theoryPeriods: [
    { start: "08:00 AM", end: "08:50 AM", days: { mon: "A1" } },
    { start: "08:50 AM", end: "09:40 AM", days: {} },
  ],
  labPeriods: [
    { start: "08:00 AM", end: "08:50 AM", days: {} },
    { start: "08:50 AM", end: "09:40 AM", days: {} },
  ],
};

describe("Portrait A4 dossier PDF", () => {
  afterEach(() => vi.restoreAllMocks());

  it("creates a portrait, searchable PDF with the vector timetable by default", async () => {
    const buffer = await createPortraitDossierPdf(sample);
    const bytes = new Uint8Array(buffer);
    const signature = new TextDecoder().decode(bytes.slice(0, 8));
    expect(signature).toMatch(/^%PDF-/);
    expect(buffer.byteLength).toBeGreaterThan(1500);
  });

  it("also supports the image timetable treatment", async () => {
    const onePixelPng = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";
    vi.spyOn(htmlToImage, "toPng").mockResolvedValue(onePixelPng);
    const buffer = await createPortraitDossierPdf({ ...sample, gridMode: "image" });
    expect(new TextDecoder().decode(new Uint8Array(buffer).slice(0, 8))).toMatch(/^%PDF-/);
    expect(buffer.byteLength).toBeGreaterThan(1500);
  });

  it("keeps long dossier strings in the PDF output", async () => {
    const longFaculty = `Faculty ${"reviewable full name ".repeat(120)}FACULTY-END`;
    const longCourseTitle = `Course title ${"complete course detail ".repeat(160)}COURSE-END`;
    const buffer = await createPortraitDossierPdf({
      ...sample,
      timetableName: `Schedule ${"long title ".repeat(18)}TITLE-END`,
      courses: [{ ...sample.courses[0], title: longCourseTitle, faculty: longFaculty }],
      masterCourses: [{
        CODE: "CSE1001", TITLE: "Foundations of Computing", TYPE: "TH", CREDITS: "4",
        ROOM: "AB1-101", SLOT: "A1", FACULTY: `Alternative ${"full replacement detail ".repeat(90)}ALTERNATIVE-END`,
      }],
    });
    expect(buffer.byteLength).toBeGreaterThan(3000);
  });
});
