/**
 * Upload adapter — local first, network later.
 *
 * Speaks the exact contract of the reference backend
 * (CodeChefVIT/papers-codechef `POST /api/upload`):
 *
 *   FormData: `files` (the PDF), `isPdf` = `"true"`, optional `thumbnail`,
 *             optional `campus`
 *   Response: `{ status: "success", data: { file_url, thumbnail_url } }`
 *             or `{ status: "error", message }`
 *
 * Sending *this* contract is deliberate: pointing at a deployed reference
 * backend works unchanged, and a future first-party backend has a proven
 * shape to implement. The endpoint itself is not shipped — see
 * `ScannerSettings.uploadEndpoint`; a guessed URL would fail at the worst
 * moment, right after a scan the student cannot re-take.
 *
 * Failures are classified, because the upload queue decides from it:
 * connection/timeout/5xx/429 are {@link UploadError.retryable} (try again),
 * a 4xx or a server rejection is not (the message says what to change).
 * A scan is already safe in IndexedDB before any of this runs — an upload
 * failure never loses data, it only delays it.
 */

import { api } from "../sync-engine";

export interface UploadScanInput {
  /** The generated PDF. */
  pdf: Blob;
  /** Small preview image — the catalogue shows it in lists when present. */
  thumbnail?: Blob;
  /** Campus label the receiving side expects (reference enum: Vellore, Chennai, …). */
  campus?: string;
}

export interface UploadScanOptions {
  /** Absolute endpoint accepting the contract above. Empty means "not configured". */
  endpoint: string;
  /** Filename for the PDF part — the paper's title makes archives findable. */
  filename?: string;
  signal?: AbortSignal;
  /** Generous: a phone on mobile data pushing megabytes. Defaults to 120s. */
  timeoutMs?: number;
}

export interface UploadScanResult {
  /** Where the backend stored the PDF. */
  url: string;
  /** The backend's own thumbnail URL, when it made one. */
  thumbnailUrl?: string;
}

/** Upload failed; `retryable` says whether the queue should try again. */
export class UploadError extends Error {
  readonly retryable: boolean;
  constructor(message: string, retryable: boolean, cause?: unknown) {
    super(message, cause === undefined ? undefined : { cause });
    this.name = "UploadError";
    this.retryable = retryable;
  }
}

/** Server said no — retrying the same bytes against the same backend won't help. */
const retryableStatus = (status: number): boolean => status >= 500 || status === 429;

interface UploadEnvelope {
  status?: unknown;
  message?: unknown;
  data?: { file_url?: unknown; thumbnail_url?: unknown } | null;
  file_url?: unknown; // accepted too: a bare success body is still a success
}

/** Read a string field defensively — this JSON crossed a network we do not own. */
const asOptionalString = (value: unknown): string | undefined =>
  typeof value === "string" && value ? value : undefined;

export async function uploadScan(input: UploadScanInput, options: UploadScanOptions): Promise<UploadScanResult> {
  const endpoint = options.endpoint.trim();
  if (!endpoint) {
    throw new UploadError("No upload endpoint is configured — this scan stays on this device.", false);
  }
  if (!input.pdf || input.pdf.size === 0) {
    throw new UploadError("Nothing to upload — the PDF is empty.", false);
  }

  const form = new FormData();
  form.append("files", input.pdf, options.filename ?? "scan.pdf");
  form.append("isPdf", "true");
  if (input.thumbnail) form.append("thumbnail", input.thumbnail, "thumbnail.jpg");
  if (input.campus) form.append("campus", input.campus);

  let response: Response;
  try {
    response = (await api(endpoint, {
      method: "POST",
      body: form,
      parse: "raw",
      signal: options.signal,
      timeoutMs: options.timeoutMs ?? 120_000,
    })) as Response;
  } catch (err) {
    if (options.signal?.aborted) throw err; // cancellation is intent, not failure
    if (err instanceof Error && err.name === "TimeoutError") {
      throw new UploadError("Upload timed out — the connection was too slow to finish.", true, err);
    }
    throw new UploadError("Upload could not reach the server — check your connection.", true, err);
  }

  let body: UploadEnvelope;
  try {
    body = (await response.json()) as UploadEnvelope;
  } catch (err) {
    throw new UploadError(
      `Upload failed (HTTP ${response.status}) with a response the app could not read.`,
      retryableStatus(response.status),
      err,
    );
  }

  const envelope: UploadEnvelope = body && typeof body === "object" ? body : {};
  const url = asOptionalString(envelope.data?.file_url) ?? asOptionalString(envelope.file_url);
  const serverMessage = asOptionalString(envelope.message);

  if (!response.ok || envelope.status === "error") {
    throw new UploadError(
      serverMessage ?? `Upload failed (HTTP ${response.status}).`,
      retryableStatus(response.status),
    );
  }
  if (!url) {
    throw new UploadError("The server accepted the file but did not return a URL for it.", false);
  }

  const thumbnailUrl = asOptionalString(envelope.data?.thumbnail_url);
  return { url, ...(thumbnailUrl ? { thumbnailUrl } : {}) };
}
