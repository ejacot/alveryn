import { Button } from "../ui/button";

type Props = {
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
};

export function SettingsEmptyState({ title, description, actionLabel, onAction }: Props) {
  return (
    <Card className="px-6 py-7 text-center">
      <p className="text-[1.05rem] font-semibold tracking-[-0.04em] text-white">{title}</p>
      {description ? <p className="mt-2 text-sm leading-6 text-white/46">{description}</p> : null}
      {actionLabel && onAction ? (
        <Button className="mt-5" onClick={onAction}>
          {actionLabel}
        </Button>
      ) : null}
    </Card>
  );
}
import { Card } from "../ui/card";
