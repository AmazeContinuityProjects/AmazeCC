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
    expect(screen.getByText("BAMAT101")).toBeTruthy();
    expect(screen.getByText("Bala Murugan")).toBeTruthy();
    expect(screen.getByLabelText("1 classmate")).toBeTruthy();

    // Profile button in top right opens bottom sheet with profile info
    fireEvent.click(screen.getByRole("button", { name: "Profile" }));
    expect(await screen.findByText("Mohammed Anas")).toBeTruthy();
    expect(screen.getByText("1 class")).toBeTruthy();
  });

  it("asks for a second tap before removing you", async () => {
    apiMock.mockResolvedValueOnce(joinedWithMatch());
    await renderTab();
    fireEvent.click(screen.getByRole("button", { name: "Profile" }));
    fireEvent.click(await screen.findByRole("button", { name: /Remove me/ }));
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

  it("offers a logout button in the profile sheet with a second confirmation tap", async () => {
    apiMock.mockResolvedValueOnce(joinedWithMatch());
    await renderTab();
    fireEvent.click(screen.getByRole("button", { name: "Profile" }));
    const logoutBtn = await screen.findByRole("button", { name: /Log out/ });
    expect(logoutBtn).toBeTruthy();
    fireEvent.click(logoutBtn);
    expect(screen.getByRole("button", { name: /Tap again to log out/ })).toBeTruthy();
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

  it("opens friend bottom sheet modal when clicking a friend in classes mode", async () => {
    apiMock.mockResolvedValueOnce(joinedWithMatch());
    await renderTab();

    // Default grouping is Classes. Clicking on a friend's chip directly in the section card opens the bottom sheet.
    expect(screen.getByText("Your sections")).toBeTruthy();
    const friendChip = screen.getByText(/Bala Murugan/);
    expect(friendChip).toBeTruthy();
    fireEvent.click(friendChip);

    // Friend bottom sheet opens with shared classes
    expect(await screen.findByText(/1 class in common/i)).toBeTruthy();
    expect(screen.getByText("Classes in common (tap to view details)")).toBeTruthy();
    expect(screen.getAllByText(/Calculus/).length).toBeGreaterThan(0);

    // Tapping the shared class inside the sheet navigates into that class subpage
    fireEvent.click(screen.getAllByText(/Calculus/)[0]);
    expect(screen.getByText("Faculty reviews")).toBeTruthy();
    expect(screen.getByText("1 classmate here")).toBeTruthy();

    // Now inside the class subpage, clicking the classmate row also opens the bottom sheet modal
    fireEvent.click(screen.getAllByText("Bala Murugan")[0]);
    expect(await screen.findByText(/1 class in common/i)).toBeTruthy();
    expect(screen.getByText("Classes in common (tap to view details)")).toBeTruthy();
  });

  it("pairs embedded courses and marks friends who are not in both ETH and ELA", async () => {
    const ETH_OFFERING = {
      classId: "ETH_001",
      code: "BCSE202L",
      title: "Database Systems",
      type: "ETH",
      credits: "3",
      room: "SJT101",
      slot: "F1+TF1",
      faculty: "DR ALICE",
    };
    const ELA_OFFERING = {
      classId: "ELA_002",
      code: "BCSE202L",
      title: "Database Systems",
      type: "ELA",
      credits: "1",
      room: "SJT102",
      slot: "L23+L24",
      faculty: "DR ALICE",
    };

    const embeddedState = stateWith(
      { joined: true, discoverable: true, source: "registered", classIds: ["ETH_001", "ELA_002"] },
      {
        sections: [
          {
            classId: "ETH_001",
            offering: ETH_OFFERING,
            people: [
              { handle: "AMZ-BOTH", name: "Kavya S", source: "registered", regNo: "22BCE1111" },
              { handle: "AMZ-ETH-ONLY", name: "Rahul M", source: "registered", regNo: "22BCE2222" },
            ],
          },
          {
            classId: "ELA_002",
            offering: ELA_OFFERING,
            people: [
              { handle: "AMZ-BOTH", name: "Kavya S", source: "registered", regNo: "22BCE1111" },
              { handle: "AMZ-ELA-ONLY", name: "Sneha R", source: "registered", regNo: "22BCE3333" },
            ],
          },
        ],
        overlaps: [
          {
            handle: "AMZ-BOTH",
            name: "Kavya S",
            source: "registered",
            regNo: "22BCE1111",
            shared: 2,
            sharedClassIds: ["ETH_001", "ELA_002"],
            identical: true,
            updatedAt: "2026-11-09",
          },
          {
            handle: "AMZ-ETH-ONLY",
            name: "Rahul M",
            source: "registered",
            regNo: "22BCE2222",
            shared: 1,
            sharedClassIds: ["ETH_001"],
            identical: false,
            updatedAt: "2026-11-09",
          },
        ],
      },
    );

    apiMock.mockResolvedValueOnce(embeddedState);
    await renderTab();

    // Paired ETH + ELA is unified into ONE single entry with combined slots and "Embedded" type
    expect(screen.queryByText(/Paired with/)).toBeNull();
    expect(screen.getByText("Embedded")).toBeTruthy();
    expect(screen.getByText("F1+TF1 + L23+L24")).toBeTruthy();

    // In SectionCard chips, friends not in both are marked
    expect(screen.getByText("ETH only")).toBeTruthy();
    expect(screen.getByText("ELA only")).toBeTruthy();

    // Drill into the unified embedded section
    fireEvent.click(screen.getByText("Database Systems"));
    expect(screen.getByText("3 classmates here")).toBeTruthy();

    // In the unified section, Kavya is in both ETH+ELA (no extra badge), Rahul is only in ETH, Sneha is only in ELA
    expect(screen.queryByText(/Both ETH \+ ELA/i)).toBeNull();
    expect(screen.getByText("ETH only · Lab differs")).toBeTruthy();
    expect(screen.getByText("ELA only · Theory differs")).toBeTruthy();

    // Since both ETH and ELA are taught by Dr Alice, it renders as one unified teacher entry
    expect(screen.getByText("+")).toBeTruthy();
    expect(screen.getByText(/ETH: F1\+TF1/i)).toBeTruthy();
    expect(screen.getByText(/ELA: L23\+L24/i)).toBeTruthy();
    expect(screen.getByText("Class Numbers")).toBeTruthy();
    expect(screen.getByText("ETH_001, ELA_002")).toBeTruthy();

    // Clicking on Rahul in the class subpage opens his bottom sheet modal showing the mark
    fireEvent.click(screen.getAllByText("Rahul M")[0]);
    expect(await screen.findByText("Classes in common (tap to view details)")).toBeTruthy();
    expect(screen.getAllByText("ETH only · Lab differs").length).toBeGreaterThan(0);
  });

  it("shows two separate teacher cards for embedded course when theory and lab teachers differ", async () => {
    const diffFacultyState = stateWith(
      { joined: true, discoverable: true, source: "registered", classIds: ["ETH_DIFF", "ELA_DIFF"] },
      {
        sections: [
          {
            classId: "ETH_DIFF",
            offering: {
              classId: "ETH_DIFF",
              code: "BCSE301L",
              title: "Operating Systems",
              type: "ETH",
              credits: "3",
              room: "AB1",
              slot: "A1+TA1",
              faculty: "PROF CHEN",
              facultyId: "11111",
            },
            people: [{ handle: "AMZ-1", name: "Student One", source: "registered", regNo: "22BCE0001" }],
          },
          {
            classId: "ELA_DIFF",
            offering: {
              classId: "ELA_DIFF",
              code: "BCSE301L",
              title: "Operating Systems",
              type: "ELA",
              credits: "1",
              room: "AB2",
              slot: "L1+L2",
              faculty: "PROF DAVIS",
              facultyId: "22222",
            },
            people: [{ handle: "AMZ-1", name: "Student One", source: "registered", regNo: "22BCE0001" }],
          },
        ],
        overlaps: [
          {
            handle: "AMZ-1",
            name: "Student One",
            source: "registered",
            regNo: "22BCE0001",
            shared: 2,
            sharedClassIds: ["ETH_DIFF", "ELA_DIFF"],
            identical: true,
            updatedAt: "2026-11-09",
          },
        ],
      },
    );

    apiMock.mockResolvedValueOnce(diffFacultyState);
    await renderTab();

    fireEvent.click(screen.getByText("Operating Systems"));
    // Since professors differ, separate ETH and ELA cards are rendered
    expect(screen.getByText("Prof Chen")).toBeTruthy();
    expect(screen.getByText("Prof Davis")).toBeTruthy();
  });

  it("lists all friends including those in only 1 class, ordered by shared count with hero numbers", async () => {
    const multiFriendState = stateWith(
      { joined: true, discoverable: true, source: "registered", classIds: ["CLS_1", "CLS_2", "CLS_3"] },
      {
        sections: [
          {
            classId: "CLS_1",
            offering: { ...OFFERING, classId: "CLS_1", code: "MAT101", title: "Calculus" },
            people: [
              { handle: "USER_ALICE", name: "Alice Green", source: "registered", regNo: "24BCE0001" },
              { handle: "USER_BOB", name: "Bob Builder", source: "registered", regNo: "24BCE0002" },
              { handle: "USER_CHARLIE", name: "Charlie OneClass", source: "registered", regNo: "24BCE0003" },
            ],
          },
          {
            classId: "CLS_2",
            offering: { ...OFFERING, classId: "CLS_2", code: "PHY101", title: "Physics" },
            people: [
              { handle: "USER_ALICE", name: "Alice Green", source: "registered", regNo: "24BCE0001" },
              { handle: "USER_BOB", name: "Bob Builder", source: "registered", regNo: "24BCE0002" },
            ],
          },
          {
            classId: "CLS_3",
            offering: { ...OFFERING, classId: "CLS_3", code: "CSE101", title: "Computer Science" },
            people: [{ handle: "USER_ALICE", name: "Alice Green", source: "registered", regNo: "24BCE0001" }],
          },
        ],
        overlaps: [
          {
            handle: "USER_ALICE",
            name: "Alice Green",
            source: "registered",
            regNo: "24BCE0001",
            shared: 3,
            sharedClassIds: ["CLS_1", "CLS_2", "CLS_3"],
            identical: true,
            updatedAt: "2026-11-10",
          },
          {
            handle: "USER_BOB",
            name: "Bob Builder",
            source: "registered",
            regNo: "24BCE0002",
            shared: 2,
            sharedClassIds: ["CLS_1", "CLS_2"],
            identical: false,
            updatedAt: "2026-11-10",
          },
        ],
      },
    );

    apiMock.mockResolvedValueOnce(multiFriendState);
    await renderTab();

    // Switch to Friends grouping
    fireEvent.click(screen.getByRole("button", { name: "Friends" }));
    expect(screen.getByText("Friends with common classes")).toBeTruthy();

    // Alice (3 classes, identical), Bob (2 classes), Charlie (1 class - included even though not in overlaps!)
    expect(screen.getByText("Alice Green")).toBeTruthy();
    expect(screen.getByText("Bob Builder")).toBeTruthy();
    expect(screen.getByText(/Charlie OneClass/i)).toBeTruthy();

    // Check hero numbers: Alice has 3, Bob has 2, Charlie has 1
    expect(screen.getByLabelText("3 classes shared")).toBeTruthy();
    expect(screen.getByLabelText("2 classes shared")).toBeTruthy();
    expect(screen.getByLabelText("1 class shared")).toBeTruthy();

    // Alice is identical
    expect(screen.getByText("Identical")).toBeTruthy();
  });

  it("filters friends list by search query and supports clear", async () => {
    const searchState = stateWith(
      { joined: true, discoverable: true, source: "registered", classIds: ["CLS_1", "CLS_2"] },
      {
        sections: [
          {
            classId: "CLS_1",
            offering: { ...OFFERING, classId: "CLS_1", code: "MAT201", title: "Differential Equations" },
            people: [
              { handle: "USER_DEV", name: "Devansh Sharma", source: "registered", regNo: "23BCE1001" },
              { handle: "USER_PRIYA", name: "Priya Nair", source: "registered", regNo: "24BCS2002" },
            ],
          },
        ],
        overlaps: [
          {
            handle: "USER_DEV",
            name: "Devansh Sharma",
            source: "registered",
            regNo: "23BCE1001",
            shared: 1,
            sharedClassIds: ["CLS_1"],
            identical: false,
            updatedAt: "2026-11-10",
          },
          {
            handle: "USER_PRIYA",
            name: "Priya Nair",
            source: "registered",
            regNo: "24BCS2002",
            shared: 1,
            sharedClassIds: ["CLS_1"],
            identical: false,
            updatedAt: "2026-11-10",
          },
        ],
      },
    );

    apiMock.mockResolvedValueOnce(searchState);
    await renderTab();

    fireEvent.click(screen.getByRole("button", { name: "Friends" }));
    const searchInput = screen.getByPlaceholderText(/Search friends by name/i);

    // Search by name
    fireEvent.change(searchInput, { target: { value: "Devansh" } });
    expect(screen.getByText("Devansh Sharma")).toBeTruthy();
    expect(screen.queryByText("Priya Nair")).toBeNull();

    // Search by regNo
    fireEvent.change(searchInput, { target: { value: "24BCS" } });
    expect(screen.getByText("Priya Nair")).toBeTruthy();
    expect(screen.queryByText("Devansh Sharma")).toBeNull();

    // Search with no results
    fireEvent.change(searchInput, { target: { value: "NonExistent" } });
    expect(screen.getByText(/No friends matching/i)).toBeTruthy();

    // Clear search using the empty-state button
    fireEvent.click(screen.getByRole("button", { name: /^Clear search$/i }));
    expect(screen.getByText("Devansh Sharma")).toBeTruthy();
    expect(screen.getByText("Priya Nair")).toBeTruthy();

    // Search again and clear using the search input clear icon button
    fireEvent.change(searchInput, { target: { value: "Devansh" } });
    expect(screen.queryByText("Priya Nair")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Clear search input" }));
    expect(screen.getByText("Priya Nair")).toBeTruthy();
  });

  it("persists friend finder state in localStorage for offline availability", async () => {
    const cachedData = stateWith(
      { joined: true, discoverable: true, source: "registered", classIds: ["CLS_CACHE"] },
      {
        sections: [
          {
            classId: "CLS_CACHE",
            offering: { ...OFFERING, classId: "CLS_CACHE", code: "SWE201", title: "Software Engineering" },
            people: [{ handle: "USER_OFFLINE", name: "Offline Student", source: "registered", regNo: "22BCE9999" }],
          },
        ],
        overlaps: [
          {
            handle: "USER_OFFLINE",
            name: "Offline Student",
            source: "registered",
            regNo: "22BCE9999",
            shared: 1,
            sharedClassIds: ["CLS_CACHE"],
            identical: true,
            updatedAt: "2026-11-10",
          },
        ],
      },
    );

    // Seed localStorage cache before tab render
    window.localStorage.setItem("amaze_friend_finder_cache_CH20262705", JSON.stringify(cachedData));

    // Even if network fails (offline), cached state renders immediately
    apiMock.mockRejectedValueOnce(new Error("Network offline"));
    await renderTab();

    // Cached data is visible
    expect(screen.getByText("Your sections")).toBeTruthy();
    expect(screen.getByText("SWE201")).toBeTruthy();

    // Friends mode renders from cache and is searchable
    fireEvent.click(screen.getByRole("button", { name: "Friends" }));
    expect(screen.getByText("Offline Student")).toBeTruthy();
    expect(screen.getByLabelText("1 class shared")).toBeTruthy();
  });
});
