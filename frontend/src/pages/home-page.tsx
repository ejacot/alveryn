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
  const monthLabel = new Intl.DateTimeFormat(undefined, {
    month: "long",
    year: "numeric"
  }).format(selectedDate);

  return (
    <div>
      <header
        className="settings-sticky-header dashboard-sticky-header dashboard-home-header fixed inset-x-0 top-0 z-40 mx-auto w-full max-w-[560px] px-5"
        data-scroll-region="page-top"
      >
        <div className="dashboard-home-header-content pb-4">
          <div className="relative flex h-10 items-center justify-between">
            <span className="text-[0.68rem] font-medium uppercase tracking-[0.18em] text-[#d5be8d]/70">
              {monthLabel}
            </span>
            <AppLogo
              wordmark
              className="dashboard-header-wordmark absolute left-1/2 -translate-x-1/2 opacity-90"
            />
          </div>
          <div className="mt-3">
            <WeekSelector value={selectedDate} onChange={setSelectedDate} showMonthLabel={false} />
          </div>
        </div>
      </header>
      <div className="dashboard-home-header-spacer" aria-hidden="true" />
      <DashboardPage selectedDate={selectedDate} />
    </div>
  );
}
