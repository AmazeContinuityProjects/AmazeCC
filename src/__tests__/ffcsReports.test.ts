import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import * as XLSX from "xlsx";
import {
  DEFAULT_FFCS_SEMESTER,
  FFCS_SEMESTER_REPORTS,
  getFFCSSemester,
  getFFCSSemesterByClassIdPrefix,
  getFFCSSemesterByClassIdPrefixCode,
  isFFCSSemesterId,
  FINAL_FFCS_REPORTS,
  finalSemesterToVtopId,
  getSelectedFinalReportPath,
  getSelectedFinalSemesterId,
  mapToFinalSemesterId,
  legacyOfferingId,
  offeringId,
  offeringMatches,
  parseReportRows,
} from "@/lib/ffcsReports";

/**
 * The report switch has two failure modes worth pinning: a saved semester id
 * the build no longer ships, and a winter row whose extra columns are silently
 * dropped. The second is subtle because the planner still renders without them;
 * it simply loses the only stable handle on the faculty member.
 */

describe("semester reports", () => {
  it("defaults to winter and keeps the other reports selectable", () => {
    expect(DEFAULT_FFCS_SEMESTER).toBe("winter-2026-2027");
    expect(FFCS_SEMESTER_REPORTS.map((report) => report.id)).toEqual([
      "winter-2026-2027",
      "winter-2026-2027-mock",
      "fall-2026-2027",
      "codechef-vit",
    ]);
    expect(getFFCSSemester("fall-2026-2027").path).toBe("/ffcs/fall-2026-2027-final-ffcs.csv");
    expect(getFFCSSemester("previous").path).toBe("/ffcs/fall-2026-2027-final-ffcs.csv");
    expect(getFFCSSemester(null).id).toBe(DEFAULT_FFCS_SEMESTER);
    expect(getFFCSSemester("summer-2027").id).toBe(DEFAULT_FFCS_SEMESTER);
  });

  it("ships the winter final list and its mock side by side", () => {
    const final = FFCS_SEMESTER_REPORTS.find((entry) => entry.id === "winter-2026-2027");
    const mock = FFCS_SEMESTER_REPORTS.find((entry) => entry.id === "winter-2026-2027-mock");
    expect(final?.path).toBe("/ffcs/winter-2026-2027-final-ffcs.csv");
    expect(mock?.path).toBe("/ffcs/winter-2026-2027-slot-timetable.csv");
    // Both lists share one class-ID namespace, so the numeric share code is
    // the only thing that tells them apart: 2 = final, 1 = mock.
    expect(final?.classIdPrefix).toBe("CH202627050");
    expect(mock?.classIdPrefix).toBe("CH202627050");
    expect(final?.classIdPrefixCode).toBe("2");
    expect(mock?.classIdPrefixCode).toBe("1");
    expect(getFFCSSemesterByClassIdPrefixCode("2")?.id).toBe("winter-2026-2027");
    expect(getFFCSSemesterByClassIdPrefixCode("1")?.id).toBe("winter-2026-2027-mock");
  });

  it("resolves the shared winter class-ID namespace to the default report", () => {
    // The legacy p-prefix link format carries no report code; when several
    // reports share the prefix, the default must win or every winter link
    // would die on the ambiguity.
    expect(getFFCSSemesterByClassIdPrefix("CH202627050")?.id).toBe(DEFAULT_FFCS_SEMESTER);
    expect(getFFCSSemesterByClassIdPrefix("CH2026270503524")?.id).toBe(DEFAULT_FFCS_SEMESTER);
    expect(getFFCSSemesterByClassIdPrefix("CH202627010")?.id).toBe("fall-2026-2027");
    expect(getFFCSSemesterByClassIdPrefix("CH2026270100011")?.id).toBe("fall-2026-2027");
    expect(getFFCSSemesterByClassIdPrefixCode("0")?.id).toBe("fall-2026-2027");
    expect(getFFCSSemesterByClassIdPrefix("CH999999999")).toBeNull();
  });

  it("ships the offline CodeChef VIT catalogue without a shareable class-ID prefix", () => {
    const report = FFCS_SEMESTER_REPORTS.find((entry) => entry.id === "codechef-vit");
    expect(report).toMatchObject({
      path: "/ffcs/codechef-vit-catalogue.csv",
      shortLabel: "CodeChef VIT",
    });
    // The catalogue data is third-party and carries no class IDs; a name-free
    // share link must never resolve to it.
    expect(report?.attribution).toContain("CodeChef VIT");
    expect(report?.attribution).toContain("ffcs.codechefvit.com");
    expect(report?.classIdPrefix).toBeUndefined();
    expect(report?.classIdPrefixCode).toBeUndefined();
  });

  it("credits each report for what it is", () => {
    const winter = FFCS_SEMESTER_REPORTS.find((entry) => entry.id === "winter-2026-2027");
    const mock = FFCS_SEMESTER_REPORTS.find((entry) => entry.id === "winter-2026-2027-mock");
    const fall = FFCS_SEMESTER_REPORTS.find((entry) => entry.id === "fall-2026-2027");
    expect(winter?.attribution).toBe("Course data from VIT's Winter 2026-2027 course offered list.");
    expect(mock?.attribution).toContain("Mock");
    expect(fall?.attribution).toBe("Course data from VIT's Fall 2026-2027 course allocation report.");
  });

  it("accepts only ids this build knows", () => {
    expect(isFFCSSemesterId("winter-2026-2027")).toBe(true);
    expect(isFFCSSemesterId("winter-2026-2027-mock")).toBe(true);
    expect(isFFCSSemesterId("fall-2026-2027")).toBe(true);
    expect(isFFCSSemesterId("previous")).toBe(true);
    expect(isFFCSSemesterId("codechef-vit")).toBe(true);
    expect(isFFCSSemesterId("ffcs_semester")).toBe(false);
    expect(isFFCSSemesterId(null)).toBe(false);
  });
});

