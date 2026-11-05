import * as htmlToImage from "html-to-image";
import { afterEach, describe, expect, it, vi } from "vitest";
import { downloadElementImage, downloadHtmlImage, renderHtmlToImage } from "@/lib/imageDownload";

/**
 * One engine now serves every "save this screen as an image" in the app, so
 * these pin the contracts all of them lean on: format routing (JPEG gets
 * `toJpeg` and a `.jpeg` file, PNG gets `toPng` and a `.png`), the off-screen
 * wrapper's lifecycle, and the promise the old downloader could not keep —
 * the live element is never touched, only its clone.
 */

const JPEG = "data:image/jpeg;base64,jpegdata";
const PNG = "data:image/png;base64,pngdata";

function trackDownloads() {
  const names: string[] = [];
  const spy = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (this: HTMLAnchorElement) {
    names.push(this.download);
  });
  return { names, spy };
}

describe("imageDownload engine", () => {
  afterEach(() => vi.restoreAllMocks());

  it("routes JPG through toJpeg and saves a .jpeg file", async () => {
    const toJpeg = vi.spyOn(htmlToImage, "toJpeg").mockResolvedValue(JPEG);
    const toPng = vi.spyOn(htmlToImage, "toPng").mockResolvedValue(PNG);
    const { names } = trackDownloads();

    await downloadHtmlImage("<div>plan</div>", "Winter_2026_HORIZONTAL_FFCS", {
      backgroundColor: "#090d16",
    });

    expect(toJpeg).toHaveBeenCalledTimes(1);
    expect(toPng).not.toHaveBeenCalled();
    expect(toJpeg).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ quality: 0.95, pixelRatio: 2, backgroundColor: "#090d16" }),
    );
    expect(names).toEqual(["Winter_2026_HORIZONTAL_FFCS.jpeg"]);
  });

  it("routes PNG through toPng and saves a .png file", async () => {
    const toJpeg = vi.spyOn(htmlToImage, "toJpeg").mockResolvedValue(JPEG);
    const toPng = vi.spyOn(htmlToImage, "toPng").mockResolvedValue(PNG);
    const { names } = trackDownloads();

    await downloadHtmlImage("<div>schedule</div>", "Exam_Schedule_FFCS", { format: "png" });

    expect(toPng).toHaveBeenCalledTimes(1);
    expect(toJpeg).not.toHaveBeenCalled();
    expect(names).toEqual(["Exam_Schedule_FFCS.png"]);
  });

  it("captures markup that is in the document, then removes the wrapper", async () => {
    const toJpeg = vi.spyOn(htmlToImage, "toJpeg").mockResolvedValue(JPEG);
    const toPng = vi.spyOn(htmlToImage, "toPng").mockResolvedValue(PNG);
    let connectedDuringCapture = false;
    toJpeg.mockImplementation(async (node) => {
      connectedDuringCapture = node.isConnected;
      return JPEG;
    });
    const { names } = trackDownloads();
    const before = document.body.childElementCount;

    await downloadHtmlImage("<div>plan</div>", "Plan", { backgroundColor: "#090d16" });
    await renderHtmlToImage("<div>page</div>", { format: "png" });

    expect(connectedDuringCapture).toBe(true);
    expect(toPng).toHaveBeenCalledTimes(1);
    expect(document.body.childElementCount).toBe(before);
    // The render-only path resolves a data URL; it saves nothing.
    expect(names).toEqual(["Plan.jpeg"]);
  });

  it("sizes the wrapper from containerStyle for fixed-width captures", async () => {
    const toPng = vi.spyOn(htmlToImage, "toPng").mockResolvedValue(PNG);
    let wrapperWidth = "";
    toPng.mockImplementation(async (node) => {
      wrapperWidth = (node.parentElement as HTMLElement).style.width;
      return PNG;
    });

    await renderHtmlToImage("<div>dossier</div>", {
      format: "png",
      containerStyle: { width: "1400px", boxSizing: "border-box" },
    });

    expect(wrapperWidth).toBe("1400px");
    expect(document.body.childElementCount).toBe(0);
  });

  it("fails loudly instead of saving when the capture returns nothing", async () => {
    vi.spyOn(htmlToImage, "toJpeg").mockResolvedValue("");
    const { names, spy } = trackDownloads();

    await expect(downloadHtmlImage("<div>x</div>", "Plan")).rejects.toThrow(/no data/i);
    expect(names).toEqual([]);
    expect(spy).not.toHaveBeenCalled();
  });

  it("captures a clone — chrome stripped, scrollers un-clipped — leaving the live element alone", async () => {
    const toJpeg = vi.spyOn(htmlToImage, "toJpeg").mockResolvedValue(JPEG);
    const { names } = trackDownloads();

    const live = document.createElement("div");
    live.className = "xl:contents space-y-4 overflow-x-auto";
    live.innerHTML = `
      <div data-export-chrome>View switcher</div>
      <div class="overflow-x-auto"><table><tr><td>cell</td></tr></table></div>`;
    document.body.appendChild(live);
    const bodyChildren = document.body.childElementCount;

    let cloneSeen: HTMLElement | null = null;
    toJpeg.mockImplementation(async (node) => {
      cloneSeen = node as HTMLElement;
      return JPEG;
    });

    await downloadElementImage(live, "Timetable_FFCS", {
      backgroundColor: "#ffffff",
      // The fallback's layout fix belongs on the clone: `display: contents`
      // would leave it without a box inside the off-screen wrapper.
      prepareClone: (clone) => clone.classList.remove("xl:contents"),
    });

    // A throwaway copy was captured, not the screen the student sees.
    expect(cloneSeen).not.toBeNull();
    expect(cloneSeen).not.toBe(live);
    expect(cloneSeen!.querySelector("[data-export-chrome]")).toBeNull();
    expect(cloneSeen!.querySelector(".overflow-x-auto")).toBeNull();
    expect(cloneSeen!.classList.contains("w-max")).toBe(true);
    expect(cloneSeen!.classList.contains("min-w-full")).toBe(true);
    expect(cloneSeen!.classList.contains("xl:contents")).toBe(false);

    // The live element kept every class and subtree it started with…
    expect(live.className).toBe("xl:contents space-y-4 overflow-x-auto");
    expect(live.querySelector("[data-export-chrome]")).not.toBeNull();
    expect(live.querySelector(".overflow-x-auto")).not.toBeNull();

    // …and the wrapper it rode in on is gone: `live` is back on body directly.
    expect(document.body.childElementCount).toBe(bodyChildren);
    expect(live.parentElement).toBe(document.body);
    live.remove();

    expect(names).toEqual(["Timetable_FFCS.jpeg"]);
  });
});
