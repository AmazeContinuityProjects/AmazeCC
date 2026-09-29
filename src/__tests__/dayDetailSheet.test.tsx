import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import DayDetailSheet from "@/components/custom/attendance/DayDetailSheet";
import type { AttendanceDayCardsMap } from "@/lib/attendanceTimetable";
import { buildEnrichedCalendars, type CalendarDayModel } from "@/lib/calendarDay";

/**
 * The day sheet's section headings.
 *
 * A heading that names the event it is heading — "CAT II" above a row that also
 * says "CAT II" — is the bug this file exists for. It reads as two tests where
 * the college published one, and it is the kind of thing that survives review
 * because each half looks correct in isolation.
 *
 * These assert the heading is a *category* while the row keeps the name, which
 * is the shape the rest of the sheet uses: the pill carries the kind, the row
 * carries the content, the heading carries the group.
 */

/** An exam day built the way the real pipeline builds it. */
function examDay(papers: { code: string; title: string }[] = []) {
  const [august] = buildEnrichedCalendars({
    calendars: [
      {
        month: "August 2026",
        year: 2026,
        days: [{ date: 20, events: [{ type: "Other", text: "CAT - II", category: "Working day" }] }],
      },
    ],
    schedule: {
      Schedule: {
        "CAT - II": papers.map((p) => ({
          courseCode: p.code,
          courseTitle: p.title,
          examDate: "2026-08-20",
          examTime: "12:00 PM - 01:30 PM",
          venue: "AB1-308",
        })),
      },
    },
  });
  return august.days.find((d) => d.date === 20)!;
}

function renderSheet(day: CalendarDayModel) {
  return render(
    <DayDetailSheet
      day={day}
      onClose={() => {}}
      dayCardsMap={{} as AttendanceDayCardsMap}
      attendanceByDate={new Map()}
      onCycleTask={() => {}}
      onAddTask={() => {}}
      notes={{ hasNotes: () => false, onToggleNotes: () => {} }}
      isMoodleConnected={false}
      onConnectMoodle={() => {}}
    />
  );
}

describe("day sheet section headings", () => {
  it("does not repeat the exam's name in the heading and the row", () => {
    renderSheet(examDay([{ code: "25BLC1081", title: "German Level I" }]));

    // The heading is the category...
    expect(screen.getByRole("heading", { level: 2, name: "Exam" })).toBeTruthy();
    // ...and the row below it is the actual exam, exactly once.
    const rows = screen.getAllByRole("heading", { level: 4, name: "CAT II" });
    expect(rows).toHaveLength(1);
  });

  it("still names the exam on the row, and the paper under it", () => {
    renderSheet(examDay([{ code: "25BLC1081", title: "German Level I" }]));

    expect(screen.getByRole("heading", { level: 4, name: "CAT II" })).toBeTruthy();
    expect(screen.getByRole("heading", { level: 4, name: "German Level I" })).toBeTruthy();
  });

  it("keeps the blurb, so the heading has not cost the explanation", () => {
    renderSheet(examDay([{ code: "25BLC1081", title: "German Level I" }]));

    expect(screen.getByText("Continuous Assessment Test II")).toBeTruthy();
  });

  it("says Exams, plural, only when there is more than one", () => {
    // A milestone the schedule did not confirm stays put, so a day can genuinely
    // hold two assessments. The heading then has to admit it.
    const [august] = buildEnrichedCalendars({
      calendars: [
        {
          month: "August 2026",
          year: 2026,
          days: [
            {
              date: 20,
              events: [
                { type: "Other", text: "CAT - II", category: "Working day" },
                { type: "Other", text: "Final Assessment", category: "Working day" },
              ],
            },
          ],
        },
      ],
      schedule: {
        Schedule: {
          "Final Assessment": [
            { courseCode: "25CS1101", courseTitle: "Data Structures", examDate: "2026-08-20" },
          ],
        },
      },
    });
    renderSheet(august.days.find((d) => d.date === 20)!);

    expect(screen.getByRole("heading", { level: 2, name: "Exams" })).toBeTruthy();
  });

  it("does not invent a heading from an event that has no name of its own", () => {
    // A milestone with no papers: the row is the only thing that can say what it
    // is, so the heading must not reach into it for a label.
    renderSheet(examDay([]));

    expect(screen.getByRole("heading", { level: 2, name: "Exam" })).toBeTruthy();
    expect(screen.getByRole("heading", { level: 4, name: "CAT II" })).toBeTruthy();
  });

  it("leaves the other sections' headings alone", () => {
    // The same rule, checked where it is easiest to break by accident later.
    const [august] = buildEnrichedCalendars({
      calendars: [
        {
          month: "August 2026",
          year: 2026,
          days: [
            {
              date: 15,
              events: [
                { type: "Holiday", text: "Holiday", category: "Independence Day" },
                { type: "Other", text: "Vibrance 2026", category: "Robotics Club workshop" },
              ],
            },
          ],
        },
      ],
    });
    renderSheet(august.days.find((d) => d.date === 15)!);

    // The holiday heads the day, and its name is on the row, not the heading.
    expect(screen.getByRole("heading", { level: 2, name: "Holiday" })).toBeTruthy();
    expect(screen.getByRole("heading", { level: 4, name: "Independence Day" })).toBeTruthy();
    // The club event is still shown, under the catch-all.
    expect(screen.getByRole("heading", { level: 4, name: "Robotics Club workshop" })).toBeTruthy();
  });

  it("opens the course page from a schedule row, and only when it can", () => {
    // The other half of the sheet's click contract, and the reason the prop is
    // optional: no handler means no button, because a row that looks tappable
    // and does nothing is worse than one that does not.
    const [august] = buildEnrichedCalendars({
      calendars: [
        {
          month: "August 2026",
          year: 2026,
          days: [
            { date: 5, events: [{ type: "Instructional Day", text: "Instructional Day", category: "Working day" }] },
          ],
        },
      ],
    });
    const day = august.days.find((d) => d.date === 5)!;
    const cards = {
      WED: [{ slotName: "L1+L2", courseCode: "25BLC1081", courseTitle: "Biology", time: "08:00-09:40" }],
    };

    const { rerender } = render(
      <DayDetailSheet
        day={day}
        onClose={() => {}}
        dayCardsMap={cards as any}
        attendanceByDate={new Map()}
        onCycleTask={() => {}}
        onAddTask={() => {}}
        notes={{ hasNotes: () => false, onToggleNotes: () => {} }}
        isMoodleConnected={false}
        onConnectMoodle={() => {}}
      />
    );
    expect(screen.getByRole("button", { name: /Biology/ })).toHaveProperty("disabled", true);

    const onOpenCourse = vi.fn();
    rerender(
      <DayDetailSheet
        day={day}
        onClose={() => {}}
        dayCardsMap={cards as any}
        attendanceByDate={new Map()}
        onCycleTask={() => {}}
        onAddTask={() => {}}
        notes={{ hasNotes: () => false, onToggleNotes: () => {} }}
        isMoodleConnected={false}
        onConnectMoodle={() => {}}
        onOpenCourse={onOpenCourse}
      />
    );
    const row = screen.getByRole("button", { name: /Biology/ });
    expect(row).toHaveProperty("disabled", false);
    row.click();
    expect(onOpenCourse).toHaveBeenCalledWith("25BLC1081");
  });
});
