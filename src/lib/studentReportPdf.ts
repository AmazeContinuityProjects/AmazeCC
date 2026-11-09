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
  const sectionPages = new Map<string, number>();
  const sectionTops = new Map<string, number>();
  const pendingLinks: Array<{ x: number; y: number; w: number; h: number; target: string }> = [];
  const indexHeadings = Array.from(root.querySelectorAll<HTMLElement>("h2, h3, h4"))
    .filter((heading) => !heading.closest(".report-index, .report-chart, .report-cover"))
    .filter((heading) => !(heading.matches("h3") && heading.closest(".report-overview-calendar")))
    .filter((heading) => {
      const divider = heading.closest(".report-divider");
      if (!divider || heading.tagName !== "H2") return true;
      const nextSection = divider.nextElementSibling?.matches(".report-section")
        ? divider.nextElementSibling.querySelector(":scope > h2")
        : null;
      const normalize = (value: string) => value.replace(/\s+/g, " ").trim().toLocaleLowerCase();
      return normalize(heading.textContent || "") !== normalize(nextSection?.textContent || "");
    });
  indexHeadings.forEach((heading, index) => {
    if (!heading.id) heading.id = `pdf-report-heading-${index + 1}`;
  });
  const pendingIndexRows: Array<{
    page: number;
    x: number;
    y: number;
    w: number;
    h: number;
    target: string;
    number: string;
  }> = [];
  const markHeading = (heading: Element | null, top = y) => {
    if (!heading?.id) return;
    sectionPages.set(heading.id, page);
    sectionTops.set(heading.id, top);
  };

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
    pdf.text(safe(value), PAGE_W / 2, y + (main ? 6 : 4.8), { align: "center" });
    y += main ? 12 : 10;
  };
  const subheading = (value: string, size = 8) => {
    y += 4;
    write(value, MARGIN, CONTENT_W, size, true, accent);
    y += 2;
  };
  const drawSummaryCards = (container: Element) => {
    const cards = Array.from(container.children).map((item) => ({
      label: item.querySelector("span")?.textContent?.trim() || "",
      value: item.querySelector("strong")?.textContent?.trim() || "—",
    }));
    if (!cards.length) return;
    const columns = Math.min(4, cards.length);
    const gap = 2;
    const width = (CONTENT_W - gap * (columns - 1)) / columns;
    for (let offset = 0; offset < cards.length; offset += columns) {
      const row = cards.slice(offset, offset + columns);
      const rowHeight = row.length > 2 ? 19 : 20;
      room(rowHeight + 2);
      row.forEach((card, index) => {
        const x = MARGIN + index * (width + gap);
        pdf.setFillColor(band);
        pdf.setDrawColor(155);
        pdf.setLineWidth(0.25);
        pdf.rect(x, y, width, rowHeight, "FD");
        pdf.setDrawColor(accent);
        pdf.setLineWidth(0.8);
        pdf.line(x, y, x + width, y);
        pdf.setTextColor(accent);
        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(10);
        const valueLines = pdf.splitTextToSize(safe(card.value), width - 3) as string[];
        pdf.text(valueLines.slice(0, 1), x + 1.5, y + 7);
        pdf.setTextColor(ink);
        pdf.setFont("helvetica", "normal");
        pdf.setFontSize(5.2);
        const labelLines = pdf.splitTextToSize(safe(card.label.toUpperCase()), width - 3) as string[];
        pdf.text(labelLines.slice(0, 2), x + 1.5, y + 12, { lineHeightFactor: 1.05 });
      });
      y += rowHeight + 2;
    }
  };
  const drawFacultyCard = (card: Element, photoData: string) => {
    const name = card.querySelector(".report-faculty-card-copy strong")?.textContent?.trim() || "Faculty";
    const detail = Array.from(card.querySelectorAll(".report-faculty-card-copy span"))
      .map((item) => item.textContent?.trim())
      .filter(Boolean);
    const recommendation = card.querySelector(".report-faculty-card-stat strong")?.textContent?.trim() || "—";
    const height = 25;
    room(height + 2);
    pdf.setFillColor(band);
    pdf.setDrawColor(155);
    pdf.setLineWidth(0.3);
    pdf.rect(MARGIN, y, CONTENT_W, height, "FD");
    pdf.setDrawColor(accent);
    pdf.setLineWidth(1.2);
    pdf.line(MARGIN, y, MARGIN, y + height);
    const hasPhoto = Boolean(photoData);
    if (hasPhoto) {
      try {
        pdf.addImage(photoData, photoData.includes("jpeg") ? "JPEG" : "PNG", MARGIN + 3, y + 2, 15, 21);
      } catch {
        /* portrait is optional */
      }
    }
    const textX = MARGIN + (hasPhoto ? 21 : 4);
    const maxW = CONTENT_W - (hasPhoto ? 48 : 31);
    pdf.setTextColor(accent);
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(9);
    pdf.text(pdf.splitTextToSize(safe(name), maxW) as string[], textX, y + 7);
    pdf.setTextColor(ink);
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(6.5);
    pdf.text(pdf.splitTextToSize(safe(detail.join("  |  ")), maxW) as string[], textX, y + 13);
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(9);
    pdf.text(safe(recommendation), MARGIN + CONTENT_W - 25, y + 9);
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(5.2);
    pdf.text("RECOMMENDATION", MARGIN + CONTENT_W - 25, y + 14);
    y += height + 3;
  };
  const drawThemeGroup = (group: Element) => {
    const heading = group.querySelector(":scope > strong")?.textContent?.trim() || "Review themes";
    const themes = Array.from(group.querySelectorAll(".report-theme-pill"));
    const critical = group.classList.contains("critical");
    if (!themes.length) return;
    write(heading, MARGIN, CONTENT_W, 7, true, accent);
    let x = MARGIN;
    for (const theme of themes) {
      const pillText = `${safe(theme.childNodes[0]?.textContent?.trim() || "")} (${safe(theme.querySelector("b")?.textContent?.trim() || "")})`;
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(6.1);
      const width = Math.min(CONTENT_W, pdf.getTextWidth(pillText) + 6);
      if (x + width > MARGIN + CONTENT_W) {
        y += 9;
        x = MARGIN;
      }
      room(9);
      pdf.setFillColor(
        critical ? (grayscale ? 238 : 255) : grayscale ? 242 : 239,
        critical ? (grayscale ? 220 : 239) : grayscale ? 242 : 247,
        critical ? (grayscale ? 220 : 237) : grayscale ? 242 : 243,
      );
      pdf.setDrawColor(critical ? (grayscale ? 180 : 224) : 200);
      pdf.roundedRect(x, y, width, 7, 3, 3, "FD");
      pdf.setTextColor(critical && !grayscale ? "#842c20" : ink);
      pdf.text(pillText, x + 3, y + 4.6);
      x += width + 2;
    }
    y += 10;
  };
  const drawCalendarMonth = (month: Element) => {
    const heading = month.querySelector(":scope > h3");
    const headingTop = y;
    write(heading?.textContent?.trim() || "Academic calendar", MARGIN, CONTENT_W, 8, true, accent);
    markHeading(heading, headingTop);
    const weekdays = Array.from(month.querySelectorAll(".report-calendar-weekday"));
    const days = Array.from(month.querySelectorAll(".report-calendar-day:not(.empty)"));
    if (!days.length) return;
    const cells = Array.from({ length: 42 }, () => ({ date: "", events: "", tint: "" }));
    const offset = month.querySelectorAll(".report-calendar-day.empty").length;
    for (const day of days) {
      const number = Number(day.querySelector("strong")?.textContent || 0);
      if (number > 0 && number <= 31)
        cells[offset + number - 1] = {
          date: String(number),
          events: Array.from(day.querySelectorAll("span"))
            .map((item) => item.textContent?.trim())
            .filter(Boolean)
            .join("; "),
          tint: day.classList.contains("has-absence")
            ? "absence"
            : day.classList.contains("on-duty")
              ? "od"
              : day.classList.contains("all-present")
                ? "present"
                : "",
        };
    }
    const colW = CONTENT_W / 7;
    const cellH = 15;
    room(6 * cellH + 8);
    for (let col = 0; col < 7; col++) {
      const x = MARGIN + col * colW;
      pdf.setFillColor(band);
      pdf.setDrawColor(205);
      pdf.rect(x, y, colW, 5, "FD");
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(5.5);
      pdf.setTextColor(accent);
      pdf.text(weekdays[col]?.textContent?.trim() || "", x + 1, y + 3.4);
    }
    y += 5;
    for (let week = 0; week < 6; week++) {
      for (let col = 0; col < 7; col++) {
        const x = MARGIN + col * colW;
        const cell = cells[week * 7 + col];
        const tint =
          cell.tint === "absence"
            ? grayscale
              ? [246, 228, 228]
              : [255, 235, 231]
            : cell.tint === "od"
              ? grayscale
                ? [230, 235, 240]
                : [232, 242, 251]
              : cell.tint === "present"
                ? grayscale
                  ? [234, 240, 234]
                  : [233, 246, 237]
                : cell.date
                  ? [255, 255, 255]
                  : [249, 250, 253];
        pdf.setFillColor(...(tint as [number, number, number]));
        pdf.setDrawColor(grayscale ? 215 : 220, grayscale ? 215 : 229, grayscale ? 215 : 239);
        pdf.setLineWidth(0.15);
        pdf.rect(x, y, colW, cellH, "FD");
        if (cell.date) {
          pdf.setTextColor(accent);
          pdf.setFont("helvetica", "bold");
          pdf.setFontSize(6);
          pdf.text(cell.date, x + 1, y + 3);
          pdf.setTextColor(ink);
          pdf.setFont("helvetica", "normal");
          pdf.setFontSize(4.1);
          pdf.text((pdf.splitTextToSize(safe(cell.events), colW - 2) as string[]).slice(0, 4), x + 1, y + 6, {
            lineHeightFactor: 1.05,
          });
        }
      }
      y += cellH;
    }
    y += 4;
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
      pdf.setLineWidth(0.18);
      headers.forEach((header, i) => {
        pdf.setFillColor(grayscale ? 237 : 235, grayscale ? 237 : 241, grayscale ? 237 : 248);
        pdf.setDrawColor(grayscale ? 195 : 205, grayscale ? 195 : 216, grayscale ? 195 : 229);
        pdf.rect(x, y, widths[i], 7, "FD");
        pdf.setTextColor(ink);
        pdf.text(pdf.splitTextToSize(safe(header), widths[i] - 2) as string[], x + 1, y + 2.7);
        x += widths[i];
      });
      y += 7;
    };
    drawHeader();
    for (const [rowIndex, row] of bodyRows.entries()) {
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
      pdf.setDrawColor(grayscale ? 205 : 215, grayscale ? 205 : 225, grayscale ? 205 : 236);
      pdf.setLineWidth(0.15);
      pdf.setTextColor(ink);
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(6.2);
      headers.forEach((_, i) => {
        if (rowIndex % 2 === 1) {
          pdf.setFillColor(grayscale ? 249 : 248, grayscale ? 249 : 250, grayscale ? 249 : 253);
          pdf.rect(x, y, widths[i], height, "F");
        }
        pdf.rect(x, y, widths[i], height);
        pdf.text(wrapped[i], x + 1, y + 2.8, { lineHeightFactor: 1.05 });
        x += widths[i];
      });
      y += height;
    }
    y += 2;
  };

  const drawBarChart = (chart: Element) => {
    const items = Array.from(chart.querySelectorAll<HTMLElement>(".report-bar-item"));
    if (!items.length) return;
    room(43);
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(7.5);
    pdf.setTextColor(accent);
    pdf.text(safe(chart.querySelector("h4")?.textContent?.trim() || "Attendance trend"), MARGIN, y + 3);
    y += 6;
    const top = y;
    const height = 25;
    const base = top + height;
    const slot = CONTENT_W / items.length;
    const gap = 0.7;
    const barW = Math.max(0.65, Math.min(2.2, (slot - gap) / 2));
    const max = Math.max(
      1,
      ...items.map((item) => Math.max(Number(item.dataset.value) || 0, Number(item.dataset.absent) || 0)),
    );
    pdf.setDrawColor(150);
    pdf.line(MARGIN, base, MARGIN + CONTENT_W, base);
    items.forEach((item, index) => {
      const x = MARGIN + index * slot + (slot - barW * 2 - gap) / 2;
      const present = Number(item.dataset.value) || 0;
      const absent = Number(item.dataset.absent) || 0;
      pdf.setFillColor(grayscale ? 75 : 45, grayscale ? 75 : 106, grayscale ? 75 : 159);
      if (present) pdf.rect(x, base - (present / max) * height, barW, (present / max) * height, "F");
      pdf.setFillColor(grayscale ? 165 : 197, grayscale ? 165 : 84, grayscale ? 165 : 84);
      if (absent) pdf.rect(x + barW + gap, base - (absent / max) * height, barW, (absent / max) * height, "F");
      if (items.length <= 16 || index % 2 === 0) {
        pdf.setFont("helvetica", "normal");
        pdf.setFontSize(items.length > 22 ? 3.5 : 4.2);
        pdf.setTextColor(ink);
        pdf.text(safe(item.dataset.label || ""), x - 0.4, base + 3.5);
      }
    });
    y = base + 7;
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(5.5);
    pdf.setTextColor(ink);
    pdf.setFillColor(grayscale ? 75 : 45, grayscale ? 75 : 106, grayscale ? 75 : 159);
    pdf.rect(MARGIN, y, 2, 2, "F");
    pdf.text("Present sessions", MARGIN + 3, y + 1.8);
    pdf.setFillColor(grayscale ? 165 : 197, grayscale ? 165 : 84, grayscale ? 165 : 84);
    pdf.rect(MARGIN + 29, y, 2, 2, "F");
    pdf.text("Absent sessions", MARGIN + 32, y + 1.8);
    y += 5;
  };

  const drawPieChart = (chart: Element) => {
    const slices = Array.from(chart.querySelectorAll<HTMLElement>(".report-pie-disc > i"))
      .map((item) => ({
        label: item.dataset.label || "",
        value: Math.max(0, Number(item.dataset.value) || 0),
        color: item.dataset.color || "#777777",
      }))
      .filter((item) => item.value > 0);
    const total = slices.reduce((sum, item) => sum + item.value, 0);
    if (!total) return;
    room(43);
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(7.5);
    pdf.setTextColor(accent);
    pdf.text(safe(chart.querySelector("h4")?.textContent?.trim() || "Distribution"), MARGIN, y + 3);
    const cx = MARGIN + 19,
      cy = y + 25,
      radius = 14;
    let start = -Math.PI / 2;
    for (const slice of slices) {
      const end = start + (slice.value / total) * Math.PI * 2;
      const hex = slice.color.match(/^#([\da-f]{2})([\da-f]{2})([\da-f]{2})$/i);
      const rgb = hex ? hex.slice(1).map((value) => parseInt(value, 16)) : [100, 100, 100];
      const gray = Math.round(rgb.reduce((a, b) => a + b, 0) / 3);
      pdf.setFillColor(...((grayscale ? [gray, gray, gray] : rgb) as [number, number, number]));
      const steps = Math.max(1, Math.ceil((end - start) * 48));
      for (let step = 0; step < steps; step++) {
        const a = start + ((end - start) * step) / steps;
        const b = start + ((end - start) * (step + 1)) / steps;
        pdf.triangle(
          cx,
          cy,
          cx + radius * Math.cos(a),
          cy + radius * Math.sin(a),
          cx + radius * Math.cos(b),
          cy + radius * Math.sin(b),
          "F",
        );
      }
      start = end;
    }
    pdf.setFillColor(255, 255, 255);
    pdf.circle(cx, cy, 6, "F");
    const legend = Array.from(chart.querySelectorAll(".report-chart-legend span"));
    let ly = y + 15;
    for (const item of legend) {
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(6.5);
      pdf.setTextColor(ink);
      const color = item.querySelector("i") as HTMLElement | null;
      const hex = color?.style.backgroundColor.match(/\d+/g)?.map(Number);
      if (hex?.length === 3) pdf.setFillColor(...(hex as [number, number, number]));
      else pdf.setFillColor(120, 120, 120);
      pdf.rect(MARGIN + 39, ly - 2, 2.2, 2.2, "F");
      const text = item.textContent?.trim() || "";
      const lines = pdf.splitTextToSize(safe(text), CONTENT_W - 43) as string[];
      pdf.text(lines, MARGIN + 43, ly);
      ly += Math.max(4, lines.length * 2.8 + 1);
    }
    y += Math.max(42, ly - y + 2);
  };

  for (const node of Array.from(root.children)) {
    if (node.matches(".report-divider")) {
      newPage();
      if (node.id) sectionPages.set(node.id, page);
      pdf.setFillColor(grayscale ? 244 : 239, grayscale ? 244 : 245, grayscale ? 244 : 251);
      pdf.rect(0, 0, PAGE_W, PAGE_H, "F");
      pdf.setFillColor(grayscale ? 229 : 229, grayscale ? 229 : 239, grayscale ? 229 : 247);
      pdf.circle(36, 76, 31, "F");
      pdf.setFillColor(grayscale ? 236 : 246, grayscale ? 236 : 225, grayscale ? 236 : 190);
      pdf.circle(177, 200, 22, "F");
      // Build the divider waves from filled ellipses and rectangles. jsPDF's
      // `lines` expects a path-segment format that these relative point pairs
      // do not satisfy, and rejects the document during export.
      pdf.setFillColor(grayscale ? 225 : 222, grayscale ? 225 : 239, grayscale ? 225 : 235);
      for (let x = -12, i = 0; x < PAGE_W + 12; x += 12, i += 1) {
        pdf.ellipse(x, 240 + (i % 2 === 0 ? -2 : 2), 8, 8, "F");
      }
      pdf.rect(0, 246, PAGE_W, PAGE_H - 246, "F");
      pdf.setFillColor(grayscale ? 238 : 249, grayscale ? 238 : 223, grayscale ? 238 : 183);
      for (let x = -12, i = 0; x < PAGE_W + 12; x += 12, i += 1) {
        pdf.ellipse(x, 255 + (i % 2 === 0 ? 2 : -2), 8, 7, "F");
      }
      pdf.rect(0, 260, PAGE_W, PAGE_H - 260, "F");
      pdf.setDrawColor(grayscale ? 190 : 195, grayscale ? 190 : 213, grayscale ? 190 : 230);
      pdf.setLineWidth(0.5);
      pdf.setDrawColor(grayscale ? 190 : 195, grayscale ? 190 : 213, grayscale ? 190 : 230);
      pdf.roundedRect(MARGIN, 68, CONTENT_W, 144, 8, 8, "S");
      pdf.setTextColor(accent);
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(8);
      pdf.text(safe(node.querySelector("span")?.textContent?.trim() || "AMAZECC STUDENT RECORD"), PAGE_W / 2, 125, {
        align: "center",
      });
      pdf.setFontSize(22);
      pdf.text(
        pdf.splitTextToSize(
          safe(node.querySelector("h2")?.textContent?.trim() || "Historical academic report"),
          CONTENT_W - 20,
        ) as string[],
        PAGE_W / 2,
        145,
        { align: "center" },
      );
      markHeading(node.querySelector(":scope > h2"), 139);
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(9);
      pdf.setTextColor(90);
      pdf.text(
        pdf.splitTextToSize(safe(node.querySelector("p")?.textContent?.trim() || ""), CONTENT_W - 30) as string[],
        PAGE_W / 2,
        160,
        { align: "center" },
      );
      newPage();
      continue;
    }
    if (node.matches("header.report-cover")) {
      const h = node.querySelector("h1")?.textContent?.trim() || "Student Academic Report";
      const paper = grayscale ? [247, 247, 247] : [246, 249, 253];
      pdf.setFillColor(...(paper as [number, number, number]));
      pdf.rect(0, 0, PAGE_W, PAGE_H, "F");
      pdf.setFillColor(grayscale ? 220 : 230, grayscale ? 220 : 239, grayscale ? 220 : 249);
      pdf.circle(157, 74, 46, "F");
      pdf.setFillColor(grayscale ? 205 : 235, grayscale ? 205 : 206, grayscale ? 205 : 226);
      pdf.circle(177, 189, 26, "F");
      pdf.setFillColor(grayscale ? 230 : 248, grayscale ? 230 : 219, grayscale ? 230 : 174);
      pdf.circle(43, 226, 19, "F");
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
          const image = pdf.getImageProperties(data);
          const maxWidth = 22;
          const maxHeight = 13;
          const scale = Math.min(maxWidth / image.width, maxHeight / image.height);
          const width = image.width * scale;
          const height = image.height * scale;
          pdf.addImage(
            data,
            blob.type.includes("png") ? "PNG" : "JPEG",
            MARGIN + 2 + (maxWidth - width) / 2,
            19 + (maxHeight - height) / 2,
            width,
            height,
          );
        } catch {
          /* logo is decorative; preserve report content if unavailable */
        }
      }
      const photoSrc = node.querySelector<HTMLImageElement>(".report-photo")?.src || "";
      if (photoSrc.startsWith("data:image/")) {
        try {
          pdf.setFillColor(255, 255, 255);
          pdf.roundedRect(150, 80, 36, 45, 5, 5, "F");
          pdf.addImage(photoSrc, photoSrc.includes("jpeg") ? "JPEG" : "PNG", 153, 83, 30, 39);
        } catch {
          /* keep the text report complete when a cached photo is malformed */
        }
      }
      const copy = node.querySelector(".report-cover-copy");
      const paragraphs = Array.from(copy?.querySelectorAll("p") || []).map((p) => p.textContent?.trim() || "");
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(29);
      const titleLines = pdf.splitTextToSize(safe(h), 119) as string[];
      const titleY = 92;
      pdf.setFontSize(12);
      const nameLines = pdf.splitTextToSize(safe(paragraphs[1] || "Student"), 115) as string[];
      const nameY = titleY + Math.max(0, titleLines.length - 1) * 12 + 18;
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(9);
      const profileLines = pdf.splitTextToSize(safe(paragraphs[2] || ""), 115) as string[];
      const profileY = nameY + Math.max(8, nameLines.length * 5.5);
      const chipY = Math.max(145, profileY + profileLines.length * 5.2 + 4);
      pdf.setTextColor(accent);
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(29);
      pdf.text(titleLines, MARGIN + 3, titleY, { lineHeightFactor: 1.15 });
      pdf.setFontSize(12);
      pdf.setTextColor(ink);
      pdf.text(nameLines, MARGIN + 3, nameY, { lineHeightFactor: 1.15 });
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(9);
      pdf.setTextColor(90);
      pdf.text(profileLines, MARGIN + 3, profileY, { lineHeightFactor: 1.15 });
      const chips = Array.from(node.querySelectorAll(".report-cover-chips span"));
      let chipX = MARGIN + 3;
      for (const chip of chips) {
        const label = safe(chip.textContent?.trim() || "");
        const chipW = Math.min(44, pdf.getTextWidth(label) + 8);
        pdf.setFillColor(grayscale ? 235 : 255, grayscale ? 235 : 255, grayscale ? 235 : 255);
        pdf.setDrawColor(grayscale ? 190 : 204, grayscale ? 190 : 218, grayscale ? 190 : 235);
        pdf.roundedRect(chipX, chipY, chipW, 9, 4, 4, "FD");
        pdf.setTextColor(accent);
        pdf.setFontSize(6.5);
        pdf.text(label, chipX + 4, chipY + 6);
        chipX += chipW + 3;
      }
      pdf.setFontSize(8);
      pdf.setTextColor(90);
      pdf.text(pdf.splitTextToSize(safe(paragraphs[3] || ""), 145) as string[], MARGIN + 3, chipY + 23);
      y = PAGE_H - 18;
      newPage();
    } else if (node.matches(".report-index")) {
      title(node.querySelector("h2")?.textContent?.trim() || "Inside your report", true);
      let sectionNo = 0;
      let subsectionNo = 0;
      let subsubsectionNo = 0;
      for (const heading of indexHeadings) {
        const depth = Number(heading.tagName.slice(1)) - 2;
        if (depth === 0) {
          sectionNo += 1;
          subsectionNo = 0;
          subsubsectionNo = 0;
        } else if (depth === 1) {
          subsectionNo += 1;
          subsubsectionNo = 0;
        } else {
          subsubsectionNo += 1;
        }
        const number =
          depth === 0
            ? String(sectionNo).padStart(2, "0")
            : depth === 1
              ? `${String(sectionNo).padStart(2, "0")}.${String(subsectionNo).padStart(2, "0")}`
              : `${String(sectionNo).padStart(2, "0")}.${String(subsectionNo).padStart(2, "0")}.${String(subsubsectionNo).padStart(2, "0")}`;
        const left = MARGIN + depth * 5;
        const rowW = CONTENT_W - depth * 5;
        const labelW = rowW - 26;
        const size = depth === 0 ? 7 : depth === 1 ? 6.2 : 5.5;
        pdf.setFont("helvetica", depth === 0 ? "bold" : "normal");
        pdf.setFontSize(size);
        const labelLines = pdf.splitTextToSize(
          safe(heading.textContent?.trim() || "Untitled section"),
          labelW - 12,
        ) as string[];
        const rowH = Math.max(depth === 0 ? 8 : 6.5, labelLines.length * size * 0.43 + 2.5);
        room(rowH + 1);
        const rowY = y;
        if (depth === 0) pdf.setFillColor(band);
        else pdf.setFillColor(grayscale ? 250 : 250, grayscale ? 250 : 252, grayscale ? 250 : 255);
        pdf.setDrawColor(grayscale ? 218 : 228, grayscale ? 218 : 234, grayscale ? 218 : 241);
        pdf.setLineWidth(0.18);
        pdf.roundedRect(left, rowY, rowW, rowH, 1.5, 1.5, "FD");
        pdf.setTextColor(accent);
        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(depth === 0 ? 6.8 : 5.4);
        pdf.text(number, left + 2, rowY + rowH * 0.62);
        pdf.setTextColor(ink);
        pdf.setFont("helvetica", depth === 0 ? "bold" : "normal");
        pdf.setFontSize(size);
        pdf.text(labelLines, left + 14, rowY + Math.max(4, rowH * 0.62));
        y += rowH + 1;
        pendingIndexRows.push({ page, x: left, y: rowY, w: rowW, h: rowH, target: heading.id, number });
      }
      newPage();
    } else if (node.matches(".report-notice"))
      write(node.textContent?.trim() || "", MARGIN, CONTENT_W, 7, false, "#555555");
    else if (node.matches(".report-section")) {
      if (
        (node.classList.contains("report-curriculum-section") ||
          node.classList.contains("report-grade-history-section") ||
          node.classList.contains("report-page-start")) &&
        y > MARGIN + 2
      )
        newPage();
      const sectionHeading = node.querySelector(":scope > h2");
      title(sectionHeading?.textContent?.trim() || "Report section");
      markHeading(sectionHeading, y - 12);
      if (node.id) sectionPages.set(node.id, page);
      for (const child of Array.from(node.children)) {
        if (child.matches("h2")) continue;
        if (child.matches("h3")) {
          subheading(child.textContent?.trim() || "", 8);
          markHeading(child, y - 8);
          continue;
        }
        if (child.matches(".report-month")) {
          if (y > MARGIN + 2) newPage();
          const heading = child.querySelector("h3");
          if (heading) title(heading.textContent?.trim() || "Attendance month");
          markHeading(heading, y - 12);
          if (child.id) sectionPages.set(child.id, page);
          for (const part of Array.from(child.children)) {
            if (part.matches("h3")) continue;
            if (part.matches(".report-calendar")) {
              drawCalendarMonth(child);
            } else if (part.matches(".report-summary")) {
              drawSummaryCards(part);
            } else if (part.matches(".report-pie")) drawPieChart(part);
            else if (part.matches(".report-chart")) drawBarChart(part);
            else if (part.matches(".report-table-wrap")) {
              const table = part.querySelector("table");
              if (table) drawTable(table);
            }
          }
          continue;
        }
        if (child.matches(".report-overview-calendar")) {
          for (const month of Array.from(child.querySelectorAll(":scope > .report-calendar-month")))
            drawCalendarMonth(month);
          continue;
        }
        if (child.matches(".report-subject")) {
          if (y > MARGIN + 2) newPage();
          const heading = child.querySelector("h3");
          if (heading) title(heading.textContent?.trim() || "Subject dossier");
          markHeading(heading, y - 12);
          if (child.id) sectionPages.set(child.id, page);
          for (const part of Array.from(child.children)) {
            if (part.id) sectionPages.set(part.id, page);
            if (part.matches("h3")) continue;
            if (part.matches("h4")) {
              subheading(part.textContent?.trim() || "", 8);
              markHeading(part, y - 8);
            } else if (part.matches(".report-pie")) drawPieChart(part);
            else if (part.matches(".report-chart")) drawBarChart(part);
            else if (part.matches(".report-summary")) {
              drawSummaryCards(part);
            } else if (part.matches(".report-faculty-card")) {
              const photo = part.querySelector<HTMLImageElement>("img")?.src || "";
              let photoData = photo.startsWith("data:image/") ? photo : "";
              if (photo && !photoData) {
                try {
                  const response = await fetch(photo);
                  if (response.ok) {
                    const blob = await response.blob();
                    photoData = await new Promise<string>((resolve, reject) => {
                      const reader = new FileReader();
                      reader.onload = () => resolve(String(reader.result));
                      reader.onerror = () => reject(reader.error);
                      reader.readAsDataURL(blob);
                    });
                  }
                } catch {
                  /* remote portraits may disallow cross-origin export */
                }
              }
              drawFacultyCard(part, photoData);
            } else if (part.matches(".report-education-list")) {
              for (const education of Array.from(part.querySelectorAll(".report-education-card"))) {
                const lines = Array.from(education.querySelectorAll("strong,span"))
                  .map((item) => item.textContent?.trim())
                  .filter(Boolean);
                room(18);
                pdf.setFillColor(band);
                pdf.setDrawColor(grayscale ? 205 : 213, grayscale ? 205 : 222, grayscale ? 205 : 235);
                pdf.roundedRect(MARGIN, y, CONTENT_W, 16, 2, 2, "FD");
                pdf.setFont("helvetica", "bold");
                pdf.setFontSize(7);
                pdf.setTextColor(accent);
                pdf.text(safe(lines[0] || "Education"), MARGIN + 3, y + 5);
                pdf.setFont("helvetica", "normal");
                pdf.setFontSize(5.8);
                pdf.setTextColor(ink);
                pdf.text(
                  pdf.splitTextToSize(safe(lines.slice(1).join(" · ")), CONTENT_W - 6) as string[],
                  MARGIN + 3,
                  y + 10,
                );
                y += 18;
              }
            } else if (part.matches(".report-theme-group")) {
              drawThemeGroup(part);
            } else if (part.matches(".report-table-wrap")) {
              const table = part.querySelector("table");
              if (table) drawTable(table);
            } else if (part.matches("p,.report-empty")) write(part.textContent?.trim() || "", MARGIN, CONTENT_W, 7);
          }
          continue;
        }
        if (child.matches(".report-chart")) {
          if (child.matches(".report-pie")) drawPieChart(child);
          else drawBarChart(child);
          continue;
        }
        if (child.matches(".report-calendar-month")) {
          drawCalendarMonth(child);
          continue;
        }
        if (child.matches(".report-summary")) {
          drawSummaryCards(child);
        } else if (child.matches(".report-curriculum-groups")) {
          for (const category of Array.from(child.querySelectorAll(":scope > .report-curriculum-category"))) {
            if (y > MARGIN + 2) newPage();
            const heading = category.querySelector(":scope > h3");
            if (heading) title(heading.textContent?.trim() || "Curriculum category");
            markHeading(heading, y - 12);
            const basketsOverview = Array.from(category.querySelectorAll(":scope > .report-basket-index span"));
            if (basketsOverview.length) {
              write(
                `Baskets: ${basketsOverview
                  .map((item) => item.textContent?.trim())
                  .filter(Boolean)
                  .join(" · ")}`,
                MARGIN,
                CONTENT_W,
                6.5,
                true,
                accent,
              );
            }
            for (const basket of Array.from(category.querySelectorAll(":scope > .report-curriculum-basket"))) {
              const basketHeading = basket.querySelector("h4");
              if (basketHeading) {
                subheading(basketHeading.textContent?.trim() || "Course basket", 8);
                markHeading(basketHeading, y - 8);
              }
              const table = basket.querySelector("table");
              if (table) drawTable(table);
            }
          }
        } else if (child.matches(".report-table-wrap")) {
          const table = child.querySelector("table");
          if (table) drawTable(table);
        } else if (child.matches("table")) drawTable(child);
        else if (child.matches(".mb-3,.mb-4")) {
          const heading = child.querySelector("h3");
          if (heading) subheading(heading.textContent?.trim() || "", 8);
          markHeading(heading, y - 8);
          if (child.id) sectionPages.set(child.id, page);
          const p = child.querySelector("p");
          if (p) write(p.textContent?.trim() || "");
          const courses = Array.from(child.querySelectorAll(":scope > .report-course"));
          if (courses.length) {
            for (const course of courses) {
              const courseHeading = course.querySelector("h4");
              if (courseHeading) {
                subheading(courseHeading.textContent?.trim() || "", 7.5);
                markHeading(courseHeading, y - 8);
              }
              const gradeCards = Array.from(course.querySelectorAll(":scope > .report-grade-cards > div")).map(
                (card) => ({
                  label: card.querySelector("span")?.textContent?.trim() || "",
                  value: card.querySelector("strong")?.textContent?.trim() || "—",
                }),
              );
              if (gradeCards.length) {
                const gap = 2;
                const cardW = (CONTENT_W - gap * (gradeCards.length - 1)) / gradeCards.length;
                room(20);
                gradeCards.forEach((card, index) => {
                  const x = MARGIN + index * (cardW + gap);
                  pdf.setFillColor(band);
                  pdf.setDrawColor(grayscale ? 205 : 213, grayscale ? 205 : 222, grayscale ? 205 : 235);
                  pdf.roundedRect(x, y, cardW, 18, 2, 2, "FD");
                  pdf.setFont("helvetica", "bold");
                  pdf.setFontSize(7);
                  pdf.setTextColor(accent);
                  pdf.text(pdf.splitTextToSize(safe(card.value), cardW - 3) as string[], x + 1.5, y + 7);
                  pdf.setFont("helvetica", "normal");
                  pdf.setFontSize(4.8);
                  pdf.setTextColor(ink);
                  pdf.text(safe(card.label.toUpperCase()), x + 1.5, y + 13);
                });
                y += 20;
              }
              const courseSummary = course.querySelector("p");
              if (courseSummary) write(courseSummary.textContent?.trim() || "", MARGIN, CONTENT_W, 6.5);
              const courseTable = course.querySelector("table");
              if (courseTable) drawTable(courseTable);
            }
          } else {
            const table = child.querySelector("table");
            if (table) drawTable(table);
          }
        } else if (child.matches("p,.report-empty")) write(child.textContent?.trim() || "", MARGIN, CONTENT_W, 7);
      }
    }
  }
  for (const row of pendingIndexRows) {
    const targetPage = sectionPages.get(row.target);
    if (!targetPage) continue;
    pdf.setPage(row.page);
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(6);
    pdf.setTextColor(accent);
    pdf.text(String(targetPage), row.x + row.w - 3, row.y + row.h * 0.62, { align: "right" });
    pdf.link(row.x, row.y, row.w, row.h, {
      pageNumber: targetPage,
      top: Math.max(MARGIN, Math.min(BOTTOM, sectionTops.get(row.target) ?? MARGIN)),
    });
  }
  for (const link of pendingLinks) {
    const targetPage = sectionPages.get(link.target);
    if (targetPage)
      pdf.link(link.x, link.y, link.w, link.h, {
        pageNumber: targetPage,
        top: Math.max(MARGIN, Math.min(BOTTOM, sectionTops.get(link.target) ?? MARGIN)),
      });
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
