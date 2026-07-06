import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  PRIMARY_API_URL,
  BACKUP_API_URL,
  getActiveApiUrl,
  setActiveApiUrl,
  rewriteUrlIfNeeded,
  fetchWithFailover,
  setOriginalFetchForTest
} from "../lib/fetch-utils";

describe("API Failover Mechanism", () => {
  let originalFetch: typeof fetch;

  beforeEach(() => {
    originalFetch = window.fetch;
    setActiveApiUrl(PRIMARY_API_URL);
    if (typeof window !== "undefined" && window.localStorage) {
      window.localStorage.clear();
    }
  });

  afterEach(() => {
    window.fetch = originalFetch;
    setOriginalFetchForTest(originalFetch);
    vi.restoreAllMocks();
  });

  it("should initialize activeApiUrl to PRIMARY_API_URL", () => {
    expect(getActiveApiUrl()).toBe(PRIMARY_API_URL);
  });

  it("should allow getting and setting active API URL", () => {
    setActiveApiUrl(BACKUP_API_URL);
    expect(getActiveApiUrl()).toBe(BACKUP_API_URL);
    if (typeof window !== "undefined" && window.localStorage) {
      expect(window.localStorage.getItem("amazecc_active_api_url")).toBe(BACKUP_API_URL);
    }

    setActiveApiUrl(PRIMARY_API_URL);
    expect(getActiveApiUrl()).toBe(PRIMARY_API_URL);
    if (typeof window !== "undefined" && window.localStorage) {
      expect(window.localStorage.getItem("amazecc_active_api_url")).toBe(PRIMARY_API_URL);
    }
  });

  it("should rewrite URLs correctly depending on activeApiUrl status", () => {
    setActiveApiUrl(PRIMARY_API_URL);
    expect(rewriteUrlIfNeeded(`${PRIMARY_API_URL}/api/test`)).toBe(`${PRIMARY_API_URL}/api/test`);

    setActiveApiUrl(BACKUP_API_URL);
    expect(rewriteUrlIfNeeded(`${PRIMARY_API_URL}/api/test`)).toBe(`${BACKUP_API_URL}/api/test`);
  });

  it("should transparently resolve requests if primary is working", async () => {
    const mockResponse = new Response(JSON.stringify({ data: "success" }), { status: 200 });
    const mockFetch = vi.fn().mockResolvedValue(mockResponse);
    setOriginalFetchForTest(mockFetch);

    const res = await fetchWithFailover(`${PRIMARY_API_URL}/api/data`);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(mockFetch).toHaveBeenCalledWith(`${PRIMARY_API_URL}/api/data`, undefined);

    const json = await res.json();
    expect(json.data).toBe("success");
    expect(getActiveApiUrl()).toBe(PRIMARY_API_URL);
  });

  it("should automatically retry with backup API if primary fails", async () => {
    const mockResponseBackup = new Response(JSON.stringify({ data: "backup_success" }), { status: 200 });
    const mockFetch = vi.fn()
      .mockRejectedValueOnce(new TypeError("Failed to fetch (blocked)"))
      .mockResolvedValueOnce(mockResponseBackup);

    setOriginalFetchForTest(mockFetch);

    const res = await fetchWithFailover(`${PRIMARY_API_URL}/api/data`);
    expect(mockFetch).toHaveBeenCalledTimes(2);
    expect(mockFetch).toHaveBeenNthCalledWith(1, `${PRIMARY_API_URL}/api/data`, undefined);
    expect(mockFetch).toHaveBeenNthCalledWith(2, `${BACKUP_API_URL}/api/data`, undefined);

    const json = await res.json();
    expect(json.data).toBe("backup_success");
    expect(getActiveApiUrl()).toBe(BACKUP_API_URL);
  });

  it("should rewrite subsequent requests once failover has occurred", async () => {
    setActiveApiUrl(BACKUP_API_URL);

    const mockResponse = new Response(JSON.stringify({ data: "backup_direct" }), { status: 200 });
    const mockFetch = vi.fn().mockResolvedValue(mockResponse);
    setOriginalFetchForTest(mockFetch);

    const res = await fetchWithFailover(`${PRIMARY_API_URL}/api/data`);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(mockFetch).toHaveBeenCalledWith(`${BACKUP_API_URL}/api/data`, undefined);

    const json = await res.json();
    expect(json.data).toBe("backup_direct");
  });
});
