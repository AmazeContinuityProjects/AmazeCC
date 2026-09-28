import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

/**
 * Regression tests for the response guard.
 *
 * The bug: `apiRequest` does NOT throw on a non-2xx status. It only throws for
 * auth-flavoured bodies, so a
 * `404 { success: false, error: "handle_not_found" }` — which carries no
 * `message`, so `isAuthFailMessage(undefined)` is false — arrives as an ordinary
 * object. A caller that treated "did not throw" as "it worked" therefore showed
 * a green "handle found" for a handle nobody has.
 *
 * `fetch` is mocked so the real transport is bypassed and the exact body the
 * server sends is what gets tested.
 */
const fetchMock = vi.fn();

vi.mock("@/lib/sync-engine", () => ({
  api: (path: string, opts: { method?: string; body?: unknown }) =>
    fetchMock(path, { method: opts?.method, body: opts?.body }),
}));

import { SocialApiError, claimPair, lookupPerson, readPeerTimetable } from "../lib/social/client";

function respond(body: unknown) {
  fetchMock.mockResolvedValueOnce(body);
}

describe("a 404 handle_not_found is an error, not a person", () => {
  beforeEach(() => fetchMock.mockReset());
  afterEach(() => vi.restoreAllMocks());

  it("throws SocialApiError with the server's code", async () => {
    // Exactly what POST /api/social/people returns for an unknown handle.
    respond({ success: false, error: "handle_not_found" });
    await expect(lookupPerson("AMZ-ZZZZ-9999")).rejects.toBeInstanceOf(SocialApiError);
  });

  it("carries handle_not_found, not a generic failure", async () => {
    respond({ success: false, error: "handle_not_found" });
    await expect(lookupPerson("AMZ-ZZZZ-9999")).rejects.toMatchObject({
      code: "handle_not_found",
    });
  });

  it("keeps the server's detail when it sent one", async () => {
    respond({ success: false, error: "handle_not_found", detail: "No student with that handle" });
    await expect(lookupPerson("AMZ-ZZZZ-9999")).rejects.toMatchObject({
      code: "handle_not_found",
      detail: "No student with that handle",
    });
  });

  it("never resolves with a person-shaped object for a failed lookup", async () => {
    // The precise shape that made the sheet show green.
    respond({ success: false, error: "handle_not_found" });
    let resolved: unknown = null;
    try {
      resolved = await lookupPerson("AMZ-ZZZZ-9999");
    } catch {
      /* expected */
    }
    expect(resolved).toBeNull();
  });
});

describe("a body that is not the shape we asked for is an error", () => {
  beforeEach(() => fetchMock.mockReset());

  it("rejects a 200 that has no person field", async () => {
    // A proxy answering instead of the API. Without this, `res.person` is
    // undefined and the caller sees an empty "found" with no name.
    respond({ success: true });
    await expect(lookupPerson("AMZ-7K2P-9RTW")).rejects.toMatchObject({
      code: "unexpected_response",
    });
  });

  it("rejects an empty body", async () => {
    respond({});
    await expect(lookupPerson("AMZ-7K2P-9RTW")).rejects.toBeInstanceOf(SocialApiError);
  });

  it("names the route in the message so the cause is obvious", async () => {
    respond({});
    await expect(lookupPerson("AMZ-7K2P-9RTW")).rejects.toThrow(/person/i);
  });
});

describe("genuine successes still resolve", () => {
  beforeEach(() => fetchMock.mockReset());

  it("returns a person when the handle exists", async () => {
    respond({ success: true, person: { handle: "AMZ-7K2P-9RTW", displayName: "Neha", alreadyPaired: false } });
    const res = await lookupPerson("AMZ-7K2P-9RTW");
    expect(res.person.displayName).toBe("Neha");
    expect(res.person.alreadyPaired).toBe(false);
  });

  it("returns a claim with its secret", async () => {
    respond({ success: true, grantId: "gr_1", secret: "s".repeat(43), created: true, visibility: "coarse", peer: { handle: "AMZ-7K2P-9RTW", name: "Neha", lastPublishedAt: null, semesters: [] } });
    const res = await claimPair("AMZ-7K2P-9RTW");
    expect(res.grantId).toBe("gr_1");
    expect(res.secret).toHaveLength(43);
  });

  it("rejects a claim response with no secret rather than handing back a broken one", async () => {
    respond({ success: true, grantId: "gr_1" });
    await expect(claimPair("AMZ-7K2P-9RTW")).rejects.toMatchObject({ code: "unexpected_response" });
  });
});

describe("other social error codes surface", () => {
  beforeEach(() => fetchMock.mockReset());

  it("already_self is distinguishable", async () => {
    respond({ success: false, error: "already_self", detail: "That is your own handle" });
    await expect(claimPair("AMZ-AZ1V-CDJG")).rejects.toMatchObject({ code: "already_self" });
  });

  it("grant_invalid is distinguishable from a transport failure", async () => {
    respond({ success: false, error: "grant_invalid" });
    await expect(readPeerTimetable("nope", "AMZ-7K2P-9RTW")).rejects.toMatchObject({
      code: "grant_invalid",
    });
  });

  it("not_a_participant is distinguishable", async () => {
    respond({ success: false, error: "not_a_participant" });
    await expect(readPeerTimetable("s".repeat(43), "AMZ-ZZZZ-9999")).rejects.toMatchObject({
      code: "not_a_participant",
    });
  });
});
