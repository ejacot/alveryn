import type { ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { AuthContext, type AuthContextValue } from "../features/auth/auth-context";
import { APP_HOME_PATH } from "./app-paths";
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
  completeEmailVerification: vi.fn(),
  completeOAuthLogin: vi.fn(),
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
        <Route path={APP_HOME_PATH} element={<div>Dashboard</div>} />
        <Route path="/onboarding" element={<div>Onboarding</div>} />
      </Routes>,
      {
        route: "/login",
        authValue: {
          ...baseAuthValue,
          isAuthenticated: true,
          user: {
            account: {
              id: "1",
              email: "alveryn@example.com",
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

    expect(await screen.findByText("Onboarding")).toBeInTheDocument();
  });

  it("sends invited Business users from guest routes directly to Business", async () => {
    renderWithAuth(
      <Routes>
        <Route element={<GuestRoute />}>
          <Route path="/login" element={<div>Login</div>} />
        </Route>
        <Route path="/business" element={<div>Business</div>} />
      </Routes>,
      {
        route: "/login",
        authValue: {
          ...baseAuthValue,
          isAuthenticated: true,
          user: {
            account: {
              id: "1",
              email: "invited@example.com",
              emailVerified: true,
              status: "ACTIVE",
              lastLoginAt: null
            },
            profile: null,
            preferences: null,
            hasBusinessWorkspace: true
          }
        }
      }
    );

    expect(await screen.findByText("Business")).toBeInTheDocument();
  });

  it("redirects authenticated users into tracking setup before onboarding", async () => {
    renderWithAuth(
      <Routes>
        <Route element={<ProtectedRoute />}>
          <Route path={APP_HOME_PATH} element={<div>Dashboard</div>} />
          <Route path="/onboarding" element={<div>Onboarding</div>} />
          <Route path="/tracking-setup" element={<div>Tracking setup</div>} />
        </Route>
      </Routes>,
      {
        route: APP_HOME_PATH,
        authValue: {
          ...baseAuthValue,
          isAuthenticated: true,
          user: {
            account: {
              id: "1",
              email: "alveryn@example.com",
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

    expect(await screen.findByText("Tracking setup")).toBeInTheDocument();
  });

  it("lets invited Business users bypass Personal setup", async () => {
    const invitedBusinessUser: AuthContextValue = {
      ...baseAuthValue,
      isAuthenticated: true,
      user: {
        account: {
          id: "1",
          email: "invited@example.com",
          emailVerified: true,
          status: "ACTIVE",
          lastLoginAt: null
        },
        profile: null,
        preferences: null,
        hasBusinessWorkspace: true
      }
    };

    const routes = (
      <Routes>
        <Route element={<ProtectedRoute />}>
          <Route path={APP_HOME_PATH} element={<div>Dashboard</div>} />
          <Route path="/onboarding" element={<div>Onboarding</div>} />
          <Route path="/tracking-setup" element={<div>Tracking setup</div>} />
          <Route path="/business" element={<div>Business</div>} />
        </Route>
      </Routes>
    );

    const { unmount } = renderWithAuth(routes, {
      route: APP_HOME_PATH,
      authValue: invitedBusinessUser
    });
    expect(await screen.findByText("Business")).toBeInTheDocument();

    unmount();
    renderWithAuth(routes, { route: "/business", authValue: invitedBusinessUser });
    expect(await screen.findByText("Business")).toBeInTheDocument();
  });

  it("continues into profile onboarding after tracking setup", async () => {
    renderWithAuth(
      <Routes>
        <Route element={<ProtectedRoute />}>
          <Route path={APP_HOME_PATH} element={<div>Dashboard</div>} />
          <Route path="/onboarding" element={<div>Onboarding</div>} />
          <Route path="/tracking-setup" element={<div>Tracking setup</div>} />
        </Route>
      </Routes>,
      {
        route: APP_HOME_PATH,
        authValue: {
          ...baseAuthValue,
          isAuthenticated: true,
          user: {
            account: {
              id: "1",
              email: "alveryn@example.com",
              emailVerified: true,
              status: "ACTIVE",
              lastLoginAt: null
            },
            profile: null,
            preferences: {
              id: "pref-1",
              language: "en",
              timezone: "Europe/Berlin",
              currency: "EUR",
              firstDayOfWeek: "MONDAY",
              dateFormat: "dd/MM/yyyy",
              timeFormat: "H24",
              theme: "DARK",
              defaultBreakMinutes: 30,
              preferredDailyMinutes: 480,
              paidSickLeave: true,
              paidVacation: true,
              onboardingCompleted: false,
              trackingSetupVersionCompleted: 1
            }
          }
        }
      }
    );

    expect(await screen.findByText("Onboarding")).toBeInTheDocument();
  });

  it("allows authenticated users with completed onboarding into the app", async () => {
    renderWithAuth(
      <Routes>
        <Route element={<ProtectedRoute />}>
          <Route path={APP_HOME_PATH} element={<div>Dashboard</div>} />
        </Route>
      </Routes>,
      {
        route: APP_HOME_PATH,
        authValue: {
          ...baseAuthValue,
          isAuthenticated: true,
          user: {
            account: {
              id: "1",
              email: "alveryn@example.com",
              emailVerified: true,
              status: "ACTIVE",
              lastLoginAt: null
            },
            profile: null,
            preferences: {
              id: "pref-1",
              language: "en",
              timezone: "Europe/Berlin",
              currency: "EUR",
              firstDayOfWeek: "MONDAY",
              dateFormat: "dd/MM/yyyy",
              timeFormat: "H24",
              theme: "DARK",
              defaultBreakMinutes: 30,
              preferredDailyMinutes: 480,
              paidSickLeave: true,
              paidVacation: true,
              onboardingCompleted: true,
              trackingSetupVersionCompleted: 1
            }
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

    expect(screen.getByText("Warming up Alveryn...")).toBeInTheDocument();
  });
});
