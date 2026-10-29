import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import FFCSShareView from "@/app/share/ffcs/FFCSShareView";
import { encodeCompactTimetableShare, encodeTimetableShare } from "@/lib/ffcsShare";
import { DAYS } from "@/components/custom/exams/FFCS/constants";
import type { AddedCourse } from "@/components/custom/exams/FFCS/types";

const { searchParams, downloadModernTimetableImage } = vi.hoisted(() => ({
  searchParams: new URLSearchParams(),
  downloadModernTimetableImage: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("next/navigation", () => ({
  useSearchParams: () => searchParams,
}));

vi.mock("@/lib/exportTimetable", () => ({
  downloadModernTimetableImage,
}));

vi.mock("@/components/custom/exams/FFCS/components/TimetableGrid", () => ({
  TimetableGrid: () => <div data-testid="timetable-grid" />,
}));

const course: AddedCourse = {
  id: "course-1",
  code: "CSE1001",
  title: "Computer Science",
  faculty: "Dr. Example",
  venue: "AB1-101",
  slots: ["A1"],
  credits: "3",
  type: "ETH",
  color: "bg-blue-500",
};

describe("FFCSShareView image export", () => {
  beforeEach(() => {
    searchParams.delete("x");
    searchParams.set("d", encodeTimetableShare({ name: "Shared Plan", courses: [course] }));
    downloadModernTimetableImage.mockClear();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("uses the modern horizontal exporter for PNG and JPEG", async () => {
    render(<FFCSShareView />);

    fireEvent.click(screen.getByRole("button", { name: "Download as PNG" }));
    await waitFor(() => expect(downloadModernTimetableImage).toHaveBeenCalledTimes(1));

    fireEvent.click(screen.getByRole("button", { name: "Download as JPEG" }));
    await waitFor(() => expect(downloadModernTimetableImage).toHaveBeenCalledTimes(2));

    const [pngOptions] = downloadModernTimetableImage.mock.calls[0];
    expect(pngOptions).toMatchObject({
      timetableName: "Shared Plan",
      courses: [course],
      days: DAYS,
      viewMode: "horizontal",
      format: "png",
    });

    const [jpegOptions] = downloadModernTimetableImage.mock.calls[1];
    expect(jpegOptions).toMatchObject({
      viewMode: "horizontal",
      format: "jpg",
    });
  });

  it("resolves a short class-ID link against its semester report", async () => {
    const csv = [
      "COURSE CODE,COURSE TITLE,CREDITS,CLASS ID,SLOT,ERP ID,EMPLOYEE NAME,EMPLOYEE SCHOOL",
      "CSE1001,Computer Science,3,CH2026270500002,A1,ERP1,Dr Example,SCI",
    ].join("\n");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response(csv, { status: 200 }))
    );
    const compact = encodeCompactTimetableShare({
      name: "Compact Plan",
      courses: [{ ...course, classId: "CH2026270500002" }],
    }, "winter-2026-2027")!;
    searchParams.delete("d");
    searchParams.set("x", compact);

    render(<FFCSShareView />);

    expect(await screen.findByRole("heading", { name: "Compact Plan" })).toBeDefined();
    // The course title is rendered twice on purpose: once in the mobile card
    // and once in the desktop table row. jsdom applies no media queries, so
    // both responsive variants are in the DOM at once — hence AllByText.
    expect(screen.getAllByText("Computer Science").length).toBeGreaterThan(0);
    expect(screen.getByText(/selected class IDs/i)).toBeDefined();
  });
});
