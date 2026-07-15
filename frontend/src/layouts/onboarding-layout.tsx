import { Outlet } from "react-router-dom";
import { AppLogo } from "../components/branding/app-logo";

export function OnboardingLayout() {
  return (
    <main className="screen-shell max-w-[560px] pb-10">
      <header className="pt-6">
        <AppLogo />
      </header>
      <Outlet />
    </main>
  );
}
