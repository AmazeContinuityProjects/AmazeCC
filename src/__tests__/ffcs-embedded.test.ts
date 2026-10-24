import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import * as XLSX from "xlsx";
import { processParsedCourses } from "../components/custom/exams/FFCSTimetableTab";
import { parseReportRows } from "../components/custom/exams/FFCS/reports";
import type { ParsedCourse } from "../components/custom/exams/FFCS/types";
import { getTimetableSchema } from "@/lib/campusSchema";
import { slotsOverlap } from "@/lib/slots";

/**
 * The winter report speaks a different dialect from the one the grouping
 * engine grew up with: no TYPE column, no venue, and an employee id instead of
 * a faculty identity. These tests pin the reconcile: blank types are treated
 * as embedded halves, pairing is inferred and stays inside one employee, and
 * the previous semester's labelled rows still pair exactly as they always
 * did.
 */

const winterRow = (
  over: Partial<ParsedCourse> & Pick<ParsedCourse, "CODE" | "SLOT" | "FACULTY">
): ParsedCourse => ({
  TITLE: "Test course",
  TYPE: "",
  CREDITS: "2",
  ROOM: "",
  ...over,
});

describe("blank types take the embedded pairing path", () => {
  it("pairs the two halves of one person's blank-type offering", () => {
    // BACSE104 in the winter CSV: one theory class and one lab class, both
    // carried by the same employee under the same course code. Lab slots on
    // Thursday cannot clash a theory slot that only runs Monday/Wednesday.
    const grouped = processParsedCourses([
      winterRow({
        CODE: "BACSE104",
        SLOT: "A1",
        FACULTY: "AARTHI B",
        ERP_ID: "54151",
        CREDITS: "2",
        CLASS_ID: "CH2026270502643",
        EMPLOYEE_SCHOOL: "SCOPE",
      }),
      winterRow({
        CODE: "BACSE104",
        SLOT: "L19",
        FACULTY: "AARTHI B",
        ERP_ID: "54151",
        CREDITS: "2",
        CLASS_ID: "CH2026270502806",
        EMPLOYEE_SCHOOL: "SCOPE",
      }),
    ]);

    expect(grouped).toHaveLength(1);
    const [merged] = grouped;
    expect(merged.SLOT).toBe("A1+L19");
    expect(merged.TYPE).toBe("ETH+ELA");
    expect(merged.TITLE).toBe("Test course [Embedded Theory and Lab]");
    // The winter report has no venue; joining two absent rooms must not
    // publish the string " / " as if it were one.
    expect(merged.ROOM).toBe("");
    expect(merged.CREDITS).toBe("4");
    expect(merged.FACULTY).toBe("AARTHI B");
    expect(merged.ERP_ID).toBe("54151");
    expect(merged.CLASS_ID).toBe("CH2026270502643");
  });

  it("gives both of one person's sections their own lab", () => {
    // AARTHI D in the winter CSV teaches two theory sections and runs two lab
    // sections. Grouping by employee id, each section keeps its own half.
    const grouped = processParsedCourses([
      winterRow({ CODE: "BACSE104", SLOT: "G1", FACULTY: "AARTHI D", ERP_ID: "54969" }),
      winterRow({ CODE: "BACSE104", SLOT: "G2", FACULTY: "AARTHI D", ERP_ID: "54969" }),
      winterRow({ CODE: "BACSE104", SLOT: "L31+L32+L49+L50", FACULTY: "AARTHI D", ERP_ID: "54969" }),
      winterRow({ CODE: "BACSE104", SLOT: "L3+L4+L23+L24", FACULTY: "AARTHI D", ERP_ID: "54969" }),
    ]);

    expect(grouped).toHaveLength(2);
    const slots = grouped.map((c) => c.SLOT);
    expect(slots).toContain("G1+L31+L32+L49+L50");
    expect(slots).toContain("G2+L3+L4+L23+L24");
  });

  it("optimally pairs multi-section offerings respecting session shifts (Muthulakshmi S)", () => {
    // When a faculty member teaches both morning and evening theories (A1+TA1 and A2+TA2)
    // with multiple lab sections (L15+L16 on Wednesday morning and L11+L12 on Tuesday),
    // A2+TA2 (evening theory) must take the morning lab L15+L16, while A1+TA1 pairs with
    // L11+L12 to avoid placing both theory and lab during morning theory hours.
    const grouped = processParsedCourses([
      winterRow({ CODE: "BAECE204", SLOT: "A1+TA1", FACULTY: "MUTHULAKSHMI S", ERP_ID: "50407", CLASS_ID: "CH2026270501459" }),
      winterRow({ CODE: "BAECE204", SLOT: "A2+TA2", FACULTY: "MUTHULAKSHMI S", ERP_ID: "50407", CLASS_ID: "CH2026270501461" }),
      winterRow({ CODE: "BAECE204", SLOT: "L15+L16", FACULTY: "MUTHULAKSHMI S", ERP_ID: "50407", CLASS_ID: "CH2026270502817" }),
      winterRow({ CODE: "BAECE204", SLOT: "L11+L12", FACULTY: "MUTHULAKSHMI S", ERP_ID: "50407", CLASS_ID: "CH2026270503049" }),
    ]);

    expect(grouped).toHaveLength(2);
    const slots = grouped.map((c) => c.SLOT);
    expect(slots).toContain("A1+TA1+L11+L12");
    expect(slots).toContain("A2+TA2+L15+L16");
  });

  it("prioritizes Priority 1 (8:00-11:40 for evening theory, 2:00-5:30 for morning theory) over Priority 2 & 3", () => {
    // A faculty has:
    // Theory: Morning (A1+TA1) and Evening (A2+TA2)
    // Labs:
    // - L15+L16 (Wed 9:50-11:30 AM -> 8:00-11:40 core morning lab)
    // - L11+L12 (Tue 11:40-1:20 PM -> 11:40-1:20 late morning lab)
    // Under Priority 1, A2+TA2 gets L15+L16.
    // Under Priority 2, A1+TA1 gets L11+L12.
    const grouped = processParsedCourses([
      winterRow({ CODE: "BAECE204", SLOT: "A1+TA1", FACULTY: "MUTHULAKSHMI S", ERP_ID: "50407" }),
      winterRow({ CODE: "BAECE204", SLOT: "A2+TA2", FACULTY: "MUTHULAKSHMI S", ERP_ID: "50407" }),
      winterRow({ CODE: "BAECE204", SLOT: "L15+L16", FACULTY: "MUTHULAKSHMI S", ERP_ID: "50407" }),
      winterRow({ CODE: "BAECE204", SLOT: "L11+L12", FACULTY: "MUTHULAKSHMI S", ERP_ID: "50407" }),
    ]);

    expect(grouped).toHaveLength(2);
    const slots = grouped.map((c) => c.SLOT);
    expect(slots).toContain("A2+TA2+L15+L16"); // Priority 1 (Evening Theory + 8:00-11:40 lab)
    expect(slots).toContain("A1+TA1+L11+L12"); // Priority 2 (Morning Theory + 11:40-1:20 lab)
  });

  it("prioritizes above-30 lab over 11:40-1:20 lab for morning theory", () => {
    // If morning theory has both an above-30 lab (e.g. L43+L44) and an 11:40-1:20 lab (e.g. L11+L12),
    // it must prioritize the above-30 lab first.
    const grouped = processParsedCourses([
      winterRow({ CODE: "BACSE201", SLOT: "A1+TA1", FACULTY: "TEST FACULTY", ERP_ID: "99991" }),
      winterRow({ CODE: "BACSE201", SLOT: "B1+TB1", FACULTY: "TEST FACULTY", ERP_ID: "99991" }),
      winterRow({ CODE: "BACSE201", SLOT: "L11+L12", FACULTY: "TEST FACULTY", ERP_ID: "99991" }),
      winterRow({ CODE: "BACSE201", SLOT: "L43+L44", FACULTY: "TEST FACULTY", ERP_ID: "99991" }),
    ]);

    expect(grouped).toHaveLength(2);
    const slots = grouped.map((c) => c.SLOT);
    // Both are morning theories, one gets above-30 lab, one gets 11:40-1:20 lab
    expect(slots.some((s) => s.includes("L43+L44"))).toBe(true);
    expect(slots.some((s) => s.includes("L11+L12"))).toBe(true);
  });

  it("pairs evening theory with 5:30-7:20 evening lab over earlier evening lab", () => {
    // When forced to pair evening theory with evening labs, 5:30-7:20 (e.g. L47+L48)
    // is preferred over core afternoon/evening labs (e.g. L31+L32).
    const grouped = processParsedCourses([
      winterRow({ CODE: "BACSE202", SLOT: "A2+TA2", FACULTY: "TEST FACULTY", ERP_ID: "99992" }),
      winterRow({ CODE: "BACSE202", SLOT: "C1+TC1", FACULTY: "TEST FACULTY", ERP_ID: "99992" }),
      winterRow({ CODE: "BACSE202", SLOT: "L31+L32", FACULTY: "TEST FACULTY", ERP_ID: "99992" }),
      winterRow({ CODE: "BACSE202", SLOT: "L47+L48", FACULTY: "TEST FACULTY", ERP_ID: "99992" }),
    ]);

    expect(grouped).toHaveLength(2);
    const slots = grouped.map((c) => c.SLOT);
    // C1+TC1 (morning theory) gets L31+L32 (above 30)
    // A2+TA2 (evening theory) gets L47+L48 (5:30-7:20 evening lab)
    expect(slots).toContain("C1+TC1+L31+L32");
    expect(slots).toContain("A2+TA2+L47+L48");
  });

  it("pairs the same person across two different name spellings", () => {
    const grouped = processParsedCourses([
      winterRow({ CODE: "BAXXX101", SLOT: "A1", FACULTY: "S SARAVANAN", ERP_ID: "12345" }),
      winterRow({ CODE: "BAXXX101", SLOT: "L19", FACULTY: "SREF SARAVANAN", ERP_ID: "12345" }),
    ]);

    expect(grouped).toHaveLength(1);
    expect(grouped[0].SLOT).toBe("A1+L19");
  });

  it("never borrows another person's lab, even under one name", () => {
    // Two sections share the name AARTHI B but are different employees, and
    // each one's half clashes with its own other half. Pairing by name would
    // happily cross the two; pairing by employee id must refuse, and the rows
    // have to come out standing alone.
    const grouped = processParsedCourses([
      winterRow({ CODE: "BAXXX201", SLOT: "A1", FACULTY: "AARTHI B", ERP_ID: "50151" }), // Mon 8:00
      winterRow({ CODE: "BAXXX201", SLOT: "D1", FACULTY: "AARTHI B", ERP_ID: "50252" }), // Thu 8:00
      winterRow({ CODE: "BAXXX201", SLOT: "L1", FACULTY: "AARTHI B", ERP_ID: "50151" }), // Mon 8:00
      winterRow({ CODE: "BAXXX201", SLOT: "L19", FACULTY: "AARTHI B", ERP_ID: "50252" }), // Thu 8:00
    ]);

    expect(grouped).toHaveLength(4);
    expect(grouped.every((c) => !c.SLOT.includes("+"))).toBe(true);
  });

  it("leaves a half alone when its partner clashes with it", () => {
    const grouped = processParsedCourses([
      winterRow({ CODE: "CSE3506", SLOT: "A1", FACULTY: "PADMA J", ERP_ID: "53408" }),
      winterRow({ CODE: "CSE3506", SLOT: "L1", FACULTY: "PADMA J", ERP_ID: "53408" }),
    ]);

    expect(grouped).toHaveLength(2);
    expect(grouped.every((c) => !c.SLOT.includes("+"))).toBe(true);
    expect(grouped.every((c) => c.TYPE === "")).toBe(true);
  });

  it("keeps NIL rows beside their sibling halves", () => {
    // Winter analytics courses ship as a scheduled theory offering plus a NIL
    // sibling. A NIL slot is not a lab and cannot be paired away.
    const grouped = processParsedCourses([
      winterRow({ CODE: "MGT3007", SLOT: "E1+TE1", FACULTY: "ARSHIYA FATHIMA M S", ERP_ID: "53031" }),
      winterRow({ CODE: "MGT3007", SLOT: "NIL", FACULTY: "ARSHIYA FATHIMA M S", ERP_ID: "53031" }),
    ]);

    expect(grouped).toHaveLength(2);
    expect(grouped.map((c) => c.SLOT).sort()).toEqual(["E1+TE1", "NIL"]);
  });
});

