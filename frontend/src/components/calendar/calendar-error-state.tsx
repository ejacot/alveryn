import { Button } from "../ui/button";
import { Card } from "../ui/card";
import { useTranslation } from "react-i18next";

type Props = {
  message: string;
  onRetry: () => void;
};

export function CalendarErrorState({ message, onRetry }: Props) {
  const { t } = useTranslation(["calendar", "common"]);

  return (
    <div className="space-y-4 pb-8">
      <div className="space-y-2">
        <h1 className="text-[2.1rem] font-semibold tracking-[-0.06em] text-white">
          {t("calendar:unavailable")}
        </h1>
        <p className="max-w-md text-sm leading-6 text-white/58">{message}</p>
      </div>
      <Card variant="muted" className="p-5">
        <Button onClick={onRetry}>{t("common:actions.retry")}</Button>
      </Card>
    </div>
  );
}
