import { describe, expect, it } from "vitest";
import {
  parseAndConvert,
  parsePastedText,
  toParsedCourses,
  type PastedCourseOption,
} from "../features/import/parsePastedText";

/**
 * The paste parser, and its translation into this app's rows.
 *
 * Two different things are being pinned. The extraction is a port of
 * ffcsmaker's parser and is held to that implementation — if the same text
 * starts yielding different courses, something in the port moved. The
 * conversion is unique to this app, and it carries the risk that
 * ffcsmaker's two-field course (`theorySlotRaw`, `labSlotRaw`) does not
 * survive becoming one `SLOT`.
 *
 * Two facts about this university's data decide most of the expectations
 * below, and both were read off the shipped `ffcsReport.csv` rather than
 * assumed:
 *
 * - A slot chain is *one* unit. `THEORY_RE` matches `A1+TA1` and
 *   `D1+TD1+TDD1` whole, because a `+` chain is how a single booking is
 *   written — and that is already exactly this app's `SLOT` shape. `L7+L8`
 *   likewise comes back as one lab group. So `TA1` is not a lab: it is the
 *   Friday theory period, which is why every "theory slot" below can be a
 *   chain and still be theory.
 * - VIT codes are eight characters. `BASTS101`, `BAMAT201`, `BABIT314` are
 *   ordinary, and the reference's `{2,4}` letter run cannot reach any of
 *   them. The first describe exists to keep that from regressing.
 */

describe("recognising this university's course codes", () => {
  // 98 of the 497 distinct codes in public/ffcs/ffcsReport.csv fail the
  // reference's pattern. A parser that cannot read the commonest code in the
  // catalogue would report every line of a real paste as "Course code not
  // found" while looking perfectly healthy on a tutorial example.
  it("reads an eight-character VIT code", () => {
    const [only] = parsePastedText("BASTS101 Qualitative and Quantitative Skills Practice I F1+TF1 - Dr. Nair");
    expect(only.courseCode).toBe("BASTS101");
    expect(only.errors).not.toContain("Course code not found");
  });

  it.each(["BAMAT201", "BABIT314", "BMAT202P", "IASTS101", "BACLE102"])(
    "reads %s",
    (code) => {
      expect(parsePastedText(`${code} Some Course A1 - Dr. Smith`)[0].courseCode).toBe(code);
    }
  );

  it("still reads a short code", () => {
    expect(parsePastedText("CSE1001 Course A1 - Dr. Smith")[0].courseCode).toBe("CSE1001");
  });

  it("never takes a slot for a code", () => {
    // Every one of these is a slot, and each has the digit run the code
    // pattern wants — so it is the two-letter floor that has to hold them off.
    const [only] = parsePastedText("A1 TA1 S11 TDD1 L7 Dr. Smith");
    expect(only.courseCode).toBeNull();
  });
});

