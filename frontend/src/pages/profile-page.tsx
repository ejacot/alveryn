import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { queryKeys } from "../api/query-keys";
import { getPreferences, getProfile, listHourlyRates, listWorkTypes } from "../api/endpoints";
import { useAuth } from "../features/auth/use-auth";
import { SettingsGroup, SettingsRow } from "../components/settings/settings-group";
import { SettingsProfileCard } from "../components/settings/settings-profile-card";
import { todayLocalIsoDate } from "../utils/date";
import { getNativeLanguageName, normalizeLanguage } from "../i18n/language";

export function ProfilePage() {
  const { t } = useTranslation(["settings", "common"]);
  const { user, logout } = useAuth();
  const profileQuery = useQuery({
    queryKey: queryKeys.profile(),
    queryFn: getProfile,
    initialData: user?.profile ?? undefined
  });
  const preferencesQuery = useQuery({
    queryKey: queryKeys.preferences(),
    queryFn: getPreferences,
    initialData: user?.preferences ?? undefined
  });
  const hourlyRatesQuery = useQuery({
    queryKey: queryKeys.hourlyRates.all(),
    queryFn: listHourlyRates
  });
  const workTypesQuery = useQuery({
    queryKey: queryKeys.workTypes.all(),
    queryFn: listWorkTypes
  });

  const profile = profileQuery.data ?? user?.profile ?? null;
  const preferences = preferencesQuery.data ?? user?.preferences ?? null;

  const fullName = useMemo(() => {
    const composed = [profile?.firstName, profile?.lastName]
      .map((value) => value?.trim())
      .filter(Boolean)
      .join(" ");

    return composed || profile?.displayName?.trim() || user?.account.email || "Roomly";
  }, [profile?.displayName, profile?.firstName, profile?.lastName]);

  const initials = useMemo(() => {
    const source =
      [profile?.firstName, profile?.lastName]
        .map((value) => value?.trim())
        .filter(Boolean)
        .slice(0, 2)
        .map((value) => value?.charAt(0).toUpperCase())
        .join("") ||
      user?.account.email.slice(0, 2).toUpperCase() ||
      "RM";

    return source;
  }, [profile?.firstName, profile?.lastName, user?.account.email]);

  const hourlyRateValue = useMemo(() => {
    const rates = hourlyRatesQuery.data ?? [];
    if (!rates.length) {
      return t("settings:notSet");
    }

    const today = todayLocalIsoDate();
    const current =
      rates.find((rate) => rate.validFrom <= today && (!rate.validTo || rate.validTo >= today)) ??
      rates[0];

    return `${current.hourlyRate} ${current.currency}`;
  }, [hourlyRatesQuery.data, t]);

  const workTypesValue = useMemo(() => {
    const items = workTypesQuery.data ?? [];
    const activeCount = items.filter((item) => item.active).length;

    if (!items.length) {
      return "0";
    }

    return `${activeCount}`;
  }, [workTypesQuery.data]);

  return (
    <div className="space-y-8 pb-10">
      <h1 className="text-[2rem] font-semibold tracking-[-0.07em] text-white">{t("settings:title")}</h1>

      <SettingsProfileCard
        initials={initials}
        fullName={fullName}
        email={user?.account.email ?? ""}
      />

      <SettingsGroup title={t("settings:account")}>
        <SettingsRow to="/settings/profile" label={t("settings:profile")} />
      </SettingsGroup>

      <SettingsGroup title={t("settings:work")}>
        <SettingsRow to="/settings/hourly-rates" label={t("settings:hourlyRates")} value={hourlyRateValue} />
        <div className="mx-6 h-px bg-white/[0.06]" />
        <SettingsRow to="/settings/work-types" label={t("settings:workTypes")} value={workTypesValue} />
      </SettingsGroup>

      <SettingsGroup title={t("settings:preferences")}>
        <SettingsRow
          to="/settings/preferences"
          label={t("settings:preferencesFields.language")}
          value={formatLanguage(preferences?.language)}
        />
        <div className="mx-6 h-px bg-white/[0.06]" />
        <SettingsRow
          to="/settings/preferences"
          label={t("settings:preferencesFields.currency")}
          value={preferences?.currency ?? "EUR"}
        />
        <div className="mx-6 h-px bg-white/[0.06]" />
        <SettingsRow
          to="/settings/preferences"
          label={t("settings:preferencesFields.timezone")}
          value={preferences?.timezone ?? "Europe/Berlin"}
        />
      </SettingsGroup>

      <SettingsGroup title={t("settings:app")}>
        <SettingsRow to="/settings/import" label={t("settings:import.title")} />
        <div className="mx-6 h-px bg-white/[0.06]" />
        <SettingsRow to="/settings/about" label={t("settings:about")} />
        <div className="mx-6 h-px bg-white/[0.06]" />
        <SettingsRow to="/settings/help" label={t("settings:help")} />
      </SettingsGroup>

      <SettingsGroup title={t("settings:account")}>
        <SettingsRow label={t("settings:logout")} onClick={() => void logout()} />
      </SettingsGroup>
    </div>
  );
}

function formatLanguage(value?: string | null) {
  return getNativeLanguageName(normalizeLanguage(value));
}
