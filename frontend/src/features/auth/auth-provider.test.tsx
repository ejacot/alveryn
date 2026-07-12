import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AuthProvider } from "./auth-provider";
import { useAuth } from "./use-auth";

vi.mock("../../api/endpoints", () => ({
  getCurrentUser: vi.fn(),
  login: vi.fn(),
  logout: vi.fn(),
  register: vi.fn()
}));

import { getCurrentUser, login, logout } from "../../api/endpoints";
import { getStoredAccessToken, getStoredRefreshToken } from "../../api/auth-storage";

function Consumer() {
  const auth = useAuth();

  return (
    <div>
      <button onClick={() => void auth.loginWithPassword("roomly@example.com", "Password123!")}>
        Login
      </button>
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
        email: "roomly@example.com",
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
      refreshToken: "refresh-token",
      tokenType: "Bearer",
      accessTokenExpiresIn: 900,
      refreshTokenExpiresAt: "2026-12-31T00:00:00Z",
      user: {
        id: "1",
        email: "roomly@example.com",
        emailVerified: true,
        status: "ACTIVE",
        lastLoginAt: null
      }
    });

    renderProvider();
    const user = userEvent.setup();

    await user.click(screen.getByText("Login"));

    expect(await screen.findByText("roomly@example.com")).toBeInTheDocument();
    expect(getStoredAccessToken()).toBe("access-token");
    expect(getStoredRefreshToken()).toBe("refresh-token");
  });

  it("clears tokens on logout", async () => {
    vi.mocked(logout).mockResolvedValue({ message: "Logged out successfully" });
    localStorage.setItem("roomly.access-token", "access-token");
    localStorage.setItem("roomly.refresh-token", "refresh-token");

    renderProvider();
    const user = userEvent.setup();
    await screen.findByText("roomly@example.com");

    await user.click(screen.getByText("Logout"));

    await waitFor(() => {
      expect(getStoredAccessToken()).toBeNull();
      expect(getStoredRefreshToken()).toBeNull();
    });
  });
});
