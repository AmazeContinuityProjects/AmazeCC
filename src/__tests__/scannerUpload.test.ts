import { beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "../lib/sync-engine";
import { uploadScan, UploadError } from "../lib/scanner/upload";

/**
 * `api` is mocked at the sync-engine seam: the contract under test is what
 * upload.ts *builds and reads* (FormData fields, envelope parsing, failure
 * classification) — the transport beneath it is the sync layer's own suite.
 */
vi.mock("../lib/sync-engine", () => ({ api: vi.fn() }));

const apiMock = vi.mocked(api);

const rawResponse = (body: unknown, status = 200): Response =>
  ({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  }) as unknown as Response;

const successEnvelope = (file_url = "https://cdn.example/paper.pdf", thumbnail_url?: string) =>
  rawResponse({
    status: "success",
    data: { file_url, ...(thumbnail_url ? { thumbnail_url } : {}) },
    message: "Created",
  });

const pdf = (text = "pdf-bytes") => new Blob([text], { type: "application/pdf" });

beforeEach(() => {
  apiMock.mockReset();
});

/** Run and return whatever it rejected with, failing if it resolved. */
async function captureError(promise: Promise<unknown>): Promise<unknown> {
  return promise.then(
    () => {
      throw new Error("expected uploadScan to reject");
    },
    (e: unknown) => e,
  );
}

/** Like {@link captureError}, but also requiring the typed UploadError shape. */
async function expectUploadError(promise: Promise<unknown>): Promise<UploadError> {
  const error = await captureError(promise);
  expect(error).toBeInstanceOf(UploadError);
  return error as UploadError;
}

describe("scanner upload: request shape", () => {
  it("builds the reference backend's FormData exactly", async () => {
    apiMock.mockResolvedValue(successEnvelope());
    const thumbnail = new Blob(["thumb"], { type: "image/jpeg" });

    const result = await uploadScan(
      { pdf: pdf(), thumbnail, campus: "Vellore" },
      {
        endpoint: "https://backend.example/api/upload",
        filename: "Thermodynamics CAT-2.pdf",
      },
    );

    expect(result).toEqual({ url: "https://cdn.example/paper.pdf" });
    expect(apiMock).toHaveBeenCalledTimes(1);
    const [endpoint, opts] = apiMock.mock.calls[0] as [string, { method?: string; body?: FormData; parse?: string }];
    expect(endpoint).toBe("https://backend.example/api/upload");
    expect(opts.method).toBe("POST");
    expect(opts.parse).toBe("raw");

    const form = opts.body as FormData;
    const files = form.get("files") as File;
    expect(files.name).toBe("Thermodynamics CAT-2.pdf");
    expect(files.type).toBe("application/pdf");
    expect(form.get("isPdf")).toBe("true"); // the contract's string flag, not a bare bool
    expect(form.get("thumbnail")).toBeTruthy();
    expect(form.get("campus")).toBe("Vellore");
  });

  it("omits optional parts the backend treats as nullable", async () => {
    apiMock.mockResolvedValue(successEnvelope("https://cdn.example/x.pdf", "https://cdn.example/x.png"));

    const result = await uploadScan({ pdf: pdf() }, { endpoint: "https://backend.example/api/upload" });

    expect(result.thumbnailUrl).toBe("https://cdn.example/x.png");
    const form = (apiMock.mock.calls[0] as [string, { body: FormData }])[1].body;
    expect(form.get("thumbnail")).toBeNull();
    expect(form.get("campus")).toBeNull();
    expect((form.get("files") as File).name).toBe("scan.pdf");
  });

  it("refuses to call the network without an endpoint", async () => {
    const error = await expectUploadError(uploadScan({ pdf: pdf() }, { endpoint: "  " }));
    expect(error.message).toMatch(/stays on this device/);
    expect(error.retryable).toBe(false);
    expect(apiMock).not.toHaveBeenCalled();
  });

  it("refuses an empty PDF", async () => {
    const error = await expectUploadError(
      uploadScan({ pdf: new Blob([]) }, { endpoint: "https://backend.example/api/upload" }),
    );
    expect(error.message).toMatch(/PDF is empty/);
    expect(apiMock).not.toHaveBeenCalled();
  });
});

describe("scanner upload: failure classification", () => {
  const endpoint = "https://backend.example/api/upload";

  it("surfaces the server's own message on a rejection, without retrying", async () => {
    apiMock.mockResolvedValue(rawResponse({ status: "error", data: null, message: "No files received." }, 400));

    const error = await expectUploadError(uploadScan({ pdf: pdf() }, { endpoint }));
    expect(error.message).toContain("No files received.");
    expect(error.retryable).toBe(false); // a 400 will 400 again
  });

  it("treats a failure envelope on HTTP 200 as permanent", async () => {
    apiMock.mockResolvedValue(
      rawResponse({ status: "error", data: null, message: "GCS bucket rejected the write" }, 200),
    );

    const error = await expectUploadError(uploadScan({ pdf: pdf() }, { endpoint }));
    expect(error.message).toContain("GCS bucket rejected the write");
    expect(error.retryable).toBe(false);
  });

  it("retries on 5xx", async () => {
    apiMock.mockResolvedValue(rawResponse({ status: "error", message: "boom" }, 503));
    const error = await expectUploadError(uploadScan({ pdf: pdf() }, { endpoint }));
    expect(error.message).toBe("boom");
    expect(error.retryable).toBe(true);
  });

  it("retries on network failure", async () => {
    apiMock.mockRejectedValue(new TypeError("fetch failed"));
    const error = await expectUploadError(uploadScan({ pdf: pdf() }, { endpoint }));
    expect(error.message).toMatch(/check your connection/);
    expect(error.retryable).toBe(true);
  });

  it("retries on timeout", async () => {
    const timeout = new Error("operation timed out");
    timeout.name = "TimeoutError";
    apiMock.mockRejectedValue(timeout);
    const error = await expectUploadError(uploadScan({ pdf: pdf() }, { endpoint }));
    expect(error.message).toMatch(/timed out/);
    expect(error.retryable).toBe(true);
  });

  it("fails permanently when a success response carries no URL", async () => {
    apiMock.mockResolvedValue(rawResponse({ status: "success", data: {} }, 201));
    const error = await expectUploadError(uploadScan({ pdf: pdf() }, { endpoint }));
    expect(error.message).toMatch(/did not return a URL/);
    expect(error.retryable).toBe(false);
  });

  it("classifies an unreadable error response by status", async () => {
    apiMock.mockResolvedValue({
      ok: false,
      status: 502,
      json: async () => {
        throw new Error("<html>bad gateway</html>");
      },
    } as unknown as Response);

    const error = await expectUploadError(uploadScan({ pdf: pdf() }, { endpoint }));
    expect(error.message).toMatch(/could not read/);
    expect(error.retryable).toBe(true);
  });

  it("lets a cancellation propagate as itself", async () => {
    const controller = new AbortController();
    controller.abort();
    const abortError = new DOMException("The operation was aborted.", "AbortError");
    apiMock.mockRejectedValue(abortError);

    const error = await captureError(uploadScan({ pdf: pdf() }, { endpoint, signal: controller.signal }));
    expect(error).not.toBeInstanceOf(UploadError); // abort ≠ upload failure
    expect((error as { name: string }).name).toBe("AbortError");
  });
});
