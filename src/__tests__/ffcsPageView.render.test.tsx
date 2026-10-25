import React from "react";
import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import FFCSPageView from "../app/ffcs/FFCSPageView";
import * as pwaModule from "@/lib/pwaInstall";

describe("FFCSPageView", () => {
  it("renders AmazeCC brand and Login to AmazeCC, with non-sticky header and no back button", () => {
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
});
