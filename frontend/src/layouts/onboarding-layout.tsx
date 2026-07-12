import { Outlet, useLocation } from "react-router-dom";
import { AppLogo } from "../components/branding/app-logo";
import { PageTransition } from "../components/ui/page-transition";

export function OnboardingLayout() {
  const location = useLocation();

  return (
    <main className="screen-shell max-w-[560px] pb-10">
      <header className="pt-6">
        <AppLogo />
      </header>
      <PageTransition routeKey={location.pathname}>
        <Outlet />
      </PageTransition>
    </main>
  );
}
