import { describe, it, expect } from "vitest";
import {
  isVtopRegistrationText,
  parseVtopRegistrationText,
  parsePastedText,
  toParsedCourses,
  vtopRowsToAddedCourses,
  parseAndConvert,
} from "../features/import/parsePastedText";

const sampleInput = `Course Details Credit Course Category Course
Option
Class Detail Slot Faculty Status Modify Delete
BACSE202 -Database Systems- Embedded Theory
3.0 Concentration
(Software Systems
Basket)
Regular CH2026270502880 - COE01 
AB4-305
F1+TF1 VISWANATHAN V 
COE01
Registered and
Approved Delete
BACSE202 -Database Systems- Embedded Lab
1.0 Concentration
(Software Systems
Basket)
Regular CH2026270502881 - COE01 
AB4-409
L23+L24 VISWANATHAN V 
COE01
Registered and
Approved Delete
BACSE203 -Computer
Networks - Embedded Theory
3.0 Programme Core
Courses
Regular CH2026270503011 - 53056 
AB4-305
B1+TB1 PRASANNA
BHARATHI S 
53056
Registered and
Approved Delete
BACSE203 -Computer
Networks - Embedded Lab
1.0 Programme Core
Courses
Regular CH2026270503013 - 53056 
AB4-407
L29+L30 PRASANNA
BHARATHI S 
53056
Registered and
Approved Delete
BACSE205 -Fundamentals of
Artificial Intelligence and
Machine Learning - Embedded
Theory
3.0 Concentration
(Software Systems
Basket)
Regular CH2026270503027 - 52244 
AB4-305
G1+TG1 LOGESH R - 52244 Registered and
Approved Delete
BACSE205 -Fundamentals of
Artificial Intelligence and
Machine Learning - Embedded
Lab
1.0 Concentration
(Software Systems
Basket)
Regular CH2026270503032 - 52244 
AB4-411
L43+L44 LOGESH R - 52244 Registered and
Approved Delete
BAECE204 -Microcontrollers
and Embedded C Programming- Embedded Theory
3.0 Programme Core
Courses
Regular CH2026270501463 - 53065 
AB4-306
A1+TA1 BALAKRISHNAN R- 53065
Registered and
Approved Delete
 
WINTER SEMESTER REGISTRATION 2026-27
VIT - CHENNAI CAMPUS
  Home   View / Modify

  SignOut
Copyright © 2026 Software Development Cell, VIT, Chennai-600 127.
Course Details Credit Course Category Course
Option
Class Detail Slot Faculty Status Modify Delete
BAECE204 -Microcontrollers
and Embedded C Programming- Embedded Lab
1.0 Programme Core
Courses
Regular CH2026270502818 - 53065 
AB3-102
L31+L32 BALAKRISHNAN R- 53065
Registered and
Approved Delete
BAECE302 -VLSI System
Design - Embedded Theory
3.0 Programme Core
Courses
Regular CH2026270501414 - 50283 
AB4-316
D1+TD1 MANIKANDAN P 
50283
Registered and
Approved Delete
BAECE302 -VLSI System
Design - Embedded Lab
1.0 Programme Core
Courses
Regular CH2026270502589 - 50283 
AB3-312
L11+L12 MANIKANDAN P 
50283
Registered and
Approved Delete
BAHUM103 -Ethics and
Values - Theory Only
2.0 University Core
Courses
Regular CH2026270503566 - 53913 
AB4-313
G2 IMMANUEL
SELWYN RAJ A 
53913
Registered and
Approved Modify Delete
BASTS102 -Qualitative and
Quantitative Skills Practice II 
Soft Skill
1.0 University Core
Courses
Regular CH2026270500055 
SIXPHRASE - AB4-305
E1+TE1 SIXPHRASE(APT) 
SIXPHRASE
Registered and
Approved Modify-N`;

