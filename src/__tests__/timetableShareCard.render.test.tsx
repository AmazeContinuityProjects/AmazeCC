import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import TimetableShareCard from "../components/custom/timetable/TimetableShareCard";
import type { attendanceRes } from "../types/data/attendance";

const attendance = {
  attendance: [
    { courseCode: "BACSE211", classId: "CH2026270501792" },
    { courseCode: "BAMAT101", classId: "CH2026270500101" },
  ],
} as unknown as attendanceRes;

describe("TimetableShareCard", () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("shows a share link for the registered timetable and copies it", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText } });
    Object.defineProperty(navigator, "share", { configurable: true, value: undefined });

    await act(async () => {
      render(<TimetableShareCard attendanceData={attendance} />);
    });
    const url = screen.getByText(/\/share\/ffcs\/\?/).textContent!;
    expect(url).toContain(window.location.origin);
    expect(screen.getByText("2 classes")).toBeTruthy();
    expect(screen.getByRole("link", { name: /Preview/ }).getAttribute("href")).toBe(url);

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /Copy link/ }));
    });
    expect(writeText).toHaveBeenCalledWith(url);
    expect(screen.getByText("Copied")).toBeTruthy();
  });

  it("explains when there is nothing to share yet", async () => {
    await act(async () => {
      render(<TimetableShareCard attendanceData={{ attendance: [] }} />);
    });
    expect(screen.getByText(/appears once your timetable has synced/)).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Copy link/ })).toBeNull();
  });

  it("does not offer the demo account's timetable", async () => {
    await act(async () => {
      render(<TimetableShareCard attendanceData={attendance} isDemo />);
    });
    expect(screen.getByText(/demo account has no real timetable/)).toBeTruthy();
    expect(screen.queryByText(/\/share\/ffcs\//)).toBeNull();
  });

  it("points to the planner's friends and the friend finder", async () => {
    await act(async () => {
      render(<TimetableShareCard attendanceData={attendance} />);
    });
    expect(screen.getByRole("link", { name: /Friends in the FFCS planner/ }).getAttribute("href")).toMatch(
      /^\/ffcs\/?$/,
    );
    expect(screen.getByRole("link", { name: /Find classmates/ }).getAttribute("href")).toMatch(
      /^\/ffcs\/?\?open=classmates$/,
    );
  });
});
