import { SUPPORT_EMAIL } from "../api/config";
import { SettingsPageHeader } from "../components/settings/settings-page-header";
import { SettingsContextCard } from "../components/settings/settings-context-card";
import { SettingsSection } from "../components/settings/settings-section";

export function HelpSupportPage() {
  return (
    <div className="space-y-8 pb-10">
      <SettingsPageHeader title="Help & Support" />
      <SettingsContextCard context="help" />
      <SettingsSection title="Support">
        <div className="space-y-3 text-sm leading-6 text-white/58">
          <p>If something feels off, the fastest path is still direct email support.</p>
          <a className="text-white underline decoration-white/20 underline-offset-4" href={`mailto:${SUPPORT_EMAIL}`}>
            {SUPPORT_EMAIL}
          </a>
        </div>
      </SettingsSection>
    </div>
  );
}
