import packageJson from "../../package.json";
import { SettingsPageHeader } from "../components/settings/settings-page-header";
import { SettingsContextCard } from "../components/settings/settings-context-card";
import { SettingsSection } from "../components/settings/settings-section";

export function AboutAlverynPage() {
  return (
    <div className="space-y-6 pb-10 pt-4">
      <SettingsPageHeader title="About Alveryn" />
      <SettingsContextCard context="about" />
      <SettingsSection title="Product">
        <div className="space-y-3 text-sm leading-6 text-white/58">
          <p className="text-white">Alveryn</p>
          <p>Version {packageJson.version}</p>
          <p>Calm work tracking for hourly and unit-based workflows, designed to feel like a premium native app.</p>
        </div>
      </SettingsSection>
      <SettingsSection title="Data and privacy">
        <div className="space-y-3 text-sm leading-6 text-white/58">
          <p>Alveryn records one activity marker per day, successful PDF exports and anonymous Welcome conversion events to understand whether the product is useful.</p>
          <p>Welcome analytics use a temporary random session identifier. No page history, persistent marketing identifier, IP address, email, work notes, earnings or work-line content is included in product analytics.</p>
        </div>
      </SettingsSection>
    </div>
  );
}
