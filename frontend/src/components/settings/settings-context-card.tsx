import {
  BadgeEuro,
  BriefcaseBusiness,
  CalendarOff,
  CircleHelp,
  Info,
  SlidersHorizontal,
  UserRound,
  WalletCards
} from "lucide-react";
import { useTranslation } from "react-i18next";

type SettingsContext =
  | "profile"
  | "preferences"
  | "employment"
  | "absences"
  | "hourlyRates"
  | "hourlyRateEditor"
  | "workTypes"
  | "about"
  | "help";

const icons = {
  profile: UserRound,
  preferences: SlidersHorizontal,
  employment: BriefcaseBusiness,
  absences: CalendarOff,
  hourlyRates: WalletCards,
  hourlyRateEditor: BadgeEuro,
  workTypes: BriefcaseBusiness,
  about: Info,
  help: CircleHelp
} satisfies Record<SettingsContext, typeof Info>;

export function SettingsContextCard({ context }: { context: SettingsContext }) {
  const { t } = useTranslation("settings");
  const Icon = icons[context];

  return (
    <section className="dashboard-glass-card overflow-hidden rounded-[24px] px-4 py-4 sm:px-5">
      <div className="flex items-center gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px] bg-white/[0.09] text-white/78">
          <Icon className="h-6 w-6" aria-hidden="true" />
        </div>
        <div className="min-w-0">
          <h2 className="text-[1.05rem] font-semibold leading-tight tracking-normal text-white">
            {t(`pageInfo.${context}.title`)}
          </h2>
          <p className="mt-1 text-sm leading-5 tracking-normal text-white/56">
            {t(`pageInfo.${context}.description`)}
          </p>
        </div>
      </div>
    </section>
  );
}
