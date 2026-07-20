import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, ChevronsUpDown } from "lucide-react";
import { useTranslation } from "react-i18next";
import { queryKeys } from "../api/query-keys";
import { getPreferences, getProfile, listEmployments, updatePreferences } from "../api/endpoints";
import { useAuth } from "../features/auth/use-auth";
import { SettingsGroup, SettingsRow } from "../components/settings/settings-group";
import { SettingsProfileCard } from "../components/settings/settings-profile-card";
import { getNativeLanguageName, normalizeLanguage } from "../i18n/language";
import { applyAppLanguage } from "../i18n";
import { useSafeBackNavigation } from "../hooks/use-safe-back-navigation";
import { APP_HOME_PATH } from "../routes/app-paths";
import type { UserPreferences } from "../types/configuration";
import { getSupportedTimezones } from "../utils/timezones";
import { applyAppTheme } from "../utils/theme";
import { setEmploymentScope, useEmploymentScope } from "../features/employment/employment-scope";

export function ProfilePage() {
  const { t } = useTranslation(["settings", "common"]);
  const { user, logout } = useAuth();
  const queryClient = useQueryClient();
  const selectedEmploymentId = useEmploymentScope();
  const safeBack = useSafeBackNavigation({ fallback: APP_HOME_PATH });
  const backButtonRef = useRef<HTMLButtonElement | null>(null);
  const largeTitleRef = useRef<HTMLHeadingElement | null>(null);
  const [compactTitleVisible, setCompactTitleVisible] = useState(false);
  const supportedTimezones = useMemo(getSupportedTimezones, []);
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
  const employmentsQuery = useQuery({
    queryKey: queryKeys.employments.all(),
    queryFn: listEmployments
  });

  const profile = profileQuery.data ?? user?.profile ?? null;
  const preferences = preferencesQuery.data ?? user?.preferences ?? null;
  const preferencesMutation = useMutation({
    mutationFn: updatePreferences,
    onSuccess: (nextPreferences) => {
      queryClient.setQueryData(queryKeys.preferences(), nextPreferences);
      applyAppLanguage(nextPreferences.language);
      applyAppTheme(nextPreferences.theme);
    }
  });

  const updatePreference = <Key extends keyof Pick<UserPreferences, "language" | "timezone" | "currency" | "firstDayOfWeek" | "timeFormat" | "dateFormat" | "theme">>(
    key: Key,
    value: UserPreferences[Key]
  ) => {
    if (!preferences || preferences[key] === value) {
      return;
    }

    preferencesMutation.mutate({
      language: preferences.language,
      timezone: preferences.timezone,
      currency: preferences.currency,
      firstDayOfWeek: preferences.firstDayOfWeek,
      dateFormat: preferences.dateFormat,
      timeFormat: preferences.timeFormat,
      theme: preferences.theme,
      defaultBreakMinutes: preferences.defaultBreakMinutes,
      preferredDailyMinutes: preferences.preferredDailyMinutes,
      paidSickLeave: preferences.paidSickLeave,
      paidVacation: preferences.paidVacation,
      [key]: value
    });
  };

  const fullName = useMemo(() => {
    const composed = [profile?.firstName, profile?.lastName]
      .map((value) => value?.trim())
      .filter(Boolean)
      .join(" ");

    return composed || profile?.displayName?.trim() || user?.account.email || "Alveryn";
  }, [profile?.displayName, profile?.firstName, profile?.lastName, user?.account.email]);

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

  const activeEmployments = useMemo(
    () => (employmentsQuery.data ?? []).filter((employment) => employment.active),
    [employmentsQuery.data]
  );
  const employmentValue = useMemo(() => {
    if (!activeEmployments.length) return t("settings:employment.none");
    if (activeEmployments.length === 1) return activeEmployments[0].name;
    return selectedEmploymentId
      ? activeEmployments.find((employment) => employment.id === selectedEmploymentId)?.name ?? t("settings:employment.all")
      : t("settings:employment.all");
  }, [activeEmployments, selectedEmploymentId, t]);
  const employmentLabel = t(
    activeEmployments.length > 1
      ? "settings:profileEditor.employments"
      : "settings:profileEditor.employment"
  );

  useEffect(() => {
    if (!employmentsQuery.isSuccess) return;
    if (activeEmployments.length === 1 && selectedEmploymentId !== activeEmployments[0].id) {
      setEmploymentScope(activeEmployments[0].id);
      return;
    }
    if (!activeEmployments.length || (selectedEmploymentId && !activeEmployments.some((employment) => employment.id === selectedEmploymentId))) {
      setEmploymentScope(null);
    }
  }, [activeEmployments, employmentsQuery.isSuccess, selectedEmploymentId]);

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

  return (
    <div className="mx-auto w-full max-w-[560px] space-y-6 pb-10 pt-8">
      <header className="settings-sticky-header fixed inset-x-0 top-0 z-40 mx-auto flex w-full max-w-[560px] items-start px-5 pt-2">
        <button
          ref={backButtonRef}
          type="button"
          onClick={safeBack}
          aria-label={t("common:actions.back")}
          className="settings-sticky-header-control flex h-9 items-center gap-1.5 rounded-md px-0 text-[1rem] font-bold leading-none tracking-[-0.035em] text-white transition active:scale-95 focus:outline-none focus:ring-2 focus:ring-white/24"
        >
          <ArrowLeft className="h-[1.22rem] w-[1.22rem]" aria-hidden="true" />
          <span>{t("common:actions.back")}</span>
        </button>
        <div
          className={`settings-sticky-header-title pointer-events-none absolute left-1/2 flex h-9 -translate-x-1/2 items-center text-[1rem] font-bold leading-none tracking-[-0.035em] text-white transition duration-300 ${
            compactTitleVisible ? "translate-y-0 opacity-100 delay-100" : "translate-y-1 opacity-0 delay-0"
          }`}
          aria-hidden="true"
        >
          {t("settings:title")}
        </div>
      </header>

      <h1
        ref={largeTitleRef}
        className={`text-[2.25rem] font-semibold leading-none tracking-[-0.06em] text-white transition duration-200 ${
          compactTitleVisible ? "-translate-y-1 opacity-0" : "translate-y-0 opacity-100 delay-75"
        }`}
      >
        {t("settings:title")}
      </h1>

      <SettingsProfileCard
        initials={initials}
        fullName={fullName}
        email={user?.account.email ?? ""}
        ariaLabel={t("settings:profile")}
        employmentLabel={employmentLabel}
        employmentValue={employmentValue}
        employmentOptions={activeEmployments.map(({ id, name }) => ({ id, name }))}
        selectedEmploymentId={selectedEmploymentId}
        allEmploymentsLabel={t("settings:employment.all")}
        chooseEmploymentLabel={t("settings:employment.choose")}
        onEmploymentChange={setEmploymentScope}
      />

      <SettingsGroup title={t("settings:preferences")}>
        <InlinePreferenceRow
          label={t("settings:preferencesFields.language")}
          value={preferences?.language ?? "en"}
          disabled={!preferences || preferencesMutation.isPending}
          onChange={(value) => updatePreference("language", value)}
          options={["en", "de", "ro"].map((language) => ({ value: language, label: formatLanguage(language) }))}
        />
        <div className="mx-5 h-px bg-white/[0.06]" />
        <InlinePreferenceRow
          label={t("settings:preferencesFields.timezone")}
          value={preferences?.timezone ?? "Europe/Berlin"}
          disabled={!preferences || preferencesMutation.isPending}
          onChange={(value) => updatePreference("timezone", value)}
          options={supportedTimezones.map((timezone) => ({ value: timezone, label: timezone }))}
        />
        <div className="mx-5 h-px bg-white/[0.06]" />
        <InlinePreferenceRow
          label={t("settings:preferencesFields.currency")}
          value={preferences?.currency ?? "EUR"}
          disabled={!preferences || preferencesMutation.isPending}
          onChange={(value) => updatePreference("currency", value)}
          options={["EUR", "USD", "GBP", "CHF", "PLN", "RON"].map((currency) => ({ value: currency, label: currency }))}
        />
        <div className="mx-5 h-px bg-white/[0.06]" />
        <InlinePreferenceRow
          label={t("settings:preferencesFields.firstDayOfWeek")}
          value={preferences?.firstDayOfWeek ?? "MONDAY"}
          disabled={!preferences || preferencesMutation.isPending}
          onChange={(value) => updatePreference("firstDayOfWeek", value as UserPreferences["firstDayOfWeek"])}
          options={[
            { value: "MONDAY", label: t("settings:preferencesOptions.monday") },
            { value: "SUNDAY", label: t("settings:preferencesOptions.sunday") }
          ]}
        />
        <div className="mx-5 h-px bg-white/[0.06]" />
        <InlinePreferenceRow
          label={t("settings:preferencesFields.timeFormat")}
          value={preferences?.timeFormat ?? "H24"}
          disabled={!preferences || preferencesMutation.isPending}
          onChange={(value) => updatePreference("timeFormat", value as UserPreferences["timeFormat"])}
          options={[
            { value: "H24", label: t("settings:preferencesOptions.time24") },
            { value: "H12", label: t("settings:preferencesOptions.time12") }
          ]}
        />
        <div className="mx-5 h-px bg-white/[0.06]" />
        <InlinePreferenceRow
          label={t("settings:preferencesFields.dateFormat")}
          value={preferences?.dateFormat ?? "DD.MM.YYYY"}
          disabled={!preferences || preferencesMutation.isPending}
          onChange={(value) => updatePreference("dateFormat", value)}
          options={[
            { value: "DD.MM.YYYY", label: "31.12.2026" },
            { value: "MM/DD/YYYY", label: "12/31/2026" },
            { value: "YYYY-MM-DD", label: "2026-12-31" }
          ]}
        />
        <div className="mx-5 h-px bg-white/[0.06]" />
        <InlinePreferenceRow
          label={t("settings:preferencesFields.theme")}
          value={preferences?.theme ?? "SYSTEM"}
          disabled={!preferences || preferencesMutation.isPending}
          onChange={(value) => updatePreference("theme", value as UserPreferences["theme"])}
          options={[
            { value: "SYSTEM", label: t("settings:preferencesOptions.systemTheme") },
            { value: "LIGHT", label: t("settings:preferencesOptions.lightTheme") },
            { value: "DARK", label: t("settings:preferencesOptions.darkTheme") }
          ]}
        />
      </SettingsGroup>

      <SettingsGroup title={t("settings:app")}>
        <SettingsRow to="/settings/export-pdf" label={t("settings:pdfExport.menuLabel")} />
        <div className="mx-5 h-px bg-white/[0.06]" />
        <SettingsRow to="/settings/about" label={t("settings:about")} />
        <div className="mx-5 h-px bg-white/[0.06]" />
        <SettingsRow to="/settings/help" label={t("settings:help")} />
      </SettingsGroup>

      <SettingsGroup title={t("settings:account")}>
        <SettingsRow
          label={t("settings:logout")}
          onClick={() => void logout()}
          destructive
        />
      </SettingsGroup>
    </div>
  );
}

