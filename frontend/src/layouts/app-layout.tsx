import { useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { BottomNav } from "../components/navigation/bottom-nav";
import { ProfilePage } from "../pages/profile-page";
import { APP_HOME_PATH } from "../routes/app-paths";
import { safeLocalIsoDate } from "../utils/date";
import { cn } from "../utils/cn";

export function AppLayout() {
  const [selectedDate, setSelectedDate] = useState(() => new Date());
  const location = useLocation();
  const settingsSplitView = location.pathname.startsWith("/settings/");
  const ambientView =
    location.pathname === APP_HOME_PATH ||
    location.pathname === "/preview/dashboard" ||
    location.pathname === "/calendar" ||
    location.pathname === "/profile" ||
    location.pathname.startsWith("/records/") ||
    location.pathname.startsWith("/settings");

  return (
    <div className={settingsSplitView ? "settings-split-view" : undefined}>
      <div
        className={cn("app-background", ambientView && "app-background--dashboard")}
        aria-hidden="true"
      />
      {settingsSplitView ? (
        <aside className="settings-master-pane" aria-label="Settings navigation">
          <ProfilePage embedded />
        </aside>
      ) : null}
      <main className="screen-shell space-y-4">
        <Outlet context={{ selectedDate, setSelectedDate }} />
      </main>
      <BottomNav addEntryDate={safeLocalIsoDate(selectedDate)} />
    </div>
  );
}
