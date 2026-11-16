import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../lib/dpop", () => ({ dpopProof: vi.fn() }));
vi.mock("../lib/oauth2", () => ({ getAccessTokenSync: vi.fn(() => "test-access-token") }));

import { dpopProof } from "../lib/dpop";
import {
  BACKUP_API_URL,
  fetchWithFailover,
  getActiveApiUrl,
  PRIMARY_API_URL,
  setActiveApiUrl,
  setOriginalFetchForTest,
} from "../lib/fetch-utils";

const mockDpopProof = vi.mocked(dpopProof);

describe("Amaze ID DPoP API requests", () => {
  beforeEach(() => {
    setActiveApiUrl(PRIMARY_API_URL);
    mockDpopProof.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("sends a proof with the DPoP-bound access token", async () => {
    mockDpopProof.mockResolvedValue("signed-proof");
    const mockFetch = vi.fn(
      async (_input: RequestInfo | URL, _init?: RequestInit) => new Response("{}", { status: 200 }),
    );
    setOriginalFetchForTest(mockFetch as unknown as typeof fetch);

    await fetchWithFailover(`${PRIMARY_API_URL}/api/cabshare/auth`, { method: "POST" });

    const requestHeaders = new Headers(mockFetch.mock.calls[0]?.[1]?.headers);
    expect(requestHeaders.get("Authorization")).toBe("DPoP test-access-token");
    expect(requestHeaders.get("DPoP")).toBe("signed-proof");
  });

  it("does not send an access token when proof generation fails", async () => {
    mockDpopProof.mockRejectedValue(new Error("key cannot sign"));
    const mockFetch = vi.fn(
      async (_input: RequestInfo | URL, _init?: RequestInit) => new Response("{}", { status: 200 }),
    );
    setOriginalFetchForTest(mockFetch as unknown as typeof fetch);

    await expect(fetchWithFailover(`${PRIMARY_API_URL}/api/cabshare/auth`, { method: "POST" })).rejects.toThrow(
      "Could not create an Amaze ID DPoP proof: key cannot sign",
    );
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("pins DPoP requests to the primary when the backup is active", async () => {
    setActiveApiUrl(BACKUP_API_URL);
    mockDpopProof.mockResolvedValue("signed-proof");
    const mockFetch = vi.fn(
      async (_input: RequestInfo | URL, _init?: RequestInit) => new Response("{}", { status: 200 }),
    );
    setOriginalFetchForTest(mockFetch as unknown as typeof fetch);

    await fetchWithFailover(`${PRIMARY_API_URL}/api/cabshare/hubs`);

    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(mockFetch.mock.calls[0]?.[0]).toBe(`${PRIMARY_API_URL}/api/cabshare/hubs`);
    expect(getActiveApiUrl()).toBe(PRIMARY_API_URL);
  });

  it("does not fail over DPoP requests to the legacy backup", async () => {
    mockDpopProof.mockResolvedValue("signed-proof");
    const mockFetch = vi.fn(
      async (_input: RequestInfo | URL, _init?: RequestInit) => new Response("{}", { status: 500 }),
    );
    setOriginalFetchForTest(mockFetch as unknown as typeof fetch);

    await expect(fetchWithFailover(`${PRIMARY_API_URL}/api/cabshare/hubs`)).rejects.toThrow("Server error 500");
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });
});
