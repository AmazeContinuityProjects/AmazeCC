import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from "vitest";
import React, { useState } from "react";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import FFCSFriendsSubpage, { type FFCSFriendsSubpageProps } from "../components/custom/exams/FFCS/FFCSFriendsSubpage";
import { ShareInputError } from "../lib/ffcsShareInput";
import { closeTopOverlayFromPop, hasOpenOverlays } from "../lib/overlayStack";
import type { Friend, FriendGroup, TimetableState } from "../components/custom/exams/FFCS/types";

/**
 * The friends subpage's contract: the hub routes to three sections, both ways
 * of adding a friend (share link or bare TT-shape code via `loadShareInput`,
 * and exported JSON) funnel into one naming step, and back walks
 * section → hub → planner rather than leaving the screen outright.
 */

const { loadShareInputMock } = vi.hoisted(() => ({ loadShareInputMock: vi.fn() }));

vi.mock("@/lib/ffcsShareInput", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/ffcsShareInput")>();
  return { ...actual, loadShareInput: loadShareInputMock };
});

vi.mock("../components/custom/exams/FFCS/components/modals/FriendTimetableViewModal", () => ({
  // The modal drags in the timetable grid and the amazeui course table; what
  // this suite owes it is that a selection reaches it, nothing more.
  FriendTimetableViewModal: ({ data }: { data: { name: string } | null }) =>
    data ? <div data-testid="friend-view">{data.name}</div> : null,
}));

const timetable: TimetableState = {
  id: "share-1",
  name: "Shared timetable",
  courses: [],
};

const props = (over: Partial<FFCSFriendsSubpageProps> = {}) =>
  ({
    onClose: vi.fn(),
    friends: [],
    setFriends: vi.fn(),
    friendGroups: [],
    setFriendGroups: vi.fn(),
    theoryPeriods: [],
    labPeriods: [],
    reportCourses: [],
    semesterId: "winter-2026-2027",
    onFriendAdded: vi.fn(),
    ...over,
    // The two setters stay mocks in the return type so the group tests can
    // assert the updater they were handed; `over` may replace them with real
    // setters, which those tests never do.
  }) as FFCSFriendsSubpageProps & { setFriends: Mock; setFriendGroups: Mock };

afterEach(async () => {
  // The naming sheet and the subpage both register overlay entries while
  // mounted, and a page-like entry that consumed back re-pushes itself — with
  // its close still a pending React update. Draining synchronously reads the
  // same stale `true` forever, so flush between pops and bound the loop like
  // the generator's suite does.
  let guard = 0;
  while (closeTopOverlayFromPop() && guard++ < 25) {
    await act(async () => {});
  }
});

