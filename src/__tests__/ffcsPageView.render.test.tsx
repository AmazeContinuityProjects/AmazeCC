import React from "react";
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import FFCSPageView from "../app/ffcs/FFCSPageView";

describe("FFCSPageView", () => {
  it("renders AmazeCC brand and Login to AmazeCC, with non-sticky header and no back button", () => {
    const { container } = render(<FFCSPageView />);

    // 1. Should NOT show "Back to AmazeCC Home" or "VTOP Login"
    expect(screen.queryByText(/Back to AmazeCC Home/i)).toBeNull();
    expect(screen.queryByText(/VTOP Login/i)).toBeNull();

    // 2. Should show "AmazeCC" brand link
    const amazeccLinks = screen.getAllByRole("link", { name: /AmazeCC/i });
    expect(amazeccLinks.length).toBeGreaterThan(0);
    const homeBrandLink = amazeccLinks.find((el) => el.getAttribute("href") === "/");
    expect(homeBrandLink).toBeDefined();

    // 3. Should show "Login to AmazeCC"
    expect(screen.getByText("Login to AmazeCC")).toBeDefined();

    // 4. Header nav should not be sticky
    const nav = container.querySelector("nav");
    expect(nav).toBeDefined();
    expect(nav?.className).not.toContain("sticky");
  });
});
