import { Navigate, Outlet, useLocation } from "react-router-dom";
import { ScreenMessage } from "../components/ui/screen-message";
import { useAuth } from "../features/auth/use-auth";

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
    return <Navigate to="/" replace />;
  }

  return <Outlet />;
}
