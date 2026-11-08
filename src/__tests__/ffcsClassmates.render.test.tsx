import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { getDefaultStore } from "jotai";
import { demoModeAtom, isLoggedInAtom } from "../store";
import type { ClassmatesState } from "../lib/ffcsClassmates";
import type { ParsedCourse, TimetableState } from "../lib/ffcsTypes";

const apiMock = vi.fn();
const ensureMock = vi.fn();
const pushMock = vi.fn();
vi.mock("@/lib/sync-engine/request-layer", () => ({
  apiRequest: (path: string, opts: unknown) => apiMock(path, opts),
}));
vi.mock("@/lib/sync-engine/credential-manager", () => ({
  credentialManager: { ensureVtopSession: (opts: unknown) => ensureMock(opts) },
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: pushMock }) }));

import { AuthError } from "../lib/sync-engine/errors";
import FFCSClassmatesSection from "../components/custom/exams/FFCS/FFCSClassmatesSection";

const OFFERING = {
  classId: "CH2026270500101",
  code: "BAMAT101",
  title: "Calculus",
  type: "TH",
  credits: "4",
  room: "AB2-102",
  slot: "B1+TB1",
  faculty: "PRIYA S",
};
const report: ParsedCourse[] = [
  {
    CODE: "BAMAT101",
    TITLE: "Calculus",
    TYPE: "TH",
    CREDITS: "4",
    ROOM: "AB2-102",
    SLOT: "B1+TB1",
    FACULTY: "PRIYA S",
    CLASS_ID: "CH2026270500101",
  },
];
const timetables: TimetableState[] = [
  {
    id: "t1",
    name: "Plan A",
    courses: [
      {
        id: "c1",
        code: "BAMAT101",
        title: "Calculus",
        slots: ["B1", "TB1"],
        faculty: "PRIYA S",
        venue: "",
        credits: "4",
        type: "TH",
        color: "blue",
      },
    ],
  },
  { id: "t2", name: "Empty plan", courses: [] },
];

function stateWith(partial: Partial<ClassmatesState["me"]>, extra: Partial<ClassmatesState> = {}): ClassmatesState {
  return {
    success: true,
    semesterId: "CH20262705",
    participants: 12,
    me: {
      handle: "AMZ-ME",
      name: "MOHAMMED ANAS",
      joined: false,
      discoverable: false,
      source: null,
      classIds: [],
      updatedAt: null,
      changesLeft: 10,
      ...partial,
    },
    sections: [],
    overlaps: [],
    ...extra,
  } as ClassmatesState;
}

const joinedWithMatch = () =>
  stateWith(
    { joined: true, discoverable: true, source: "planned", classIds: [OFFERING.classId] },
    {
      sections: [
        {
          classId: OFFERING.classId,
          offering: OFFERING,
          people: [{ handle: "AMZ-B", name: "BALA MURUGAN", source: "registered" }],
        },
      ],
      overlaps: [],
    },
  );

async function renderSection(semesterId: "winter-2026-2027" | "winter-2026-2027-mock" = "winter-2026-2027") {
  await act(async () => {
    render(
      <FFCSClassmatesSection
        semesterId={semesterId}
        timetables={timetables}
        activeTimetableId="t1"
        reportCourses={report}
      />,
    );
  });
}

