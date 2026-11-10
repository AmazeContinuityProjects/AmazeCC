import { describe, expect, it } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import FFCSPageView from "../app/ffcs/FFCSPageView";

function setLayoutMode(mode?: "guided" | "modern") {
  const values = new Map<string, string>();
  if (mode) values.set("ffcs_layout_mode", mode);
  Object.defineProperty(window, "localStorage", {
    configurable: true,
    value: {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
      removeItem: (key: string) => values.delete(key),
      clear: () => values.clear(),
    },
  });
}

describe("FFCSPageView", () => {
  it("renders AmazeCC brand and Login to AmazeCC, with non-sticky header and no back button", async () => {
    setLayoutMode("guided");
    const { container } = render(<FFCSPageView />);

    // The planner tab is a deferred chunk; wait for it to mount so its
    // layout-mode callback has revealed the nav these assertions walk.
    // (Importing the tab's module graph takes seconds under vitest, hence
    // the explicit timeout — same convention as the ffcsTab tests.)
    await waitFor(() => expect(screen.getAllByRole("link", { name: /AmazeCC/i }).length).toBeGreaterThan(0), {
      timeout: 30_000,
    });

    // 1. Should NOT show "Back to AmazeCC Home" or "VTOP Login"
    expect(screen.queryByText(/Back to AmazeCC Home/i)).toBeNull();
    expect(screen.queryByText(/VTOP Login/i)).toBeNull();

    // 2. Should show "AmazeCC" brand link without presenting FFCS as an app
    const amazeccLinks = screen.getAllByRole("link", { name: /AmazeCC/i });
    expect(amazeccLinks.length).toBeGreaterThan(0);
    const homeBrandLink = amazeccLinks.find((el) => el.getAttribute("href") === "/");
    expect(homeBrandLink).toBeDefined();
    expect(screen.queryByText("App")).toBeNull();

    // 3. Should show "Login to AmazeCC"
    expect(screen.getByText("Login to AmazeCC")).toBeDefined();

    // 4. Header nav should not be sticky
    const nav = container.querySelector("nav");
    expect(nav).toBeDefined();
    expect(nav?.className).not.toContain("sticky");
  });

  it("does not offer a separate FFCS app install action", () => {
    setLayoutMode("guided");
    render(<FFCSPageView />);
    expect(screen.queryByRole("button", { name: /Install App/i })).toBeNull();
  });

  it("defaults to Modern on mobile when no planner layout has been saved", () => {
    setLayoutMode();
    const originalWidth = window.innerWidth;
    Object.defineProperty(window, "innerWidth", { configurable: true, value: 390 });
    try {
      const { container } = render(<FFCSPageView />);
      expect(container.querySelector("nav")?.hasAttribute("hidden")).toBe(true);
    } finally {
      Object.defineProperty(window, "innerWidth", {
        configurable: true,
        value: originalWidth,
      });
    }
  });

  it("combines the page headers in Modern mode", async () => {
    setLayoutMode("modern");
    const { container } = render(<FFCSPageView />);

    // The "AmazeCC home" link and the split wordmark live in the deferred
    // planner chunk, so wait for it before walking the merged headers.
    await screen.findByRole("link", { name: "AmazeCC home" }, { timeout: 30_000 });

    const main = container.querySelector("main");
    expect(main?.className).toContain("w-full");
    expect(main?.className).not.toContain("max-w-7xl");
    expect(main?.className).toContain("sm:px-6");

    const topNav = container.querySelector("nav");
    expect(topNav?.hasAttribute("hidden")).toBe(true);
    expect(screen.getByRole("link", { name: "AmazeCC home" })).toBeDefined();
    expect(screen.getByRole("link", { name: "AmazeCC home" }).querySelector("img")?.getAttribute("src")).toContain(
      "/favicon/favicon.svg",
    );
    expect(screen.getByText("Amaze")).toBeDefined();
    expect(screen.getByText("CC")).toBeDefined();
  });
});