describe("reading pasted lines", () => {
  it("reads a fully written line as high confidence", () => {
    const [only] = parsePastedText("CSE1001 - Introduction to Computing - A1+TA1 - Dr. Smith");
    expect(only).toMatchObject({
      courseCode: "CSE1001",
      courseName: "Introduction to Computing",
      professorName: "Dr. Smith",
      theorySlotRaw: "A1+TA1",
      labSlotRaw: null,
      confidence: "high",
      errors: [],
    });
  });

  it("keeps a slot chain whole, because a chain is one booking", () => {
    const [only] = parsePastedText("BAMAT201 - Calculus - D1+TD1+TDD1 - Dr. Iyer");
    expect(only.theorySlotRaw).toBe("D1+TD1+TDD1");
    expect(only.labSlotRaw).toBeNull();
  });

  it("reads a lab-only booking as lab, not as theory", () => {
    const [only] = parsePastedText("BMAT202P - Biochemistry Lab - L7+L8 - Dr. Shah");
    expect(only.theorySlotRaw).toBeNull();
    expect(only.labSlotRaw).toBe("L7+L8");
    expect(only.confidence).toBe("high");
  });

  it("keeps what it knows onto the option lines that omit it", () => {
    // The commonest shape in the wild: a heading, then rows that only say
    // which slot each option is on. The heading is recognised as a heading
    // and is not itself offered as a course.
    const options = parsePastedText(
      [
        "CSE1001 Introduction to Computing 4 credits",
        "Option 1: A1+TA1 - Dr. Smith",
        "Option 2: B1+TB1 - Dr. Rao",
      ].join("\n")
    );

    expect(options).toHaveLength(2);
    expect(options[0]).toMatchObject({ courseCode: "CSE1001", theorySlotRaw: "A1+TA1", credits: 4 });
    expect(options[1]).toMatchObject({ courseCode: "CSE1001", theorySlotRaw: "B1+TB1", credits: 4 });
    expect(options[1].professorName).toContain("Dr. Rao");
  });

  it("gives the line under a heading the heading's identity", () => {
    const options = parsePastedText(
      ["CSE1001 Introduction to Computing 4 credits", "A1+TA1 Dr. Smith"].join("\n")
    );
    expect(options).toHaveLength(1);
    expect(options[0]).toMatchObject({ courseCode: "CSE1001", theorySlotRaw: "A1+TA1", credits: 4 });
  });

  it("recognises a law slot", () => {
    const [only] = parsePastedText("LAW101 Legal Studies S11+TEE - Prof. Nair");
    expect(only.theorySlotRaw).toBe("S11");
    expect(only.confidence).toBe("high");
    expect(only.errors).toEqual([]);
    // `S11` and `TEE` are the same period under the schema's law table, so the
    // converter keeps the one and the slot-spelling layer supplies the other.
    expect(toParsedCourses([only])[0].SLOT).toBe("S11");
  });

  it("reports a line that says there is no slot, and turns it into no course", () => {
    const [only] = parsePastedText("CSE1001 Introduction - NIL - Dr. Smith");
    expect(only.theorySlotRaw).toBeNull();
    expect(only.labSlotRaw).toBeNull();
    expect(only.errors).toContain("No slots found");
    expect(toParsedCourses([only])).toEqual([]);
  });

  it("says what it could not read, and does not claim to have lost a professor it kept", () => {
    const [only] = parsePastedText("Something incomprehensible");
    expect(only.confidence).toBe("low");
    expect(only.errors).toEqual(
      expect.arrayContaining(["Course code not found", "No slots found"])
    );
    // The whole line became the professor, which is a poor guess — but it is
    // an explicit one, and reporting it as missing would send the student
    // looking for a gap that is not where the problem is.
    expect(only.errors).not.toContain("Professor not found");
    expect(only.professorName).toBe("Something incomprehensible");
  });

  it("grades a partial line between the two", () => {
    const [only] = parsePastedText("CSE1001 A1+TA1");
    expect(only.confidence).toBe("medium");
    expect(only.errors).toEqual(["Professor not found"]);
  });

  it("reads credits in both the ways they are written", () => {
    // `(4)` marks an offering line, which is emitted.
    expect(parsePastedText("CSE1001 Course A1 (4) - Dr. Smith")[0].credits).toBe(4);
    // "3 credits" marks a heading, which is consumed and handed down instead.
    const carried = parsePastedText(["CSE1001 Course 3 credits", "A1+TA1 Dr. Smith"].join("\n"));
    expect(carried).toHaveLength(1);
    expect(carried[0].credits).toBe(3);
    expect(parsePastedText("CSE1001 Course A1 - Dr. Smith")[0].credits).toBeNull();
  });

  it("strips a leading list number", () => {
    const [only] = parsePastedText("1.   CSE1001    -  Course  -  A1+TA1  -  Dr. Smith");
    expect(only).toMatchObject({ courseCode: "CSE1001", courseName: "Course", professorName: "Dr. Smith" });
  });

  it("returns nothing at all for empty input", () => {
    expect(parsePastedText("")).toEqual([]);
    expect(parsePastedText("   \n\n   ")).toEqual([]);
  });
});

