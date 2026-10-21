import { readFileSync } from "fs";
import { describe, expect, it } from "vitest";
import { importFile, mergeCourses } from "../features/import/importFile";
import { detectColumns, hasField, normalizeHeader } from "../features/import/normalizeColumns";
import type { ParsedCourse } from "../components/custom/exams/FFCS/types";

/**
 * Column detection and file import.
 *
 * The load-bearing test is the first one: the course list the planner starts
 * with comes from `public/ffcs/ffcsReport.csv`, and this importer is meant to
 * accept a stranger's sheet as well. If it cannot read the file the app ships
 * with, nothing else here matters — and reading it through the *new* path
 * proves the header normalisation agrees with the hand-written loader that
 * has always read `VENUE` and `COURSE CODE` by name.
 */

/** A `File` that works whether or not the test environment implements `.text`. */
const fileOf = (contents: string | Uint8Array, name: string): File => {
  const file = new File([contents as BlobPart], name, { type: "text/csv" });
  if (typeof file.text !== "function") {
    Object.defineProperty(file, "text", { value: async () => String(contents) });
  }
  return file;
};

const csv = (text: string, name = "courses.csv") => fileOf(text, name);

describe("recognising a column heading", () => {
  it.each([
    ["CODE", "CODE"],
    ["Course Code", "CODE"],
    ["COURSE_CODE", "CODE"],
    ["Sub Code", "CODE"],
    ["Subject Code", "CODE"],
    ["title", "TITLE"],
    ["Course Title", "TITLE"],
    ["Course Name", "TITLE"],
    ["SLOT", "SLOT"],
    ["Slot(s)", "SLOT"],
    ["Theory Slot", "SLOT"],
    ["FACULTY", "FACULTY"],
    ["Professor", "FACULTY"],
    ["Instructor", "FACULTY"],
    ["VENUE", "ROOM"],
    ["Room", "ROOM"],
    ["Classroom", "ROOM"],
    ["Credits", "CREDITS"],
    ["Credit Hours", "CREDITS"],
    ["Batch", "BATCH"],
    ["Section", "BATCH"],
  ])("%s → %s", (heading, field) => {
    expect(normalizeHeader(heading)).toBe(field);
  });

  it("tolerates the byte-order mark Windows puts on a CSV", () => {
    expect(normalizeHeader("\uFEFFCODE")).toBe("CODE");
    expect(normalizeHeader("\uFEFF Course Code ")).toBe("CODE");
  });

  it("refuses a heading it does not recognise rather than guessing", () => {
    expect(normalizeHeader("Prerequisite")).toBeNull();
    expect(normalizeHeader("Batch Intake Capacity")).toBeNull();
    expect(normalizeHeader("")).toBeNull();
  });

  it("does not let a short heading claim a longer one", () => {
    // Both headings name the code column; the first spelling in the sheet is
    // the one its author meant, so the second must not overwrite it.
    const columns = detectColumns(["Course Code", "CODE", "Slot"]);
    expect(columns.get("Course Code")).toBe("CODE");
    expect(columns.has("CODE")).toBe(false);
    expect(hasField(columns, "CODE")).toBe(true);
  });

  it("keeps a heading that is only part-word matched out", () => {
    expect(normalizeHeader("barcode")).toBeNull();
    expect(normalizeHeader("Slot Machine")).toBeNull();
  });

  it("accepts a real heading with a qualifier wrapped round it", () => {
    // The third pass: the multi-word alias is unmistakable even with
    // something of the sheet's own choosing appended.
    expect(normalizeHeader("Course Code (VIT)")).toBe("CODE");
    expect(normalizeHeader("Subject Code - Undergraduate")).toBe("CODE");
    expect(normalizeHeader("Course Title [2025]")).toBe("TITLE");
  });
});

describe("importing the course report this app ships with", () => {
  it("reads every row the hand-written loader has always read", async () => {
    const contents = readFileSync("public/ffcs/ffcsReport.csv", "utf8");
    const result = await importFile(fileOf(contents, "ffcsReport.csv"));

    expect(result.error).toBeNull();
    expect(result.headers).toEqual(["CODE", "TITLE", "TYPE", "CREDITS", "SLOT", "FACULTY", "VENUE"]);
    expect(result.ignoredHeaders).toEqual([]);
    expect(result.missingFields).toEqual([]);
    // 2357 data rows; anything meaningfully fewer means a column went astray.
    expect(result.courses.length).toBeGreaterThan(2300);
    expect(result.skipped).toBe(0);

    expect(result.courses[0]).toEqual({
      CODE: "BASTS101",
      TITLE: "Qualitative and Quantitative Skills Practice I",
      TYPE: "SS",
      CREDITS: "1",
      ROOM: "AB3-103",
      SLOT: "F1+TF1",
      FACULTY: "SIXPHRASE(APT)",
      BATCH: "",
    });
  });
});

