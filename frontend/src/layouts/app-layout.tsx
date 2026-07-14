import { useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { BottomNav } from "../components/navigation/bottom-nav";
import { MainWorkspace } from "../components/navigation/main-workspace";
import { isWorkspaceRoute } from "../components/navigation/workspace-swipe";

export function AppLayout() {
  const location = useLocation();
  const [selectedDate, setSelectedDate] = useState(() => new Date());
  const isWorkspace = isWorkspaceRoute(location.pathname);

  return (
    <>
      <div className="app-background" aria-hidden="true" />
      {isWorkspace ? (
        <MainWorkspace
          selectedDate={selectedDate}
          onSelectedDateChange={setSelectedDate}
          visible={isWorkspace}
        />
      ) : (
        <main className="screen-shell space-y-4">
          <Outlet context={{ selectedDate }} />
        </main>
      )}
      <BottomNav />
    </>
  );
}
