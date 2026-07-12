import { Navigate, Outlet } from "react-router-dom";
import { ScreenMessage } from "../components/ui/screen-message";
import { useAuth } from "../features/auth/use-auth";

export function GuestRoute() {
  const { isAuthenticated, isHydrating } = useAuth();

  if (isHydrating) {
    return <ScreenMessage title="Loading session..." />;
  }

  if (isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  return <Outlet />;
}