describe("importing a sheet nobody here wrote", () => {
  it("reads headings spelled the other way round", async () => {
    const result = await importFile(
      csv(["Course Code,Course Title,Slot,Professor,Room,Credit", "CSE1001,Intro to Computing,A1+TA1,Dr. Smith,AB1-101,3"].join("\n"))
    );

    expect(result.error).toBeNull();
    expect(result.courses[0]).toMatchObject({
      CODE: "CSE1001",
      TITLE: "Intro to Computing",
      SLOT: "A1+TA1",
      FACULTY: "Dr. Smith",
      ROOM: "AB1-101",
      CREDITS: "3",
    });
  });

  it("ignores columns it does not understand and says which", async () => {
    const result = await importFile(
      csv(["Code,Slot,Prerequisite,Class Strength", "CSE1001,A1+TA1,MAT101,60"].join("\n"))
    );

    expect(result.error).toBeNull();
    expect(result.courses).toHaveLength(1);
    expect(result.ignoredHeaders).toEqual(["Prerequisite", "Class Strength"]);
  });

  it("reports a missing required column by name rather than returning nothing", async () => {
    const noSlot = await importFile(csv(["Code,Title,Faculty", "CSE1001,Intro,Dr. Smith"].join("\n")));
    expect(noSlot.courses).toEqual([]);
    expect(noSlot.error).toMatch(/slot column/);
    expect(noSlot.missingFields).toContain("SLOT");

    const noCode = await importFile(csv(["Slot,Title,Faculty", "A1+TA1,Intro,Dr. Smith"].join("\n")));
    expect(noCode.error).toMatch(/course code column/);
    expect(noCode.missingFields).toContain("CODE");
  });

  it("skips a row with no slot, and counts it so the preview can say so", async () => {
    const result = await importFile(
      csv(["Code,Slot", "CSE1001,A1+TA1", "CSE1002,", "CSE1003,B1+TB1"].join("\n"))
    );

    expect(result.courses.map((c) => c.CODE)).toEqual(["CSE1001", "CSE1003"]);
    expect(result.skipped).toBe(1);
    expect(result.error).toBeNull();
  });

  it("says a file is unreadable instead of throwing", async () => {
    const result = await importFile(csv("this is not a spreadsheet at all", "notes.txt"));
    // Whatever SheetJS makes of it, the caller gets a message and no rows —
    // this is called from a file input, where an exception is a blank screen.
    expect(result.courses).toEqual([]);
    expect(result.error).toBeTruthy();
  });

  it("says so when the sheet has no headings", async () => {
    const result = await importFile(csv("\n\n", "empty.csv"));
    expect(result.courses).toEqual([]);
    expect(result.error).toBeTruthy();
  });
});

describe("importing an actual workbook", () => {
  it("reads .xlsx bytes, which are not text in a hat", async () => {
    const XLSX = await import("xlsx");
    const sheet = XLSX.utils.aoa_to_sheet([
      ["Course Code", "Course Title", "Slot", "Professor"],
      ["CSE1001", "Intro to Computing", "A1+TA1", "Dr. Smith"],
      ["CSE1002", "Databases", "B1+TB1", "Dr. Rao"],
    ]);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, sheet, "Courses");
    const bytes = XLSX.write(workbook, { type: "array", bookType: "xlsx" }) as Uint8Array;

    const result = await importFile(fileOf(bytes, "semester.xlsx"));
    expect(result.error).toBeNull();
    expect(result.sheet).toBe("Courses");
    expect(result.courses.map((c) => c.CODE)).toEqual(["CSE1001", "CSE1002"]);
    expect(result.courses[0].SLOT).toBe("A1+TA1");
  });
});

describe("merging an upload into what is already loaded", () => {
  const course = (code: string, slot: string): ParsedCourse => ({
    CODE: code,
    TITLE: "",
    TYPE: "TH",
    CREDITS: "0",
    ROOM: "",
    SLOT: slot,
    FACULTY: "",
    BATCH: "",
  });

  it("replaces every offering of a course the new sheet corrects", () => {
    const existing = [course("CSE1001", "A1"), course("CSE1001", "B1"), course("CSE1002", "C1")];
    const merged = mergeCourses(existing, [course("CSE1001", "D1")]);

    expect(merged.map((c) => `${c.CODE}:${c.SLOT}`)).toEqual(["CSE1002:C1", "CSE1001:D1"]);
  });

  it("leaves the rest of the semester alone when only part was uploaded", () => {
    const merged = mergeCourses([course("CSE1001", "A1"), course("CSE1002", "B1")], [course("CSE1003", "C1")]);
    expect(merged).toHaveLength(3);
  });

  it("is a plain append when nothing overlaps", () => {
    const merged = mergeCourses([course("CSE1001", "A1")], [course("CSE1002", "B1")]);
    expect(merged.map((c) => c.CODE)).toEqual(["CSE1001", "CSE1002"]);
  });
});
