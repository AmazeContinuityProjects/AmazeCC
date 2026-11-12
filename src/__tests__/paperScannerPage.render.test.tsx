import { installLocalStorage } from "./helpers/localStorage";
installLocalStorage();
import "fake-indexeddb/auto"; // the production IndexedDB adapter, against a real fake

import { Blob as NodeBlob } from "node:buffer";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import PaperScannerPage from "../components/custom/tools/scanner/PaperScannerPage";
import { createScanStore, resetScanStoreConnection } from "../lib/scanner/store";
import type { ScanMeta, ScanRecord } from "../lib/scanner/types";

/**
 * The scanner's library screen, end to end against the real store.
 *
 * jsdom never sees a camera here — the flow starts in the library state, which
 * is also the state every student returns to. What this proves is the half
 * that does not need hardware: the shell renders, the store bootstraps, a
 * seeded scan lists, opening one loads the full record into the detail sheet,
 * and settings persist through the same `saveScannerSettings` the pipeline
 * reads.
 *
 * fake-indexeddb's structured clone reduces jsdom's Blob to `{}` — Node's
 * Blob round-trips, same trade the store contract suite makes.
 */
vi.stubGlobal("Blob", NodeBlob);

vi.mock("../lib/scanner/rasterIO", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../lib/scanner/rasterIO")>();
  return {
    ...actual,
    decodeToRaster: vi.fn(async () => ({
      width: 400,
      height: 600,
      data: new Uint8ClampedArray(400 * 600 * 4).fill(255),
    })),
    rasterToDataUrl: vi.fn(() => "data:image/png;base64,fake"),
  };
});

const DB_NAME = "amazecc-paper-scanner";

function makeRecord(title = "Digital Electronics — Midterm"): ScanRecord {
  const meta: ScanMeta = {
    id: "scan-render-1",
    createdAt: 1_700_000_000_000,
    title,
    subjectCode: "BCSE204L",
    kind: "exam",
    kindConfidence: 0.92,
    pageCount: 2,
    sizeBytes: 48_000,
    quality: { score: 82, label: "clean" },
    exam: {
      category: "FAT",
      semester: "Winter Semester 2023-24",
      shortSemester: "Winter 2023-24",
      session: "May 2024",
      slot: "C1",
      classNbr: "5493",
      maxMarks: 100,
    },
    ocr: { engine: "tesseract", confidence: 81, preview: "MAXIMUM MARKS: 50" },
    upload: { status: "local" },
  };
  return {
    meta,
    pdf: new Blob(["%PDF-1.4"], { type: "application/pdf" }),
    ocrText: "MAXIMUM MARKS: 50\nSection A — answer all questions.",
  };
}

beforeEach(async () => {
  localStorage.clear();
  resetScanStoreConnection();
  // Fresh database per test: seeding in one test must not list in the next.
  await new Promise<void>((resolve) => {
    const req = indexedDB.deleteDatabase(DB_NAME);
    req.onsuccess = () => resolve();
    req.onerror = () => resolve();
    req.onblocked = () => resolve();
  });
});

afterEach(() => {
  cleanup();
  document.body.style.overflow = ""; // the sheet's scroll lock
});

describe("PaperScannerPage", () => {
  it("renders the shell, the primary actions, and an empty library", async () => {
    render(<PaperScannerPage />);

    expect(screen.getByRole("heading", { name: "Paper Scanner" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Scan paper" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "System Camera" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Import image" })).toBeTruthy();

    expect(await screen.findByText("No scans yet")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Scan your first paper" })).toBeTruthy();

    // IndexedDB is available here, so the session-storage warning stays hidden.
    expect(screen.queryByText("Session storage")).toBeNull();
  });

  it("lists a saved scan and opens it in the detail sheet", async () => {
    const store = await createScanStore();
    const record = makeRecord();
    await store.put(record);

    render(<PaperScannerPage />);

    // Row: title plus the subject/date/pages subtitle and exam badge.
    const row = await screen.findByRole("button", { name: /Digital Electronics/ });
    expect(row.textContent).toContain("BCSE204L");
    expect(row.textContent).toContain("FAT");
    expect(row.textContent).toContain("Winter 2023-24");
    expect(row.textContent).toContain("Slot C1");

    fireEvent.click(row);

    // The sheet carries the full record — PDF actions, text, upload state.
    expect(await screen.findByText("Download PDF")).toBeTruthy();
    expect(await screen.findByText("Extracted text")).toBeTruthy();
    expect(screen.getByText(/MAXIMUM MARKS: 50/)).toBeTruthy();
    expect(screen.getByText("On this device")).toBeTruthy();
    expect(screen.getAllByText(/FAT · Winter 2023-24/).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByDisplayValue("Winter Semester 2023-24")).toBeTruthy();
    expect(screen.getByDisplayValue("May 2024")).toBeTruthy();
    expect(screen.getByDisplayValue("C1")).toBeTruthy();
  });

  it("opens scanner settings and persists an engine change", async () => {
    render(<PaperScannerPage />);

    fireEvent.click(screen.getByRole("button", { name: "Scanner settings" }));

    expect(await screen.findByText("Text recognition")).toBeTruthy();
    // Segments carry a `title` that becomes their accessible name, so query
    // the visible labels directly.
    expect(screen.getByText("Local")).toBeTruthy();
    expect(screen.getByText("Cloud")).toBeTruthy();

    fireEvent.click(screen.getByText("Cloud"));

    // The same key the pipeline reads on the next scan.
    await waitFor(() => {
      expect(localStorage.getItem("paperScannerSettings")).toContain('"ocr.space"');
    });
    // Choosing cloud surfaces the key field it needs.
    expect(await screen.findByText("OCR API key")).toBeTruthy();
  });

  it("enters full-screen camera mode with framing guide and system camera option", async () => {
    render(<PaperScannerPage />);

    fireEvent.click(screen.getByRole("button", { name: "Scan paper" }));

    // Camera component is mounted in full-screen mode
    expect(await screen.findByText("Scan Page 1")).toBeTruthy();
    expect(screen.getByText("System Cam")).toBeTruthy();
    expect(screen.getByText("Gallery")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Capture page" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Close camera" })).toBeTruthy();

    // Closing camera returns to library
    fireEvent.click(screen.getByRole("button", { name: "Close camera" }));
    expect(await screen.findByRole("button", { name: "Scan paper" })).toBeTruthy();
  });

  it("imports image from gallery into editor and opens add page sheet", async () => {
    const { container } = render(<PaperScannerPage />);

    // Query hidden file input and fire change event with mock image file
    const fileInput = container.querySelector('input[type="file"][multiple]') as HTMLInputElement;
    expect(fileInput).toBeTruthy();

    const fakeFile = new File(["fake-image-bytes"], "document.jpg", { type: "image/jpeg" });
    fireEvent.change(fileInput, { target: { files: [fakeFile] } });

    // Enters full-screen editor
    expect(await screen.findByText("Crop & Align")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Add page" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Scan 1 page" })).toBeTruthy();
    expect(screen.getByText("90°")).toBeTruthy();

    // Clicking Add page opens the Add Document Page sheet
    fireEvent.click(screen.getByRole("button", { name: "Add page" }));
    expect(await screen.findByText("Add Document Page")).toBeTruthy();
    expect(screen.getByText("Live In-App Scanner")).toBeTruthy();
    expect(screen.getByText("System Camera / Scanner")).toBeTruthy();
    expect(screen.getByText("Photo Gallery / Files")).toBeTruthy();
  });
});
