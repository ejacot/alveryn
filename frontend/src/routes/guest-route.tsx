import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../features/auth/use-auth";

export function GuestRoute() {
  const { isAuthenticated, isHydrating } = useAuth();

  if (isHydrating) {
    return (
      <div className="screen-shell flex min-h-screen items-center justify-center">
        <div className="glass-panel rounded-full px-5 py-3 text-sm text-white/68">
          Loading session...
        </div>
      </div>
    );
  }

  if (isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  return <Outlet />;
}
