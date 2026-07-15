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
      <header className="space-y-2.5 pt-1" data-scroll-region="page-top">
        <div className="space-y-2.5">
          <AppLogo />
          <WeekSelector value={selectedDate} onChange={setSelectedDate} />
        </div>
      </header>
      <DashboardPage selectedDate={selectedDate} />
    </div>
  );
}
