import { Outlet } from "react-router-dom";
import { AppLogo } from "../components/branding/app-logo";
import { RouteScrollReset } from "../components/navigation/route-scroll-reset";

export function OnboardingLayout() {
  return (
    <main className="screen-shell max-w-[560px] pb-10">
      <RouteScrollReset />
      <header className="pt-6">
        <AppLogo />
      </header>
      <Outlet />
    </main>
  );
}
