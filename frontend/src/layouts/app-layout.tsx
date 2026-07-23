import { useState } from "react";
import { Outlet } from "react-router-dom";
import { BottomNav } from "../components/navigation/bottom-nav";
import { safeLocalIsoDate } from "../utils/date";
import { WorkspaceSwitcher } from "../components/navigation/workspace-switcher";

export function AppLayout() {
  const [selectedDate, setSelectedDate] = useState(() => new Date());

  return (
    <>
      <div className="app-background" aria-hidden="true" />
      <main className="screen-shell space-y-4">
        <WorkspaceSwitcher />
        <Outlet context={{ selectedDate, setSelectedDate }} />
      </main>
      <BottomNav addEntryDate={safeLocalIsoDate(selectedDate)} />
    </>
  );
}
