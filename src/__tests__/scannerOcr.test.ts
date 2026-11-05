import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { OcrUnavailableError, runOcr } from "../lib/scanner/ocr";

/**
 * tesseract.js is mocked at the module seam: the worker's wasm + CDN download
 * has no place in a unit test, and the interop shim in `ocr.ts` (named export
 * vs `default`) is exactly what the mock exercises.
 */
const mocks = vi.hoisted(() => ({
  recognize: vi.fn(),
  terminate: vi.fn(),
  createWorker: vi.fn(),
}));

vi.mock("tesseract.js", () => ({ createWorker: mocks.createWorker }));

const page = (text: string, confidence: number) => ({ data: { text, confidence } });
const png = (tag: string) => new Blob([tag], { type: "image/png" });

const jsonResponse = (body: unknown, status = 200): Response =>
  ({ ok: status >= 200 && status < 300, status, json: async () => body }) as unknown as Response;

afterEach(() => {
  vi.unstubAllGlobals();
});

beforeEach(() => {
  mocks.createWorker.mockReset();
  mocks.recognize.mockReset();
  mocks.terminate.mockReset();
  mocks.terminate.mockResolvedValue(undefined);
  mocks.createWorker.mockImplementation(async () => ({ recognize: mocks.recognize, terminate: mocks.terminate }));
});

describe("scanner ocr: on-device engine", () => {
  it("reads every page in order and reports a mean confidence", async () => {
    mocks.recognize.mockResolvedValueOnce(page("MAXIMUM MARKS: 50", 80)).mockResolvedValueOnce(page("Section A", 60));
    const progress: Array<[number, number]> = [];

    const result = await runOcr([png("a"), png("b")], { onProgress: (done, total) => progress.push([done, total]) });

    expect(result).toEqual({
      engine: "tesseract",
      text: "MAXIMUM MARKS: 50\n\nSection A",
      confidence: 70,
      pages: 2,
    });
    expect(mocks.createWorker).toHaveBeenCalledWith("eng");
    expect(mocks.recognize).toHaveBeenCalledTimes(2);
    expect(mocks.terminate).toHaveBeenCalledTimes(1);
    expect(progress).toEqual([
      [1, 2],
      [2, 2],
    ]);
  });

  it("fails typed when the engine cannot start (offline, first use)", async () => {
    mocks.createWorker.mockRejectedValue(new TypeError("fetch failed"));
    const error = await runOcr([png("a")]).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(OcrUnavailableError);
    expect(error).toMatchObject({ name: "OcrUnavailableError", engine: "tesseract" });
    expect((error as Error).message).toMatch(/check your connection/);
  });

  it("fails typed when a page cannot be read, and still stops the worker", async () => {
    mocks.recognize.mockRejectedValue(new Error("wasm exploded"));
    const error = await runOcr([png("a")]).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(OcrUnavailableError);
    expect((error as Error).message).toMatch(/stopped while reading/);
    expect(mocks.terminate).toHaveBeenCalledTimes(1);
  });

  it("stays local in explicit tesseract mode even when a key exists", async () => {
    mocks.createWorker.mockRejectedValue(new TypeError("fetch failed"));
    vi.stubGlobal(
      "fetch",
      vi.fn(() => {
        throw new Error("the API must not be called in explicit tesseract mode");
      }),
    );

    const error = await runOcr([png("a")], { engine: "tesseract", apiKey: "k" }).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(OcrUnavailableError);
    expect((error as OcrUnavailableError).engine).toBe("tesseract");
    expect(fetch).not.toHaveBeenCalled();
  });

  it("honours a pre-aborted signal without starting the engine", async () => {
    const controller = new AbortController();
    controller.abort();

    await expect(runOcr([png("a")], { signal: controller.signal })).rejects.toThrow(/abort/i);
    expect(mocks.createWorker).not.toHaveBeenCalled();
  });

  it("aborts between pages without relabelling the abort as an engine failure", async () => {
    const controller = new AbortController();
    mocks.recognize.mockResolvedValueOnce(page("first", 70));
    const error = await runOcr([png("a"), png("b")], {
      signal: controller.signal,
      onProgress: () => controller.abort(),
    }).catch((e: unknown) => e);

    // jsdom's AbortSignal throws its own realm's DOMException — the name is
    // the contract, not the class identity.
    expect(error).toMatchObject({ name: "AbortError" });
    expect(mocks.recognize).toHaveBeenCalledTimes(1);
    expect(mocks.terminate).toHaveBeenCalledTimes(1); // the worker is still cleaned up
  });
});

