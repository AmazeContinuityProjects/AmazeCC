import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parseReportRows } from "../components/custom/exams/FFCS/reports";

/**
 * The bundled CodeChef VIT catalogue is the planner's only fully offline data
 * source — it must never need an API. That makes the shipped CSV itself the
 * contract: the loader parses it with the same `parseReportRows` as the two
 * registration reports, so this test pins the file's shape rather than any
 * consumer's interpretation of it.
 *
 * The CSV is parsed with a small quoted-field splitter instead of the xlsx
 * reader the tab uses at runtime: this is a Node-side sanity check, and a
 * dependency-free parser also proves the file stays plain RFC-4180 — nothing
 * Excel-specific snuck into a file that is supposed to be hand-inspectable.
 */

const CSV_PATH = "public/ffcs/codechef-vit-catalogue.csv";
const EXPECTED_HEADER = "CODE,TITLE,TYPE,CREDITS,SLOT,FACULTY,VENUE,EMPLOYEE SCHOOL";

/** RFC-4180: quoted fields, doubled quotes inside them, CRLF or LF endings. */
function splitCsvRows(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    if (inQuotes) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        field += char;
      }
    } else if (char === '"') {
      inQuotes = true;
    } else if (char === ",") {
      row.push(field);
      field = "";
    } else if (char === "\n") {
      row.push(field);
      field = "";
      rows.push(row);
      row = [];
    } else if (char !== "\r") {
      field += char;
    }
  }
  if (field !== "" || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

function loadCatalogue() {
  const text = readFileSync(resolve(process.cwd(), CSV_PATH), "utf8");
  const rows = splitCsvRows(text);
  const [header, ...data] = rows;
  const columns = header;
  const objects = data.map((row) => Object.fromEntries(columns.map((name, index) => [name, row[index]])));
  return { header: header.join(","), raw: data, columns, courses: parseReportRows(objects) };
}

describe("bundled CodeChef VIT catalogue", () => {
  const catalogue = loadCatalogue();

  it("ships the header the report loader expects", () => {
    expect(catalogue.header).toBe(EXPECTED_HEADER);
    expect(catalogue.columns).toHaveLength(8);
  });

  it("carries a full-semester worth of offerings", () => {
    // The catalogue is the deduplicated port of FFCS-inator's school folders:
    // ~5 500 raw source entries collapse to ~2 750 unique offerings. The floor
    // is well under that to survive upstream additions/removals, but far above
    // anything a truncated or half-converted file would produce.
    expect(catalogue.courses.length).toBeGreaterThanOrEqual(2500);
    // Every raw row must survive parseReportRows, which drops rows without a
    // course code.
    expect(catalogue.courses).toHaveLength(catalogue.raw.length);
    expect(new Set(catalogue.courses.map((course) => course.CODE)).size).toBeGreaterThanOrEqual(300);
  });

  it("keeps every row inside the planner's course vocabulary", () => {
    for (const course of catalogue.courses) {
      expect(course.CODE).toBeTruthy();
      expect(course.SLOT).toBeTruthy();
      expect(course.TYPE === "TH" || course.TYPE === "LO").toBe(true);
      expect(course.CREDITS).toMatch(/^\d+(\.\d+)?$/);
      expect(course.FACULTY).toBeTruthy();
      expect(course.EMPLOYEE_SCHOOL).toBeTruthy();
    }
  });

  it("lists a venue for nearly every offering", () => {
    // A handful of MTech entries use the literal 'NIL' venue in the source
    // data; "present" here means the column is filled, not that a room exists.
    const withVenue = catalogue.courses.filter((course) => course.ROOM.trim() !== "").length;
    expect(withVenue / catalogue.courses.length).toBeGreaterThanOrEqual(0.95);
  });

  it("has no fully duplicated rows", () => {
    const identities = catalogue.courses.map((course) =>
      [course.CODE, course.TITLE, course.TYPE, course.SLOT, course.FACULTY, course.ROOM].join("\u0000"),
    );
    expect(new Set(identities).size).toBe(identities.length);
  });

  it("matches a known offering from the converted source data", () => {
    // Verified against ../ffcs/src/data/SCOPE/FoundationCore.ts.
    const rows = catalogue.courses.filter(
      (course) => course.CODE === "BCHY101L" && course.FACULTY === "SATHISH KUMAR P",
    );
    expect(rows).toContainEqual(
      expect.objectContaining({
        CODE: "BCHY101L",
        TITLE: "Engineering Chemistry",
        TYPE: "TH",
        SLOT: "G2+TG2",
        FACULTY: "SATHISH KUMAR P",
        ROOM: "PRP630",
      }),
    );
  });
});
