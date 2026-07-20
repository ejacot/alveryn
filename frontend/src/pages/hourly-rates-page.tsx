import { useQuery } from "@tanstack/react-query";
import { ChevronRight, Plus } from "lucide-react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { getApiError } from "../api/api-errors";
import { queryKeys } from "../api/query-keys";
import { listHourlyRates } from "../api/endpoints";
import { SettingsEmptyState } from "../components/settings/settings-empty-state";
import { SettingsPageSkeleton } from "../components/settings/settings-page-skeleton";
import { SettingsNavigationHeader } from "../components/settings/settings-navigation-header";
import { Card } from "../components/ui/card";
import { ScreenMessage } from "../components/ui/screen-message";
import { useSafeBackNavigation } from "../hooks/use-safe-back-navigation";
import { parseLocalIsoDate, todayLocalIsoDate } from "../utils/date";

export function HourlyRatesPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const employmentId = searchParams.get("employmentId");
  const safeBack = useSafeBackNavigation({ fallback: employmentId ? `/settings/employment/${employmentId}` : "/profile" });
  const ratesQuery = useQuery({
    queryKey: queryKeys.hourlyRates.all(),
    queryFn: listHourlyRates
  });

  if (ratesQuery.isLoading) {
    return <SettingsPageSkeleton />;
  }

  if (ratesQuery.error) {
    return <ScreenMessage title="Hourly rates are unavailable" description={getApiError(ratesQuery.error).message} />;
  }

  const rates = [...(ratesQuery.data ?? [])]
    .filter((rate) => !employmentId || rate.employmentId === employmentId)
    .sort(compareRates);
  const title = "Hourly rates";
  const newRatePath = employmentId
    ? `/settings/hourly-rates/new?employmentId=${employmentId}`
    : "/settings/hourly-rates/new";

  return (
    <div className="mx-auto w-full max-w-[560px] space-y-6 pb-10 pt-8">
      <SettingsNavigationHeader
        title={title}
        backLabel="Back"
        onBack={safeBack}
        action={rates.length > 0 ? {
          label: "Add hourly rate",
          icon: <Plus className="h-5 w-5" aria-hidden="true" />,
          onClick: () => navigate(newRatePath)
        } : undefined}
      />
      {rates.length === 0 ? (
        <SettingsEmptyState
          title="No hourly rates yet"
          actionLabel="Add hourly rate"
          onAction={() => navigate(newRatePath)}
        />
      ) : (
        <section className="space-y-4">
          {rates.map((rate) => (
            <Card
              as="button"
              type="button"
              key={rate.id}
              onClick={() => navigate(`/settings/hourly-rates/${rate.id}${employmentId ? `?employmentId=${employmentId}` : ""}`)}
              className="flex min-h-[5.25rem] w-full items-center justify-between gap-4 px-5 py-4 text-left transition hover:bg-white/[0.06] focus:outline-none focus:ring-2 focus:ring-white/24 focus:ring-inset"
            >
              <span className="min-w-0 flex-1">
                <span className="font-name block truncate text-[1.05rem] font-semibold tracking-[-0.04em] text-white">
                  {rate.hourlyRate} {rate.currency} / hour
                </span>
                <span className="mt-1 block truncate text-sm text-white/48">
                  {formatDateRange(rate.validFrom, rate.validTo)} · {labelRate(rate)}
                </span>
                {!employmentId && rate.employmentName ? (
                  <span className="mt-1 block truncate text-sm text-white/38">{rate.employmentName}</span>
                ) : null}
              </span>
              <ChevronRight className="h-4 w-4 shrink-0 text-white/24" aria-hidden="true" />
            </Card>
          ))}
        </section>
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
