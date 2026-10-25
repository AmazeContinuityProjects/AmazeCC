import React from "react";
import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import FFCSPageView from "../app/ffcs/FFCSPageView";
import * as pwaModule from "@/lib/pwaInstall";

function setLayoutMode(mode: "guided" | "modern") {
  const values = new Map<string, string>([["ffcs_layout_mode", mode]]);
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
  it("renders AmazeCC brand and Login to AmazeCC, with non-sticky header and no back button", () => {
    setLayoutMode("guided");
    const { container } = render(<FFCSPageView />);

    // 1. Should NOT show "Back to AmazeCC Home" or "VTOP Login"
    expect(screen.queryByText(/Back to AmazeCC Home/i)).toBeNull();
    expect(screen.queryByText(/VTOP Login/i)).toBeNull();

    // 2. Should show "AmazeCC" brand link and standalone "App" badge
    const amazeccLinks = screen.getAllByRole("link", { name: /AmazeCC/i });
    expect(amazeccLinks.length).toBeGreaterThan(0);
    const homeBrandLink = amazeccLinks.find((el) => el.getAttribute("href") === "/");
    expect(homeBrandLink).toBeDefined();
    expect(screen.getByText("App")).toBeDefined();

    // 3. Should show "Login to AmazeCC"
    expect(screen.getByText("Login to AmazeCC")).toBeDefined();

    // 4. Header nav should not be sticky
    const nav = container.querySelector("nav");
    expect(nav).toBeDefined();
    expect(nav?.className).not.toContain("sticky");
  });

  it("renders Install App button when PWA installation is available and invokes promptInstall", () => {
    setLayoutMode("guided");
    const promptInstallMock = vi.fn().mockResolvedValue(true);
    vi.spyOn(pwaModule, "usePwaInstall").mockReturnValue({
      canInstall: true,
      promptInstall: promptInstallMock,
    });

    render(<FFCSPageView />);

    const installBtn = screen.getByRole("button", { name: /Install App/i });
    expect(installBtn).toBeDefined();
    fireEvent.click(installBtn);
    expect(promptInstallMock).toHaveBeenCalledTimes(1);

    vi.restoreAllMocks();
  });

  it("combines the page headers in Modern mode", () => {
    setLayoutMode("modern");
    const { container } = render(<FFCSPageView />);

    const main = container.querySelector("main");
    expect(main?.className).toContain("w-full");
    expect(main?.className).not.toContain("max-w-7xl");
    expect(main?.className).toContain("sm:px-6");

    const topNav = container.querySelector("nav");
    expect(topNav?.hasAttribute("hidden")).toBe(true);
    expect(screen.getByRole("link", { name: "AmazeCC home" })).toBeDefined();
    expect(
      screen.getByRole("link", { name: "AmazeCC home" }).querySelector("img")?.getAttribute("src")
    ).toContain("/favicon/favicon.svg");
    expect(screen.getByText("Amaze")).toBeDefined();
    expect(screen.getByText("CC")).toBeDefined();
  });
});
