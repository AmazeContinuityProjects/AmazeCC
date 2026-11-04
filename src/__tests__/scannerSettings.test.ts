import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  loadScannerSettings,
  saveScannerSettings,
  sanitizeScannerSettings,
  ScannerSettingsDefaults,
  SCANNER_SETTINGS_KEY,
  SETTINGS_REVISION,
} from "../lib/scanner/settings";

beforeEach(() => {
  localStorage.removeItem(SCANNER_SETTINGS_KEY);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("scanner settings: defaults", () => {
  it("returns frozen defaults when nothing is stored", () => {
    expect(loadScannerSettings()).toEqual(ScannerSettingsDefaults);
    expect(Object.isFrozen(ScannerSettingsDefaults)).toBe(true);
    expect(loadScannerSettings().revision).toBe(SETTINGS_REVISION);
  });

  it("falls back to defaults on corrupt storage instead of throwing", () => {
    localStorage.setItem(SCANNER_SETTINGS_KEY, "{not json");
    expect(loadScannerSettings()).toEqual(ScannerSettingsDefaults);

    localStorage.setItem(SCANNER_SETTINGS_KEY, JSON.stringify("just a string"));
    expect(loadScannerSettings()).toEqual(ScannerSettingsDefaults);
  });
});

describe("scanner settings: sanitize", () => {
  it("keeps every valid field", () => {
    const settings = sanitizeScannerSettings({
      ocrEngine: "auto",
      ocrApiKey: "  my-key  ",
      defaultCleanup: "bw",
      autoUpload: true,
      uploadEndpoint: "https://example.test/upload",
    });
    expect(settings).toEqual({
      revision: SETTINGS_REVISION,
      ocrEngine: "auto",
      ocrApiKey: "my-key", // pasted keys get their stray whitespace off
      defaultCleanup: "bw",
      autoUpload: true,
      uploadEndpoint: "https://example.test/upload",
    });
  });

  it("falls back per field — one bad value must not reset the others", () => {
    const settings = sanitizeScannerSettings({
      revision: 999, // future stamp: coerced back to current, nothing else moves
      ocrEngine: "some-new-engine",
      ocrApiKey: "kept-key",
      defaultCleanup: "sepia",
      autoUpload: "yes", // wrong type
      uploadEndpoint: 42, // wrong type
    });
    expect(settings).toEqual({ ...ScannerSettingsDefaults, ocrApiKey: "kept-key" });
  });

  it("stamps the current revision even on pre-revision records", () => {
    expect(sanitizeScannerSettings({}).revision).toBe(SETTINGS_REVISION);
    expect(sanitizeScannerSettings({ revision: 0 }).revision).toBe(SETTINGS_REVISION);
    expect(sanitizeScannerSettings(null).revision).toBe(SETTINGS_REVISION);
  });
});

describe("scanner settings: save / load", () => {
  it("merges a patch into the stored record and persists it", () => {
    saveScannerSettings({ ocrEngine: "auto", ocrApiKey: "k1" });
    const next = saveScannerSettings({ autoUpload: true });

    expect(next).toMatchObject({ ocrEngine: "auto", ocrApiKey: "k1", autoUpload: true });
    expect(loadScannerSettings()).toEqual(next);
    expect(JSON.parse(localStorage.getItem(SCANNER_SETTINGS_KEY) ?? "{}")).toEqual(next);
  });

  it("round-trips through storage unchanged", () => {
    const saved = saveScannerSettings({ defaultCleanup: "grayscale", uploadEndpoint: "https://up.example/scans" });
    expect(loadScannerSettings()).toEqual(saved);
  });

  it("keeps the session's settings when the write is refused", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("QuotaExceededError");
    });

    const next = saveScannerSettings({ ocrEngine: "ocr.space" });
    expect(next.ocrEngine).toBe("ocr.space"); // returned as if written…
    expect(loadScannerSettings()).toEqual(ScannerSettingsDefaults); // …but storage is untouched, no throw
  });

  it("reads defaults when localStorage itself is forbidden", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("SecurityError");
    });
    expect(loadScannerSettings()).toEqual(ScannerSettingsDefaults);
  });
});
