import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AuthProvider } from "./auth-provider";
import { useAuth } from "./use-auth";
import { markSessionActive, setStoredAccessToken } from "../../api/auth-storage";

vi.mock("../../api/endpoints", () => ({
  getCurrentUser: vi.fn(),
  login: vi.fn(),
  logout: vi.fn(),
  refreshSession: vi.fn(),
  register: vi.fn()
}));

import { getCurrentUser, login, logout, refreshSession } from "../../api/endpoints";
import { getStoredAccessToken, hasStoredSession } from "../../api/auth-storage";

function Consumer() {
  const auth = useAuth();

  return (
    <div>
      <button onClick={() => void auth.loginWithPassword("alveryn@example.com", "Password123!")}>
        Login
      </button>
      <button onClick={() => void auth.completeOAuthLogin()}>OAuth</button>
      <button onClick={() => void auth.logout()}>Logout</button>
      <span>{auth.user?.account.email ?? "guest"}</span>
    </div>
  );
}

function renderProvider() {
  const queryClient = new QueryClient();

  return render(
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <Consumer />
      </AuthProvider>
    </QueryClientProvider>
  );
}

describe("AuthProvider", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.mocked(getCurrentUser).mockResolvedValue({
      account: {
        id: "1",
        email: "alveryn@example.com",
        emailVerified: true,
        status: "ACTIVE",
        lastLoginAt: null
      },
      profile: null,
      preferences: null
    });
  });

  it("stores tokens and hydrates the user after login", async () => {
    vi.mocked(login).mockResolvedValue({
      accessToken: "access-token",
      tokenType: "Bearer",
      accessTokenExpiresIn: 900,
      user: {
        id: "1",
        email: "alveryn@example.com",
        emailVerified: true,
        status: "ACTIVE",
        lastLoginAt: null
      }
    });

    renderProvider();
    const user = userEvent.setup();

    await user.click(screen.getByText("Login"));

    expect(await screen.findByText("alveryn@example.com")).toBeInTheDocument();
    expect(getStoredAccessToken()).toBe("access-token");
    expect(hasStoredSession()).toBe(true);
  });

  it("stores tokens and hydrates the user after OAuth callback refresh", async () => {
    vi.mocked(refreshSession).mockResolvedValue({
      accessToken: "oauth-access-token",
      tokenType: "Bearer",
      accessTokenExpiresIn: 900,
      user: {
        id: "1",
        email: "alveryn@example.com",
        emailVerified: true,
        status: "ACTIVE",
        lastLoginAt: null
      }
    });

    renderProvider();
    const user = userEvent.setup();

    await user.click(screen.getByText("OAuth"));

    expect(await screen.findByText("alveryn@example.com")).toBeInTheDocument();
    expect(getStoredAccessToken()).toBe("oauth-access-token");
    expect(hasStoredSession()).toBe(true);
  });

  it("clears tokens on logout", async () => {
    vi.mocked(logout).mockResolvedValue({ message: "Logged out successfully" });
    setStoredAccessToken("access-token");
    markSessionActive();

    renderProvider();
    const user = userEvent.setup();
    await screen.findByText("alveryn@example.com");

    await user.click(screen.getByText("Logout"));

    await waitFor(() => {
      expect(getStoredAccessToken()).toBeNull();
      expect(hasStoredSession()).toBe(false);
    });
  });
});
