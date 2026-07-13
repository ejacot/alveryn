import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { getPreferences, getProfile, listHourlyRates, listWorkTypes } from "../api/endpoints";
import { useAuth } from "../features/auth/use-auth";
import { SettingsGroup, SettingsRow } from "../components/settings/settings-group";
import { SettingsProfileCard } from "../components/settings/settings-profile-card";

export function ProfilePage() {
  const { user, logout } = useAuth();
  const profileQuery = useQuery({
    queryKey: ["settings-profile"],
    queryFn: getProfile,
    initialData: user?.profile ?? undefined
  });
  const preferencesQuery = useQuery({
    queryKey: ["settings-preferences"],
    queryFn: getPreferences,
    initialData: user?.preferences ?? undefined
  });
  const hourlyRatesQuery = useQuery({
    queryKey: ["hourly-rates"],
    queryFn: listHourlyRates
  });
  const workTypesQuery = useQuery({
    queryKey: ["work-types"],
    queryFn: listWorkTypes
  });

  const profile = profileQuery.data ?? user?.profile ?? null;
  const preferences = preferencesQuery.data ?? user?.preferences ?? null;

  const fullName = useMemo(() => {
    const composed = [profile?.firstName, profile?.lastName]
      .map((value) => value?.trim())
      .filter(Boolean)
      .join(" ");

    return composed || profile?.displayName?.trim() || "Your account";
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
      return "Not set";
    }

    const today = new Date().toISOString().slice(0, 10);
    const current =
      rates.find((rate) => rate.validFrom <= today && (!rate.validTo || rate.validTo >= today)) ??
      rates[0];

    return `${current.hourlyRate} ${current.currency}`;
  }, [hourlyRatesQuery.data]);

  const workTypesValue = useMemo(() => {
    const items = workTypesQuery.data ?? [];
    const activeCount = items.filter((item) => item.active).length;

    if (!items.length) {
      return "None";
    }

    return `${activeCount} active`;
  }, [workTypesQuery.data]);

  return (
    <div className="space-y-8 pb-10">
      <h1 className="text-[2rem] font-semibold tracking-[-0.07em] text-white">Settings</h1>

      <SettingsProfileCard
        initials={initials}
        fullName={fullName}
        email={user?.account.email ?? ""}
      />

      <SettingsGroup title="Account">
        <SettingsRow to="/settings/profile" label="Profile" />
        <div className="mx-6 h-px bg-white/[0.06]" />
        <SettingsRow to="/settings/security" label="Password & Security" />
      </SettingsGroup>

      <SettingsGroup title="Work">
        <SettingsRow to="/settings/hourly-rates" label="Hourly rates" value={hourlyRateValue} />
        <div className="mx-6 h-px bg-white/[0.06]" />
        <SettingsRow to="/settings/work-types" label="Work types" value={workTypesValue} />
      </SettingsGroup>

      <SettingsGroup title="Preferences">
        <SettingsRow
          to="/settings/preferences/language"
          label="Language"
          value={formatLanguage(preferences?.language)}
        />
        <div className="mx-6 h-px bg-white/[0.06]" />
        <SettingsRow
          to="/settings/preferences/currency"
          label="Currency"
          value={preferences?.currency ?? "EUR"}
        />
        <div className="mx-6 h-px bg-white/[0.06]" />
        <SettingsRow
          to="/settings/preferences/timezone"
          label="Timezone"
          value={preferences?.timezone ?? "Europe/Berlin"}
        />
        <div className="mx-6 h-px bg-white/[0.06]" />
        <SettingsRow
          to="/settings/preferences/appearance"
          label="Appearance"
          value={formatTheme(preferences?.theme)}
        />
        <div className="mx-6 h-px bg-white/[0.06]" />
        <SettingsRow
          to="/settings/preferences/date-format"
          label="Date format"
          value={preferences?.dateFormat ?? "DD.MM.YYYY"}
        />
        <div className="mx-6 h-px bg-white/[0.06]" />
        <SettingsRow
          to="/settings/preferences/time-format"
          label="Time format"
          value={formatTimeFormat(preferences?.timeFormat)}
        />
        <div className="mx-6 h-px bg-white/[0.06]" />
        <SettingsRow
          to="/settings/preferences/first-day-of-week"
          label="First day of week"
          value={formatFirstDay(preferences?.firstDayOfWeek)}
        />
      </SettingsGroup>

      <SettingsGroup title="Data">
        <SettingsRow to="/settings/export-data" label="Export data" />
        <div className="mx-6 h-px bg-white/[0.06]" />
        <SettingsRow to="/settings/notifications" label="Notifications" />
        <div className="mx-6 h-px bg-white/[0.06]" />
        <SettingsRow to="/settings/about" label="About Roomly" />
        <div className="mx-6 h-px bg-white/[0.06]" />
        <SettingsRow to="/settings/help" label="Help & Support" />
      </SettingsGroup>

      <SettingsGroup title="Account">
        <SettingsRow label="Log out" onClick={() => void logout()} />
      </SettingsGroup>
    </div>
  );
}

function formatLanguage(value?: string | null) {
  if (!value) {
    return "English";
  }

  const normalized = value.toLowerCase();
  if (normalized.startsWith("en")) {
    return "English";
  }
  if (normalized.startsWith("de")) {
    return "German";
  }
  if (normalized.startsWith("ro")) {
    return "Romanian";
  }

  return value;
}

function formatTheme(value?: "LIGHT" | "DARK" | "SYSTEM" | null) {
  if (!value) {
    return "System";
  }

  return value.charAt(0) + value.slice(1).toLowerCase();
}

function formatTimeFormat(value?: "H12" | "H24" | null) {
  if (value === "H12") {
    return "12-hour";
  }

  return "24-hour";
}

function formatFirstDay(value?: "MONDAY" | "SUNDAY" | null) {
  return value === "SUNDAY" ? "Sunday" : "Monday";
}