describe("offering identity", () => {
  const offering = { FACULTY: "A SHARED NAME", SLOT: "A1+TA1", ROOM: "AB1-101", ERP_ID: "50919" };

  it("appends the employee id when the report has one", () => {
    expect(offeringId(offering)).toBe("A SHARED NAME|A1+TA1|AB1-101|50919");
    expect(legacyOfferingId(offering)).toBe("A SHARED NAME|A1+TA1|AB1-101");
  });

  it("keeps two people with one name apart", () => {
    expect(offeringId({ ...offering, ERP_ID: "1" })).not.toBe(offeringId({ ...offering, ERP_ID: "2" }));
  });

  it("accepts locks saved before employee ids were used", () => {
    expect(offeringMatches(offering, ["A SHARED NAME|A1+TA1|AB1-101"])).toBe(true);
    expect(offeringMatches(offering, ["A SHARED NAME|A1+TA1|AB1-101|50919"])).toBe(true);
    expect(offeringMatches(offering, ["A SHARED NAME|B1+TB1|AB1-101"])).toBe(false);
  });
});

describe("parsing report rows", () => {
  it("still reads the previous report's shorter headings", () => {
    const [course] = parseReportRows([
      {
        CODE: "CSE1001",
        TITLE: "Problem Solving",
        TYPE: "TH",
        CREDITS: 4,
        VENUE: "AB1-101",
        SLOT: "A1+TA1",
        FACULTY: "PARTHIBAN V",
        BATCH: "1",
      },
    ]);

    expect(course).toEqual({
      CODE: "CSE1001",
      TITLE: "Problem Solving",
      TYPE: "TH",
      CREDITS: "4",
      ROOM: "AB1-101",
      SLOT: "A1+TA1",
      FACULTY: "PARTHIBAN V",
      BATCH: "1",
    });
  });

  it("keeps the winter report's class, employee id, and school", () => {
    const [course] = parseReportRows([
      {
        "COURSE CODE": "MATR705",
        "COURSE TITLE": "Topics in Applicable Mathematics",
        CREDITS: 3,
        "CLASS ID": "CH2026270503524",
        SLOT: "N2+R3+U4",
        "ERP ID": 54509,
        "EMPLOYEE NAME": "SUKAVANAM N",
        "EMPLOYEE SCHOOL": "SAS",
      },
    ]);

    expect(course).toMatchObject({
      CODE: "MATR705",
      TITLE: "Topics in Applicable Mathematics",
      TYPE: "",
      CREDITS: "3",
      ROOM: "",
      SLOT: "N2+R3+U4",
      FACULTY: "SUKAVANAM N",
      CLASS_ID: "CH2026270503524",
      ERP_ID: "54509",
      EMPLOYEE_SCHOOL: "SAS",
    });
  });

  it("reads every row of the shipped winter CSVs", () => {
    const load = (path: string) => {
      const csv = readFileSync(resolve(process.cwd(), path));
      const workbook = XLSX.read(csv, { type: "buffer" });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      return parseReportRows(XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet));
    };

    // The final course-offered list (the default report).
    const final = load("public/ffcs/winter-2026-2027-final-ffcs.csv");
    expect(final).toHaveLength(3530);
    expect(new Set(final.map((course) => course.CODE)).size).toBe(741);
    expect(final.every((course) => course.SLOT && course.CLASS_ID && course.ERP_ID)).toBe(true);
    expect(final.every((course) => course.EMPLOYEE_SCHOOL)).toBe(true);
    // No extraction glue: every code is a bare 7–8 character code, never a
    // code merged with the first word of its title (e.g. "UHUM151NEthics").
    expect(final.every((course) => /^[A-Z0-9]{7,8}$/.test(course.CODE))).toBe(true);

    // The earlier mock slot timetable, still selectable beside the final list.
    const mock = load("public/ffcs/winter-2026-2027-slot-timetable.csv");
    expect(mock).toHaveLength(3426);
    expect(new Set(mock.map((course) => course.CODE)).size).toBe(686);

    // The upgraded Fall Semester 2026-2027 final allocation list.
    const fall = load("public/ffcs/fall-2026-2027-final-ffcs.csv");
    expect(fall).toHaveLength(2362);
    expect(new Set(fall.map((course) => course.CODE)).size).toBe(497);
    expect(fall.every((course) => course.SLOT && course.CLASS_ID && course.ERP_ID)).toBe(true);
    expect(fall.every((course) => course.EMPLOYEE_SCHOOL)).toBe(true);
    expect(fall.every((course) => course.CLASS_ID?.startsWith("CH202627010"))).toBe(true);
  });

  it("joins wrapped names at word boundaries without splitting words", () => {
    const csv = readFileSync(resolve(process.cwd(), "public/ffcs/winter-2026-2027-final-ffcs.csv"));
    const workbook = XLSX.read(csv, { type: "buffer" });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const courses = parseReportRows(XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet));

    expect(courses.find((course) => course.CODE === "MATR706")?.FACULTY).toBe("THARASI DILLESWAR RAO");
    expect(courses.find((course) => course.CODE === "PRMC001L")?.FACULTY).toBe("BALAMURUGAN B J");
  });
});

