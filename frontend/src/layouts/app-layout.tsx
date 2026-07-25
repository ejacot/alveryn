import { useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { BottomNav } from "../components/navigation/bottom-nav";
import { ProfilePage } from "../pages/profile-page";
import { safeLocalIsoDate } from "../utils/date";

export function AppLayout() {
  const [selectedDate, setSelectedDate] = useState(() => new Date());
  const location = useLocation();
  const settingsSplitView = location.pathname.startsWith("/settings/");

  return (
    <div className={settingsSplitView ? "settings-split-view" : undefined}>
      <div className="app-background" aria-hidden="true" />
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
