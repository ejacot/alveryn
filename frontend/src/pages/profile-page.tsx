import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import { useTranslation } from "react-i18next";
import { queryKeys } from "../api/query-keys";
import { getPreferences, getProfile, listEmployments } from "../api/endpoints";
import { useAuth } from "../features/auth/use-auth";
import { SettingsGroup, SettingsRow } from "../components/settings/settings-group";
import { SettingsProfileCard } from "../components/settings/settings-profile-card";
import { getNativeLanguageName, normalizeLanguage } from "../i18n/language";
import { useSafeBackNavigation } from "../hooks/use-safe-back-navigation";
import { APP_HOME_PATH } from "../routes/app-paths";

type ProfilePageProps = {
  embedded?: boolean;
};

export function ProfilePage({ embedded = false }: ProfilePageProps) {
  const { t } = useTranslation(["settings", "common"]);
  const { user, logout } = useAuth();
  const safeBack = useSafeBackNavigation({ fallback: APP_HOME_PATH });
  const backButtonRef = useRef<HTMLButtonElement | null>(null);
  const largeTitleRef = useRef<HTMLHeadingElement | null>(null);
  const [compactTitleVisible, setCompactTitleVisible] = useState(false);
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
    return t("settings:employment.count", { count: activeEmployments.length });
  }, [activeEmployments, t]);

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
    <div
      className={
        embedded
          ? "settings-master-content w-full space-y-5 px-5 pb-10 pt-5"
          : "mx-auto w-full max-w-[560px] space-y-6 pb-10 pt-8"
      }
    >
      {embedded ? (
        <header className="flex min-h-12 items-center gap-3">
          <button
            type="button"
            onClick={safeBack}
            aria-label={t("common:actions.back")}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-white/64 transition hover:bg-white/[0.06] hover:text-white"
          >
            <ArrowLeft className="h-5 w-5" aria-hidden="true" />
          </button>
          <h1 className="text-[1.55rem] font-semibold tracking-[-0.055em] text-white">
            {t("settings:title")}
          </h1>
        </header>
      ) : (
        <header className="settings-sticky-header dashboard-sticky-header settings-page-sticky-header fixed inset-x-0 top-0 z-40 mx-auto flex w-full max-w-[560px] items-start px-5 pt-2">
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
      )}

      {!embedded ? (
        <h1
          ref={largeTitleRef}
          className={`text-[2.25rem] font-semibold leading-none tracking-[-0.06em] text-white transition duration-200 ${
            compactTitleVisible ? "-translate-y-1 opacity-0" : "translate-y-0 opacity-100 delay-75"
          }`}
        >
          {t("settings:title")}
        </h1>
      ) : null}

      <SettingsProfileCard
        initials={initials}
        fullName={fullName}
        email={user?.account.email ?? ""}
        ariaLabel={t("settings:profile")}
      />

      <SettingsGroup title={t("settings:work")}>
        <SettingsRow
          to={activeEmployments.length === 1 ? `/settings/employment/${activeEmployments[0].id}` : "/settings/employment"}
          label={t("settings:employment.settingsTitle")}
          value={employmentValue}
        />
      </SettingsGroup>

      <SettingsGroup title={t("settings:preferences")}>
        <SettingsRow
          to="/settings/preferences?section=region"
          label={t("settings:preferencesSections.region")}
          value={formatLanguage(preferences?.language)}
        />
        <div className="mx-5 h-px bg-white/[0.06]" />
        <SettingsRow
          to="/settings/preferences?section=date-time"
          label={t("settings:preferencesSections.dateTime")}
          value={preferences?.timeFormat === "H12" ? t("settings:preferencesOptions.time12") : t("settings:preferencesOptions.time24")}
        />
        <div className="mx-5 h-px bg-white/[0.06]" />
        <SettingsRow
          to="/settings/preferences?section=appearance"
          label={t("settings:preferencesSections.appearance")}
          value={t(`settings:preferencesOptions.${themeTranslationKey(preferences?.theme)}`)}
        />
      </SettingsGroup>

      <SettingsGroup title={t("settings:data")}>
        <SettingsRow
          to="/settings/export-pdf"
          label={t("settings:pdfExport.menuLabel")}
          description={t("settings:pageInfo.pdfExport.description")}
        />
      </SettingsGroup>

      <SettingsGroup title={t("settings:support")}>
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

function themeTranslationKey(theme?: string | null) {
  if (theme === "LIGHT") return "lightTheme";
  if (theme === "DARK") return "darkTheme";
  return "systemTheme";
}
