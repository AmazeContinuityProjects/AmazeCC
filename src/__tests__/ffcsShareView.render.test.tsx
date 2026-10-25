import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import FFCSShareView from "@/app/share/ffcs/FFCSShareView";
import { encodeTimetableShare } from "@/lib/ffcsShare";
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
    searchParams.set("d", encodeTimetableShare({ name: "Shared Plan", courses: [course] }));
    downloadModernTimetableImage.mockClear();
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
});
