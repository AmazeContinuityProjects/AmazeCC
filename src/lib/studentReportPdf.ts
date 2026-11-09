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
        if (child.matches(".report-month")) {
          if (y > MARGIN + 2) newPage();
          const heading = child.querySelector("h3");
          if (heading) title(heading.textContent?.trim() || "Attendance month");
          for (const part of Array.from(child.children)) {
            if (part.matches("h3")) continue;
            if (part.matches(".report-summary")) {
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
        if (child.matches(".report-subject")) {
          if (y > MARGIN + 2) newPage();
          const heading = child.querySelector("h3");
          if (heading) title(heading.textContent?.trim() || "Subject dossier");
          for (const part of Array.from(child.children)) {
            if (part.matches("h3")) continue;
            if (part.matches("h4")) write(part.textContent?.trim() || "", MARGIN, CONTENT_W, 8, true, accent);
            else if (part.matches(".report-pie")) drawPieChart(part);
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
        if (child.matches(".report-summary")) {
          drawSummaryCards(child);
        } else if (child.matches(".report-curriculum-groups")) {
          for (const category of Array.from(child.querySelectorAll(":scope > .report-curriculum-category"))) {
            if (y > MARGIN + 2) newPage();
            const heading = category.querySelector(":scope > h3");
            if (heading) title(heading.textContent?.trim() || "Curriculum category");
            for (const basket of Array.from(category.querySelectorAll(":scope > .report-curriculum-basket"))) {
              const basketHeading = basket.querySelector("h4");
              if (basketHeading)
                write(basketHeading.textContent?.trim() || "Course basket", MARGIN, CONTENT_W, 8, true, accent);
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
          if (heading) write(heading.textContent?.trim() || "", MARGIN, CONTENT_W, 8, true, accent);
          const p = child.querySelector("p");
          if (p) write(p.textContent?.trim() || "");
          const courses = Array.from(child.querySelectorAll(":scope > .report-course"));
          if (courses.length) {
            for (const course of courses) {
              const courseHeading = course.querySelector("h4");
              if (courseHeading) write(courseHeading.textContent?.trim() || "", MARGIN, CONTENT_W, 7.5, true, accent);
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
