import { Navigate, Outlet, useLocation } from "react-router-dom";
import { ScreenMessage } from "../components/ui/screen-message";
import { useAuth } from "../features/auth/use-auth";
import { APP_HOME_PATH } from "./app-paths";

export function ProtectedRoute() {
  const { isAuthenticated, isHydrating, user } = useAuth();
  const location = useLocation();

  if (isHydrating) {
    return <ScreenMessage title="Warming up Alveryn..." />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  const onboardingCompleted = user?.preferences?.onboardingCompleted === true;
  const isOnboardingRoute = location.pathname.startsWith("/onboarding");

  if (!onboardingCompleted && !isOnboardingRoute) {
    return <Navigate to="/onboarding" replace />;
  }

  if (onboardingCompleted && isOnboardingRoute) {
    return <Navigate to={APP_HOME_PATH} replace />;
  }

  return <Outlet />;
}
