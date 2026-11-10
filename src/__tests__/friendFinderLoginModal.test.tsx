import { describe, expect, it, afterEach, vi } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import FriendFinderLoginModal from "../components/custom/friendfinder/FriendFinderLoginModal";

afterEach(() => {
  cleanup();
  document.body.style.overflow = "";
  vi.restoreAllMocks();
});

describe("FriendFinderLoginModal", () => {
  it("renders nothing when open is false", () => {
    const { container } = render(<FriendFinderLoginModal open={false} onClose={() => {}} />);
    expect(container.firstChild).toBeNull();
  });

  it("renders modal with username, password, sync engine console, and AmazeCC statement when open", () => {
    render(<FriendFinderLoginModal open={true} onClose={() => {}} />);

    // Title and Subtitle
    expect(screen.getAllByText("Sign in with VTOP").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("AmazeCC Unified Sync Engine")).toBeDefined();

    // Statement that logging in logs the user into the rest of AmazeCC
    expect(screen.getByText(/Logging in here will log you into the rest of/i)).toBeDefined();
    expect(screen.getByText(/Unified Amaze Continuity Projects Sign-In/i)).toBeDefined();

    // Sync Engine console
    expect(screen.getByText("Sync Engine Console")).toBeDefined();
    expect(screen.getByText(/vtopcc\.vit\.ac\.in/i)).toBeDefined();

    // Username and Password inputs
    expect(screen.getByLabelText(/VTOP Username/i)).toBeDefined();
    expect(screen.getByLabelText(/VTOP Password/i)).toBeDefined();

    // Sign in CTA
    const submitBtn = screen.getByRole("button", { name: /Sign in with VTOP/i });
    expect(submitBtn).toBeDefined();
  });

  it("toggles password visibility when the eye button is clicked", () => {
    render(<FriendFinderLoginModal open={true} onClose={() => {}} />);

    const passwordInput = screen.getByLabelText(/VTOP Password/i) as HTMLInputElement;
    expect(passwordInput.type).toBe("password");

    const toggleBtn = screen.getByRole("button", { name: /Show password/i });
    fireEvent.click(toggleBtn);
    expect(passwordInput.type).toBe("text");

    const hideBtn = screen.getByRole("button", { name: /Hide password/i });
    fireEvent.click(hideBtn);
    expect(passwordInput.type).toBe("password");
  });

  it("calls onClose when the cancel button is clicked", () => {
    const handleClose = vi.fn();
    render(<FriendFinderLoginModal open={true} onClose={handleClose} />);

    const cancelBtn = screen.getByRole("button", { name: /Cancel/i });
    fireEvent.click(cancelBtn);
    expect(handleClose).toHaveBeenCalledTimes(1);
  });
});
