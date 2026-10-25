import { describe, it, expect } from "vitest";
import {
  parseUniversalPaste,
  isVtopRegistrationText,
} from "../features/import/parsePastedText";

describe("Universal Paste Parser", () => {
  const expectedCourses = [
    { code: "BACSE202", title: "Database Systems", slot: "F1+TF1", faculty: "VISWANATHAN V", venue: "AB4-305", credits: "3.0" },
    { code: "BACSE202", title: "Database Systems", slot: "L23+L24", faculty: "VISWANATHAN V", venue: "AB4-409", credits: "1.0" },
    { code: "BACSE203", title: "Computer Networks", slot: "B1+TB1", faculty: "PRASANNA BHARATHI S", venue: "AB4-305", credits: "3.0" },
  ];

  it("parses Markdown table format", () => {
    const markdown = `
| Course Code | Course Title | Slot | Faculty | Venue | Credits |
|-------------|--------------|------|---------|-------|---------|
| BACSE202 | Database Systems | F1+TF1 | VISWANATHAN V | AB4-305 | 3.0 |
| BACSE202 | Database Systems | L23+L24 | VISWANATHAN V | AB4-409 | 1.0 |
| BACSE203 | Computer Networks | B1+TB1 | PRASANNA BHARATHI S | AB4-305 | 3.0 |
`;
    const result = parseUniversalPaste(markdown);
    expect(result.addedCourses).toHaveLength(3);
    expect(result.addedCourses[0].code).toBe("BACSE202");
    expect(result.addedCourses[0].slots).toEqual(["F1", "TF1"]);
    expect(result.addedCourses[0].faculty).toBe("VISWANATHAN V");
    expect(result.addedCourses[0].venue).toBe("AB4-305");
    expect(result.addedCourses[0].credits).toBe("3.0");
  });

  it("parses simple piped format without outer pipes", () => {
    const piped = `
Course Code | Title | Slot | Faculty | Room | Credits
BACSE202 | Database Systems | F1+TF1 | VISWANATHAN V | AB4-305 | 3.0
BACSE202 | Database Systems | L23+L24 | VISWANATHAN V | AB4-409 | 1.0
BACSE203 | Computer Networks | B1+TB1 | PRASANNA BHARATHI S | AB4-305 | 3.0
`;
    const result = parseUniversalPaste(piped);
    expect(result.addedCourses).toHaveLength(3);
    expect(result.addedCourses[1].code).toBe("BACSE202");
    expect(result.addedCourses[1].slots).toEqual(["L23", "L24"]);
    expect(result.addedCourses[1].venue).toBe("AB4-409");
  });

  it("parses piped format without headers (inferred columns)", () => {
    const pipedNoHeaders = `
BACSE202 | Database Systems | ETH | F1+TF1 | VISWANATHAN V | AB4-305 | 3.0
BACSE202 | Database Systems | ELA | L23+L24 | VISWANATHAN V | AB4-409 | 1.0
BACSE203 | Computer Networks | ETH | B1+TB1 | PRASANNA BHARATHI S | AB4-305 | 3.0
`;
    const result = parseUniversalPaste(pipedNoHeaders);
    expect(result.addedCourses).toHaveLength(3);
    expect(result.addedCourses[0].code).toBe("BACSE202");
    expect(result.addedCourses[0].slots).toEqual(["F1", "TF1"]);
    expect(result.addedCourses[0].faculty).toBe("VISWANATHAN V");
  });

  it("parses TSV (tab-separated) copied from Excel / Google Sheets", () => {
    const tsv = [
      "Code\tTitle\tSlot\tFaculty\tVenue\tCredits",
      "BACSE202\tDatabase Systems\tF1+TF1\tVISWANATHAN V\tAB4-305\t3.0",
      "BACSE202\tDatabase Systems\tL23+L24\tVISWANATHAN V\tAB4-409\t1.0",
      "BACSE203\tComputer Networks\tB1+TB1\tPRASANNA BHARATHI S\tAB4-305\t3.0",
    ].join("\n");

    const result = parseUniversalPaste(tsv);
    expect(result.addedCourses).toHaveLength(3);
    expect(result.addedCourses[0].code).toBe("BACSE202");
    expect(result.addedCourses[0].slots).toEqual(["F1", "TF1"]);
    expect(result.addedCourses[2].code).toBe("BACSE203");
  });

  it("parses TSV without headers", () => {
    const tsv = [
      "BACSE202\tDatabase Systems\tF1+TF1\tVISWANATHAN V\tAB4-305\t3.0",
      "BACSE202\tDatabase Systems\tL23+L24\tVISWANATHAN V\tAB4-409\t1.0",
      "BACSE203\tComputer Networks\tB1+TB1\tPRASANNA BHARATHI S\tAB4-305\t3.0",
    ].join("\n");

    const result = parseUniversalPaste(tsv);
    expect(result.addedCourses).toHaveLength(3);
    expect(result.addedCourses[0].code).toBe("BACSE202");
    expect(result.addedCourses[0].slots).toEqual(["F1", "TF1"]);
  });

  it("parses CSV with quoted strings", () => {
    const csv = [
      `"Course Code","Course Title","Slot","Faculty Name","Venue","Credits"`,
      `"BACSE202","Database Systems","F1+TF1","VISWANATHAN V","AB4-305","3.0"`,
      `"BACSE202","Database Systems","L23+L24","VISWANATHAN V","AB4-409","1.0"`,
      `"BACSE203","Computer Networks","B1+TB1","PRASANNA BHARATHI S","AB4-305","3.0"`,
    ].join("\n");

    const result = parseUniversalPaste(csv);
    expect(result.addedCourses).toHaveLength(3);
    expect(result.addedCourses[0].code).toBe("BACSE202");
    expect(result.addedCourses[0].slots).toEqual(["F1", "TF1"]);
    expect(result.addedCourses[2].faculty).toBe("PRASANNA BHARATHI S");
  });

  it("parses CSV without headers", () => {
    const csv = [
      `BACSE202,Database Systems,F1+TF1,VISWANATHAN V,AB4-305,3.0`,
      `BACSE202,Database Systems,L23+L24,VISWANATHAN V,AB4-409,1.0`,
      `BACSE203,Computer Networks,B1+TB1,PRASANNA BHARATHI S,AB4-305,3.0`,
    ].join("\n");

    const result = parseUniversalPaste(csv);
    expect(result.addedCourses).toHaveLength(3);
    expect(result.addedCourses[0].code).toBe("BACSE202");
    expect(result.addedCourses[0].slots).toEqual(["F1", "TF1"]);
  });

  it("parses semicolon-separated CSV", () => {
    const semi = [
      "Course Code;Title;Slot;Faculty;Venue;Credits",
      "BACSE202;Database Systems;F1+TF1;VISWANATHAN V;AB4-305;3.0",
      "BACSE202;Database Systems;L23+L24;VISWANATHAN V;AB4-409;1.0",
      "BACSE203;Computer Networks;B1+TB1;PRASANNA BHARATHI S;AB4-305;3.0",
    ].join("\n");

    const result = parseUniversalPaste(semi);
    expect(result.addedCourses).toHaveLength(3);
    expect(result.addedCourses[0].code).toBe("BACSE202");
    expect(result.addedCourses[0].slots).toEqual(["F1", "TF1"]);
  });

  it("parses JSON array of course objects", () => {
    const json = JSON.stringify([
      { code: "BACSE202", title: "Database Systems", slot: "F1+TF1", faculty: "VISWANATHAN V", venue: "AB4-305", credits: "3.0" },
      { code: "BACSE202", title: "Database Systems", slot: "L23+L24", faculty: "VISWANATHAN V", venue: "AB4-409", credits: "1.0" },
      { code: "BACSE203", title: "Computer Networks", slot: "B1+TB1", faculty: "PRASANNA BHARATHI S", venue: "AB4-305", credits: "3.0" },
    ]);

    const result = parseUniversalPaste(json);
    expect(result.addedCourses).toHaveLength(3);
    expect(result.addedCourses[0].code).toBe("BACSE202");
    expect(result.addedCourses[0].slots).toEqual(["F1", "TF1"]);
  });

  it("parses AmazeCC timetable export JSON", () => {
    const json = JSON.stringify({
      timetables: [
        {
          id: "tt-1",
          name: "My Timetable",
          courses: [
            { id: "c1", code: "BACSE202", title: "Database Systems", slots: ["F1", "TF1"], faculty: "VISWANATHAN V", venue: "AB4-305", credits: "3.0", type: "ETH", color: "bg-blue-600" },
            { id: "c2", code: "BACSE202", title: "Database Systems", slots: ["L23", "L24"], faculty: "VISWANATHAN V", venue: "AB4-409", credits: "1.0", type: "ELA", color: "bg-blue-600" },
          ],
        },
      ],
    });

    const result = parseUniversalPaste(json);
    expect(result.addedCourses).toHaveLength(2);
    expect(result.addedCourses[0].code).toBe("BACSE202");
    expect(result.addedCourses[0].slots).toEqual(["F1", "TF1"]);
  });
});
