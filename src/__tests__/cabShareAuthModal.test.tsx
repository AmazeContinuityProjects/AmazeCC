import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { api } from "@/lib/sync-engine";
import { getValidAccessToken, signInInteractive } from "@/lib/oauth2";
import CabShareAuthModal from "../components/custom/hostel/CabShare/CabShareAuthModal";

vi.mock("@/lib/sync-engine", () => ({ api: vi.fn() }));
vi.mock("@/lib/oauth2", () => ({
  getValidAccessToken: vi.fn(),
  signInInteractive: vi.fn(),
}));

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

beforeEach(() => {
  vi.mocked(getValidAccessToken).mockResolvedValue("access-token");
});

describe("CabShareAuthModal", () => {
  it("authenticates through Amaze ID without sending saved VTOP credentials", async () => {
    const user = { user_id: 1, name: "Student", reg_number: "VIT123", phone_number: "9876543210" };
    vi.mocked(api).mockResolvedValueOnce(jsonResponse({ success: true, user, phone_required: false }));
    const onAuthSuccess = vi.fn();

    render(<CabShareAuthModal isOpen onAuthSuccess={onAuthSuccess} />);

    await waitFor(() => expect(onAuthSuccess).toHaveBeenCalledWith(user));
    expect(api).toHaveBeenCalledWith(
      "cabshare/auth",
      expect.objectContaining({ method: "POST", parse: "raw", body: {} }),
    );
    expect(JSON.stringify(vi.mocked(api).mock.calls)).not.toContain("secret");
  });

  it("prompts Amaze ID sign-in when there is no Amaze ID token", async () => {
    vi.mocked(getValidAccessToken).mockResolvedValueOnce(null);

    render(<CabShareAuthModal isOpen onAuthSuccess={vi.fn()} />);

    fireEvent.click(await screen.findByRole("button", { name: /sign up or sign in with amaze id/i }));
    expect(signInInteractive).toHaveBeenCalledTimes(1);
    expect(api).not.toHaveBeenCalled();
  });

  it("registers the phone through the profile API before authenticating Cab Share", async () => {
    const user = { user_id: 2, name: "Student", reg_number: "VIT456", phone_number: "9876543210" };
    vi.mocked(api)
      .mockResolvedValueOnce(
        jsonResponse({
          success: true,
          phone_required: true,
          user: { ...user, phone_number: null },
        }),
      )
      .mockResolvedValueOnce(jsonResponse({ success: true, phone_number: user.phone_number }))
      .mockResolvedValueOnce(jsonResponse({ success: true, user, phone_required: false }));
    const onAuthSuccess = vi.fn();

    render(<CabShareAuthModal isOpen onAuthSuccess={onAuthSuccess} />);

    fireEvent.change(await screen.findByLabelText(/phone number/i), { target: { value: "9876543210" } });
    fireEvent.click(screen.getByRole("button", { name: /register phone & continue/i }));

    await waitFor(() => expect(onAuthSuccess).toHaveBeenCalledWith(user));
    expect(api).toHaveBeenNthCalledWith(
      2,
      "profile/phone",
      expect.objectContaining({ method: "PATCH", body: { phone_number: "9876543210" } }),
    );
    expect(api).toHaveBeenNthCalledWith(3, "cabshare/auth", expect.any(Object));
  });

  it("offers the existing Amaze ID account page when VTOP is not linked", async () => {
    vi.mocked(api).mockResolvedValueOnce(jsonResponse({ success: false, error: "profile_incomplete" }, 403));

    render(<CabShareAuthModal isOpen onAuthSuccess={vi.fn()} />);

    const accountLink = await screen.findByRole("link", { name: /link vtop in amaze id/i });
    expect(accountLink.getAttribute("href")).toBe("https://auth.amazecc.com/account");
  });
});
