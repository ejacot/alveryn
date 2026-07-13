import packageJson from "../../package.json";
import { SettingsPageHeader } from "../components/settings/settings-page-header";
import { SettingsSection } from "../components/settings/settings-section";

export function AboutRoomlyPage() {
  return (
    <div className="space-y-8 pb-10">
      <SettingsPageHeader title="About Roomly" />
      <SettingsSection title="Product">
        <div className="space-y-3 text-sm leading-6 text-white/58">
          <p className="text-white">Roomly</p>
          <p>Version {packageJson.version}</p>
          <p>Calm work tracking for hourly and unit-based workflows, designed to feel like a premium native app.</p>
        </div>
      </SettingsSection>
    </div>
  );
}