describe("FFCSClassmatesSection", () => {
  beforeEach(() => {
    apiMock.mockReset();
    ensureMock.mockReset();
    pushMock.mockReset();
    ensureMock.mockResolvedValue({ cookies: ["x"], authorizedID: "A", csrf: "c", fetchedAt: Date.now() });
    window.sessionStorage.clear();
    getDefaultStore().set(isLoggedInAtom, true);
    getDefaultStore().set(demoModeAtom, false);
  });
  afterEach(() => {
    cleanup();
    getDefaultStore().set(isLoggedInAtom, false);
  });

  it("offers guests a sign-in that comes back to the friend finder", async () => {
    getDefaultStore().set(isLoggedInAtom, false);
    await renderSection();
    expect(apiMock).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: /Sign in with VTOP/ }));
    expect(pushMock).toHaveBeenCalledWith("/?signin=1");
    expect(JSON.parse(window.sessionStorage.getItem("amaze_signin_return")!).path).toBe("/ffcs/?open=classmates");
  });

  it("refuses the mock list without calling the server", async () => {
    await renderSection("winter-2026-2027-mock");
    expect(screen.getByText(/final course list/)).toBeTruthy();
    expect(apiMock).not.toHaveBeenCalled();
  });

  it("explains the privacy rules, offers only timetables with classes, and publishes the chosen plan", async () => {
    apiMock.mockResolvedValueOnce(stateWith({}));
    await renderSection();
    expect(apiMock).toHaveBeenLastCalledWith(
      "social/ffcs-match",
      expect.objectContaining({ body: { op: "get", semesterId: "CH20262705" } }),
    );
    expect(screen.getByText(/12 students have joined/)).toBeTruthy();
    expect(screen.getByText(/Only people in at least one of your sections/)).toBeTruthy();
    expect(screen.getByText("Plan A")).toBeTruthy();
    expect(screen.queryByText("Empty plan")).toBeNull();

    apiMock.mockResolvedValueOnce(joinedWithMatch());
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /Share and find classmates/ }));
    });
    expect(apiMock).toHaveBeenLastCalledWith(
      "social/ffcs-match",
      expect.objectContaining({
        body: { op: "publish", source: "planned", classIds: [OFFERING.classId], semesterId: "CH20262705" },
      }),
    );
    expect(screen.getByText("Mohammed Anas")).toBeTruthy();
    expect(screen.getByText(/Sharing 1 class$/)).toBeTruthy();
    expect(screen.getByText("BAMAT101")).toBeTruthy();
    expect(screen.getByText("Bala Murugan")).toBeTruthy();
    expect(screen.getByText("1 classmate")).toBeTruthy();
  });

  it("asks for a second tap before removing you", async () => {
    apiMock.mockResolvedValueOnce(joinedWithMatch());
    await renderSection();
    fireEvent.click(screen.getByRole("button", { name: /Remove me/ }));
    expect(apiMock).toHaveBeenCalledTimes(1);
    apiMock.mockResolvedValueOnce(stateWith({}));
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /Tap again to remove/ }));
    });
    expect(apiMock).toHaveBeenLastCalledWith(
      "social/ffcs-match",
      expect.objectContaining({ body: { op: "leave", semesterId: "CH20262705" } }),
    );
  });

  it("offers Sign in again when there is no session, and retries after a fresh login", async () => {
    ensureMock.mockRejectedValueOnce(new AuthError("Not logged in", "vtop"));
    await renderSection();
    expect(screen.getByRole("alert").textContent).toMatch(/sign-in needs refreshing/i);
    expect(apiMock).not.toHaveBeenCalled();

    apiMock.mockResolvedValueOnce(joinedWithMatch());
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /Sign in again/ }));
    });
    expect(ensureMock).toHaveBeenCalledWith({ forceNew: true });
    expect(screen.getByText("Bala Murugan")).toBeTruthy();
    expect(pushMock).not.toHaveBeenCalled();
  });

  it("sends you to the sign-in page when the saved login no longer works", async () => {
    ensureMock.mockRejectedValue(new AuthError("Login failed", "vtop"));
    await renderSection();
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /Sign in again/ }));
    });
    expect(pushMock).toHaveBeenCalledWith("/?signin=1");
  });

  it("shows other errors in plain words with Try again", async () => {
    apiMock.mockResolvedValueOnce({ success: false, error: "report_unavailable" });
    await renderSection();
    expect(screen.getByRole("alert").textContent).toMatch(/course list/i);
    expect(screen.getByRole("button", { name: /Try again/ })).toBeTruthy();
  });

  it("tells a hidden user they are hidden, with a one-tap way back", async () => {
    apiMock.mockResolvedValueOnce(
      stateWith({ joined: true, discoverable: false, source: "planned", classIds: [OFFERING.classId] }),
    );
    await renderSection();
    expect(screen.getByText("You're hidden")).toBeTruthy();
    expect(screen.queryByText("Your sections")).toBeNull();
    apiMock.mockResolvedValueOnce(joinedWithMatch());
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /Become visible/ }));
    });
    expect(apiMock).toHaveBeenLastCalledWith(
      "social/ffcs-match",
      expect.objectContaining({ body: { op: "visibility", discoverable: true, semesterId: "CH20262705" } }),
    );
  });
});
