import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { i18n } from "../i18n";
import { ForgotPasswordPage } from "./forgot-password-page";
import { LoginPage } from "./login-page";
import { RegisterPage } from "./register-page";

const mocks = vi.hoisted(() => ({
  login: vi.fn(),
  register: vi.fn(),
  forgot: vi.fn()
}));

vi.mock("../features/auth/use-auth", () => ({
  useAuth: () => ({ loginWithPassword: mocks.login, registerWithPassword: mocks.register })
}));

vi.mock("../api/endpoints", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../api/endpoints")>();
  return { ...actual, forgotPassword: mocks.forgot };
});

function renderPage(path: string, element: React.ReactNode) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path={path} element={element} />
          <Route path="/app" element={<div>Today destination</div>} />
          <Route path="/verify-email" element={<div>Verify destination</div>} />
          <Route path="/reset-password" element={<div>Reset destination</div>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe("integrated auth pages", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    await i18n.changeLanguage("en");
    window.localStorage.clear();
    window.sessionStorage.clear();
  });

  it("submits login once with Enter and redirects after success", async () => {
    mocks.login.mockResolvedValue(undefined);
    const user = userEvent.setup();
    renderPage("/login", <LoginPage />);
    await user.type(screen.getByLabelText("Email"), "worker@example.com");
    await user.type(screen.getByLabelText("Password"), "password123{Enter}");
    await waitFor(() => expect(mocks.login).toHaveBeenCalledTimes(1));
    expect(mocks.login).toHaveBeenCalledWith("worker@example.com", "password123");
  });

  it("announces authentication failure at form level", async () => {
    mocks.login.mockRejectedValue(new Error("unauthorized"));
    const user = userEvent.setup();
    renderPage("/login", <LoginPage />);
    await user.type(screen.getByLabelText("Email"), "worker@example.com");
    await user.type(screen.getByLabelText("Password"), "wrongpass{Enter}");
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("We couldn’t sign you in");
    expect(alert).toHaveAttribute("aria-live", "assertive");
    expect(document.activeElement).toBe(alert);
    expect(mocks.login).toHaveBeenCalledTimes(1);
  });

  it("exposes an accessible independent password visibility state", async () => {
    const user = userEvent.setup();
    renderPage("/register", <RegisterPage />);
    const password = screen.getByLabelText("Password");
    await user.type(password, "password123");
    const showButtons = screen.getAllByRole("button", { name: "Show password" });
    await user.click(showButtons[0]);
    expect(password).toHaveAttribute("type", "text");
    expect(showButtons[0]).toHaveAttribute("aria-pressed", "true");
    expect(showButtons[1]).toHaveAttribute("aria-pressed", "false");
  });

  it("blocks registration when passwords differ", async () => {
    const user = userEvent.setup();
    renderPage("/register", <RegisterPage />);
    await user.type(screen.getByLabelText("Email"), "worker@example.com");
    await user.type(screen.getByLabelText("Password"), "password123");
    await user.type(screen.getByLabelText("Confirm password"), "different123");
    await user.click(screen.getByRole("button", { name: "Create my free account" }));
    expect(await screen.findByText("Passwords must match")).toBeInTheDocument();
    expect(mocks.register).not.toHaveBeenCalled();
  });

  it("creates an account without forwarding the confirmation field", async () => {
    mocks.register.mockResolvedValue(undefined);
    const user = userEvent.setup();
    renderPage("/register", <RegisterPage />);
    await user.type(screen.getByLabelText("Email"), "worker@example.com");
    await user.type(screen.getByLabelText("Password"), "password123");
    await user.type(screen.getByLabelText("Confirm password"), "password123");
    await user.click(screen.getByRole("button", { name: "Create my free account" }));
    await waitFor(() => expect(mocks.register).toHaveBeenCalledTimes(1));
    expect(mocks.register).toHaveBeenCalledWith("worker@example.com", "password123");
    expect(await screen.findByText("Verify destination")).toBeInTheDocument();
  });

  it("requests one password reset and preserves the existing reset route", async () => {
    mocks.forgot.mockResolvedValue({ message: "Sent" });
    const user = userEvent.setup();
    renderPage("/forgot-password", <ForgotPasswordPage />);
    await user.type(screen.getByLabelText("Email"), "worker@example.com{Enter}");
    await waitFor(() => expect(mocks.forgot).toHaveBeenCalledTimes(1));
    expect(await screen.findByText("Reset destination")).toBeInTheDocument();
  });
});