describe("FFCSFriendsSubpage", () => {
  beforeEach(() => {
    loadShareInputMock.mockReset();
  });

  it("shows the hub with live counts and drills into each section", () => {
    const friends: Friend[] = [
      { id: "f1", name: "Rahul", timetables: [timetable] },
      { id: "f2", name: "Meera", timetables: [] },
    ];
    const groups: FriendGroup[] = [{ id: "g1", name: "Gaming Squad", friendIds: ["f1"] }];
    const p = props({ friends, friendGroups: groups });
    const { container } = render(<FFCSFriendsSubpage {...p} />);

    expect(screen.getByText("Your friends").parentElement).toBeTruthy();
    // Counts are on the hub rows, so the answer to "how many?" needs no tap.
    expect(screen.getByText("2")).toBeTruthy();
    expect(screen.getByText("1")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: /your friends/i }));
    expect(screen.getByText("Rahul")).toBeTruthy();
    expect(screen.getByText(/Considering 1 timetable$/)).toBeTruthy();
    expect(screen.getByText("Meera")).toBeTruthy();
    expect(screen.queryByText("Groups")).toBeNull();

    // Back returns to the hub rather than leaving the subpage. PageShell's
    // back control is an icon-only Pressable with no accessible name, so it is
    // found by the `self-start` class PageShell pins it with.
    const back = container.querySelector("button.self-start")!;
    expect(back).toBeTruthy();
    fireEvent.click(back);
    expect(screen.getByText("Add a friend")).toBeTruthy();
    expect(p.onClose).not.toHaveBeenCalled();
  });

  it("adds a friend from a share link or bare code through one naming step", async () => {
    loadShareInputMock.mockResolvedValue({ timetable, campus: "chennai" });
    const p = props();
    // The prop setters are the parent's, so the harness below owns the state a
    // real tab would — letting the save be asserted through what renders, not
    // just through a spy call.
    function Harness() {
      const [friends, setFriends] = React.useState<Friend[]>([]);
      return <FFCSFriendsSubpage {...p} friends={friends} setFriends={setFriends} />;
    }
    render(<Harness />);

    fireEvent.click(screen.getByRole("button", { name: /add a friend/i }));
    const input = screen.getByLabelText(/share link or code/i);

    // The bare TT-shape code path — what a chat app delivers intact. The
    // leading digit is the report's numeric alias: 2 = winter final list.
    fireEvent.change(input, { target: { value: "2.ABCDEF" } });
    fireEvent.keyDown(input, { key: "Enter" });

    await waitFor(() =>
      expect(loadShareInputMock).toHaveBeenCalledWith("2.ABCDEF", {
        reportCourses: [],
        reportSemesterId: "winter-2026-2027",
      }),
    );
    // Naming sheet opens with the resolved plan, and the link field clears.
    expect(await screen.findByText("Name Your Friend")).toBeTruthy();
    expect((input as HTMLInputElement).value).toBe("");

    fireEvent.change(screen.getByPlaceholderText("E.g., Rahul"), {
      target: { value: "Rahul" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save Friend" }));

    expect(p.onFriendAdded).toHaveBeenCalledWith("Rahul");
    // Landed on the list, where the friend just named is visible.
    expect(await screen.findByText("Rahul")).toBeTruthy();
    expect(screen.getByText(/Considering 1 timetable$/)).toBeTruthy();
    // The naming sheet is gone — one naming step, then done.
    expect(screen.queryByText("Name Your Friend")).toBeNull();
  });

  it("reports an unreadable paste inline instead of a toast on the planner", async () => {
    loadShareInputMock.mockRejectedValue(
      new ShareInputError("unreadable", "That does not look like a share link or a TT-shape code."),
    );
    render(<FFCSFriendsSubpage {...props()} />);

    fireEvent.click(screen.getByRole("button", { name: /add a friend/i }));
    fireEvent.change(screen.getByLabelText(/share link or code/i), {
      target: { value: "come check my timetable" },
    });
    fireEvent.click(screen.getByRole("button", { name: /add friend/i }));

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain("does not look like a share link");
    // No naming sheet, no friend.
    expect(screen.queryByText("Name Your Friend")).toBeNull();
  });

  it("names an imported JSON config the same way as a link", () => {
    render(<FFCSFriendsSubpage {...props()} />);

    fireEvent.click(screen.getByRole("button", { name: /add a friend/i }));
    const file = screen.getByLabelText(/import exported json/i);
    // jsdom FileReader reads the fake file's text, so the JSON path is real.
    fireEvent.change(file, {
      target: {
        files: [new File([JSON.stringify([{ id: "tt-9", courses: [] }])], "config.json", { type: "application/json" })],
      },
    });

    return waitFor(() => expect(screen.getByText("Name Your Friend")).toBeTruthy());
  });

  it("removing a friend also drops them from every group", () => {
    const friends: Friend[] = [{ id: "f1", name: "Rahul", timetables: [timetable] }];
    const groups: FriendGroup[] = [{ id: "g1", name: "Squad", friendIds: ["f1", "ghost"] }];
    const p = props({ friends, friendGroups: groups });
    render(<FFCSFriendsSubpage {...p} />);

    fireEvent.click(screen.getByRole("button", { name: /your friends/i }));
    fireEvent.click(screen.getByRole("button", { name: "Remove Friend" }));

    expect(p.setFriends).toHaveBeenCalled();
    expect(p.setFriendGroups).toHaveBeenCalledWith(expect.any(Function));
    const updater = p.setFriendGroups.mock.calls[0][0] as (g: FriendGroup[]) => FriendGroup[];
    expect(updater(groups)).toEqual([{ id: "g1", name: "Squad", friendIds: ["ghost"] }]);
  });

  it("creates a group from a name and a friend selection", () => {
    const friends: Friend[] = [{ id: "f1", name: "Rahul", timetables: [] }];
    const p = props({ friends });
    render(<FFCSFriendsSubpage {...p} />);

    fireEvent.click(screen.getByRole("button", { name: /^groups/i }));
    const create = screen.getByRole("button", { name: "Create Group" });
    expect((create as HTMLButtonElement).disabled).toBe(true);

    fireEvent.change(screen.getByPlaceholderText(/group name/i), {
      target: { value: "Gaming Squad" },
    });
    fireEvent.click(screen.getByLabelText("Rahul"));
    expect((create as HTMLButtonElement).disabled).toBe(false);

    fireEvent.click(create);
    expect(p.setFriendGroups).toHaveBeenCalledTimes(1);
    const updater = p.setFriendGroups.mock.calls[0][0] as (g: FriendGroup[]) => FriendGroup[];
    expect(updater([])).toEqual([{ id: expect.any(String), name: "Gaming Squad", friendIds: ["f1"] }]);
    // The form clears for the next group.
    expect((screen.getByPlaceholderText(/group name/i) as HTMLInputElement).value).toBe("");
  });

  it("system back walks a section to the hub, then the hub to the planner", () => {
    const p = props();
    render(<FFCSFriendsSubpage {...p} />);

    fireEvent.click(screen.getByRole("button", { name: /groups/i }));
    expect(hasOpenOverlays()).toBe(true);
    act(() => {
      expect(closeTopOverlayFromPop()).toBe(true);
    });
    // Consumed by the section → hub step; still on the subpage.
    expect(screen.getByText("Add a friend")).toBeTruthy();
    expect(p.onClose).not.toHaveBeenCalled();

    act(() => {
      expect(closeTopOverlayFromPop()).toBe(true);
    });
    expect(p.onClose).toHaveBeenCalled();
  });
});
