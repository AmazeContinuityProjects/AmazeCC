import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { PasteRegisteredCoursesModal } from "../components/custom/exams/FFCS/components/modals/PasteRegisteredCoursesModal";

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

describe("PasteRegisteredCoursesModal", () => {
  it("renders and parses VTOP text into timetable courses", () => {
    const onLoadCourses = vi.fn();
    const onClose = vi.fn();

    render(
      <PasteRegisteredCoursesModal
        isOpen={true}
        onClose={onClose}
        onLoadCourses={onLoadCourses}
      />
    );

    const textarea = screen.getByPlaceholderText(/Paste your courses here/i);
    fireEvent.change(textarea, { target: { value: sampleInput } });

    // Should detect 12 offerings and 23 credits
    expect(screen.getByText(/12 offerings/i)).toBeDefined();
    expect(screen.getByText(/23 credits/i)).toBeDefined();

    const applyButton = screen.getByRole("button", { name: /Load into Timetable/i });
    expect(applyButton).toBeDefined();
    expect((applyButton as HTMLButtonElement).disabled).toBe(false);
    fireEvent.click(applyButton);

    expect(onLoadCourses).toHaveBeenCalledTimes(1);
    const [addedCourses, parsedCourses, replaceExisting] = onLoadCourses.mock.calls[0];

    expect(addedCourses).toHaveLength(12);
    expect(parsedCourses).toHaveLength(12);
    expect(replaceExisting).toBe(true);

    expect(addedCourses[0].code).toBe("BACSE202");
    expect(addedCourses[0].slots).toEqual(["F1", "TF1"]);
    expect(addedCourses[0].faculty).toBe("VISWANATHAN V");
    expect(addedCourses[0].venue).toBe("AB4-305");

    expect(onClose).toHaveBeenCalled();
  });

  it("renders and parses Markdown/CSV tables and displays format indicator", () => {
    const onLoadCourses = vi.fn();
    const onClose = vi.fn();

    render(
      <PasteRegisteredCoursesModal
        isOpen={true}
        onClose={onClose}
        onLoadCourses={onLoadCourses}
      />
    );

    const textarea = screen.getByPlaceholderText(/Paste your courses here/i);
    const mdTable = `| Course Code | Title | Slot | Faculty | Venue | Credits |
| BACSE202 | Database Systems | F1+TF1 | Dr. Alan | AB4-305 | 3.0 |
| BACSE203 | Computer Networks | B1+TB1 | Dr. Bob | AB4-306 | 3.0 |`;

    fireEvent.change(textarea, { target: { value: mdTable } });

    expect(screen.getByText(/2 offerings/i)).toBeDefined();
    expect(screen.getByText(/6 credits/i)).toBeDefined();
    expect(screen.getByText(/Markdown Table detected/i)).toBeDefined();

    const applyButton = screen.getByRole("button", { name: /Load into Timetable/i });
    fireEvent.click(applyButton);

    expect(onLoadCourses).toHaveBeenCalledTimes(1);
    const [addedCourses] = onLoadCourses.mock.calls[0];
    expect(addedCourses).toHaveLength(2);
    expect(addedCourses[0].code).toBe("BACSE202");
    expect(addedCourses[0].slots).toEqual(["F1", "TF1"]);
  });
});
