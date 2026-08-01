import { SUPPORT_EMAIL } from "../api/config";
import { useTranslation } from "react-i18next";
import { Mail, MessageCircle } from "lucide-react";
import { SettingsPageHeader } from "../components/settings/settings-page-header";
import { SettingsContextCard } from "../components/settings/settings-context-card";
import { SettingsSection } from "../components/settings/settings-section";

export function HelpSupportPage() {
  const { t } = useTranslation("settings");
  return (
    <div className="space-y-6 pb-10 pt-4">
      <SettingsPageHeader title={t("helpPage.title")} />
      <SettingsContextCard context="help" />
      <SettingsSection title={t("helpPage.support")}>
        <div className="text-center text-sm leading-6 text-white/58">
          <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-[20px] border border-[#d5be8d]/20 bg-[#d5be8d]/[0.08] text-[#d5be8d]"><MessageCircle className="h-6 w-6" /></div>
          <p className="mx-auto max-w-sm">{t("helpPage.description")}</p>
          <a className="mt-5 flex min-h-14 items-center justify-center gap-2 rounded-2xl border border-white/[0.09] bg-white/[0.055] px-4 font-semibold text-white transition active:scale-[0.98]" href={`mailto:${SUPPORT_EMAIL}`}>
            <Mail className="h-4 w-4" />{SUPPORT_EMAIL}
          </a>
        </div>
      </SettingsSection>
    </div>
  );
}
