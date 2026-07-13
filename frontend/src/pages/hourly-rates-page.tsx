import { useQuery } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { getApiError } from "../api/api-errors";
import { listHourlyRates } from "../api/endpoints";
import { settingsKeys } from "../features/settings/settings-keys";
import { SettingsEmptyState } from "../components/settings/settings-empty-state";
import { SettingsPageHeader } from "../components/settings/settings-page-header";
import { Button } from "../components/ui/button";
import { ScreenMessage } from "../components/ui/screen-message";

export function HourlyRatesPage() {
  const navigate = useNavigate();
  const ratesQuery = useQuery({
    queryKey: settingsKeys.hourlyRates(),
    queryFn: listHourlyRates
  });

  if (ratesQuery.isLoading) {
    return <ScreenMessage title="Loading hourly rates..." description="Bringing in your saved rate periods." />;
  }

  if (ratesQuery.error) {
    return <ScreenMessage title="Hourly rates are unavailable" description={getApiError(ratesQuery.error).message} />;
  }

  const rates = ratesQuery.data ?? [];

  return (
    <div className="space-y-8 pb-10">
      <SettingsPageHeader title="Hourly rates" description="Rates are ordered newest first and never rewrite historical work-entry amounts." />
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
              className="w-full rounded-[28px] border border-white/[0.05] bg-white/[0.035] px-5 py-5 text-left transition hover:bg-white/[0.045] focus:outline-none focus:ring-2 focus:ring-white/24"
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
  const today = new Date().toISOString().slice(0, 10);
  if (rate.validFrom > today) return "Future";
  if (!rate.validTo || rate.validTo >= today) return "Current";
  return "Past";
}

function formatDateRange(validFrom: string, validTo: string | null) {
  return `${formatDate(validFrom)} – ${validTo ? formatDate(validTo) : "Current"}`;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric"
  }).format(new Date(`${value}T00:00:00`));
}
