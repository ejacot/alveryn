import { Navigate, Outlet } from "react-router-dom";
import { ScreenMessage } from "../components/ui/screen-message";
import { useAuth } from "../features/auth/use-auth";
import { APP_HOME_PATH } from "./app-paths";

export function GuestRoute() {
  const { isAuthenticated, isHydrating, user } = useAuth();

  if (isHydrating) {
    return <ScreenMessage title="Loading session..." />;
  }

  if (isAuthenticated) {
    const destination = user?.hasBusinessWorkspace && !user.preferences?.onboardingCompleted
      ? "/business"
      : user?.preferences?.onboardingCompleted
        ? APP_HOME_PATH
        : "/onboarding";
    return (
      <Navigate to={destination} replace />
    );
  }

  return <Outlet />;
}
