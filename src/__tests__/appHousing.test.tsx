import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import AppHousing from "../components/custom/app/AppHousing";
import { installLocalStorage } from "./helpers/localStorage";
import { getDefaultStore } from "jotai";
import { isLoggedInAtom, credentialsAtom } from "@/store";
import * as posthogModule from "@/lib/posthog";

vi.mock("@/lib/posthog", async () => {
  const actual = await vi.importActual<typeof posthogModule>("@/lib/posthog");
  return {
    ...actual,
    syncCurrentUserPostHogIdentity: vi.fn(),
  };
});

describe("AppHousing", () => {
  let ls: Storage;

  beforeEach(() => {
    ls = installLocalStorage();
    getDefaultStore().set(isLoggedInAtom, false);
    getDefaultStore().set(credentialsAtom, {
      VtopUsername: "",
      VtopPassword: "",
      MoodleUsername: "",
      MoodlePassword: "",
    });
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it("renders children cleanly", () => {
    render(
      <AppHousing route="test-route">
        <div data-testid="child-content">Child Content</div>
      </AppHousing>,
    );

    expect(screen.getByTestId("child-content")).toBeDefined();
    expect(screen.getByText("Child Content")).toBeDefined();
  });

  it("hydrates session cache from storage on mount", () => {
    ls.setItem("username", "25BLC1081");
    ls.setItem("password", "secretPass123");
    ls.setItem("IDs", JSON.stringify({ VtopUsername: "25BLC1081" }));

    render(
      <AppHousing route="friend_finder">
        <div>Loaded</div>
      </AppHousing>,
    );

    expect(getDefaultStore().get(isLoggedInAtom)).toBe(true);
    expect(getDefaultStore().get(credentialsAtom)?.VtopUsername).toBe("25BLC1081");
    expect(posthogModule.syncCurrentUserPostHogIdentity).toHaveBeenCalledWith(
      expect.objectContaining({
        route: "friend_finder",
      }),
    );
  });
});
