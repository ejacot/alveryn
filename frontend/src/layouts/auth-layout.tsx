import { Outlet, useLocation } from "react-router-dom";
import { PageTransition } from "../components/ui/page-transition";

export function AuthLayout() {
  const location = useLocation();

  return (
    <PageTransition routeKey={location.pathname}>
      <Outlet />
    </PageTransition>
  );
}
