import { useState } from "react";
import { Outlet } from "react-router-dom";
import { BottomNav } from "../components/navigation/bottom-nav";
import { safeLocalIsoDate } from "../utils/date";
import { WorkspaceSwitcher } from "../components/navigation/workspace-switcher";
import { DesktopSidebar } from "../components/navigation/desktop-sidebar";

export function AppLayout() {
  const [selectedDate, setSelectedDate] = useState(() => new Date());

  return (
    <>
      <div className="app-background" aria-hidden="true" />
      <div className="desktop-app-shell">
        <DesktopSidebar addEntryDate={safeLocalIsoDate(selectedDate)} />
        <div className="desktop-content min-w-0">
          <main className="screen-shell space-y-4">
            <div className="mobile-workspace-switcher">
              <WorkspaceSwitcher />
            </div>
            <Outlet context={{ selectedDate, setSelectedDate }} />
          </main>
          <BottomNav addEntryDate={safeLocalIsoDate(selectedDate)} />
        </div>
      </div>
    </>
  );
}
