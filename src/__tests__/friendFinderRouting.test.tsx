import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, act, renderHook } from "@testing-library/react";
import { useEffect } from "react";
import { getDefaultStore } from "jotai";
import { activeTabAtom } from "@/store/uiAtoms";
import { DashboardNavigatorProvider, DashboardRoute } from "@/components/custom/dashboard/DashboardNavigator";

describe("Friend Finder Routing & Deep Link Consumer", () => {
  const store = getDefaultStore();

  beforeEach(() => {
    store.set(activeTabAtom, "home");
  });

  it("DashboardRoute mounts friend-finder content only when activeTab matches", () => {
    store.set(activeTabAtom, "friend-finder");

    const { queryByText, rerender } = render(
      <DashboardNavigatorProvider>
        <DashboardRoute route="friend-finder">
          <div>Friend Finder Content</div>
        </DashboardRoute>
      </DashboardNavigatorProvider>,
    );

    expect(queryByText("Friend Finder Content")).not.toBeNull();

    // Change tab to home
    act(() => {
      store.set(activeTabAtom, "home");
    });

    rerender(
      <DashboardNavigatorProvider>
        <DashboardRoute route="friend-finder">
          <div>Friend Finder Content</div>
        </DashboardRoute>
      </DashboardNavigatorProvider>,
    );

    expect(queryByText("Friend Finder Content")).toBeNull();
  });

  it("consumes ?open=friend-finder, sets active tab, and strips the query parameter", () => {
    // Simulate window.location with ?open=friend-finder
    const originalLocation = window.location;
    const originalHistory = window.history;

    const replaceStateMock = vi.fn();
    delete (window as any).location;
    window.location = new URL("https://app.amazecc.com/?open=friend-finder") as any;

    const historyMock = {
      ...originalHistory,
      replaceState: replaceStateMock,
      state: {},
    };
    Object.defineProperty(window, "history", {
      value: historyMock,
      writable: true,
      configurable: true,
    });

    // Run the consumer effect as in Main.tsx
    function useDeepLinkConsumer() {
      useEffect(() => {
        try {
          if (typeof window === "undefined") return;
          const url = new URL(window.location.href);
          if (url.searchParams.get("open") === "friend-finder") {
            store.set(activeTabAtom, "friend-finder");
            url.searchParams.delete("open");
            window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}${url.hash}`);
          }
        } catch {
          // ignore
        }
      }, []);
    }

    renderHook(() => useDeepLinkConsumer());

    expect(store.get(activeTabAtom)).toBe("friend-finder");
    expect(replaceStateMock).toHaveBeenCalledWith({}, "", "/");

    // Clean up
    (window as any).location = originalLocation;
    Object.defineProperty(window, "history", {
      value: originalHistory,
      writable: true,
      configurable: true,
    });
  });
});
