import { useEffect } from "react";
import { Navigate, Outlet, createBrowserRouter } from "react-router-dom";
import { RouteFallback } from "../components/ui/route-fallback";
import { RouteErrorPage } from "../components/ui/route-error-page";
import { useAuth } from "../features/auth/use-auth";
import { AdminLoginPage } from "./pages/admin-login-page";
import { FounderDashboardPage } from "../pages/founder-dashboard-page";
import { applyAppTheme } from "../utils/theme";

function AdminRoute() {
  const { user, isAuthenticated, isHydrating } = useAuth();

  useEffect(() => {
    applyAppTheme("DARK");
  }, [user]);

  if (isHydrating) return <RouteFallback />;
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (!user?.founder) return <Navigate to="/login" replace state={{ unauthorized: true }} />;
  return <Outlet />;
}

function AdminGuestRoute() {
  const { user, isHydrating } = useAuth();
  if (isHydrating) return <RouteFallback />;
  return user?.founder ? <Navigate to="/" replace /> : <AdminLoginPage />;
}

export function createAdminRouter() {
  return createBrowserRouter([
    { path: "/login", element: <AdminGuestRoute />, errorElement: <RouteErrorPage /> },
    {
      element: <AdminRoute />,
      errorElement: <RouteErrorPage />,
      children: [{ path: "/", element: <FounderDashboardPage /> }]
    },
    { path: "*", element: <Navigate to="/" replace /> }
  ]);
}
