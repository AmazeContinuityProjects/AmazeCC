import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import * as XLSX from "xlsx";
import {
  DEFAULT_FFCS_SEMESTER,
  FFCS_SEMESTER_REPORTS,
  getFFCSSemester,
  isFFCSSemesterId,
  legacyOfferingId,
  offeringId,
  offeringMatches,
  parseReportRows,
} from "../components/custom/exams/FFCS/reports";

/**
 * The report switch has two failure modes worth pinning: a saved semester id
 * the build no longer ships, and a winter row whose extra columns are silently
 * dropped. The second is subtle because the planner still renders without them;
 * it simply loses the only stable handle on the faculty member.
 */

describe("semester reports", () => {
  it("defaults to winter and keeps the other reports selectable", () => {
    expect(DEFAULT_FFCS_SEMESTER).toBe("winter-2026-2027");
    expect(FFCS_SEMESTER_REPORTS.map((report) => report.id)).toEqual(["winter-2026-2027", "previous", "codechef-vit"]);
    expect(getFFCSSemester("previous").path).toBe("/ffcs/ffcsReport.csv");
    expect(getFFCSSemester(null).id).toBe(DEFAULT_FFCS_SEMESTER);
    expect(getFFCSSemester("summer-2027").id).toBe(DEFAULT_FFCS_SEMESTER);
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

  it("credits the two registration reports for what they are", () => {
    const winter = FFCS_SEMESTER_REPORTS.find((entry) => entry.id === "winter-2026-2027");
    const previous = FFCS_SEMESTER_REPORTS.find((entry) => entry.id === "previous");
    expect(winter?.attribution).toBe("Course data from VIT's current-semester registration list.");
    expect(previous?.attribution).toBe("Course data from VIT's previous-semester registration report.");
  });

  it("accepts only ids this build knows", () => {
    expect(isFFCSSemesterId("winter-2026-2027")).toBe(true);
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

  it("reads every row of the shipped winter CSV", () => {
    const csv = readFileSync(resolve(process.cwd(), "public/ffcs/winter-2026-2027-slot-timetable.csv"));
    const workbook = XLSX.read(csv, { type: "buffer" });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet);
    const courses = parseReportRows(rows);

    expect(courses).toHaveLength(3426);
    expect(new Set(courses.map((course) => course.CODE)).size).toBe(686);
    expect(courses.every((course) => course.SLOT && course.CLASS_ID && course.ERP_ID)).toBe(true);
    expect(courses.every((course) => course.EMPLOYEE_SCHOOL)).toBe(true);
  });

  it("joins wrapped names at word boundaries without splitting words", () => {
    const csv = readFileSync(resolve(process.cwd(), "public/ffcs/winter-2026-2027-slot-timetable.csv"));
    const workbook = XLSX.read(csv, { type: "buffer" });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const courses = parseReportRows(XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet));

    expect(courses.find((course) => course.CODE === "MATR706")?.FACULTY).toBe("THARASI DILLESWAR RAO");
    expect(courses.find((course) => course.CODE === "PRMC001L")?.FACULTY).toBe("BALAMURUGAN B J");
  });
});
