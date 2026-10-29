import { describe, expect, it } from "vitest";
import { importFile } from "../features/import/importFile";
import { IMPORTABLE_FIELDS, normalizeHeader, REQUIRED_FIELDS } from "../features/import/normalizeColumns";
import { buildSampleCourseListCsv, SAMPLE_COURSE_LIST_FILENAME } from "../features/import/sampleCourseList";

/**
 * The downloadable sample sheet.
 *
 * The load-bearing test is the round-trip: the sample is built from the same
 * field constants the importer matches against, so downloading it, editing
 * nothing and importing it straight back must parse cleanly — every heading
 * recognised, every required field present, both example rows read as
 * courses. If a field is added or renamed in `normalizeColumns` and the
 * sample is not regenerated to match, this is what catches it.
 */

/** A `File` that works whether or not the test environment implements `.text`. */
const fileOf = (contents: string, name: string): File => {
  const file = new File([contents as BlobPart], name, { type: "text/csv" });
  if (typeof file.text !== "function") {
    Object.defineProperty(file, "text", { value: async () => contents });
  }
  return file;
};

describe("sample course list", () => {
  it("marks exactly the required fields in its headings", () => {
    const [heading] = buildSampleCourseListCsv().split("\n");

    for (const field of IMPORTABLE_FIELDS) {
      const marker = REQUIRED_FIELDS.includes(field) ? `${field} (required)` : field;
      expect(heading).toContain(marker);
    }
    // The optional columns carry no marker that could be read as one.
    expect(heading).not.toContain("TITLE (required)");
    expect(heading).not.toContain("FACULTY (required)");
  });

  it("names every field with the importer's own spelling", () => {
    const [heading] = buildSampleCourseListCsv().split("\n");
    const recognised = heading
      .split(",")
      .map((cell) => normalizeHeader(cell.trim()))
      .filter((field) => field !== null);

    expect(recognised).toEqual([...IMPORTABLE_FIELDS]);
  });

  it("round-trips through the importer unedited", async () => {
    const result = await importFile(fileOf(buildSampleCourseListCsv(), SAMPLE_COURSE_LIST_FILENAME));

    expect(result.error).toBeNull();
    expect(result.courses).toHaveLength(2);
    expect(result.missingFields).toEqual([]);
    expect(result.ignoredHeaders).toEqual([]);
    expect(result.skipped).toBe(0);

    const [theory, lab] = result.courses;
    expect(theory.CODE).toBe("CSX1001");
    expect(theory.SLOT).toBe("A1+TA1");
    expect(theory.TYPE).toBe("TH");
    expect(theory.CREDITS).toBe("4");
    // A row may leave its optional columns blank — the lab row says so.
    expect(lab.FACULTY).toBe("");
    expect(lab.ROOM).toBe("");
  });

  it("still imports a corrected copy with an optional column deleted", async () => {
    // What a student's edit actually looks like: columns gone, values
    // changed, headings rewritten in their own words.
    const edited =
      "Course Code,Course Title,Slot\n" +
      "CSX1001,Edited Title,A2+TA2\n";

    const result = await importFile(fileOf(edited, "my-list.csv"));

    expect(result.error).toBeNull();
    expect(result.courses).toHaveLength(1);
    expect(result.courses[0].TITLE).toBe("Edited Title");
    expect(result.courses[0].SLOT).toBe("A2+TA2");
    // Unmapped columns are reported rather than silently dropped.
    expect(result.missingFields).toContain("FACULTY");
  });
});
