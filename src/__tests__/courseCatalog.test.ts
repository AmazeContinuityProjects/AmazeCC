import { describe, it, expect, beforeEach } from "vitest";
import { parseFastCSV, clearCourseCatalogCache } from "@/lib/courseCatalog";
import { parseCourseRows } from "@/lib/freeClassrooms";

describe("courseCatalog - parseFastCSV", () => {
  beforeEach(() => {
    clearCourseCatalogCache();
  });

  it("parses standard CSV text accurately", () => {
    const csv = `COURSE CODE,COURSE TITLE,TYPE,CREDITS,ROOM,SLOT
CSE1001,Problem Solving and Programming,Theory Only,3,AB3-201,A1+TA1
CSE1002,Data Structures,Embedded Lab,4,AB3-202,L31+L32`;

    const parsed = parseFastCSV(csv);
    expect(parsed).toHaveLength(2);
    expect(parsed[0]["COURSE CODE"]).toBe("CSE1001");
    expect(parsed[0]["COURSE TITLE"]).toBe("Problem Solving and Programming");
    expect(parsed[0]["ROOM"]).toBe("AB3-201");
    expect(parsed[1]["COURSE CODE"]).toBe("CSE1002");
    expect(parsed[1]["SLOT"]).toBe("L31+L32");
  });

  it("handles quoted fields containing commas and quotes correctly", () => {
    const csv = `CODE,TITLE,FACULTY,ROOM
MAT1001,"Calculus, Differential and Integral",Dr. John,AB1-101
ENG1001,"Technical English: ""Writing & Speech""",Dr. Smith,AB1-102`;

    const parsed = parseFastCSV(csv);
    expect(parsed).toHaveLength(2);
    expect(parsed[0]["TITLE"]).toBe("Calculus, Differential and Integral");
    expect(parsed[1]["TITLE"]).toBe('Technical English: "Writing & Speech"');
  });

  it("handles BOM and transforms seamlessly via parseCourseRows", () => {
    const bomCsv = `\uFEFFCOURSE CODE,COURSE TITLE,TYPE,ROOM,SLOT
PHY1001,Engineering Physics,Theory,AB2-301,B1+TB1`;

    const rawRows = parseFastCSV(bomCsv);
    const courses = parseCourseRows(rawRows);
    expect(courses).toHaveLength(1);
    expect(courses[0].CODE).toBe("PHY1001");
    expect(courses[0].VENUE).toBe("AB2-301");
  });

  it("handles empty or single-line input gracefully", () => {
    expect(parseFastCSV("")).toEqual([]);
    expect(parseFastCSV("JUST_HEADER_NO_ROWS")).toEqual([]);
  });
});
