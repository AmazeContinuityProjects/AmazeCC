import type { jsPDF } from "jspdf";

const MARGIN = 13;
const PAGE_W = 210;
const PAGE_H = 297;
const CONTENT_W = PAGE_W - MARGIN * 2;
const BOTTOM = PAGE_H - 13;

function safe(value: string) {
  return value
    .replace(/[\u2013\u2014\u2212]/g, "-")
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201c\u201d]/g, '"')
    .replace(/\u2022/g, "-")
    .replace(/\u00a0/g, " ")
    .replace(/[^\u0020-\u007e\u00a0-\u00ff]/g, "");
}

/** Converts the report's semantic HTML into searchable jsPDF text and vector rules. */
export async function downloadStudentReportPdf(html: string, fileName: string, grayscale: boolean): Promise<void> {
  const { jsPDF } = await import("jspdf");
  const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4", compress: true });
  pdf.setProperties({ title: "AmazeCC Student Academic Report", creator: "AmazeCC" });
  const doc = new DOMParser().parseFromString(html, "text/html");
  const root = doc.querySelector("article") || doc.body;
  const ink = grayscale ? "#171717" : "#172033";
  const accent = grayscale ? "#222222" : "#173b67";
  const band = grayscale ? "#ededed" : "#eaf0f7";
  let y = MARGIN;
  let page = 1;

  const newPage = () => {
    pdf.addPage("a4", "portrait");
    page += 1;
    y = MARGIN;
  };
  const room = (height: number) => {
    if (y + height > BOTTOM) newPage();
  };
  const write = (value: string, x = MARGIN, width = CONTENT_W, size = 8, bold = false, color = ink) => {
    pdf.setFont("helvetica", bold ? "bold" : "normal");
    pdf.setFontSize(size);
    pdf.setTextColor(color);
    const lines = pdf.splitTextToSize(safe(value || "-"), width) as string[];
    const height = Math.max(3.6, lines.length * size * 0.4);
    room(height + 1);
    pdf.text(lines, x, y + size * 0.35);
    y += height + 1;
  };
  const title = (value: string, main = false) => {
    y += main ? 1 : 3;
    room(main ? 13 : 9);
    pdf.setFillColor(band);
    pdf.rect(MARGIN, y, CONTENT_W, main ? 9 : 7, "F");
    pdf.setTextColor(accent);
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(main ? 13 : 9);
    pdf.text(safe(value), MARGIN + 2, y + (main ? 6 : 4.8));
    y += main ? 12 : 10;
  };
  const drawTable = (table: Element) => {
    const headerCells = Array.from(table.querySelectorAll("thead th")).map((cell) => cell.textContent?.trim() || "");
    const bodyRows = Array.from(table.querySelectorAll("tbody tr")).map((tr) =>
      Array.from(tr.querySelectorAll("td")).map((td) => td.textContent?.trim() || ""),
    );
    const headers = headerCells.length ? headerCells : (bodyRows[0] || []).map((_, i) => `Field ${i + 1}`);
    if (!headers.length) return;
    const widths = headers.map(() => CONTENT_W / headers.length);
    const drawHeader = () => {
      room(8);
      let x = MARGIN;
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(6.2);
      headers.forEach((header, i) => {
        pdf.setFillColor(band);
        pdf.setDrawColor(150);
        pdf.rect(x, y, widths[i], 7, "FD");
        pdf.setTextColor(ink);
        pdf.text(pdf.splitTextToSize(safe(header), widths[i] - 2) as string[], x + 1, y + 2.7);
        x += widths[i];
      });
      y += 7;
    };
    drawHeader();
    for (const row of bodyRows) {
      const wrapped = headers.map((_, i) => {
        pdf.setFont("helvetica", "normal");
        pdf.setFontSize(6.2);
        return pdf.splitTextToSize(safe(row[i] || "-"), widths[i] - 2) as string[];
      });
      const lines = Math.max(1, ...wrapped.map((cell) => cell.length));
      const height = Math.max(6.5, lines * 2.6 + 2);
      if (y + height > BOTTOM) {
        newPage();
        drawHeader();
      }
      let x = MARGIN;
      pdf.setDrawColor(175);
      pdf.setTextColor(ink);
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(6.2);
      headers.forEach((_, i) => {
        pdf.rect(x, y, widths[i], height);
        pdf.text(wrapped[i], x + 1, y + 2.8, { lineHeightFactor: 1.05 });
        x += widths[i];
      });
      y += height;
    }
    y += 2;
  };

  for (const node of Array.from(root.children)) {
    if (node.matches("header.report-cover")) {
      const h = node.querySelector("h1")?.textContent?.trim() || "Student Academic Report";
      const logo = node.querySelector<HTMLImageElement>(".report-logo");
      if (logo?.getAttribute("src")) {
        try {
          const response = await fetch(logo.src);
          const blob = await response.blob();
          const data = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(String(reader.result));
            reader.onerror = () => reject(reader.error);
            reader.readAsDataURL(blob);
          });
          pdf.addImage(data, blob.type.includes("png") ? "PNG" : "JPEG", MARGIN, y, 15, 15);
        } catch {
          /* logo is decorative; preserve report content if unavailable */
        }
      }
      const photoSrc = node.querySelector<HTMLImageElement>(".report-photo")?.src || "";
      if (photoSrc.startsWith("data:image/")) {
        try {
          pdf.addImage(photoSrc, photoSrc.includes("jpeg") ? "JPEG" : "PNG", MARGIN + CONTENT_W - 18, y, 15, 18);
        } catch {
          /* keep the text report complete when a cached photo is malformed */
        }
      }
      pdf.setTextColor(accent);
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(12);
      pdf.text(pdf.splitTextToSize(safe(h), CONTENT_W - 42) as string[], MARGIN + 19, y + 7);
      pdf.setDrawColor(ink);
      pdf.setLineWidth(0.6);
      pdf.line(MARGIN, y + 21, MARGIN + CONTENT_W, y + 21);
      y += 25;
      for (const p of Array.from(node.querySelectorAll("p"))) write(p.textContent?.trim() || "", MARGIN, CONTENT_W, 8);
    } else if (node.matches(".report-notice"))
      write(node.textContent?.trim() || "", MARGIN, CONTENT_W, 7, false, "#555555");
    else if (node.matches(".report-section")) {
      title(node.querySelector(":scope > h2")?.textContent?.trim() || "Report section");
      for (const child of Array.from(node.children)) {
        if (child.matches("h2")) continue;
        if (child.matches("h3")) {
          write(child.textContent?.trim() || "", MARGIN, CONTENT_W, 8, true, accent);
          continue;
        }
        if (child.matches(".report-summary")) {
          const items = Array.from(child.children).map(
            (item) =>
              `${item.querySelector("span")?.textContent?.trim() || ""}: ${item.querySelector("strong")?.textContent?.trim() || ""}`,
          );
          write(items.join("    |    "), MARGIN, CONTENT_W, 8, true);
        } else if (child.matches(".report-table-wrap")) {
          const table = child.querySelector("table");
          if (table) drawTable(table);
        } else if (child.matches("table")) drawTable(child);
        else if (child.matches(".mb-3,.mb-4")) {
          const heading = child.querySelector("h3");
          if (heading) write(heading.textContent?.trim() || "", MARGIN, CONTENT_W, 8, true, accent);
          const p = child.querySelector("p");
          if (p) write(p.textContent?.trim() || "");
          const table = child.querySelector("table");
          if (table) drawTable(table);
        } else if (child.matches("p,.report-empty")) write(child.textContent?.trim() || "", MARGIN, CONTENT_W, 7);
      }
    }
  }
  for (let i = 1; i <= page; i++) {
    pdf.setPage(i);
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(7);
    pdf.setTextColor(100);
    pdf.text(`AmazeCC Student Academic Report  |  Page ${i} of ${page}`, MARGIN, PAGE_H - 6);
  }
  const blob = pdf.output("blob");
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 2500);
}