describe("VTOP Registration Parser", () => {
  it("detects and parses all 12 registered course offerings cleanly", () => {
    expect(isVtopRegistrationText(sampleInput)).toBe(true);
    const parsed = parseVtopRegistrationText(sampleInput);

    expect(parsed.length).toBe(12);

    // BACSE202 Theory
    expect(parsed[0].code).toBe("BACSE202");
    expect(parsed[0].title).toBe("Database Systems");
    expect(parsed[0].type).toBe("ETH");
    expect(parsed[0].slot).toBe("F1+TF1");
    expect(parsed[0].venue).toBe("AB4-305");
    expect(parsed[0].faculty).toBe("VISWANATHAN V");
    expect(parsed[0].credits).toBe("3.0");

    // BACSE202 Lab
    expect(parsed[1].code).toBe("BACSE202");
    expect(parsed[1].title).toBe("Database Systems");
    expect(parsed[1].type).toBe("ELA");
    expect(parsed[1].slot).toBe("L23+L24");
    expect(parsed[1].venue).toBe("AB4-409");
    expect(parsed[1].faculty).toBe("VISWANATHAN V");
    expect(parsed[1].credits).toBe("1.0");

    // BACSE203 Theory
    expect(parsed[2].code).toBe("BACSE203");
    expect(parsed[2].title).toBe("Computer Networks");
    expect(parsed[2].type).toBe("ETH");
    expect(parsed[2].slot).toBe("B1+TB1");
    expect(parsed[2].faculty).toBe("PRASANNA BHARATHI S");
    expect(parsed[2].employeeId).toBe("53056");

    // BACSE205 Theory
    expect(parsed[4].code).toBe("BACSE205");
    expect(parsed[4].title).toBe("Fundamentals of Artificial Intelligence and Machine Learning");
    expect(parsed[4].type).toBe("ETH");
    expect(parsed[4].slot).toBe("G1+TG1");
    expect(parsed[4].faculty).toBe("LOGESH R");
    expect(parsed[4].employeeId).toBe("52244");

    // BAECE204 Theory
    expect(parsed[6].code).toBe("BAECE204");
    expect(parsed[6].title).toBe("Microcontrollers and Embedded C Programming");
    expect(parsed[6].type).toBe("ETH");
    expect(parsed[6].slot).toBe("A1+TA1");
    expect(parsed[6].faculty).toBe("BALAKRISHNAN R");
    expect(parsed[6].employeeId).toBe("53065");

    // BAHUM103
    const ethics = parsed.find((p) => p.code === "BAHUM103");
    expect(ethics?.title).toBe("Ethics and Values");
    expect(ethics?.type).toBe("TH");
    expect(ethics?.slot).toBe("G2");
    expect(ethics?.faculty).toBe("IMMANUEL SELWYN RAJ A");

    // BASTS102
    const softSkills = parsed.find((p) => p.code === "BASTS102");
    expect(softSkills?.title).toBe("Qualitative and Quantitative Skills Practice II");
    expect(softSkills?.type).toBe("SS");
    expect(softSkills?.slot).toBe("E1+TE1");
    expect(softSkills?.faculty).toBe("SIXPHRASE(APT)");
  });

  it("converts parsed VTOP rows into AddedCourses ready for the timetable", () => {
    const vtopRows = parseVtopRegistrationText(sampleInput);
    const addedCourses = vtopRowsToAddedCourses(vtopRows);

    expect(addedCourses).toHaveLength(12);
    // Theory half of BACSE202
    expect(addedCourses[0].slots).toEqual(["F1", "TF1"]);
    expect(addedCourses[0].venue).toBe("AB4-305");
    expect(addedCourses[0].color).toBe(addedCourses[1].color); // same course code shares color

    // Total credits
    const totalCredits = addedCourses.reduce((sum, c) => sum + parseFloat(c.credits), 0);
    expect(totalCredits).toBe(23);
  });

  it("parseAndConvert handles VTOP registration text directly", () => {
    const { options, courses } = parseAndConvert(sampleInput);
    expect(options).toHaveLength(12);
    expect(courses).toHaveLength(12);
    expect(courses[0].CODE).toBe("BACSE202");
    expect(courses[0].SLOT).toBe("F1+TF1");
    expect(courses[0].ROOM).toBe("AB4-305");
  });
});
