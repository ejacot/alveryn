import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { i18n } from "../i18n";
import { VerifyEmailPage } from "./verify-email-page";

const mocks = vi.hoisted(() => ({
  verifyEmail: vi.fn(),
  resendVerification: vi.fn(),
  completeEmailVerification: vi.fn()
}));

vi.mock("../api/endpoints", () => ({
  verifyEmail: mocks.verifyEmail,
  resendVerification: mocks.resendVerification
}));

vi.mock("../features/auth/use-auth", () => ({
  useAuth: () => ({ completeEmailVerification: mocks.completeEmailVerification })
}));

function apiError(status: number, message: string) {
  return {
    isAxiosError: true,
    response: {
      status,
      data: { status, message, code: null, errors: [] }
    }
  };
}

function renderVerify(email = "worker@example.com") {
  if (email) window.sessionStorage.setItem("alveryn.pendingVerificationEmail", email);
  return render(
    <MemoryRouter initialEntries={["/verify-email"]}>
      <Routes>
        <Route path="/verify-email" element={<VerifyEmailPage />} />
        <Route path="/onboarding" element={<div>Onboarding destination</div>} />
        <Route path="/register" element={<div>Register destination</div>} />
        <Route path="/login" element={<div>Sign in destination</div>} />
      </Routes>
    </MemoryRouter>
  );
}

describe("VerifyEmailPage", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    window.sessionStorage.clear();
    await i18n.changeLanguage("en");
  });

  it("restores the pending email and accepts only the backend code format", async () => {
    const user = userEvent.setup();
    renderVerify();
    expect(screen.getByText(/worker@example\.com/)).toBeInTheDocument();
    const code = screen.getByLabelText("Verification code");
    await user.type(code, "12a34-5678");
    expect(code).toHaveValue("123456");
  });

  it("submits once with Enter, announces success, then continues", async () => {
    mocks.verifyEmail.mockResolvedValue({ accessToken: "access", refreshToken: "refresh" });
    mocks.completeEmailVerification.mockResolvedValue({});
    const user = userEvent.setup();
    renderVerify();
    await user.type(screen.getByLabelText("Verification code"), "482731{Enter}");
    await waitFor(() => expect(mocks.verifyEmail).toHaveBeenCalledTimes(1));
    expect(mocks.verifyEmail).toHaveBeenCalledWith({ email: "worker@example.com", code: "482731" });
    const status = await screen.findByRole("status");
    expect(status).toHaveTextContent("Email verified.");
    expect(status).toHaveTextContent("Preparing your first record…");
    expect(status).toHaveFocus();
    expect(window.sessionStorage.getItem("alveryn.pendingVerificationEmail")).toBeNull();
    expect(await screen.findByText("Onboarding destination", {}, { timeout: 1500 })).toBeInTheDocument();
  });

  it.each([
    [401, "Invalid verification code", "That code is not correct"],
    [400, "Verification code has expired", "That code has expired"]
  ])("localizes verification failure %s", async (status, message, expected) => {
    mocks.verifyEmail.mockRejectedValue(apiError(status, message));
    const user = userEvent.setup();
    renderVerify();
    await user.type(screen.getByLabelText("Verification code"), "482731{Enter}");
    expect(await screen.findByRole("alert")).toHaveTextContent(expected);
    expect(screen.getByLabelText("Verification code")).toHaveAttribute("aria-invalid", "true");
  });

  it("resends once, reports success and starts the cooldown", async () => {
    let resolveRequest: ((value: { message: string }) => void) | undefined;
    mocks.resendVerification.mockImplementation(() => new Promise((resolve) => { resolveRequest = resolve; }));
    const user = userEvent.setup();
    renderVerify();
    const resend = screen.getByRole("button", { name: "Send a new code" });
    await user.dblClick(resend);
    expect(mocks.resendVerification).toHaveBeenCalledTimes(1);
    expect(resend).toHaveAttribute("aria-busy", "true");
    resolveRequest?.({ message: "Sent" });
    expect(await screen.findByRole("status")).toHaveTextContent("A new code has been sent.");
    expect(screen.getByRole("button", { name: /Send a new code in 60s/ })).toBeDisabled();
  });

  it("shows one safe action when the pending email is missing", () => {
    renderVerify("");
    expect(screen.queryByLabelText("Verification code")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /new code/i })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Return to sign in" })).toHaveAttribute("href", "/login");
  });

  it("clears the pending email before returning to registration", async () => {
    const user = userEvent.setup();
    renderVerify();
    await user.click(screen.getByRole("link", { name: "Use a different email" }));
    expect(window.sessionStorage.getItem("alveryn.pendingVerificationEmail")).toBeNull();
    expect(screen.getByText("Register destination")).toBeInTheDocument();
  });
});
