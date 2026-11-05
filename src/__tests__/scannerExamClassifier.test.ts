import { describe, expect, it } from "vitest";
import { buildExamTitle, classifyExamPaper, inferSemesterFromMonthYear } from "../lib/scanner/examClassifier";

describe("scannerExamClassifier", () => {
  describe("inferSemesterFromMonthYear", () => {
    it("maps May 2024 to Winter Semester 2023-24 by default", () => {
      const res = inferSemesterFromMonthYear(5, 2024);
      expect(res.semester).toBe("Winter Semester 2023-24");
      expect(res.shortSemester).toBe("Winter 2023-24");
      expect(res.term).toBe("Winter");
      expect(res.academicYear).toBe("2023-24");
    });

    it("maps May 2024 to Summer Semester 2023-24 when summer hint is present", () => {
      const res = inferSemesterFromMonthYear(5, 2024, { isSummerHint: true });
      expect(res.semester).toBe("Summer Semester 2023-24");
      expect(res.shortSemester).toBe("Summer 2023-24");
      expect(res.term).toBe("Summer");
      expect(res.academicYear).toBe("2023-24");
    });

    it("maps June 2024 to Summer Semester 2023-24", () => {
      const res = inferSemesterFromMonthYear(6, 2024);
      expect(res.semester).toBe("Summer Semester 2023-24");
      expect(res.shortSemester).toBe("Summer 2023-24");
      expect(res.term).toBe("Summer");
      expect(res.academicYear).toBe("2023-24");
    });

    it("maps December 2023 to Winter Semester 2023-24", () => {
      const res = inferSemesterFromMonthYear(12, 2023);
      expect(res.semester).toBe("Winter Semester 2023-24");
      expect(res.shortSemester).toBe("Winter 2023-24");
      expect(res.term).toBe("Winter");
      expect(res.academicYear).toBe("2023-24");
    });

    it("maps January 2024 to Winter Semester 2023-24", () => {
      const res = inferSemesterFromMonthYear(1, 2024);
      expect(res.semester).toBe("Winter Semester 2023-24");
      expect(res.shortSemester).toBe("Winter 2023-24");
      expect(res.term).toBe("Winter");
    });

    it("maps April 2024 to Winter Semester 2023-24", () => {
      const res = inferSemesterFromMonthYear(4, 2024);
      expect(res.semester).toBe("Winter Semester 2023-24");
      expect(res.shortSemester).toBe("Winter 2023-24");
    });

    it("maps July 2024 to Fall Semester 2024-25", () => {
      const res = inferSemesterFromMonthYear(7, 2024);
      expect(res.semester).toBe("Fall Semester 2024-25");
      expect(res.shortSemester).toBe("Fall 2024-25");
      expect(res.term).toBe("Fall");
      expect(res.academicYear).toBe("2024-25");
    });

    it("maps November 2024 to Fall Semester 2024-25", () => {
      const res = inferSemesterFromMonthYear(11, 2024);
      expect(res.semester).toBe("Fall Semester 2024-25");
      expect(res.shortSemester).toBe("Fall 2024-25");
      expect(res.term).toBe("Fall");
      expect(res.academicYear).toBe("2024-25");
    });

    it("maps February 2025 to Winter Semester 2024-25", () => {
      const res = inferSemesterFromMonthYear(2, 2025);
      expect(res.semester).toBe("Winter Semester 2024-25");
      expect(res.shortSemester).toBe("Winter 2024-25");
    });

    it("maps September 2023 to Fall Semester 2023-24", () => {
      const res = inferSemesterFromMonthYear(9, 2023);
      expect(res.semester).toBe("Fall Semester 2023-24");
      expect(res.shortSemester).toBe("Fall 2023-24");
    });
  });

  describe("classifyExamPaper", () => {
    it("extracts FAT exam details from real German question paper OCR text", () => {
      const sampleText = `
wa Reg. No: 21600019
-~ Final Assessment Test - May 2024
oy V 1 1} Course: BGER101L - German!
WIR Teles td Tei Class NBR(s): 5493 Slot: C1
FRESSmEEEET Time: Three Hours Max. Marks: 100
» KEEPING MOBILE PHONE/ELECTRONIC DEVICES EVEN IN ‘OFF POSITION IS TREATED AS EXAM MALPRACTICE
» DON'T WRITE ANYTHING ON THE QUESTION PAPER
Answer any TEN Questions
(10 X 10 = 100 Marks)
1 a) Nomen. (Lernmaterialien) Schreiben Sie die fehlenden Buchstaben! 15)
Nouns. (Learning Materials) Write the missing letters.
      `;

      const details = classifyExamPaper(sampleText);
      expect(details).not.toBeNull();
      expect(details?.category).toBe("FAT");
      expect(details?.session).toBe("May 2024");
      expect(details?.month).toBe("May");
      expect(details?.year).toBe(2024);
      expect(details?.semester).toBe("Winter Semester 2023-24");
      expect(details?.shortSemester).toBe("Winter 2023-24");
      expect(details?.courseCode).toBe("BGER101L");
      expect(details?.courseTitle).toBe("German");
      expect(details?.slot).toBe("C1");
      expect(details?.classNbr).toBe("5493");
      expect(details?.regNo).toBe("21600019");
      expect(details?.maxMarks).toBe(100);
      expect(details?.duration).toBe("Three Hours");

      const title = buildExamTitle(details!);
      expect(title).toBe("BGER101L German — FAT (May 2024)");
    });

    it("detects CAT 1 with Roman numeral I and September session", () => {
      const text = `
Continuous Assessment Test - I - September 2024
Course: BCSE204L - Database Management Systems
Slot: A1+TA1 Class NBR: 2012
Max Marks: 50 Time: 90 Minutes
Answer all questions.
      `;

      const details = classifyExamPaper(text);
      expect(details).not.toBeNull();
      expect(details?.category).toBe("CAT 1");
      expect(details?.session).toBe("September 2024");
      expect(details?.semester).toBe("Fall Semester 2024-25");
      expect(details?.courseCode).toBe("BCSE204L");
      expect(details?.courseTitle).toBe("Database Management Systems");
      expect(details?.slot).toBe("A1+TA1");
      expect(details?.maxMarks).toBe(50);
      expect(details?.duration).toBe("90 Minutes");
    });

    it("detects CAT 2 with digit 2 and March session", () => {
      const text = `
CAT-2 Examination - March 2025
Course Code: BAMAT209 Linear Algebra
Slot: D1
Max. Marks: 50
Time: 90 Mins
      `;

      const details = classifyExamPaper(text);
      expect(details).not.toBeNull();
      expect(details?.category).toBe("CAT 2");
      expect(details?.session).toBe("March 2025");
      expect(details?.semester).toBe("Winter Semester 2024-25");
      expect(details?.courseCode).toBe("BAMAT209");
      expect(details?.courseTitle).toBe("Linear Algebra");
      expect(details?.slot).toBe("D1");
      expect(details?.maxMarks).toBe(50);
    });

    it("detects Lab FAT with November session", () => {
      const text = `
Laboratory Final Assessment Test - November 2024
Course: BCSE204P - Database Management Systems Lab
Slot: L31+L32
Class NBR: 2013
Max Marks: 50
      `;

      const details = classifyExamPaper(text);
      expect(details).not.toBeNull();
      expect(details?.category).toBe("Lab FAT");
      expect(details?.session).toBe("November 2024");
      expect(details?.semester).toBe("Fall Semester 2024-25");
      expect(details?.courseCode).toBe("BCSE204P");
      expect(details?.slot).toBe("L31+L32");
    });

    it("honors explicit Winter Semester 2023-24 text in header", () => {
      const text = `
Winter Semester 2023-24
Final Assessment Test (FAT)
Course: BACSE106 Operating Systems
      `;

      const details = classifyExamPaper(text);
      expect(details).not.toBeNull();
      expect(details?.category).toBe("FAT");
      expect(details?.semester).toBe("Winter Semester 2023-24");
      expect(details?.courseCode).toBe("BACSE106");
    });

    it("detects Supplementary / Arrear examination", () => {
      const text = `
Supplementary Examination - July 2024
Course: BMAT101L - Calculus
Slot: B1
      `;

      const details = classifyExamPaper(text);
      expect(details).not.toBeNull();
      expect(details?.category).toBe("Supplementary");
      expect(details?.session).toBe("July 2024");
      expect(details?.semester).toBe("Fall Semester 2024-25");
    });

    it("categorizes December 2023 FAT as Winter Semester 2023-24", () => {
      const text = `
Final Assessment Test - December 2023
Course: BCSE301L - Software Engineering
Slot: E1
Class NBR: 3311
Max Marks: 100
      `;

      const details = classifyExamPaper(text);
      expect(details).not.toBeNull();
      expect(details?.category).toBe("FAT");
      expect(details?.session).toBe("December 2023");
      expect(details?.semester).toBe("Winter Semester 2023-24");
      expect(details?.shortSemester).toBe("Winter 2023-24");
      expect(details?.academicYear).toBe("2023-24");
    });

    it("categorizes June 2024 FAT as Summer Semester 2023-24", () => {
      const text = `
Final Assessment Test - June 2024
Course: BMAT202L - Applied Numerical Methods
Slot: TF1
Max Marks: 100
      `;

      const details = classifyExamPaper(text);
      expect(details).not.toBeNull();
      expect(details?.category).toBe("FAT");
      expect(details?.session).toBe("June 2024");
      expect(details?.semester).toBe("Summer Semester 2023-24");
      expect(details?.shortSemester).toBe("Summer 2023-24");
      expect(details?.term).toBe("Summer");
    });

    it("categorizes May 2024 Summer Term examination as Summer Semester 2023-24", () => {
      const text = `
Summer Semester Final Assessment Test - May 2024
Course: BECE102L - Digital Systems Design
Slot: A2
      `;

      const details = classifyExamPaper(text);
      expect(details).not.toBeNull();
      expect(details?.category).toBe("FAT");
      expect(details?.session).toBe("May 2024");
      expect(details?.semester).toBe("Summer Semester 2023-24");
      expect(details?.shortSemester).toBe("Summer 2023-24");
      expect(details?.term).toBe("Summer");
    });

    it("returns null for non-exam text like general lecture notes", () => {
      const text = `
Lecture 4: Introduction to Linked Lists
In computer science, a linked list is a linear collection of data elements whose order is not given by their physical placement in memory.
Next topic: Doubly linked lists.
      `;

      const details = classifyExamPaper(text);
      expect(details).toBeNull();
    });
  });
});
