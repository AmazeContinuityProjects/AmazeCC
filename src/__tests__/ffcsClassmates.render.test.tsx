import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { getDefaultStore } from "jotai";
import { demoModeAtom, isLoggedInAtom } from "../store";
import { FRIEND_FINDER_REFRESH_EVENT, type ClassmatesState } from "../lib/ffcsClassmates";

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

vi.mock("../components/custom/exams/FFCS/components/FacultyReviewSheetHost", () => ({
  default: ({ target }: { target: { name: string; courseCode?: string } | null }) =>
    target ? (
      <div data-testid="faculty-review-sheet">
        {target.name} - {target.courseCode}
      </div>
    ) : null,
}));

import { AuthError } from "../lib/sync-engine/errors";
import { closeTopOverlayFromPop } from "../lib/overlayStack";
import FriendFinderTab from "../components/custom/friendfinder/FriendFinderTab";
import { installLocalStorage } from "./helpers/localStorage";

const ls = installLocalStorage();

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
    { joined: true, discoverable: true, source: "registered", classIds: [OFFERING.classId] },
    {
      sections: [
        {
          classId: OFFERING.classId,
          offering: OFFERING,
          people: [{ handle: "AMZ-B", name: "BALA MURUGAN", source: "registered" }],
        },
      ],
      overlaps: [
        {
          handle: "AMZ-B",
          name: "BALA MURUGAN",
          source: "registered",
          shared: 1,
          sharedClassIds: [OFFERING.classId],
          identical: false,
          updatedAt: "2026-11-09",
          regNo: "22BCE1234",
        },
      ],
    },
  );

async function renderTab(onBack?: () => void, semesterId?: string) {
  let res: any;
  await act(async () => {
    res = render(<FriendFinderTab onBack={onBack} semesterId={semesterId} />);
  });
  return res;
}