describe("global final semester mapping and resolution", () => {
  it("maps VTOP semester IDs to final report semester IDs", () => {
    expect(mapToFinalSemesterId("CH20262701")).toBe("fall-2026-2027");
    expect(mapToFinalSemesterId("CH20262705")).toBe("winter-2026-2027");
    expect(mapToFinalSemesterId("fall-2026-2027")).toBe("fall-2026-2027");
    expect(mapToFinalSemesterId("previous")).toBe("fall-2026-2027");
    expect(mapToFinalSemesterId("winter-2026-2027")).toBe("winter-2026-2027");
    expect(mapToFinalSemesterId(null)).toBeNull();
  });

  it("maps FinalFFCSSemesterId to VTOP IDs", () => {
    expect(finalSemesterToVtopId("fall-2026-2027")).toBe("CH20262701");
    expect(finalSemesterToVtopId("winter-2026-2027")).toBe("CH20262705");
  });

  it("resolves the final report path dynamically", () => {
    expect(getSelectedFinalReportPath("CH20262701")).toBe("/ffcs/fall-2026-2027-final-ffcs.csv");
    expect(getSelectedFinalReportPath("CH20262705")).toBe("/ffcs/winter-2026-2027-final-ffcs.csv");
    expect(getSelectedFinalReportPath("fall-2026-2027")).toBe("/ffcs/fall-2026-2027-final-ffcs.csv");
    expect(getSelectedFinalReportPath("winter-2026-2027")).toBe("/ffcs/winter-2026-2027-final-ffcs.csv");
  });

  it("ships FINAL_FFCS_REPORTS with exactly winter and fall", () => {
    expect(FINAL_FFCS_REPORTS.map((r) => r.id)).toEqual(["winter-2026-2027", "fall-2026-2027"]);
  });
});
