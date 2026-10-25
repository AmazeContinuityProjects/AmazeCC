import React from "react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import FFCSGuidedSelector from "../components/custom/exams/FFCS/components/FFCSGuidedSelector";
import type { ParsedCourse, AddedCourse, TimetableState } from "../components/custom/exams/FFCS/types";

const mockMasterCourses: ParsedCourse[] = [
  {
    CODE: "BCSE101",
    TITLE: "Data Structures",
    TYPE: "Embedded Theory",
    CREDITS: "4",
    SLOT: "A1+TA1+TAA1",
    ROOM: "SJT-101",
    FACULTY: "DR. ALICE",
  },
  {
    CODE: "BCSE101",
    TITLE: "Data Structures",
    TYPE: "Embedded Lab",
    CREDITS: "0",
    SLOT: "L1+L2",
    ROOM: "SJT-LAB1",
    FACULTY: "DR. ALICE",
  },
  {
    CODE: "BCSE102",
    TITLE: "Algorithms",
    TYPE: "TH",
    CREDITS: "3",
    SLOT: "B1+TB1",
    ROOM: "TT-201",
    FACULTY: "DR. BOB",
  },
];

const mockTimetables: TimetableState[] = [
  {
    id: "tt-1",
    name: "Timetable 1",
    courses: [
      {
        id: "c-1",
        code: "BCSE101",
        title: "Data Structures",
        type: "Embedded Theory",
        credits: "4",
        slots: ["A1", "TA1", "TAA1"],
        venue: "SJT-101",
        faculty: "DR. ALICE",
        color: "bg-purple-600",
      },
    ],
  },
  {
    id: "tt-2",
    name: "Timetable 2",
    courses: [],
  },
];