describe("turning options into this app's rows", () => {
  const rows = (text: string) => toParsedCourses(parsePastedText(text));

  it("keeps a slot chain as the one SLOT the solver reads", () => {
    const [course] = rows("CSE1001 Introduction - A1+TA1 - Dr. Smith");
    expect(course).toMatchObject({ CODE: "CSE1001", SLOT: "A1+TA1", FACULTY: "Dr. Smith", TYPE: "TH" });
  });

  it("pairs two comma lists index by index rather than crossing them", () => {
    const produced = rows("CSE1001 Course - Theory: A1, B1 - Lab: L7, L8 - Dr. Smith");
    expect(produced.map((course) => course.SLOT)).toEqual(["A1+L7", "B1+L8"]);
  });

  it("keeps an offering that has only one half", () => {
    const theoryOnly = rows("CSE1001 Course - Theory: A1 - Dr. Smith");
    expect(theoryOnly).toHaveLength(1);
    expect(theoryOnly[0].SLOT).toBe("A1");
    expect(theoryOnly[0].TYPE).toBe("TH");

    const labOnly = rows("CSE1001 Course - Lab: L7 - Dr. Smith");
    expect(labOnly[0].SLOT).toBe("L7");
    expect(labOnly[0].TYPE).toBe("LO");
  });

  it("calls a booking embedded when it genuinely carries both halves", () => {
    const [course] = rows("CSE1001 Course (Embedded) - A1+L7 - Dr. Smith");
    expect(course.SLOT).toBe("A1+L7");
    expect(course.TYPE).toBe("ETH + ELA");
  });

  it("never labels a half as embedded, because the solver would delete it", () => {
    // `ETH` means "theory half of an embedded course, pair me with an ELA
    // row". Nothing here can pair with, so the solver's completeness check
    // takes one look, finds no `L…` slot, and drops the course — silently,
    // leaving the student with one timetable fewer and no message anywhere.
    // The TYPE the slots justify has no such fate.
    const theoryHalf = rows("CSE1001 Course (Embedded) - A1 - Dr. Smith");
    expect(theoryHalf[0].TYPE).toBe("TH");
    expect(theoryHalf[0].SLOT).toBe("A1");

    // `A1+TA1` looks like theory-plus-lab and is not: `TA1` is the Friday
    // theory period, so there is no lab here to pair.
    const noLab = rows("CSE1001 Course (Embedded) - A1+TA1 - Dr. Smith");
    expect(noLab[0].TYPE).toBe("TH");

    // Nor may a lab alone claim to be the theory half.
    const labHalf = rows("CSE1001 Course (Embedded) - L7 - Dr. Smith");
    expect(labHalf[0].TYPE).toBe("LO");
  });

  it("emits nothing for a line with a code but no slots", () => {
    // A heading or a fragment. Importing it would create a course the solver
    // then rejects as `no_valid_slots`, pointing at something that never
    // existed.
    expect(toParsedCourses(parsePastedText("CSE1001 Introduction to Computing 4 credits"))).toEqual([]);
  });

  it("emits nothing for a line with no code", () => {
    const orphan: PastedCourseOption = {
      rawLine: "A1+TA1 Dr. Smith",
      courseCode: null,
      courseName: null,
      professorName: "Dr. Smith",
      theorySlotRaw: "A1+TA1",
      labSlotRaw: null,
      credits: null,
      confidence: "low",
      errors: ["Course code not found"],
    };
    expect(toParsedCourses([orphan])).toEqual([]);
  });

  it("upper-cases what it carries, because slot ids are compared case-sensitively", () => {
    const [course] = rows("cse1001 course - a1+ta1 - dr. smith");
    expect(course.CODE).toBe("CSE1001");
    expect(course.SLOT).toBe("A1+TA1");
  });

  it("defaults the fields it never saw rather than leaving them absent", () => {
    const [course] = rows("CSE1001 Course - A1+TA1 - Dr. Smith");
    expect(course.CREDITS).toBe("0");
    expect(course.ROOM).toBe("");
    expect(course.BATCH).toBe("");
  });
});

describe("paste to rows in one step", () => {
  it("gives the preview its per-line detail and the importer its rows", () => {
    const { options, courses } = parseAndConvert(
      ["CSE1001 Introduction - A1+TA1 - Dr. Smith", "gibberish"].join("\n")
    );

    expect(options).toHaveLength(2);
    // The second line inherited the course but has no slots, so it is graded
    // down and yields no row — reported, not silently dropped.
    expect(options[1].courseCode).toBe("CSE1001");
    expect(options[1].errors).toContain("No slots found");
    expect(courses).toHaveLength(1);
    expect(courses[0].CODE).toBe("CSE1001");
  });

  it("matches what doing it in two steps produces", () => {
    const text = [
      "CSE1001 Introduction - A1+TA1 - Dr. Smith",
      "CSE1002 Databases - B1+TB1 - Dr. Rao",
    ].join("\n");
    expect(parseAndConvert(text).courses).toEqual(toParsedCourses(parsePastedText(text)));
  });
});