describe("labelled halves keep the engine they always had", () => {
  it("pairs ETH and ELA rows exactly as before", () => {
    const grouped = processParsedCourses([
      winterRow({
        CODE: "BAMAT101",
        TYPE: "ETH",
        SLOT: "G1+TG1",
        CREDITS: "3",
        ROOM: "AB1-101",
        FACULTY: "PARTHIBAN V",
      }),
      winterRow({
        CODE: "BAMAT101",
        TYPE: "ELA",
        SLOT: "L47+L48",
        CREDITS: "1",
        ROOM: "SB1-201",
        FACULTY: "PARTHIBAN V",
      }),
    ]);

    expect(grouped).toHaveLength(1);
    const [merged] = grouped;
    expect(merged.SLOT).toBe("G1+TG1+L47+L48");
    expect(merged.TYPE).toBe("ETH+ELA");
    expect(merged.CREDITS).toBe("4");
    expect(merged.ROOM).toBe("AB1-101 / SB1-201");
    expect(merged.TITLE).toBe("Test course [Embedded Theory and Lab]");
  });
});

describe("the shipped reports", () => {
  const loadCsv = (file: string): ParsedCourse[] => {
    const csv = readFileSync(resolve(process.cwd(), file));
    const workbook = XLSX.read(csv, { type: "buffer" });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    return parseReportRows(XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet));
  };

  const halvesOf = (combo: ParsedCourse): { theory: string; lab: string } | null => {
    const tokens = combo.SLOT.split("+");
    const labStart = tokens.findIndex((s) => s.startsWith("L"));
    if (labStart <= 0) return null;
    return {
      theory: tokens.slice(0, labStart).join("+"),
      lab: tokens.slice(labStart).join("+"),
    };
  };

  it("infers pairs for the winter report from the same employee only", () => {
    const parsed = loadCsv("public/ffcs/winter-2026-2027-slot-timetable.csv");
    // The inference signal is the blank type itself; nothing else in this
    // report is allowed to be missing.
    expect(parsed.every((c) => c.TYPE === "")).toBe(true);

    const grouped = processParsedCourses(parsed);
    const combos = grouped.filter((c) => c.TYPE === "ETH+ELA");
    // Pinned to today's winter dataset: 1079 inferred embedded offerings,
    // 690 of them BA-prefixed. Every one is validated below.
    expect(combos.length).toBe(1079);
    expect(combos.filter((c) => c.CODE.startsWith("BA")).length).toBe(690);

    // Index code families both ways so a merged L/P base still finds its
    // suffixed report row.
    const stripSuffix = (code: string): string =>
      code.endsWith("L") || code.endsWith("P") ? code.slice(0, -1) : code;
    const byKey = new Map<string, ParsedCourse>();
    for (const r of parsed) {
      byKey.set(`${stripSuffix(r.CODE)}|${r.ERP_ID}|${r.SLOT}`, r);
      byKey.set(`${r.CODE}|${r.ERP_ID}|${r.SLOT}`, r);
    }
    for (const combo of combos) {
      const halves = halvesOf(combo);
      expect(halves).not.toBeNull();
      if (!halves) continue;
      // A combined row is a theory half in front of a lab half, and the two
      // must never meet in time — that is the pairing rule the engine used.
      expect(slotsOverlap(halves.theory, halves.lab, getTimetableSchema())).toBe(false);
      // The lab half must genuinely belong to the same employee the combined
      // row carries: inferring across two people is the failure this is for.
      expect(byKey.get(`${combo.CODE}|${combo.ERP_ID}|${halves.lab}`)).toBeDefined();
    }
  });

  it("changes nothing about the previous report's pairings", () => {
    const parsed = loadCsv("public/ffcs/ffcsReport.csv");
    expect(parsed.every((c) => c.TYPE !== "")).toBe(true);

    const grouped = processParsedCourses(parsed);
    const bamat = grouped.find((c) => c.CODE === "BAMAT101" && c.TYPE === "ETH+ELA");
    expect(bamat).toBeDefined();
    if (!bamat) return;
    expect(bamat.SLOT).toBe("G1+TG1+L47+L48");
    expect(bamat.CREDITS).toBe("4");
    expect(bamat.ROOM).toContain(" / ");

    const combos = grouped.filter((c) => c.TYPE === "ETH+ELA");
    // Pinned to the shipped previous-semester dataset: the engine keeps
    // forming exactly the pairings it always did.
    expect(combos.length).toBe(335);
    expect(grouped.length).toBe(1734);
    for (const combo of combos) {
      const halves = halvesOf(combo);
      expect(halves).not.toBeNull();
      if (!halves) continue;
      expect(slotsOverlap(halves.theory, halves.lab, getTimetableSchema())).toBe(false);
    }
  });
});
