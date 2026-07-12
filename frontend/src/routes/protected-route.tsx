import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../features/auth/use-auth";

export function ProtectedRoute() {
  const { isAuthenticated, isHydrating } = useAuth();
  const location = useLocation();

  if (isHydrating) {
    return (
      <div className="screen-shell flex min-h-screen items-center justify-center">
        <div className="glass-panel rounded-full px-5 py-3 text-sm text-white/68">
          Warming up Roomly...
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  return <Outlet />;
}
