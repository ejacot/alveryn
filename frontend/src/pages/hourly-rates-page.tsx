import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Plus } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { getApiError } from "../api/api-errors";
import { queryKeys } from "../api/query-keys";
import { listHourlyRates } from "../api/endpoints";
import { SettingsEmptyState } from "../components/settings/settings-empty-state";
import { SettingsContextCard } from "../components/settings/settings-context-card";
import { SettingsPageSkeleton } from "../components/settings/settings-page-skeleton";
import { Button } from "../components/ui/button";
import { ScreenMessage } from "../components/ui/screen-message";
import { useSafeBackNavigation } from "../hooks/use-safe-back-navigation";
import { parseLocalIsoDate, todayLocalIsoDate } from "../utils/date";

export function HourlyRatesPage() {
  const navigate = useNavigate();
  const safeBack = useSafeBackNavigation({ fallback: "/profile" });
  const backButtonRef = useRef<HTMLButtonElement | null>(null);
  const largeTitleRef = useRef<HTMLHeadingElement | null>(null);
  const [compactTitleVisible, setCompactTitleVisible] = useState(false);
  const ratesQuery = useQuery({
    queryKey: queryKeys.hourlyRates.all(),
    queryFn: listHourlyRates
  });

  useEffect(() => {
    let frameId = 0;

    const updateCompactTitle = () => {
      window.cancelAnimationFrame(frameId);
      frameId = window.requestAnimationFrame(() => {
        const titleRect = largeTitleRef.current?.getBoundingClientRect();
        const buttonRect = backButtonRef.current?.getBoundingClientRect();

        if (!titleRect || !buttonRect) {
          setCompactTitleVisible(false);
          return;
        }

        setCompactTitleVisible(titleRect.top <= buttonRect.top);
      });
    };

    updateCompactTitle();
    window.addEventListener("scroll", updateCompactTitle, { passive: true });
    window.addEventListener("resize", updateCompactTitle);

    return () => {
      window.cancelAnimationFrame(frameId);
      window.removeEventListener("scroll", updateCompactTitle);
      window.removeEventListener("resize", updateCompactTitle);
    };
  }, []);

  if (ratesQuery.isLoading) {
    return <SettingsPageSkeleton />;
  }

  if (ratesQuery.error) {
    return <ScreenMessage title="Hourly rates are unavailable" description={getApiError(ratesQuery.error).message} />;
  }

  const rates = [...(ratesQuery.data ?? [])].sort(compareRates);
  const title = "Hourly rates";

  return (
    <div className="mx-auto w-full max-w-[560px] space-y-8 pb-10 pt-12">
      <header className="settings-sticky-header fixed inset-x-0 top-0 z-40 mx-auto flex h-[7.25rem] w-full max-w-[560px] items-start px-5 pt-2">
        <button
          ref={backButtonRef}
          type="button"
          onClick={safeBack}
          aria-label="Back"
          className="mt-[3.25rem] flex h-10 items-center gap-1.5 rounded-md px-0 text-[1.08rem] font-bold leading-none tracking-[-0.045em] text-white transition active:scale-95 focus:outline-none focus:ring-2 focus:ring-white/24"
        >
          <ArrowLeft className="h-[1.22rem] w-[1.22rem]" aria-hidden="true" />
          <span>Back</span>
        </button>
        <div
          className={`pointer-events-none absolute left-1/2 top-[3.75rem] flex h-10 -translate-x-1/2 items-center text-[1.08rem] font-bold leading-none tracking-[-0.045em] text-white transition duration-300 ${
            compactTitleVisible ? "translate-y-0 opacity-100 delay-100" : "translate-y-1 opacity-0 delay-0"
          }`}
          aria-hidden="true"
        >
          {title}
        </div>
      </header>

      <h1
        ref={largeTitleRef}
        className={`text-[2.8rem] font-semibold leading-none tracking-[-0.08em] text-white transition duration-200 ${
          compactTitleVisible ? "-translate-y-1 opacity-0" : "translate-y-0 opacity-100 delay-75"
        }`}
      >
        {title}
      </h1>
      <SettingsContextCard context="hourlyRates" />
      <Button className="w-full gap-2" onClick={() => navigate("/settings/hourly-rates/new")}>
        <Plus className="h-4 w-4" />
        Add hourly rate
      </Button>
      {rates.length === 0 ? (
        <SettingsEmptyState
          title="No hourly rates yet"
          description="Add your first rate so new entries can calculate pay correctly."
          actionLabel="Add hourly rate"
          onAction={() => navigate("/settings/hourly-rates/new")}
        />
      ) : (
        <div className="space-y-4">
          {rates.map((rate) => (
            <button
              key={rate.id}
              type="button"
              onClick={() => navigate(`/settings/hourly-rates/${rate.id}`)}
              className="dashboard-glass-card w-full px-5 py-5 text-left transition hover:bg-white/[0.06] focus:outline-none focus:ring-2 focus:ring-white/24"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-2">
                  <p className="text-[1.15rem] font-semibold tracking-[-0.05em] text-white">
                    {rate.hourlyRate} {rate.currency} / hour
                  </p>
                  <p className="text-sm text-white/48">
                    {formatDateRange(rate.validFrom, rate.validTo)}
                  </p>
                </div>
                <span className="rounded-full border border-white/[0.06] bg-white/[0.04] px-3 py-1.5 text-xs uppercase tracking-[0.18em] text-white/46">
                  {labelRate(rate)}
                </span>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function labelRate(rate: { validFrom: string; validTo: string | null }) {
  const today = todayLocalIsoDate();
  if (rate.validFrom > today) return "Future";
  if (!rate.validTo || rate.validTo >= today) return "Current";
  return "Past";
}

function compareRates(
  first: { validFrom: string; validTo: string | null },
  second: { validFrom: string; validTo: string | null }
) {
  const today = todayLocalIsoDate();
  const firstRank = rateRank(first, today);
  const secondRank = rateRank(second, today);

  if (firstRank !== secondRank) {
    return firstRank - secondRank;
  }

  return second.validFrom.localeCompare(first.validFrom);
}

function rateRank(rate: { validFrom: string; validTo: string | null }, today: string) {
  if (rate.validFrom <= today && (!rate.validTo || rate.validTo >= today)) return 0;
  if (rate.validFrom > today) return 1;
  return 2;
}

function formatDateRange(validFrom: string, validTo: string | null) {
  return `${formatDate(validFrom)} – ${validTo ? formatDate(validTo) : "Current"}`;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric"
  }).format(parseLocalIsoDate(value));
}
