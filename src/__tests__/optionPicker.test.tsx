import { describe, it, expect, afterEach, beforeEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import OptionPicker from "../components/custom/shared/primitives/OptionPicker";

/**
 * The overlay contract, pinned where the amazeui original broke it.
 *
 * Two defects lived in the published component and could not be patched there:
 * the popup portal painted at `z-50` (under sheets, modals and the old bottom
 * nav), and the under-768px modal had no backdrop-tap handler at all. Every test
 * below fails against that implementation and passes against this one.
 */

const OPTIONS = [
  { value: "a", label: "Alpha" },
  { value: "b", label: "Bravo" },
  { value: "c", label: "Charlie" },
];

function setViewportWidth(px: number) {
  Object.defineProperty(window, "innerWidth", {
    value: px,
    configurable: true,
    writable: true,
  });
}

beforeEach(() => {
  setViewportWidth(1280);
});

afterEach(() => {
  cleanup();
  document.body.innerHTML = "";
  setViewportWidth(1280);
});

function openDesktop() {
  render(<OptionPicker value="b" options={OPTIONS} onChange={() => {}} />);
  fireEvent.click(screen.getByRole("button", { name: /bravo/i }));
}

function openMobile() {
  setViewportWidth(390);
  render(<OptionPicker value="b" options={OPTIONS} onChange={() => {}} />);
  fireEvent.click(screen.getByRole("button", { name: /bravo/i }));
}

describe("OptionPicker overlay", () => {
  it("paints the portal above sheet chrome", () => {
    openDesktop();
    // BottomSheet sits at z-55/60; the portal must beat both.
    const layered = [...document.body.querySelectorAll("*")].filter((el) =>
      /z-\[70\]/.test(el.className as string)
    );
    expect(layered.length).toBeGreaterThan(0);
    expect(document.body.textContent).toContain("Alpha");
  });

  it("dismisses on backdrop tap (desktop portal)", () => {
    openDesktop();
    expect(screen.getByText("Alpha")).toBeTruthy();
    fireEvent.click(screen.getByLabelText("Dismiss options"));
    expect(screen.queryByText("Alpha")).toBeNull();
  });

  it("dismisses on Escape (desktop portal)", () => {
    openDesktop();
    expect(screen.getByText("Alpha")).toBeTruthy();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByText("Alpha")).toBeNull();
  });

  it("dismisses on backdrop tap (mobile dialog)", () => {
    // amazeui's mobile modal had no tap handler on its dim layer — outside-tap
    // did nothing on phones. This is the test that fails there.
    openMobile();
    expect(screen.getByText("Alpha")).toBeTruthy();
    fireEvent.click(screen.getByLabelText("Dismiss options"));
    expect(screen.queryByText("Alpha")).toBeNull();
  });

  it("dismisses on Escape (mobile dialog)", () => {
    openMobile();
    expect(screen.getByText("Alpha")).toBeTruthy();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByText("Alpha")).toBeNull();
  });

  it("selecting an option reports the value and closes", () => {
    let seen = "";
    // Fresh width: the mobile flag is read on mount, and earlier tests in this
    // file leave it at 390.
    setViewportWidth(1280);
    render(
      <OptionPicker value="b" options={OPTIONS} onChange={(v) => (seen = v)} />
    );
    fireEvent.click(screen.getByRole("button", { name: /bravo/i }));
    fireEvent.click(screen.getByText("Alpha"));
    expect(seen).toBe("a");
    expect(screen.queryByText("Charlie")).toBeNull();
  });
});
