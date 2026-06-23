import * as htmlToImage from "html-to-image";

export async function downloadTimetableImage(
  element: HTMLElement,
  timetableName: string,
  themeBgColor: string,
  format: "jpg" | "png" = "jpg"
): Promise<void> {
  const originalStyle = element.style.cssText;

  const tableContainers = element.querySelectorAll(".overflow-x-auto");
  tableContainers.forEach((container) => {
    container.classList.remove("overflow-x-auto");
  });

  element.classList.add("flex", "flex-col", "w-max", "min-w-full");

  try {
    await new Promise((resolve) => setTimeout(resolve, 150));

    const scrollWidth = element.scrollWidth;
    const scrollHeight = element.scrollHeight;
    const viewportWidth = window.innerWidth;
    const safeWidth = viewportWidth * 0.9;
    const scale = scrollWidth > safeWidth ? safeWidth / scrollWidth : 1;

    const opts = {
      quality: 0.98,
      backgroundColor: themeBgColor,
      pixelRatio: ((1 / scale) * 3),
      width: scrollWidth * scale,
      height: scrollHeight * scale,
      style: {
        transform: `scale(${scale})`,
        transformOrigin: "top left",
        width: `${scrollWidth}px`,
        height: `${scrollHeight}px`,
        padding: "24px",
        margin: "0",
        maxWidth: "none",
      },
    };

    const dataUrl =
      format === "png"
        ? await htmlToImage.toPng(element, opts)
        : await htmlToImage.toJpeg(element, opts);

    const link = document.createElement("a");
    link.download = `${timetableName.replace(/\s+/g, "_")}_FFCS.${format}`;
    link.href = dataUrl;
    link.click();
  } finally {
    element.style.cssText = originalStyle;
    element.classList.remove("flex", "flex-col", "w-max", "min-w-full");
    tableContainers.forEach((container) => {
      container.classList.add("overflow-x-auto");
    });
  }
}

export function openTimetablePrintablePage(
  htmlContent: string,
  timetableName: string,
  themeHtmlClass: string,
  themeBgColor: string,
  themeTextColor: string
): Window | null {
  const styles = Array.from(document.querySelectorAll('style, link[rel="stylesheet"]'))
    .map((el) => el.outerHTML)
    .join("\n");

  const isDarkMode = themeHtmlClass.includes("dark");
  const bgGrad = isDarkMode
    ? "linear-gradient(135deg, #0f172a 0%, #1e1b4b 50%, #0f172a 100%)"
    : "linear-gradient(135deg, #f8fafc 0%, #e0e7ff 30%, #fce7f3 70%, #f8fafc 100%)";
  const cardBg = isDarkMode ? "#1e293bcc" : "rgba(255,255,255,0.85)";
  const cardBorder = isDarkMode
    ? "1px solid rgba(99,102,241,0.25)"
    : "1px solid rgba(99,102,241,0.15)";
  const accentGrad = "linear-gradient(135deg, #6366f1, #a855f7, #ec4899)";

  const fullHtml = `
    <!DOCTYPE html>
    <html class="${themeHtmlClass}">
      <head>
        <title>${timetableName} - Timetable</title>
        ${styles}
        <style>
          * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
          body {
            margin: 0;
            min-height: 100vh;
            background: ${bgGrad};
            font-family: system-ui, -apple-system, sans-serif;
          }
          @page { size: landscape; margin: 0; }
          .print-toolbar {
            position: fixed; top: 0; left: 0; right: 0;
            background: linear-gradient(135deg, #1e293b, #1e1b4b);
            color: white; padding: 14px 32px;
            display: flex; align-items: center;
            justify-content: space-between;
            z-index: 9999; backdrop-filter: blur(12px);
            font-family: system-ui, -apple-system, sans-serif;
            box-shadow: 0 4px 32px rgba(0,0,0,0.4);
          }
          .print-toolbar button {
            background: ${accentGrad}; color: white; border: none;
            padding: 10px 24px; border-radius: 10px; font-size: 14px;
            font-weight: 600; cursor: pointer; display: flex;
            align-items: center; gap: 8px;
            transition: transform 0.2s, box-shadow 0.2s;
            box-shadow: 0 4px 16px rgba(99,102,241,0.4);
          }
          .print-toolbar button:hover {
            transform: translateY(-1px);
            box-shadow: 0 6px 24px rgba(99,102,241,0.6);
          }
          .print-toolbar .hint { font-size: 13px; color: #a5b4fc; }
          .print-wrapper {
            padding: 72px 48px 48px;
            min-height: 100vh; box-sizing: border-box;
            display: flex; align-items: flex-start; justify-content: center;
          }
          .print-card {
            width: 100%; max-width: 1400px;
            background: ${cardBg};
            backdrop-filter: blur(16px);
            border-radius: 24px;
            border: ${cardBorder};
            padding: 48px 40px 40px;
            box-shadow: 0 8px 64px rgba(0,0,0,0.12), 0 2px 8px rgba(99,102,241,0.08);
            overflow-x: auto; overflow-y: visible;
            color: ${themeTextColor};
          }
          @media print {
            .print-toolbar { display: none !important; }
            .print-wrapper { padding: 0; display: block; }
            .print-card {
              border-radius: 0; box-shadow: none;
              padding: 48px 56px;
              max-width: none;
              background: ${isDarkMode ? "#0f172a" : "#ffffff"};
              border: none;
              backdrop-filter: none;
              -webkit-backdrop-filter: none;
            }
            body { background: ${isDarkMode ? "#0f172a" : "#ffffff"}; }
          }
        </style>
      </head>
      <body>
        <div class="print-toolbar">
          <div style="display:flex;align-items:center;gap:12px">
            <span style="font-weight:700;font-size:16px;background:${accentGrad};-webkit-background-clip:text;-webkit-text-fill-color:transparent">${timetableName}</span>
            <span class="hint">— Timetable</span>
          </div>
          <div style="display:flex;align-items:center;gap:12px">
            <span class="hint hidden sm:inline">Use browser Print / Save as PDF</span>
            <button onclick="window.print()">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 9V2h12v7"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><path d="M6 14h12v8H6z"/></svg>
              Print / PDF
            </button>
          </div>
        </div>
        <div class="print-wrapper">
          <div class="print-card">
            ${htmlContent}
          </div>
        </div>
      </body>
    </html>
  `;

  const printWindow = window.open("", "_blank");
  if (!printWindow) return null;

  printWindow.document.open();
  printWindow.document.write(fullHtml);
  printWindow.document.close();
  return printWindow;
}
