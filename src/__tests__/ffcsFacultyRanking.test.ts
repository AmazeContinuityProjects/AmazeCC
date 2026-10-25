import { describe, expect, it } from "vitest";
import {
  buildFacultyRatingLookup,
  facultyRankingSummary,
  facultyRatingKeys,
  passesFacultyScoreFilters,
  type FacultyRatingLookup,
} from "../lib/ffcsFacultyRanking";
import type { AddedCourse, ParsedCourse } from "../components/custom/exams/FFCS/types";

const parsed = (employeeId: string, faculty: string): ParsedCourse => ({
  CODE: "CSE101",
  TITLE: "Computer Science",
  TYPE: "TH",
  CREDITS: "3",
  ROOM: "AB1-101",
  SLOT: "TB1",
  FACULTY: faculty,
  ERP_ID: employeeId,
});

const added = (employeeId: string | undefined, faculty: string): AddedCourse => ({
  id: faculty,
  code: "CSE101",
  title: "Computer Science",
  slots: ["TB1"],
  faculty,
  employeeId,
  venue: "AB1-101",
  credits: "3",
  type: "TH",
  color: "blue",
});

describe("faculty ranking inputs", () => {
  it("indexes ratings by both employee id and normalized faculty name", () => {
    const lookup = buildFacultyRatingLookup([parsed("1001", "Dr. A Person")], () => ({
      wPct: 80,
      lecture: 4,
      da: 3,
      vibe: 5,
      reviews: 8,
    }));

    expect(lookup["id:1001"]?.wPct).toBe(80);
    expect(lookup["name:aperson"]?.lecture).toBe(4);
    expect(facultyRatingKeys({ employeeId: "1001", faculty: "Dr. A Person" })).toEqual([
      "id:1001",
      "name:aperson",
    ]);
  });

  it("averages reviewed faculty and penalizes coverage gaps without counting unreviewed scores", () => {
    const lookup: FacultyRatingLookup = {
      "id:1001": { wPct: 80, lecture: 4, da: 3, vibe: 5, reviews: 8 },
    };
    const summary = facultyRankingSummary(
      [added("1001", "Dr. Reviewed"), added(undefined, "Dr. Unrated")],
      lookup
    );

    expect(summary.averageWPct).toBe(80);
    expect(summary.averageLecture).toBe(4);
    expect(summary.ratedFacultyCount).toBe(1);
    expect(summary.unratedFacultyCount).toBe(1);
    expect(summary.facultyScore).toBe(40);
  });

  it("applies minimum scores to rated faculty and leaves unrated entries out of comparisons", () => {
    const summary = facultyRankingSummary(
      [added("1001", "Dr. Reviewed"), added(undefined, "Dr. Unrated")],
      { "id:1001": { wPct: 68, lecture: 4, da: 3, vibe: 5, reviews: 8 } }
    );

    expect(
      passesFacultyScoreFilters(summary, {
        minWPct: 70,
        minLecture: 0,
        minDa: 0,
        minVibe: 0,
      })
    ).toBe(false);
    expect(
      passesFacultyScoreFilters(summary, {
        minWPct: 60,
        minLecture: 3.5,
        minDa: 0,
        minVibe: 0,
      })
    ).toBe(true);
  });
});
