import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const ping = vi.fn(async () => true);
vi.mock("../lib/vtopHealth", () => ({ pingVtopDirectly: () => ping() }));

import ConnectionBanner from "../components/custom/shared/ConnectionBanner";
import { checkVtopNow, getVtopState, setVtopState } from "../lib/vtopStatus";

afterEach(() => {
  act(() => setVtopState("up"));
  ping.mockReset();
  ping.mockImplementation(async () => true);
});

describe("vtopStatus", () => {
  it("single-flights concurrent checks and publishes the result", async () => {
    ping.mockImplementation(async () => false);
    const [a, b] = await Promise.all([checkVtopNow(), checkVtopNow()]);
    expect(ping).toHaveBeenCalledTimes(1);
    expect(a).toBe("down");
    expect(b).toBe("down");
    expect(getVtopState()).toBe("down");
  });
});

describe("ConnectionBanner", () => {
  it("says VTOP is down, offers a re-check, and clears when it is back", async () => {
    ping.mockImplementation(async () => false);
    render(<ConnectionBanner enabled />);
    expect(await screen.findByText(/VTOP isn.t responding/)).toBeTruthy();

    ping.mockImplementation(async () => true);
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Check now" }));
    });
    expect(screen.queryByText(/VTOP isn.t responding/)).toBeNull();
  });

  it("can be dismissed", async () => {
    ping.mockImplementation(async () => false);
    render(<ConnectionBanner enabled />);
    await screen.findByText(/VTOP isn.t responding/);
    fireEvent.click(screen.getByRole("button", { name: "Dismiss" }));
    expect(screen.queryByText(/VTOP isn.t responding/)).toBeNull();
  });

  it("renders nothing when disabled (signed out or demo)", () => {
    act(() => setVtopState("down"));
    const { container } = render(<ConnectionBanner enabled={false} />);
    expect(container.innerHTML).toBe("");
  });
});
