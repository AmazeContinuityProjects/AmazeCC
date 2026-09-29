/**
 * The Event Hub action helper.
 *
 * A 1-Click Register that fails used to be indistinguishable from one that
 * never ran: `apiRequest` hands back the parsed body for any HTTP status, and
 * the register handler branched only on `data.status`, so a `400` from
 * `/api/events/register` matched no branch and the button just stopped
 * spinning. The only trace was a line in the browser console.
 *
 * So the three properties that make a failed action visible are pinned here:
 *   1. the cached session is actually sent, so the routes can report a dead
 *      one instead of the client spending a fresh login per button press
 *   2. `reauthenticate` costs exactly one retry
 *   3. an `error` body throws, whatever the HTTP status behind it was
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

/** `apiRequest` is the only thing faked; the credential manager stays real. */
const apiRequestMock = vi.fn();
vi.mock("../lib/sync-engine/request-layer", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../lib/sync-engine/request-layer")>();
  return { ...actual, apiRequest: (...args: unknown[]) => apiRequestMock(...args) };
});

const clearEventHubMock = vi.fn();
vi.mock("../lib/sync-engine/credential-manager", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../lib/sync-engine/credential-manager")>();
  return {
    ...actual,
    credentialManager: {
      ...actual.credentialManager,
      ensureEventHubSession: vi.fn(async () => "JSESSION-FRESH"),
      clearEventHub: () => clearEventHubMock(),
    },
  };
});

const { eventHubRequest, EventHubError } = await import("../lib/sync-engine/index");

const IDS = { VtopUsername: "25BCE1234", VtopPassword: "secret" };

/** The body actually put on the wire by the most recent call. */
const sentBody = () => apiRequestMock.mock.calls.at(-1)?.[1]?.body as Record<string, unknown>;
const sentOpts = () => apiRequestMock.mock.calls.at(-1)?.[1] as Record<string, unknown>;

beforeEach(() => {
  apiRequestMock.mockReset();
  clearEventHubMock.mockReset();
});

describe("eventHubRequest", () => {
  it("sends the cached session, not a fresh login", async () => {
    apiRequestMock.mockResolvedValue({ status: "success", message: "ok" });

    await eventHubRequest(IDS, "events/register", { eid: "E1" });

    // Without this the route falls back to a full username/password login on
    // every button press.
    expect(sentBody()).toMatchObject({ eid: "E1", jsessionid: "JSESSION-FRESH" });
  });

  it("does not ask the request layer to attach a second session", async () => {
    apiRequestMock.mockResolvedValue({ status: "success" });
    await eventHubRequest(IDS, "events/register", { eid: "E1" });
    expect(sentOpts().auth).toBe("none");
  });

  it("throws on an error body — the case a 400 used to swallow", async () => {
    // Exactly what /api/events/register sends when Event Hub rejects the
    // upstream registration.
    apiRequestMock.mockResolvedValue({ error: "Registration failed with status 500" });

    await expect(eventHubRequest(IDS, "events/register", { eid: "E1" })).rejects.toThrow(
      /Registration failed with status 500/
    );
  });

  it("carries the route's reason so a caller can tell the two failures apart", async () => {
    apiRequestMock.mockResolvedValue({
      error: "Event Hub session expired. Log in again to refresh it.",
      reason: "session_expired",
    });

    const err = await eventHubRequest(IDS, "events/register", { eid: "E1" }).catch((e) => e);
    expect(err).toBeInstanceOf(EventHubError);
    expect(err.reason).toBe("session_expired");
  });

  it("retries exactly once on a dead session, after discarding it", async () => {
    apiRequestMock
      .mockResolvedValueOnce({ error: "expired", reauthenticate: true })
      .mockResolvedValueOnce({ status: "success" });

    const res = await eventHubRequest(IDS, "events/register", { eid: "E1" });

    expect(res).toEqual({ status: "success" });
    expect(clearEventHubMock).toHaveBeenCalledTimes(1);
    expect(apiRequestMock).toHaveBeenCalledTimes(2);
  });

  it("gives up after one retry rather than looping on a session that keeps dying", async () => {
    apiRequestMock.mockResolvedValue({ error: "expired", reauthenticate: true });

    await expect(eventHubRequest(IDS, "events/register", { eid: "E1" })).rejects.toThrow(/expired/);
    expect(apiRequestMock).toHaveBeenCalledTimes(2);
  });

  it("passes a normal outcome through untouched", async () => {
    // `already_registered` is a 200 with a `status` and no `error`; treating it
    // as a failure would be its own bug.
    apiRequestMock.mockResolvedValue({ status: "already_registered", message: "nope" });
    await expect(eventHubRequest(IDS, "events/register", { eid: "E1" })).resolves.toEqual({
      status: "already_registered",
      message: "nope",
    });
    expect(clearEventHubMock).not.toHaveBeenCalled();
  });

  it("skips the session round trip entirely in demo mode", async () => {
    apiRequestMock.mockResolvedValue({ status: "success" });
    await eventHubRequest({ ...IDS, VtopUsername: "demo" }, "events/register", { eid: "E1" });
    expect(sentBody()).toMatchObject({ eid: "E1" });
    expect(sentBody().jsessionid).toBeUndefined();
  });
});
