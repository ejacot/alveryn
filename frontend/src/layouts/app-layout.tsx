import { useMemo, useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { PREVIEW_ROUTES_ENABLED } from "../api/config";
import { AppLogo } from "../components/branding/app-logo";
import { BottomNav } from "../components/navigation/bottom-nav";
import { WeekSelector } from "../components/navigation/week-selector";
import { PageTransition } from "../components/ui/page-transition";

export function AppLayout() {
  const location = useLocation();
  const [selectedDate, setSelectedDate] = useState(() => new Date());

  const showWeekSelector = useMemo(
    () =>
      location.pathname === "/" ||
      location.pathname === "/calendar" ||
      (PREVIEW_ROUTES_ENABLED && location.pathname.startsWith("/preview")),
    [location.pathname]
  );

  return (
    <>
      <main className="screen-shell space-y-5">
        <header className="sticky top-0 z-30 -mx-5 bg-gradient-to-b from-[#050505] via-[#050505]/94 to-transparent px-5 pb-4 pt-2 backdrop-blur-xl">
          <div className="space-y-4">
            <AppLogo />
            {showWeekSelector ? (
              <WeekSelector value={selectedDate} onChange={setSelectedDate} />
            ) : null}
          </div>
        </header>
        <PageTransition routeKey={location.pathname}>
          <Outlet context={{ selectedDate }} />
        </PageTransition>
      </main>
      <BottomNav />
    </>
  );
}