describe("FriendFinderTab", () => {
  beforeEach(() => {
    apiMock.mockReset();
    ensureMock.mockReset();
    pushMock.mockReset();
    ensureMock.mockResolvedValue({ cookies: ["x"], authorizedID: "A", csrf: "c", fetchedAt: Date.now() });
    window.sessionStorage.clear();
    ls.clear();
    getDefaultStore().set(isLoggedInAtom, true);
    getDefaultStore().set(demoModeAtom, false);
  });

  afterEach(async () => {
    cleanup();
    getDefaultStore().set(isLoggedInAtom, false);
    let guard = 0;
    while (closeTopOverlayFromPop() && guard++ < 25) {
      await act(async () => {});
    }
  });

  it("offers guests a sign-in that comes back to the friend finder with open=friend-finder", async () => {
    getDefaultStore().set(isLoggedInAtom, false);
    await renderTab();
    expect(apiMock).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: /Sign in with VTOP/ }));
    expect(pushMock).toHaveBeenCalledWith("/?signin=1&open=friend-finder");
  });

  it("refuses the mock list without calling the server", async () => {
    await renderTab(undefined, "winter-2026-2027-mock");
    expect(screen.getByText(/upcoming winter course list/i)).toBeTruthy();
    expect(apiMock).not.toHaveBeenCalled();
  });

  it("refuses this semester (fall-2026-2027) without calling the server", async () => {
    await renderTab(undefined, "fall-2026-2027");
    expect(screen.getByText(/upcoming winter course list/i)).toBeTruthy();
    expect(apiMock).not.toHaveBeenCalled();
  });

  it("explains privacy rules, offers registered timetable, and publishes", async () => {
    apiMock.mockResolvedValueOnce(stateWith({}));
    await renderTab();
    expect(apiMock).toHaveBeenLastCalledWith(
      "social/ffcs-match",
      expect.objectContaining({ body: { op: "get", semesterId: "CH20262705" } }),
    );
    expect(screen.getByText(/12 students have joined/)).toBeTruthy();
    expect(screen.getByText(/Only people in at least one of your sections/)).toBeTruthy();
    expect(screen.getByText("My registered timetable")).toBeTruthy();

    apiMock.mockResolvedValueOnce(joinedWithMatch());
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /Share and find classmates/ }));
    });
    expect(apiMock).toHaveBeenLastCalledWith(
      "social/ffcs-match",
      expect.objectContaining({
        body: { op: "publish", source: "registered", semesterId: "CH20262705" },
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
    await renderTab();
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
    await renderTab();
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
    await renderTab();
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /Sign in again/ }));
    });
    expect(pushMock).toHaveBeenCalledWith("/?signin=1&open=friend-finder");
  });

  it("tells a hidden user they are hidden, with a one-tap way back", async () => {
    apiMock.mockResolvedValueOnce(
      stateWith({ joined: true, discoverable: false, source: "registered", classIds: [OFFERING.classId] }),
    );
    await renderTab();
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

  it("supports both groupings: by class and by friend with bottom sheet", async () => {
    apiMock.mockResolvedValueOnce(joinedWithMatch());
    await renderTab();

    // Default grouping is Classes
    expect(screen.getByText("Your sections")).toBeTruthy();
    expect(screen.getByText("BAMAT101")).toBeTruthy();

    // Switch to Friends grouping
    fireEvent.click(screen.getByRole("button", { name: "Friends" }));
    expect(screen.getByText("Friends with common classes")).toBeTruthy();
    expect(screen.getByText("Bala Murugan")).toBeTruthy();
    expect(screen.getByText("22BCE1234")).toBeTruthy();

    // Click on friend row -> opens Friend bottom sheet
    fireEvent.click(screen.getByText("Bala Murugan"));
    expect(await screen.findByText(/1 class in common/i)).toBeTruthy();
    expect(screen.getByText("Classes in common (tap to view details)")).toBeTruthy();

    // Click shared class row in the sheet -> closes sheet and drills into class subpage
    fireEvent.click(screen.getByText(/Calculus/));
    expect(screen.getByText("Faculty reviews")).toBeTruthy();
    expect(screen.getByText("Priya S")).toBeTruthy();
    expect(screen.getByText("1 classmate here")).toBeTruthy();
  });

  it("class subpage displays offering details and opens faculty review sheet", async () => {
    apiMock.mockResolvedValueOnce(joinedWithMatch());
    const { container } = await renderTab();

    // Drill into class from Classes view
    fireEvent.click(screen.getByText("BAMAT101"));
    expect(screen.getByText("Faculty reviews")).toBeTruthy();
    expect(screen.getByText("4")).toBeTruthy(); // Credits
    expect(screen.getByText("Room AB2-102")).toBeTruthy();

    // Click faculty reviews
    fireEvent.click(screen.getByText("Faculty reviews"));
    expect(await screen.findByTestId("faculty-review-sheet")).toBeTruthy();
    expect(screen.getByTestId("faculty-review-sheet").textContent).toContain("PRIYA S - BAMAT101");

    // Back returns to main sections list
    const backBtn = container.querySelector("button.self-start")!;
    expect(backBtn).toBeTruthy();
    fireEvent.click(backBtn);
    expect(screen.getByText("Your sections")).toBeTruthy();
  });

  it("refreshes data when FRIEND_FINDER_REFRESH_EVENT fires", async () => {
    apiMock.mockResolvedValueOnce(joinedWithMatch());
    await renderTab();
    expect(apiMock).toHaveBeenCalledTimes(1);

    apiMock.mockResolvedValueOnce(joinedWithMatch());
    await act(async () => {
      window.dispatchEvent(new CustomEvent(FRIEND_FINDER_REFRESH_EVENT));
    });
    expect(apiMock).toHaveBeenCalledTimes(2);
    expect(apiMock).toHaveBeenLastCalledWith(
      "social/ffcs-match",
      expect.objectContaining({ body: { op: "publish", source: "registered", semesterId: "CH20262705" } }),
    );
  });
});
