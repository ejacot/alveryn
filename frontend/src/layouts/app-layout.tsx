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
      (PREVIEW_ROUTES_ENABLED && location.pathname.startsWith("/preview")),
    [location.pathname]
  );

  return (
    <>
      <main className="screen-shell space-y-4">
        <header className="space-y-2.5 pt-1" data-scroll-region="page-top">
          <div className="space-y-2.5">
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
