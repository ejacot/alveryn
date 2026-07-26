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
      <div
        className="settings-sticky-header dashboard-sticky-header pointer-events-none fixed inset-x-0 top-0 z-30 mx-auto w-full max-w-[560px]"
      >
        <div className="relative top-16 z-10 flex h-9 items-center px-5">
          <span className="hairline-text whitespace-nowrap">{monthLabel}</span>
          <AppLogo
            wordmark
            className="dashboard-header-wordmark absolute left-1/2 -translate-x-1/2"
          />
        </div>
        <div className="dashboard-header-week pointer-events-auto absolute inset-x-5 top-[6.35rem] z-10">
          <WeekSelector value={selectedDate} onChange={setSelectedDate} showMonthLabel={false} />
        </div>
      </div>
      <header className="pt-1" data-scroll-region="page-top">
        <div className="h-[7.25rem]" aria-hidden="true" />
      </header>
      <DashboardPage selectedDate={selectedDate} />
    </div>
  );
}
