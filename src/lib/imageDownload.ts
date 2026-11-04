/**
 * The app's one image-download engine.
 *
 * Every "save this screen as a JPG/PNG" path goes through here, so quality,
 * filename and cleanup behave the same on the exam schedule, the attendance
 * grid, the FFCS planner and the share sheets.
 *
 * The shape of a capture: the markup (or a *clone* of the live node) goes into
 * an off-screen wrapper, `html-to-image` renders that, and the wrapper is
 * removed in a `finally`. The live DOM is never touched — the previous
 * downloader mutated the real element (stripping classes, hiding chrome,
 * transform-scaling to fit the viewport) and raced a `setTimeout` restore
 * against the capture, so a mid-export scroll or re-render could ship a
 * half-mutated screen or leave it visibly altered. A throwaway clone cannot
 * affect what the student is looking at, no matter what the capture does.
 *
 * Format routing matters: JPEG cannot hold transparency, so `backgroundColor`
 * should always be passed for `jpg`, and a `.jpg` file is saved as `.jpeg`
 * (the extension every browser agrees on for the same bytes).
 */

/**
 * `html-to-image` is a few hundred KB — an export the user may never click
 * does not belong in the first paint. The import is pulled on first use and
 * memoized, so the second download costs nothing. Tests spy on the module's
 * exports, which works because every consumer resolves the same namespace.
 */
let htmlToImageModule: Promise<typeof import("html-to-image")> | undefined;
const loadHtmlToImage = () => (htmlToImageModule ??= import("html-to-image"));

/**
 * Marks an element as UI chrome — a view switcher, a "swipe to see more" hint —
 * rather than timetable content, so it can be pulled out before a capture.
 *
 * Every export path serialises a DOM (`html-to-image` clones it, the printable
 * page takes `innerHTML`), so a control that happens to sit inside the captured
 * subtree would end up baked into a shared PNG. The attribute lives here, with
 * the code that strips it from image captures.
 */
export const EXPORT_CHROME_ATTR = "data-export-chrome";

export type ImageFormat = "jpg" | "png";

export interface ImageRenderOptions {
  /** `jpg` (default) or `png`. */
  format?: ImageFormat;
  /** Canvas backdrop — required in practice for JPEG, which has no alpha. */
  backgroundColor?: string;
  /** JPEG quality, 0–1 (default 0.95). Ignored by PNG. */
  quality?: number;
  /** Render scale (default 2) — the "hi-res" half of the export contract. */
  pixelRatio?: number;
  /** Inline styles for the off-screen wrapper, e.g. a fixed `width`. */
  containerStyle?: Record<string, string>;
  /** Layout/font settle time before the capture, in ms. */
  settleMs?: number;
}

export interface ElementCaptureOptions extends ImageRenderOptions {
  /**
   * Runs on the detached clone just before capture — the moment to adjust
   * classes that only make sense in the live layout (a `display: contents`
   * grid item, say), which would leave the clone without a box of its own.
   */
  prepareClone?: (clone: HTMLElement) => void;
}

const extensionFor = (format: ImageFormat) => (format === "png" ? "png" : "jpeg");

/** The off-screen wrapper: parked far outside the viewport, below everything. */
function createWrapper(): HTMLElement {
  const container = document.createElement("div");
  container.style.position = "fixed";
  container.style.left = "-9999px";
  container.style.top = "0";
  container.style.zIndex = "-1000";
  return container;
}

async function renderNode(node: HTMLElement, options: ImageRenderOptions): Promise<string> {
  const htmlToImage = await loadHtmlToImage();
  const format = options.format ?? "jpg";
  const toImageFn = format === "png" ? htmlToImage.toPng : htmlToImage.toJpeg;
  if (typeof toImageFn !== "function") {
    throw new Error("htmlToImage export function is not available");
  }
  if (options.settleMs) {
    // Layout and web fonts land asynchronously; give them a beat.
    await new Promise((resolve) => setTimeout(resolve, options.settleMs));
  }
  const dataUrl = await toImageFn(node, {
    quality: options.quality ?? 0.95,
    backgroundColor: options.backgroundColor ?? "#ffffff",
    pixelRatio: options.pixelRatio ?? 2,
  });
  if (!dataUrl) {
    throw new Error("Image capture returned no data.");
  }
  return dataUrl;
}

function saveDataUrl(dataUrl: string, filename: string, format: ImageFormat): void {
  const link = document.createElement("a");
  link.download = `${filename}.${extensionFor(format)}`;
  link.href = dataUrl;
  link.click();
}

/**
 * Render `html` off-screen and resolve with its data URL — no download.
 * The bridge for flows that embed the image somewhere else (a PDF page).
 */
export async function renderHtmlToImage(html: string, options: ImageRenderOptions = {}): Promise<string> {
  const container = createWrapper();
  if (options.containerStyle) Object.assign(container.style, options.containerStyle);
  container.innerHTML = html;
  document.body.appendChild(container);
  try {
    const target = (container.firstElementChild as HTMLElement) || container;
    return await renderNode(target, options);
  } finally {
    container.parentNode?.removeChild(container);
  }
}

/** Render `html` off-screen and save it as a file (`jpg` → `.jpeg`, `png` → `.png`). */
export async function downloadHtmlImage(
  html: string,
  filename: string,
  options: ImageRenderOptions = {},
): Promise<void> {
  const dataUrl = await renderHtmlToImage(html, options);
  saveDataUrl(dataUrl, filename, options.format ?? "jpg");
}

/**
 * Capture a *copy* of a live element and save it.
 *
 * The clone gets three fixes the old live-DOM capture used to apply to the
 * real node:
 *
 * - `[data-export-chrome]` subtrees (view switchers, "swipe" hints) are
 *   stripped, so UI controls never land in the shared image;
 * - `.overflow-x-auto` scrollers are un-clipped, so wide tables render at
 *   their full width instead of a sliced viewport;
 * - `flex flex-col w-max min-w-full` forces the natural content width inside
 *   the wrapper, where nothing constrains it.
 */
export async function downloadElementImage(
  element: HTMLElement,
  filename: string,
  options: ElementCaptureOptions = {},
): Promise<void> {
  const clone = element.cloneNode(true) as HTMLElement;
  clone.querySelectorAll<HTMLElement>(`[${EXPORT_CHROME_ATTR}]`).forEach((el) => el.remove());
  clone.querySelectorAll<HTMLElement>(".overflow-x-auto").forEach((el) => el.classList.remove("overflow-x-auto"));
  clone.classList.add("flex", "flex-col", "w-max", "min-w-full");
  options.prepareClone?.(clone);

  const container = createWrapper();
  container.appendChild(clone);
  document.body.appendChild(container);
  try {
    const dataUrl = await renderNode(clone, { settleMs: 150, ...options });
    saveDataUrl(dataUrl, filename, options.format ?? "jpg");
  } finally {
    container.parentNode?.removeChild(container);
  }
}