describe("scanner ocr: cloud engine", () => {
  const okBody = (text: string) => ({
    ParsedResults: [{ ParsedText: text }],
    OCRExitCode: 1,
    IsErroredOnProcessing: false,
  });

  it("fails typed when cloud OCR is chosen without a key", async () => {
    const error = await runOcr([png("a")], { engine: "ocr.space" }).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(OcrUnavailableError);
    expect((error as Error).message).toMatch(/API key/);
    expect(mocks.createWorker).not.toHaveBeenCalled();
  });

  it("posts each page with the fields OCR.space expects and joins the text", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(okBody("MAXIMUM MARKS: 50")))
      .mockResolvedValueOnce(jsonResponse(okBody("Section A")));
    vi.stubGlobal("fetch", fetchMock);
    const controller = new AbortController();

    const result = await runOcr([png("a"), png("b")], {
      engine: "ocr.space",
      apiKey: "test-key",
      signal: controller.signal,
    });

    expect(result).toEqual({
      engine: "ocr.space",
      text: "MAXIMUM MARKS: 50\n\nSection A",
      confidence: null, // the API reports none — null, never a made-up number
      pages: 2,
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.ocr.space/parse/image");
    expect(init.method).toBe("POST");
    expect(init.signal).toBe(controller.signal);
    const form = init.body as FormData;
    expect(form.get("apikey")).toBe("test-key");
    expect(form.get("language")).toBe("eng");
    expect(form.get("isOverlayRequired")).toBe("false");
    expect((form.get("file") as File).name).toBe("page-1.png");
    const secondForm = (fetchMock.mock.calls[1] as [string, RequestInit])[1].body as FormData;
    expect((secondForm.get("file") as File).name).toBe("page-2.png");
    expect(mocks.createWorker).not.toHaveBeenCalled();
  });

  it("surfaces the API's own explanation for a rejected request", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({ ErrorMessage: "Invalid API key" }, 403)));

    const error = await runOcr([png("a")], { engine: "ocr.space", apiKey: "bad" }).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(OcrUnavailableError);
    expect((error as OcrUnavailableError).engine).toBe("ocr.space");
    expect((error as Error).message).toContain("Invalid API key");
  });

  it("surfaces the API's explanation when processing fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        jsonResponse({
          ParsedResults: [{ ParsedText: "", ErrorMessage: "File too blurry" }],
          OCRExitCode: 0,
          IsErroredOnProcessing: true,
        }),
      ),
    );

    const error = await runOcr([png("a")], { engine: "ocr.space", apiKey: "k" }).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(OcrUnavailableError);
    expect((error as Error).message).toMatch(/File too blurry/);
  });

  it("fails typed when the service answers with something unreadable", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => {
          throw new Error("<html>gateway error</html>");
        },
      } as unknown as Response),
    );

    const error = await runOcr([png("a")], { engine: "ocr.space", apiKey: "k" }).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(OcrUnavailableError);
    expect((error as Error).message).toMatch(/could not read/);
  });

  it("fails typed when the network is gone", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("fetch failed")));

    const error = await runOcr([png("a")], { engine: "ocr.space", apiKey: "k" }).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(OcrUnavailableError);
    expect((error as Error).message).toMatch(/check your connection/);
  });
});

describe("scanner ocr: auto mode", () => {
  it("falls back to the API only when the local engine cannot start", async () => {
    mocks.createWorker.mockRejectedValue(new TypeError("fetch failed"));
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          jsonResponse({ ParsedResults: [{ ParsedText: "rescued" }], OCRExitCode: 1, IsErroredOnProcessing: false }),
        ),
    );

    const result = await runOcr([png("a")], { engine: "auto", apiKey: "k" });
    expect(result.engine).toBe("ocr.space");
    expect(result.text).toBe("rescued");
  });

  it("surfaces the local failure when there is no key to fall back to", async () => {
    mocks.createWorker.mockRejectedValue(new TypeError("fetch failed"));

    const error = await runOcr([png("a")], { engine: "auto" }).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(OcrUnavailableError);
    expect((error as OcrUnavailableError).engine).toBe("tesseract");
  });

  it("prefers the local engine while it works", async () => {
    mocks.recognize.mockResolvedValue(page("local text", 88));
    vi.stubGlobal(
      "fetch",
      vi.fn(() => {
        throw new Error("the API must not be spent while local OCR works");
      }),
    );

    const result = await runOcr([png("a")], { engine: "auto", apiKey: "k" });
    expect(result.engine).toBe("tesseract");
  });
});

describe("scanner ocr: input guard", () => {
  it("refuses an empty page list", async () => {
    await expect(runOcr([])).rejects.toThrow(/no images/);
  });
});
