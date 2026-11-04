import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { render, screen, within, fireEvent, act } from "@testing-library/react";
import * as imageDownload from "@/lib/imageDownload";
import * as exportTimetable from "@/lib/exportTimetable";
import ExamSchedule from "../components/custom/exams/ScheduleDisplay";

/**
 * The exam schedule's filter strip and the list it filters.
 *
 * These are two children of one wrapper: the `All / CAT1 / CAT2` control strip,
 * and a `space-y-6` list of series. The list's spacing class margins every
 * child *except the first*, so the topmost series header gets no top margin —
 * and the filter strip has no bottom margin — which left the pills sitting
 * flush on top of the header, overlapping it.
 *
 * It is a spacing bug that only shows up when there is more than one series,
 * because with a single series the filter is not rendered at all and there is
 * nothing to collide with. That is why it survived: the empty and single-series
 * states are the ones anybody tests by hand.
 */

const NOW = new Date(2026, 8, 29, 10, 0, 0);

/** Two series, so the filter renders. */
const data = {
  semester: "AN1",
  Schedule: {
    CAT2: [
      {
        courseCode: "BAGER101",
        courseTitle: "German Level I",
        examDate: "29-09-2026",
        examSession: "AN1",
        reportingTime: "11:45 AM",
        slot: "TE1",
      },
    ],
    CAT1: [
      {
        courseCode: "BT23C1010",
        courseTitle: "Mathematics",
        examDate: "15-09-2026",
        examSession: "AN1",
        reportingTime: "09:00 AM",
        slot: "TE1",
      },
    ],
  },
};

const renderSchedule = () => render(<ExamSchedule data={data} handleScheduleFetch={vi.fn()} onBack={vi.fn()} />);

/**
 * The `All / CAT1 / …` control strip, and the wrapper that holds it and the
 * series list.
 *
 * The wrapper is located as the strip's *parent* rather than by walking up to
 * the nearest `space-y-*`. Walking up finds `PageShell`'s own `space-y-6`,
 * which contains both ends of the collision too, and an assertion satisfied by
 * PageShell passes with the bug still in place.
 */
const filterStrip = () => screen.getByText("All").closest("div.justify-between") as HTMLElement;
const wrapper = () => filterStrip().parentElement as HTMLElement;

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  vi.setSystemTime(NOW);
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe("exam schedule filter spacing", () => {
  it("separates the filter strip from the list below it", () => {
    // The whole bug in one assertion: the wrapper has to carry a vertical
    // rhythm, because neither child can supply one. `space-y-*` on the list
    // deliberately skips its first child, and the strip has no bottom margin.
    renderSchedule();
    expect(wrapper().className).toMatch(/space-y-/);
  });

  it("keeps the filter a control strip rather than a section of the list", () => {
    // Tighter than the list's own `space-y-6`: the strip governs the list
    // rather than being another entry in it.
    renderSchedule();
    expect(wrapper().className).toBe("space-y-4");
  });

  it("is the wrapper that actually spans the filter and the first series header", () => {
    // Guards the two above: a `space-y-4` on some unrelated ancestor would
    // satisfy them while the pills still sat flush on the header. This
    // wrapper has to hold both ends of the collision.
    renderSchedule();
    expect(within(wrapper()).getByText("All")).toBeTruthy();
    expect(within(wrapper()).getByRole("heading", { name: "CAT2" })).toBeTruthy();
  });

  it("downloads exam schedule via downloadHtmlImage when clicking download button", async () => {
    const downloadSpy = vi.spyOn(imageDownload, "downloadHtmlImage").mockResolvedValue();
    renderSchedule();
    const downloadBtn = screen.getByTitle("Download as PNG");
    await act(async () => {
      fireEvent.click(downloadBtn);
    });

    expect(downloadSpy).toHaveBeenCalledTimes(1);
    const [html, filename, options] = downloadSpy.mock.calls[0];
    expect(filename).toBe("Exam_Schedule_FFCS");
    expect(options).toEqual(expect.objectContaining({ format: "png" }));
    expect(html).toContain("Exam Schedule");
    expect(html).toContain("German Level I");
    expect(html).toContain("Mathematics");
    expect(html).toContain("BAGER101");
    expect(html).toContain("BT23C1010");
  });

  it("downloads exam schedule PDF via downloadExamSchedulePdf without opening a tab when clicking PDF button", async () => {
    const pdfSpy = vi.spyOn(exportTimetable, "downloadExamSchedulePdf").mockResolvedValue();
    const openSpy = vi.spyOn(window, "open");
    renderSchedule();
    const pdfBtn = screen.getByTitle("Download Exam Schedule (PDF)");
    await act(async () => {
      fireEvent.click(pdfBtn);
    });

    expect(pdfSpy).toHaveBeenCalledTimes(1);
    expect(pdfSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        scheduleObj: data.Schedule,
        semester: "AN1",
        layout: "document",
      }),
    );
    expect(openSpy).not.toHaveBeenCalled();
  });

  it("downloads PDF specifically for a selected series when series download button is clicked", async () => {
    const pdfSpy = vi.spyOn(exportTimetable, "downloadExamSchedulePdf").mockResolvedValue();
    renderSchedule();
    const cat1Btn = screen.getByTitle("Download CAT1 Schedule (PDF)");
    await act(async () => {
      fireEvent.click(cat1Btn);
    });

    expect(pdfSpy).toHaveBeenCalledTimes(1);
    expect(pdfSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        selectedSeries: "CAT1",
      }),
    );
  });

  it("opens the choose exam download modal when clicking the download options icon", async () => {
    renderSchedule();
    const modalTrigger = screen.getByTitle("Choose exam to download");
    await act(async () => {
      fireEvent.click(modalTrigger);
    });

    expect(screen.getByText("Download Exam Schedule")).toBeTruthy();
    expect(screen.getByText("Choose an exam series and file format")).toBeTruthy();
    expect(screen.getByText("PDF (Schedule)")).toBeTruthy();
    expect(screen.getByText("PNG (Image)")).toBeTruthy();
  });
});