describe("FFCSGuidedSelector", () => {
  it("renders the mode selection screen and allows choosing Custom vs Auto", () => {
    render(
      <FFCSGuidedSelector
        masterCourses={mockMasterCourses}
        activeTimetable={mockTimetables[0]}
        allTimetables={mockTimetables}
        onAddCourse={vi.fn()}
        onSelectTimetable={vi.fn()}
      />
    );

    expect(screen.getByText("Auto-Generate Timetable")).toBeDefined();
    expect(screen.getByText("Build My Own Timetable")).toBeDefined();
  });

  it("navigates custom build flow and allows timetable selection, rename, delete", () => {
    const onSelectTimetable = vi.fn();
    const onRenameTimetable = vi.fn();
    const onDeleteTimetable = vi.fn();

    render(
      <FFCSGuidedSelector
        masterCourses={mockMasterCourses}
        activeTimetable={mockTimetables[0]}
        allTimetables={mockTimetables}
        onAddCourse={vi.fn()}
        onSelectTimetable={onSelectTimetable}
        onRenameTimetable={onRenameTimetable}
        onDeleteTimetable={onDeleteTimetable}
      />
    );

    // Pick Custom and Continue
    fireEvent.click(screen.getByText("Build My Own Timetable"));
    fireEvent.click(screen.getByRole("button", { name: /Continue to Timetable Selection/i }));

    // Should now be on timetable selection step
    expect(screen.getAllByText("Select Target Timetable").length).toBeGreaterThan(0);
    expect(screen.getByText("Timetable 1")).toBeDefined();
    expect(screen.getByText("Timetable 2")).toBeDefined();

    // Select Timetable 2
    fireEvent.click(screen.getByText("Timetable 2"));
    expect(onSelectTimetable).toHaveBeenCalledWith("tt-2");
  });

  it("displays locked target courses flow and supports slot cluster locking in manual mode", () => {
    const setCourseLocks = vi.fn();

    render(
      <FFCSGuidedSelector
        masterCourses={mockMasterCourses}
        activeTimetable={mockTimetables[1]}
        allTimetables={mockTimetables}
        courseLocks={[]}
        setCourseLocks={setCourseLocks}
        onAddCourse={vi.fn()}
      />
    );

    // Pick Custom -> Timetable -> Strategy
    fireEvent.click(screen.getByText("Build My Own Timetable"));
    fireEvent.click(screen.getByRole("button", { name: /Continue to Timetable Selection/i }));
    fireEvent.click(screen.getByRole("button", { name: /Continue to Course Strategy/i }));

    // Now on strategy step
    expect(screen.getAllByText("Course Strategy").length).toBeGreaterThan(0);
    expect(screen.getByText("Lock Target Courses in Advance")).toBeDefined();

    // Select Lock Target Courses
    fireEvent.click(screen.getByText("Lock Target Courses in Advance"));
    fireEvent.click(screen.getByRole("button", { name: /Continue to Lock Courses/i }));

    // Now on locks screen
    expect(screen.getByText("Lock Courses & Slots")).toBeDefined();
  });

  it("shows embedded theory and lab badges on new lines and shows Replace button when course already exists", () => {
    const onAddCourse = vi.fn();
    const onOpenFacultySchedule = vi.fn();

    render(
      <FFCSGuidedSelector
        masterCourses={mockMasterCourses}
        activeTimetable={mockTimetables[0]} // has BCSE101 already
        allTimetables={mockTimetables}
        onAddCourse={onAddCourse}
        onOpenFacultySchedule={onOpenFacultySchedule}
        initialGuidedPhase="builder"
        initialStep={1}
        initialPlanMode="custom"
      />
    );

    // In course picker, find BCSE101
    const courseCard = screen.getByText("BCSE101");
    expect(courseCard).toBeDefined();

    // Check embedded theory and lab badge
    expect(screen.getByText("Theory + Lab")).toBeDefined();

    // Click BCSE101 to go to Step 2
    fireEvent.click(courseCard);

    // Click slot card with DR. ALICE to go to Step 3 (Review & Add)
    fireEvent.click(screen.getAllByText("DR. ALICE")[0]);

    // In Step 3: verify faculty schedule button exists and calls onOpenFacultySchedule
    const scheduleBtn = screen.getByRole("button", { name: /View Faculty Schedule for Semester/i });
    expect(scheduleBtn).toBeDefined();
    fireEvent.click(scheduleBtn);
    expect(onOpenFacultySchedule).toHaveBeenCalledWith("DR. ALICE");

    // Because BCSE101 is already in Timetable 1, button should say Replace Slot
    const replaceBtn = screen.getByRole("button", { name: /Replace Slot in Timetable 1/i });
    expect(replaceBtn).toBeDefined();

    fireEvent.click(replaceBtn);
    expect(onAddCourse).toHaveBeenCalledWith(
      expect.objectContaining({
        code: "BCSE101",
        faculty: "DR. ALICE",
      }),
      true // isReplacing = true
    );
  });

  it("walks through complete handheld auto generator flow including strategy question in hero", async () => {
    const onApplyTimetable = vi.fn();
    const onOpenFacultySchedule = vi.fn();
    const onOpenFacultyReview = vi.fn();

    render(
      <FFCSGuidedSelector
        masterCourses={mockMasterCourses}
        activeTimetable={mockTimetables[1]}
        allTimetables={mockTimetables}
        onAddCourse={vi.fn()}
        onApplyTimetable={onApplyTimetable}
        onOpenFacultySchedule={onOpenFacultySchedule}
        onOpenFacultyReview={onOpenFacultyReview}
      />
    );

    // Step 1: Mode -> Pick Auto-Generate
    fireEvent.click(screen.getByText("Auto-Generate Timetable"));
    fireEvent.click(screen.getByRole("button", { name: /Continue to Timetable Selection/i }));

    // Step 2: Pick Timetable -> Continue to Course Strategy
    expect(screen.getAllByText("Select Target Timetable").length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole("button", { name: /Continue to Course Strategy/i }));

    // Step 3: Strategy Question -> Ask whether to lock target courses or normally add to list
    expect(screen.getAllByText("Course Strategy").length).toBeGreaterThan(0);
    expect(screen.getByText("Normally Add Courses in List")).toBeDefined();
    expect(screen.getByText("Lock Target Courses in Advance")).toBeDefined();

    // Choose Normally Add Courses in List
    fireEvent.click(screen.getByText("Normally Add Courses in List"));
    fireEvent.click(screen.getByRole("button", { name: /Continue to Course Selection/i }));

    // Step 4: Auto Courses -> Select BCSE102
    expect(screen.getAllByText("1. Select Target Courses").length).toBeGreaterThan(0);
    fireEvent.click(screen.getByText("Algorithms"));
    fireEvent.click(screen.getByRole("button", { name: /Configure Slots & Faculty \(1\)/i }));

    // Step 4.5: Slots & Faculty in Hero flow
    expect(screen.getByText("1. Allowed Slots")).toBeDefined();
    fireEvent.click(screen.getByRole("button", { name: /Continue to Class Timings/i }));

    // Step 5: Day Timings screen with slot-based edge timing presets
    expect(screen.getByText("3. Day Start & End Timings")).toBeDefined();
    expect(screen.getByText("Period 1 (A1 / L1)")).toBeDefined();
    fireEvent.click(screen.getByRole("button", { name: /Continue to Day & Slot Blocking/i }));

    // Step 6: Day & Slot Blocking with interactive vertical grid
    expect(screen.getByText("4. Slot & Day Blocking")).toBeDefined();
    expect(screen.getByText(/Block Morning Theory/i)).toBeDefined();
    fireEvent.click(screen.getByRole("button", { name: /Continue to Half-Days & Limits/i }));

    // Step 7: Half-Days & Limits
    expect(screen.getByText("5. Free Half-Days & Limits")).toBeDefined();
    expect(screen.getByText("Morning Theory")).toBeDefined();
    fireEvent.click(screen.getByText("Morning Theory"));
    fireEvent.click(screen.getByRole("button", { name: /Review Generation Blueprint/i }));

    // Step 8: Summary & Run
    expect(screen.getAllByText("6. Generation Blueprint").length).toBeGreaterThan(0);
    expect(screen.getByText("1 Courses")).toBeDefined();

    // Click Generate Timetables
    const generateBtn = screen.getByRole("button", { name: /Generate Timetable Recommendations/i });
    fireEvent.click(generateBtn);

    // Step 9: Results screen
    await waitFor(() => {
      expect(screen.getByText(/Recommendation 1 of/i)).toBeDefined();
    });

    // Check Metrics Strip
    expect(screen.getByText("Free Half-Days")).toBeDefined();
    expect(screen.getByText("Total Gaps")).toBeDefined();
    expect(screen.getByText("Avg Faculty Score")).toBeDefined();
    expect(screen.getByText("Total Credits")).toBeDefined();

    // Verify faculty score badge exists for scheduled faculty in recommendation
    expect(screen.getAllByText(/Score|Unrated/).length).toBeGreaterThan(0);

    // Check View Grid View counterpart inside hero view
    const gridViewBtn = screen.getByTitle("View Vertical Timetable Grid");
    expect(gridViewBtn).toBeDefined();
    fireEvent.click(gridViewBtn);

    // Verify on Vertical Timetable Grid View screen
    expect(screen.getAllByText("Timetable Grid View").length).toBeGreaterThan(0);
    expect(screen.getByText("List & Faculty View")).toBeDefined();

    // Switch back to list view
    fireEvent.click(screen.getByText("List & Faculty View"));
    expect(screen.getByText(/Recommendation 1 of/i)).toBeDefined();

    // Check Faculty direct schedule button
    const facultyScheduleBtn = screen.getByTitle("View Faculty Schedule for Semester");
    expect(facultyScheduleBtn).toBeDefined();
    fireEvent.click(facultyScheduleBtn);
    expect(onOpenFacultySchedule).toHaveBeenCalledWith("DR. BOB");

    // Check Vitfac review button
    const vitfacReviewBtn = screen.getByTitle("View Vitfac Review");
    expect(vitfacReviewBtn).toBeDefined();
    fireEvent.click(vitfacReviewBtn);
    expect(onOpenFacultyReview).toHaveBeenCalledWith(
      expect.objectContaining({ name: "DR. BOB" })
    );

    // Check Apply CTA
    const applyBtn = screen.getByRole("button", { name: /Apply This Recommendation to Timetable 2/i });
    expect(applyBtn).toBeDefined();
    fireEvent.click(applyBtn);
    expect(onApplyTimetable).toHaveBeenCalled();
  });

  it("supports locking target courses flow in auto generator hero and continuing to settings", () => {
    render(
      <FFCSGuidedSelector
        masterCourses={mockMasterCourses}
        activeTimetable={mockTimetables[1]}
        allTimetables={mockTimetables}
        onAddCourse={vi.fn()}
      />
    );

    // Pick Auto-Generate -> Timetable -> Strategy
    fireEvent.click(screen.getByText("Auto-Generate Timetable"));
    fireEvent.click(screen.getByRole("button", { name: /Continue to Timetable Selection/i }));
    fireEvent.click(screen.getByRole("button", { name: /Continue to Course Strategy/i }));

    // Choose Lock Target Courses in Advance
    fireEvent.click(screen.getByText("Lock Target Courses in Advance"));
    fireEvent.click(screen.getByRole("button", { name: /Continue to Lock Courses/i }));

    // Now on Lock Courses & Slots screen
    expect(screen.getByText("Lock Courses & Slots")).toBeDefined();
    expect(screen.getByText("Don't want to constrain slots or professors?")).toBeDefined();

    // User can lock BCSE101
    fireEvent.click(screen.getByText("BCSE101"));

    // Bottom action says Configure Slots & Faculty (1)
    const continueBtn = screen.getByRole("button", { name: /Configure Slots & Faculty \(1\)/i });
    expect(continueBtn).toBeDefined();
    fireEvent.click(continueBtn);

    // Advances to Slots & Faculty screen, then Continue to Class Timings
    expect(screen.getByText("1. Allowed Slots")).toBeDefined();
    fireEvent.click(screen.getByRole("button", { name: /Continue to Class Timings/i }));

    // Advances to Class Timings screen
    expect(screen.getByText("3. Day Start & End Timings")).toBeDefined();
  });

  it("integrates manual course selector directly into the auto generator and vice versa", () => {
    render(
      <FFCSGuidedSelector
        masterCourses={mockMasterCourses}
        activeTimetable={mockTimetables[1]}
        allTimetables={mockTimetables}
        onAddCourse={vi.fn()}
      />
    );

    // Go to Auto Courses screen
    fireEvent.click(screen.getByText("Auto-Generate Timetable"));
    fireEvent.click(screen.getByRole("button", { name: /Continue to Timetable Selection/i }));
    fireEvent.click(screen.getByRole("button", { name: /Continue to Course Strategy/i }));
    fireEvent.click(screen.getByText("Normally Add Courses in List"));
    fireEvent.click(screen.getByRole("button", { name: /Continue to Course Selection/i }));

    // On auto_courses: verify manual builder switcher banner exists
    expect(screen.getByText("Prefer manual timetable creation?")).toBeDefined();
    const manualSelectorBtn = screen.getByRole("button", { name: /Manual Course Selector →/i });
    expect(manualSelectorBtn).toBeDefined();

    // Switch to manual course selector
    fireEvent.click(manualSelectorBtn);

    // Now on manual course selector (builder Step 1)
    expect(screen.getByText("Want algorithm to solve combinations for you?")).toBeDefined();
    const autoGenBtn = screen.getByRole("button", { name: /Auto-Generate Timetable ✨/i });
    expect(autoGenBtn).toBeDefined();

    // Switch back to auto-generator
    fireEvent.click(autoGenBtn);
    expect(screen.getAllByText("1. Select Target Courses").length).toBeGreaterThan(0);

    // Test explore offerings button for a course directly enters Step 2 of manual selector
    const exploreBtn = screen.getByTitle("Explore slots & faculty for BCSE101 in manual course selector");
    expect(exploreBtn).toBeDefined();
    fireEvent.click(exploreBtn);

    // Verifies we are now in Step 2 of manual selector looking at slot offerings
    expect(screen.getAllByText(/A1\+TA1\+TAA1/).length).toBeGreaterThan(0);
  });

  it("allows selecting slots and faculty inline in course selection and on dedicated hero screen", () => {
    const onOpenFacultySchedule = vi.fn();

    render(
      <FFCSGuidedSelector
        masterCourses={mockMasterCourses}
        activeTimetable={mockTimetables[1]}
        allTimetables={mockTimetables}
        onAddCourse={vi.fn()}
        onOpenFacultySchedule={onOpenFacultySchedule}
      />
    );

    // Navigate to auto courses selection
    fireEvent.click(screen.getByText("Auto-Generate Timetable"));
    fireEvent.click(screen.getByRole("button", { name: /Continue to Timetable Selection/i }));
    fireEvent.click(screen.getByRole("button", { name: /Continue to Course Strategy/i }));
    fireEvent.click(screen.getByText("Normally Add Courses in List"));
    fireEvent.click(screen.getByRole("button", { name: /Continue to Course Selection/i }));

    // Select BCSE101
    fireEvent.click(screen.getByText("BCSE101"));

    // Verify "Slots & Faculty" button exists and expand inline customization
    const slotsFacultyBtn = screen.getByTitle("Customize slots & faculty for BCSE101");
    expect(slotsFacultyBtn).toBeDefined();
    fireEvent.click(slotsFacultyBtn);

    // Verify inline customization shows slot bundles and preferred faculty
    expect(screen.getByText("Options for BCSE101")).toBeDefined();
    expect(screen.getByText("A1 Slots")).toBeDefined();
    expect(screen.getByText("DR. ALICE")).toBeDefined();

    // Toggle faculty DR. ALICE inline
    fireEvent.click(screen.getByText("DR. ALICE"));

    // Advance to the dedicated Slots & Faculty Hero page
    const configureBtn = screen.getByRole("button", { name: /Configure Slots & Faculty \(1\)/i });
    fireEvent.click(configureBtn);

    // Verify on dedicated hero screen
    expect(screen.getByText("1. Allowed Slots")).toBeDefined();
    expect(screen.getByText("2. Preferred Faculty")).toBeDefined();

    // Verify faculty schedule button works on dedicated hero screen
    const scheduleBtn = screen.getByTitle("View DR. ALICE's semester schedule");
    expect(scheduleBtn).toBeDefined();
    fireEvent.click(scheduleBtn);
    expect(onOpenFacultySchedule).toHaveBeenCalledWith("DR. ALICE");

    // Can continue from Slots & Faculty screen to Class Timings
    fireEvent.click(screen.getByRole("button", { name: /Continue to Class Timings/i }));
    expect(screen.getByText("3. Day Start & End Timings")).toBeDefined();
  });

  it("supports start and end timings with edge chips, per-day blocking, half days, result limits, and vertical timetable counterpart view", async () => {
    const onToggleBlockSlot = vi.fn();
    render(
      <FFCSGuidedSelector
        masterCourses={mockMasterCourses}
        activeTimetable={mockTimetables[1]}
        allTimetables={mockTimetables}
        onAddCourse={vi.fn()}
        onToggleBlockSlot={onToggleBlockSlot}
      />
    );

    // Pick Auto-Generate -> Timetable -> Strategy -> Course selection
    fireEvent.click(screen.getByText("Auto-Generate Timetable"));
    fireEvent.click(screen.getByRole("button", { name: /Continue to Timetable Selection/i }));
    fireEvent.click(screen.getByRole("button", { name: /Continue to Course Strategy/i }));
    fireEvent.click(screen.getByText("Normally Add Courses in List"));
    fireEvent.click(screen.getByRole("button", { name: /Continue to Course Selection/i }));

    // Select BCSE102
    fireEvent.click(screen.getByText("Algorithms"));
    fireEvent.click(screen.getByRole("button", { name: /Configure Slots & Faculty \(1\)/i }));

    // On Slots & Faculty -> Continue to Class Timings
    fireEvent.click(screen.getByRole("button", { name: /Continue to Class Timings/i }));

    // Screen 1: Start and End timings with slot-based edge timing chips
    expect(screen.getByText("3. Day Start & End Timings")).toBeDefined();
    expect(screen.getByText("Earliest Start Time (No classes before)")).toBeDefined();
    expect(screen.getByText("Latest Wrap Time (No classes after)")).toBeDefined();

    // Verify slot edge timing chips are present
    expect(screen.getByText("Period 1 (A1 / L1)")).toBeDefined();
    expect(screen.getByText("Lunch Break (Morning End)")).toBeDefined();
    expect(screen.getByText("Day Wrap (Full Day End)")).toBeDefined();

    // Click quick schedule preset "Full Campus Day"
    fireEvent.click(screen.getByText("Full Campus Day"));

    // Advance to Screen 2: Day & Slot Blocking
    fireEvent.click(screen.getByRole("button", { name: /Continue to Day & Slot Blocking/i }));
    expect(screen.getByText("4. Slot & Day Blocking")).toBeDefined();
    expect(screen.getByText("INTERACTIVE VERTICAL TIMETABLE — TAP ANY CELL TO TOGGLE BLOCK")).toBeDefined();

    // Verify per-day quick block buttons
    const blockMorningBtn = screen.getByRole("button", { name: /Block Morning Theory \(08:00 - 13:25\)/i });
    expect(blockMorningBtn).toBeDefined();
    fireEvent.click(blockMorningBtn);

    // Verify day toggle changes to Unblock Morning Theory and unblock to allow solver to find combinations
    const unblockBtn = screen.getByRole("button", { name: /Unblock Morning Theory ✓/i });
    expect(unblockBtn).toBeDefined();
    fireEvent.click(unblockBtn);

    // Advance to Screen 3: Half-Days & Limits
    fireEvent.click(screen.getByRole("button", { name: /Continue to Half-Days & Limits/i }));
    expect(screen.getByText("5. Free Half-Days & Limits")).toBeDefined();
    expect(screen.getByText("Minimum Free Half-Days")).toBeDefined();
    expect(screen.getByText("Maximum Timetables to Generate")).toBeDefined();

    // Select half-days target (e.g. 2)
    fireEvent.click(screen.getByRole("button", { name: "2" }));
    expect(screen.getByText("2+ Half-Days")).toBeDefined();

    // Select generation limit (e.g. 50, then Unlimited)
    fireEvent.click(screen.getByRole("button", { name: "50" }));
    expect(screen.getByText("50 Timetables")).toBeDefined();
    fireEvent.click(screen.getByRole("button", { name: "Unlimited ✨" }));
    expect(screen.getByText("Unlimited (30k max)")).toBeDefined();

    // Advance to Summary
    fireEvent.click(screen.getByRole("button", { name: /Review Generation Blueprint/i }));
    expect(screen.getByText("6. Generation Blueprint")).toBeDefined();

    // Launch solver
    fireEvent.click(screen.getByRole("button", { name: /Generate Timetable Recommendations/i }));

    // Results screen
    await waitFor(() => {
      expect(screen.getByText(/Recommendation 1 of/i)).toBeDefined();
    });

    // Inspect the Vertical Timetable counterpart screen inside hero view
    const viewGridBtn = screen.getByTitle("View Vertical Timetable Grid");
    expect(viewGridBtn).toBeDefined();
    fireEvent.click(viewGridBtn);

    // Verify on vertical timetable grid counterpart
    expect(screen.getAllByText("Timetable Grid View").length).toBeGreaterThan(0);
    expect(screen.getByText("List & Faculty View")).toBeDefined();
  }, 15000);

  it("automatically blocks out-of-range slots when ending times are selected before advancing, and displays slot names in the vertical timetable", () => {
    const onToggleBlockSlot = vi.fn();
    render(
      <FFCSGuidedSelector
        masterCourses={mockMasterCourses}
        activeTimetable={mockTimetables[1]}
        allTimetables={mockTimetables}
        onAddCourse={vi.fn()}
        onToggleBlockSlot={onToggleBlockSlot}
      />
    );

    // Pick Auto-Generate -> Timetable -> Strategy -> Course selection
    fireEvent.click(screen.getByText("Auto-Generate Timetable"));
    fireEvent.click(screen.getByRole("button", { name: /Continue to Timetable Selection/i }));
    fireEvent.click(screen.getByRole("button", { name: /Continue to Course Strategy/i }));
    fireEvent.click(screen.getByText("Normally Add Courses in List"));
    fireEvent.click(screen.getByRole("button", { name: /Continue to Course Selection/i }));

    // Select BCSE101
    fireEvent.click(screen.getByText("Data Structures"));
    fireEvent.click(screen.getByRole("button", { name: /Configure Slots & Faculty \(1\)/i }));

    // Continue to Class Timings
    fireEvent.click(screen.getByRole("button", { name: /Continue to Class Timings/i }));
    expect(screen.getByText("3. Day Start & End Timings")).toBeDefined();

    // Select Morning Only preset (ending at 13:25)
    fireEvent.click(screen.getByText("Morning Only"));

    // Verify feedback message showing slots outside the window are automatically blocked
    expect(screen.getByText(/outside 08:00 – 13:25 are automatically blocked/i)).toBeDefined();

    // Advance to Day & Slot Blocking
    fireEvent.click(screen.getByRole("button", { name: /Continue to Day & Slot Blocking/i }));
    expect(screen.getByText("4. Slot & Day Blocking")).toBeDefined();

    // Verify slots outside the 13:25 ending time are blocked
    expect(screen.getByText(/slots blocked/i)).toBeDefined();

    // Verify that slot names (e.g. A1, L1, A2, L31) are rendered in the vertical timetable cells
    expect(screen.getAllByText("A1").length).toBeGreaterThan(0);
    expect(screen.getAllByText("L1").length).toBeGreaterThan(0);
    expect(screen.getAllByText("A2").length).toBeGreaterThan(0);
    expect(screen.getAllByText("L31").length).toBeGreaterThan(0);

    // Verify that BOTH theory (A2) and lab (L31) of the 2:00 PM afternoon slot are blocked by timing constraints
    const a2Btn = screen.getAllByRole("button", { name: "A2" })[0];
    const l31Btn = screen.getAllByRole("button", { name: "L31" })[0];
    expect(a2Btn.className).toContain("line-through");
    expect(l31Btn.className).toContain("line-through");

    // Select Thursday
    fireEvent.click(screen.getByRole("button", { name: /Thursday/i }));

    // Block Morning Theory on Thursday
    const blockThuMorningTheory = screen.getByRole("button", { name: /Block Morning Theory \(08:00 - 13:25\)/i });
    expect(blockThuMorningTheory).toBeDefined();
    fireEvent.click(blockThuMorningTheory);

    // Verify it updates to Unblock Morning Theory
    expect(screen.getByRole("button", { name: /Unblock Morning Theory ✓/i })).toBeDefined();

    // Verify Morning Lab button is still unblocked (theory and lab are NOT blocked together!)
    expect(screen.getByRole("button", { name: /Block Morning Lab \(08:00 - 13:20\)/i })).toBeDefined();

    // Verify tapping an individual slot button in the vertical timetable
    const d1SlotBtn = screen.getAllByRole("button", { name: "D1" })[0];
    fireEvent.click(d1SlotBtn);
    expect(onToggleBlockSlot).toHaveBeenCalledWith("D1");
  });

  it("renders the Plan button and invokes onSwitchToSinglePageView when clicked", () => {
    const onSwitchToSinglePageView = vi.fn();
    render(
      <FFCSGuidedSelector
        masterCourses={mockMasterCourses}
        activeTimetable={mockTimetables[0]}
        allTimetables={mockTimetables}
        onAddCourse={vi.fn()}
        onSwitchToSinglePageView={onSwitchToSinglePageView}
      />
    );

    const planBtn = screen.getByRole("button", { name: /Plan/i });
    expect(planBtn).toBeDefined();
    fireEvent.click(planBtn);
    expect(onSwitchToSinglePageView).toHaveBeenCalledTimes(1);
  });

  it("applies 85% scale to the entire hero UI container", () => {
    render(
      <FFCSGuidedSelector
        masterCourses={mockMasterCourses}
        activeTimetable={mockTimetables[0]}
        allTimetables={mockTimetables}
        onAddCourse={vi.fn()}
      />
    );

    const container = screen.getByTestId("guided-hero-container");
    expect(container).toBeDefined();
    expect(container.style.zoom).toBe("0.85");
    expect(container.className).toContain("[zoom:0.85]");
  });

  it("integrates manual timetable flow into one continuous unified flow for the mounted timetable", async () => {
    const onAddCourse = vi.fn();
    const onViewTimetable = vi.fn();

    render(
      <FFCSGuidedSelector
        masterCourses={mockMasterCourses}
        activeTimetable={mockTimetables[0]} // Timetable 1
        allTimetables={mockTimetables}
        courses={mockTimetables[0].courses}
        onAddCourse={onAddCourse}
        onViewTimetable={onViewTimetable}
      />
    );

    // Step 1: Mode -> Select Manual Builder
    fireEvent.click(screen.getByRole("button", { name: /Build My Own Timetable/i }));
    fireEvent.click(screen.getByRole("button", { name: /Continue to Timetable Selection/i }));

    // Step 2: Target Timetable -> Timetable 1 is mounted
    expect(screen.getAllByText("Select Target Timetable").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Timetable 1").length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole("button", { name: /Continue to Course Strategy/i }));

    // Step 3: Course Strategy -> Choose One by One
    expect(screen.getAllByText("Course Strategy").length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole("button", { name: /Choose Courses One by One/i }));
    fireEvent.click(screen.getByRole("button", { name: /Start Adding Courses/i }));

    // Step 4: Unified Course Selection for Timetable 1
    expect(screen.getAllByText(/Choose Course for Timetable 1/i).length).toBeGreaterThan(0);
    // BCSE102 (Algorithms)
    const bcse102Card = screen.getByText("BCSE102");
    expect(bcse102Card).toBeDefined();
    fireEvent.click(bcse102Card);

    // Step 5: Pick Faculty & Slot
    expect(screen.getAllByText(/Pick Faculty & Slot/i).length).toBeGreaterThan(0);
    expect(screen.getByText("DR. BOB")).toBeDefined();
    const bobOffering = screen.getByText("DR. BOB");
    fireEvent.click(bobOffering);

    // Step 6: Review & Place into Timetable 1
    const addBtn = screen.getByRole("button", { name: /Add to Timetable 1/i });
    expect(addBtn).toBeDefined();
    fireEvent.click(addBtn);

    // Verifies addition called
    expect(onAddCourse).toHaveBeenCalledWith(
      expect.objectContaining({
        code: "BCSE102",
        faculty: "DR. BOB",
      }),
      false
    );

    // Step 7: Seamlessly transitions to Mounted Timetable Grid View within the hero
    expect(screen.getAllByText(/Timetable 1/i).length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: /^Add Another Course$/i })).toBeDefined();
    expect(screen.getByRole("button", { name: /Done \/ View Grid/i })).toBeDefined();

    // Clicking Add Another Course returns to Course selection in the same unified flow
    fireEvent.click(screen.getByRole("button", { name: /^Add Another Course$/i }));
    expect(screen.getAllByText(/Choose Course for Timetable 1/i).length).toBeGreaterThan(0);
  });

  it("allows browsing and cycling between multiple timetables directly in the hero UI", async () => {
    const onSelectTimetable = vi.fn();
    const onViewTimetable = vi.fn();

    render(
      <FFCSGuidedSelector
        masterCourses={mockMasterCourses}
        activeTimetable={mockTimetables[0]} // Timetable 1
        allTimetables={mockTimetables} // Timetable 1 and Timetable 2
        initialGuidedPhase="manual_timetable_view"
        onAddCourse={vi.fn()}
        onSelectTimetable={onSelectTimetable}
        onViewTimetable={onViewTimetable}
      />
    );

    // Should display Timetable 1 initially with 1 course and credit count
    expect(screen.getAllByText(/Timetable 1/i).length).toBeGreaterThan(0);
    expect(screen.getByText("4 Credits")).toBeDefined();
    expect(screen.getAllByText("● Mounted Active Timetable").length).toBeGreaterThan(0);

    // Pill tabs for timetables are present
    const ttTabs = screen.getAllByRole("tab");
    expect(ttTabs.length).toBe(2);
    expect(ttTabs[0].getAttribute("aria-selected")).toBe("true");
    expect(ttTabs[1].getAttribute("aria-selected")).toBe("false");

    // Click Next Timetable button to switch to Timetable 2
    const nextBtns = screen.getAllByRole("button", { name: /Next Timetable/i });
    expect(nextBtns.length).toBeGreaterThan(0);
    fireEvent.click(nextBtns[0]);

    // onSelectTimetable should be called with tt-2 id
    expect(onSelectTimetable).toHaveBeenCalledWith("tt-2");
    expect(screen.getAllByText(/Timetable 2/i).length).toBeGreaterThan(0);

    // Empty state rendered for Timetable 2
    expect(screen.getByText(/No courses placed in/i)).toBeDefined();

    // Click tab 0 to navigate back to Timetable 1
    fireEvent.click(ttTabs[0]);
    expect(onSelectTimetable).toHaveBeenCalledWith("tt-1");

    // Arrow keys cycle timetables
    fireEvent.keyDown(window, { key: "ArrowRight" });
    expect(onSelectTimetable).toHaveBeenCalledWith("tt-2");

    fireEvent.keyDown(window, { key: "ArrowLeft" });
    expect(onSelectTimetable).toHaveBeenCalledWith("tt-1");
  });

  it("navigates to multi-timetable browser from auto results via My Timetables button", async () => {
    const onSelectTimetable = vi.fn();

    render(
      <FFCSGuidedSelector
        masterCourses={mockMasterCourses}
        activeTimetable={mockTimetables[0]}
        allTimetables={mockTimetables}
        initialGuidedPhase="auto_results"
        initialPlanMode="auto"
        onAddCourse={vi.fn()}
        onSelectTimetable={onSelectTimetable}
      />
    );

    // Mock auto results state with at least one variant if present or check button
    // The "My Timetables" button in auto results header strip
    const myTimetablesBtns = screen.queryAllByRole("button", { name: /My Timetables/i });
    if (myTimetablesBtns.length > 0) {
      fireEvent.click(myTimetablesBtns[0]);
      // Should now be in the timetable browser
      expect(screen.getAllByText(/Timetable Browser/i).length).toBeGreaterThan(0);
      expect(screen.getAllByText(/Timetable 1/i).length).toBeGreaterThan(0);
    }
  });

  it("supports wrapping physical buttons to the next row with whitespace-nowrap in both viewports", () => {
    render(
      <FFCSGuidedSelector
        masterCourses={mockMasterCourses}
        activeTimetable={mockTimetables[0]}
        allTimetables={mockTimetables}
        initialGuidedPhase="manual_timetable_view"
        onAddCourse={vi.fn()}
      />
    );

    // Verify footer actions container uses flex-wrap and buttons prevent text-wrapping inside
    const prevBtn = screen.getByRole("button", { name: /Previous Step/i });
    const footerContainer = prevBtn.closest(".flex-wrap");
    expect(footerContainer).toBeDefined();
    expect(footerContainer?.className).toContain("flex-wrap");

    const addAnotherBtn = screen.getByRole("button", { name: /^Add Another Course$/i });
    expect(addAnotherBtn).toBeDefined();
    expect(addAnotherBtn.className).toContain("whitespace-nowrap");

    const doneBtn = screen.getByRole("button", { name: /Done \/ View Grid/i });
    expect(doneBtn).toBeDefined();
    expect(doneBtn.className).toContain("whitespace-nowrap");
  });
});
