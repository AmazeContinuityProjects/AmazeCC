import { beforeEach, describe, expect, it, vi } from "vitest";

const apiMock = vi.fn();
const ensureMock = vi.fn();
vi.mock("@/lib/sync-engine/request-layer", () => ({
  apiRequest: (path: string, opts: unknown) => apiMock(path, opts),
}));
vi.mock("@/lib/sync-engine/credential-manager", () => ({
  credentialManager: { ensureVtopSession: (opts: unknown) => ensureMock(opts) },
}));

import { AuthError } from "../lib/sync-engine/errors";
import { callClassmates, classmatesSemester, ClassmatesError, displayName } from "../lib/ffcsClassmates";

describe("classmatesSemester", () => {
  it("only maps the upcoming winter list (CH20262705)", () => {
    expect(classmatesSemester("winter-2026-2027")).toBe("CH20262705");
    expect(classmatesSemester("fall-2026-2027")).toBeNull();
    expect(classmatesSemester("winter-2026-2027-mock")).toBeNull();
    expect(classmatesSemester("codechef-vit")).toBeNull();
  });
});

describe("displayName", () => {
  it("title-cases VTOP's capitals", () => {
    expect(displayName("MOHAMMED ANAS")).toBe("Mohammed Anas");
    expect(displayName("RAMAN K.S")).toBe("Raman K.S");
    expect(displayName("")).toBe("");
    expect(displayName("ETHNUS (APT)")).toBe("Ethnus (APT)");
  });
});

describe("callClassmates", () => {
  beforeEach(() => {
    apiMock.mockReset();
    ensureMock.mockReset();
    ensureMock.mockResolvedValue({ cookies: ["x"], authorizedID: "A", csrf: "c", fetchedAt: Date.now() });
  });

  it("makes sure a VTOP session exists before calling the API", async () => {
    apiMock.mockResolvedValueOnce({ success: true, me: {}, sections: [], overlaps: [] });
    await callClassmates("CH20262705", { op: "get" });
    expect(ensureMock).toHaveBeenCalledWith({ forceNew: false });
    expect(ensureMock.mock.invocationCallOrder[0]).toBeLessThan(apiMock.mock.invocationCallOrder[0]);
  });

  it("asks for a sign-in, without calling the API, when no session can be made", async () => {
    ensureMock.mockRejectedValueOnce(new AuthError("Not logged in — add your VTOP credentials first.", "vtop"));
    const err = await callClassmates("CH20262705", { op: "get" }).catch((e) => e);
    expect(err).toBeInstanceOf(ClassmatesError);
    expect(err.code).toBe("signin_required");
    expect(err.needsSignIn).toBe(true);
    expect(apiMock).not.toHaveBeenCalled();
  });

  it("reports VTOP being down as not a sign-in problem", async () => {
    ensureMock.mockRejectedValueOnce(new Error("network"));
    const err = await callClassmates("CH20262705", { op: "get" }).catch((e) => e);
    expect(err.code).toBe("vtop_unavailable");
    expect(err.needsSignIn).toBe(false);
  });

  it("treats the server's session errors as needing a sign-in", async () => {
    for (const code of ["missing_credentials", "vtop_session_expired", "vtop_identity_unresolved"]) {
      apiMock.mockResolvedValueOnce({ success: false, error: code });
      const err = await callClassmates("CH20262705", { op: "get" }).catch((e) => e);
      expect(err.needsSignIn).toBe(true);
    }
  });

  it("sends registered-only authenticated publish requests", async () => {
    apiMock.mockResolvedValueOnce({
      success: true,
      semesterId: "CH20262705",
      participants: 3,
      me: {
        handle: "AMZ-1",
        name: "A",
        joined: true,
        discoverable: true,
        source: "registered",
        classIds: [],
        updatedAt: null,
        changesLeft: 9,
      },
      sections: [],
      overlaps: [],
    });
    const state = await callClassmates("CH20262705", {
      op: "publish",
      source: "registered",
    });
    expect(state.participants).toBe(3);
    expect(apiMock).toHaveBeenCalledWith("social/ffcs-match", {
      method: "POST",
      auth: "vtop",
      body: { op: "publish", source: "registered", semesterId: "CH20262705" },
    });
  });

  it("translates planned_sharing_disabled error code", async () => {
    apiMock.mockResolvedValueOnce({ success: false, error: "planned_sharing_disabled" });
    const err = await callClassmates("CH20262705", { op: "get" }).catch((e) => e);
    expect(err).toBeInstanceOf(ClassmatesError);
    expect(err.code).toBe("planned_sharing_disabled");
    expect(err.message).toBe("Only VTOP-verified timetables can be shared.");
  });

  it("parses regNo in overlaps when returned by server", async () => {
    apiMock.mockResolvedValueOnce({
      success: true,
      semesterId: "CH20262705",
      participants: 2,
      me: {
        handle: "AMZ-1",
        name: "User",
        joined: true,
        discoverable: true,
        source: "registered",
        classIds: [],
        updatedAt: null,
        changesLeft: 10,
      },
      sections: [],
      overlaps: [
        {
          handle: "AMZ-2",
          name: "Friend",
          source: "registered",
          shared: 2,
          sharedClassIds: ["C1", "C2"],
          identical: false,
          updatedAt: "2026-11-09",
          regNo: "22BCE1000",
        },
      ],
    });
    const state = await callClassmates("CH20262705", { op: "get" });
    expect(state.overlaps[0].regNo).toBe("22BCE1000");
  });

  it("turns server error codes into readable errors", async () => {
    apiMock.mockResolvedValueOnce({ success: false, error: "slot_clash", detail: "Slot B1 is taken twice" });
    const err = await callClassmates("CH20262705", { op: "get" }).catch((e) => e);
    expect(err).toBeInstanceOf(ClassmatesError);
    expect(err.code).toBe("slot_clash");
    expect(err.message).toMatch(/slot clash/i);
  });

  it("rejects a body that is not friend finder data", async () => {
    apiMock.mockResolvedValueOnce({ ok: true });
    await expect(callClassmates("CH20262705", { op: "get" })).rejects.toMatchObject({ code: "unexpected_response" });
  });
});