function formatLanguage(value?: string | null) {
  return getNativeLanguageName(normalizeLanguage(value));
}

function InlinePreferenceRow({
  label,
  value,
  options,
  disabled,
  onChange
}: {
  label: string;
  value: string;
  options: Array<{ value: string; label: string }>;
  disabled: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <label className="flex min-h-14 w-full items-center justify-between gap-4 px-5 py-3">
      <span className="min-w-0 text-[1rem] tracking-[-0.02em] text-white">{label}</span>
      <span className="flex min-w-0 max-w-[62%] items-center gap-3">
        <select
          aria-label={label}
          value={value}
          disabled={disabled}
          onChange={(event) => onChange(event.currentTarget.value)}
          style={{ textAlignLast: "right" }}
          className="min-w-0 flex-1 cursor-pointer appearance-none truncate border-0 bg-transparent py-2 text-right text-sm text-white/48 outline-none transition focus:text-white focus:ring-2 focus:ring-white/24 disabled:cursor-wait disabled:opacity-55"
        >
          {options.map((option) => (
            <option key={option.value} value={option.value}>{option.label}</option>
          ))}
        </select>
        <ChevronsUpDown className="h-4 w-4 shrink-0 text-white/24" aria-hidden="true" />
      </span>
    </label>
  );
}
