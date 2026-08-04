import packageJson from "../../package.json";
import { useTranslation } from "react-i18next";
import { Fingerprint, Sparkles } from "lucide-react";
import { SettingsPageHeader } from "../components/settings/settings-page-header";
import { SettingsContextCard } from "../components/settings/settings-context-card";
import { SettingsSection } from "../components/settings/settings-section";

export function AboutAlverynPage() {
  const { t } = useTranslation("settings");
  return (
    <div className="space-y-6 pb-10 pt-4">
      <SettingsPageHeader title={t("aboutPage.title")} />
      <SettingsContextCard context="about" />
      <SettingsSection title={t("aboutPage.product")}>
        <div className="text-center text-sm leading-6 text-white/58">
          <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-[20px] border border-[#10b981]/20 bg-[#10b981]/[0.08] text-[#10b981]"><Sparkles className="h-6 w-6" /></div>
          <p className="font-name text-xl font-semibold tracking-[-0.05em] text-white">Alveryn</p>
          <p className="mt-1 text-white/42">{t("aboutPage.version", { version: packageJson.version })}</p>
          <p className="mx-auto mt-4 max-w-sm">{t("aboutPage.productDescription")}</p>
        </div>
      </SettingsSection>
      <SettingsSection title={t("aboutPage.privacy")}>
        <div className="text-sm leading-6 text-white/58">
          <div className="mb-3 flex items-center gap-3 text-white"><Fingerprint className="h-5 w-5 text-[#10b981]" /><span>{t("aboutPage.privacyTitle")}</span></div>
          <p>{t("aboutPage.privacyDescription")}</p>
        </div>
      </SettingsSection>
    </div>
  );
}
