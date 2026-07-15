import { useState } from "react";
import { Outlet } from "react-router-dom";
import { BottomNav } from "../components/navigation/bottom-nav";
import { formatLocalIsoDate } from "../utils/date";

export function AppLayout() {
  const [selectedDate, setSelectedDate] = useState(() => new Date());

  return (
    <>
      <div className="app-background" aria-hidden="true" />
      <main className="screen-shell space-y-4">
        <Outlet context={{ selectedDate, setSelectedDate }} />
      </main>
      <BottomNav addEntryDate={formatLocalIsoDate(selectedDate)} />
    </>
  );
}
