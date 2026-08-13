import { Outlet } from "react-router-dom";
import { RouteScrollReset } from "../components/navigation/route-scroll-reset";

export function AuthLayout() {
  return (
    <div className="auth-route-shell min-h-[100dvh] overflow-x-hidden">
      <RouteScrollReset />
      <Outlet />
    </div>
  );
}
