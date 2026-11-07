import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import ProfilePage from "../components/custom/header/ProfilePage";

vi.mock("../components/custom/header/PushNotificationManager", () => ({
  default: () => null,
}));

vi.mock("../components/custom/shared/PwaInstallCard", () => ({
  default: () => null,
}));

beforeEach(() => {
  vi.stubGlobal("localStorage", {
    getItem: () => null,
    setItem: () => {},
    removeItem: () => {},
    clear: () => {},
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("ProfilePage navigation settings", () => {
  it("does not render the removed compact mobile header switch", () => {
    render(
      <ProfilePage
        currSemesterID=""
        username=""
        password=""
        settings={{ pinnedNavTabs: [] }}
        setSettings={vi.fn()}
        setResidentialStatus={vi.fn()}
        setIsDayscholarWithBus={vi.fn()}
        isLoggedIn={false}
        handleLogOutRequest={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /Mobile & Navigation/ }));

    expect(screen.getByText("Mobile Bottom Navigation Bar")).toBeTruthy();
    expect(screen.queryByText("Compact Mobile Header")).toBeNull();
    expect(screen.queryByRole("switch")).toBeNull();
  });
});
