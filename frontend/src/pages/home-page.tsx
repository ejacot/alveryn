import { useOutletContext } from "react-router-dom";
import { AppLogo } from "../components/branding/app-logo";
import { WeekSelector } from "../components/navigation/week-selector";
import { DashboardPage } from "./dashboard-page";

type OutletContext = {
  selectedDate: Date;
  setSelectedDate: (date: Date) => void;
};

export function HomePage() {
  const { selectedDate, setSelectedDate } = useOutletContext<OutletContext>();

  return (
    <div className="space-y-4">
      <div
        className="settings-sticky-header pointer-events-none fixed inset-x-0 top-0 z-30 mx-auto h-[7.25rem] w-full max-w-[560px]"
      >
        <AppLogo className="relative z-10 pt-[max(0.85rem,env(safe-area-inset-top))]" />
      </div>
      <header className="space-y-2.5 pt-1" data-scroll-region="page-top">
        <div className="space-y-2.5">
          <div className="h-[0.95rem]" aria-hidden="true" />
          <WeekSelector value={selectedDate} onChange={setSelectedDate} />
        </div>
      </header>
      <DashboardPage selectedDate={selectedDate} />
    </div>
  );
}
