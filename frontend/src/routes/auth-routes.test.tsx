import type { ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { AuthContext, type AuthContextValue } from "../features/auth/auth-context";
import { GuestRoute } from "./guest-route";
import { ProtectedRoute } from "./protected-route";

function renderWithAuth(
  ui: ReactNode,
  {
    route = "/",
    authValue
  }: {
    route?: string;
    authValue: AuthContextValue;
  }
) {
  const queryClient = new QueryClient();

  return render(
    <QueryClientProvider client={queryClient}>
      <AuthContext.Provider value={authValue}>
        <MemoryRouter initialEntries={[route]}>{ui}</MemoryRouter>
      </AuthContext.Provider>
    </QueryClientProvider>
  );
}

const baseAuthValue: AuthContextValue = {
  user: null,
  isAuthenticated: false,
  isHydrating: false,
  loginWithPassword: vi.fn(),
  registerWithPassword: vi.fn(),
  logout: vi.fn(),
  refreshCurrentUser: vi.fn()
};

describe("auth routes", () => {
  it("redirects guests away from protected routes", async () => {
    renderWithAuth(
      <Routes>
        <Route element={<ProtectedRoute />}>
          <Route path="/" element={<div>Private</div>} />
        </Route>
        <Route path="/login" element={<div>Login</div>} />
      </Routes>,
      { authValue: baseAuthValue }
    );

    expect(await screen.findByText("Login")).toBeInTheDocument();
  });

  it("redirects authenticated users away from guest routes", async () => {
    renderWithAuth(
      <Routes>
        <Route element={<GuestRoute />}>
          <Route path="/login" element={<div>Login</div>} />
        </Route>
        <Route path="/" element={<div>Dashboard</div>} />
      </Routes>,
      {
        route: "/login",
        authValue: {
          ...baseAuthValue,
          isAuthenticated: true,
          user: {
            account: {
              id: "1",
              email: "roomly@example.com",
              emailVerified: true,
              status: "ACTIVE",
              lastLoginAt: null
            },
            profile: null,
            preferences: null
          }
        }
      }
    );

    expect(await screen.findByText("Dashboard")).toBeInTheDocument();
  });

  it("shows a hydration loading state before auth is known", () => {
    renderWithAuth(
      <Routes>
        <Route element={<ProtectedRoute />}>
          <Route path="/" element={<div>Private</div>} />
        </Route>
      </Routes>,
      {
        authValue: {
          ...baseAuthValue,
          isHydrating: true
        }
      }
    );

    expect(screen.getByText("Warming up Roomly...")).toBeInTheDocument();
  });
});
