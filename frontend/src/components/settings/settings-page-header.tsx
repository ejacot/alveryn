import { useTranslation } from "react-i18next";
import { useSafeBackNavigation } from "../../hooks/use-safe-back-navigation";
import { SettingsNavigationHeader } from "./settings-navigation-header";

type Props = {
  title: string;
  description?: string;
  fallbackHref?: string;
  onBack?: () => void;
};

export function SettingsPageHeader({
  title,
  description,
  fallbackHref = "/profile",
  onBack
}: Props) {
  const safeBack = useSafeBackNavigation({ fallback: fallbackHref });
  const { t } = useTranslation("common");

  return (
    <div className="space-y-2">
      <SettingsNavigationHeader
        title={title}
        backLabel={t("actions.back")}
        onBack={onBack ?? safeBack}
      />
      {description ? (
        <p className="max-w-[34rem] text-sm leading-6 text-white/48">{description}</p>
      ) : null}
    </div>
  );
}
