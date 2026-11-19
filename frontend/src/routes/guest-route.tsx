import { Navigate, Outlet } from "react-router-dom";
import { ScreenMessage } from "../components/ui/screen-message";
import { useAuth } from "../features/auth/use-auth";
import { authenticatedHomePath } from "./app-paths";

export function GuestRoute() {
  const { isAuthenticated, isHydrating, user } = useAuth();

  if (isHydrating) {
    return <ScreenMessage title="Loading session..." />;
  }

  if (isAuthenticated) {
    return (
      <Navigate to={authenticatedHomePath(user)} replace />
    );
  }

  return <Outlet />;
}
