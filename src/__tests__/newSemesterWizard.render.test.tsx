import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import NewSemesterWizard from "../components/custom/shared/NewSemesterWizard";
import config from "../../config.json";

const known = config.semesterIDs;
const current = known[known.length - 2];
const older = known[known.length - 3];

beforeEach(() => {
  localStorage.clear();
  localStorage.setItem("attendance", JSON.stringify({ attendance: [{ courseCode: "BCSE101E" }] }));
  localStorage.setItem(
    "tasks",
    JSON.stringify([
      { id: "a", title: "done one", status: "done", courseCode: "BCSE101E", reminders: [], schedule: [] },
      { id: "b", title: "open one", status: "pending", courseCode: "BMAT201L", reminders: [], schedule: [] },
    ]),
  );
});
afterEach(cleanup);

describe("NewSemesterWizard", () => {
  it("offers the move when the student is on an older term, and does the changeover", async () => {
    const onSwitch = vi.fn(async () => {});
    render(<NewSemesterWizard enabled currSemesterID={older} onSwitch={onSwitch} />);
    fireEvent.click(await screen.findByRole("button", { name: "Set up" }));

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /^Switch to/ }));
    });
    expect(onSwitch).toHaveBeenCalledWith(current);
    expect(localStorage.getItem(`frozen_att_${older}`)).toContain("BCSE101E");
    // finished task cleared by default, open task kept
    expect(JSON.parse(localStorage.getItem("tasks") || "[]").map((t: { id: string }) => t.id)).toEqual(["b"]);
    expect(localStorage.getItem("semester_wizard_dismissed")).toBe(current);
  });

  it("shows nothing when already on the current term", () => {
    render(<NewSemesterWizard enabled currSemesterID={current} onSwitch={vi.fn()} />);
    expect(screen.queryByRole("button", { name: "Set up" })).toBeNull();
  });

  it("can be dismissed for this semester", async () => {
    render(<NewSemesterWizard enabled currSemesterID={older} onSwitch={vi.fn()} />);
    fireEvent.click(await screen.findByRole("button", { name: "Not now" }));
    expect(screen.queryByRole("button", { name: "Set up" })).toBeNull();
    expect(localStorage.getItem("semester_wizard_dismissed")).toBe(current);
  });

  it("renders nothing when disabled (signed out or demo)", () => {
    const { container } = render(<NewSemesterWizard enabled={false} currSemesterID={older} onSwitch={vi.fn()} />);
    expect(container.innerHTML).toBe("");
  });
});
