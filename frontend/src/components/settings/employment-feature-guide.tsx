import {
  CalendarDays,
  Clock3,
  Coins,
  Layers3,
  PencilLine,
  Repeat2,
  Sparkles,
  Tag,
  Umbrella,
  WalletCards
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { SettingsGroup } from "./settings-group";
import { Card } from "../ui/card";

type EmploymentFeature = "schedule" | "hourlyRates" | "workTypes" | "absences";

const featureSteps = {
  schedule: [
    { key: "plan", icon: CalendarDays },
    { key: "repeat", icon: Repeat2 },
    { key: "adjust", icon: PencilLine }
  ],
  hourlyRates: [
    { key: "hours", icon: Clock3 },
    { key: "rate", icon: Coins },
    { key: "earnings", icon: WalletCards }
  ],
  workTypes: [
    { key: "activity", icon: Tag },
    { key: "method", icon: Layers3 },
    { key: "result", icon: Sparkles }
  ],
  absences: [
    { key: "type", icon: Umbrella },
    { key: "date", icon: CalendarDays },
    { key: "impact", icon: Clock3 }
  ]
} as const;

export function EmploymentFeatureGuide({ feature }: { feature: EmploymentFeature }) {
  const { t } = useTranslation("settings");
  const baseKey = `employmentFeatureGuides.${feature}`;

  return (
    <SettingsGroup
      title={t(`${baseKey}.title`)}
      description={t(`${baseKey}.description`)}
    >
      <div className="px-4 pb-5 pt-5">
        <div className="grid grid-cols-3 gap-2">
          {featureSteps[feature].map(({ key, icon: Icon }, index) => (
            <div key={key} className="relative min-w-0 text-center">
              {index < 2 ? (
                <span className="absolute left-[calc(50%+1.5rem)] right-[calc(-50%+1.5rem)] top-5 h-px bg-white/[0.10]" aria-hidden="true" />
              ) : null}
              <span className="relative mx-auto grid h-10 w-10 place-items-center rounded-full border border-white/[0.10] bg-[#111] text-white/55">
                <Icon className="h-4 w-4" aria-hidden="true" />
              </span>
              <p className="mt-2 text-xs font-medium text-white/72">{t(`${baseKey}.steps.${key}`)}</p>
              <p className={`mt-1 text-sm font-semibold ${index === 2 ? "text-emerald-400" : "text-white"}`}>
                {t(`${baseKey}.values.${key}`)}
              </p>
            </div>
          ))}
        </div>
      </div>
      <div className="border-t border-white/[0.06] p-4">
        <Card className="flex items-center justify-between gap-4 px-4 py-4">
          <span className="min-w-0">
            <span className="font-name block truncate text-[1rem] font-semibold tracking-[-0.04em] text-white">
              {t(`${baseKey}.example.title`)}
            </span>
            <span className="mt-1 block truncate text-sm text-white/46">
              {t(`${baseKey}.example.detail`)}
            </span>
          </span>
          <span className="shrink-0 rounded-full bg-emerald-400/10 px-3 py-1 text-xs font-semibold text-emerald-400">
            {t(`${baseKey}.example.result`)}
          </span>
        </Card>
      </div>
    </SettingsGroup>
  );
}
