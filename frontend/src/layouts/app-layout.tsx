import { useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { BottomNav } from "../components/navigation/bottom-nav";
import { RouteScrollReset } from "../components/navigation/route-scroll-reset";
import { ProfilePage } from "../pages/profile-page";
import { APP_HOME_PATH } from "../routes/app-paths";
import { cn } from "../utils/cn";

export function AppLayout() {
  const [selectedDate, setSelectedDate] = useState(() => new Date());
  const location = useLocation();
  const settingsSplitView = location.pathname.startsWith("/settings/");
  const businessWorkspaceView = location.pathname === "/business";
  const desktopWorkspaceView = [
    APP_HOME_PATH,
    "/calendar",
    "/statistics",
    "/schedule",
    "/business",
  ].includes(location.pathname);
  const showBottomNavigation =
    !settingsSplitView && !location.pathname.startsWith("/records/");
  const ambientView =
    location.pathname === APP_HOME_PATH ||
    location.pathname === "/preview/dashboard" ||
    location.pathname === "/calendar" ||
    location.pathname === "/statistics" ||
    location.pathname === "/business" ||
    location.pathname === "/schedule" ||
    location.pathname === "/profile" ||
    location.pathname.startsWith("/records/") ||
    location.pathname.startsWith("/settings");

  return (
    <div className={settingsSplitView ? "settings-split-view" : undefined}>
      <RouteScrollReset />
      <div
        className={cn(
          "app-background",
          ambientView && "app-background--dashboard",
        )}
        aria-hidden="true"
      />
      {settingsSplitView ? (
        <aside
          className="settings-master-pane"
          aria-label="Settings navigation"
        >
          <ProfilePage embedded />
        </aside>
      ) : null}
      <main
        key={location.pathname}
        className={cn(
          "screen-shell space-y-4",
          desktopWorkspaceView && "desktop-workspace-shell",
          businessWorkspaceView && "business-workspace-shell",
        )}
      >
        <Outlet context={{ selectedDate, setSelectedDate }} />
      </main>
      {showBottomNavigation ? <BottomNav /> : null}
    </div>
  );
}
