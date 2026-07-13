import { Button } from "../ui/button";

type Props = {
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
};

export function SettingsEmptyState({ title, description, actionLabel, onAction }: Props) {
  return (
    <div className="rounded-[30px] border border-white/[0.05] bg-white/[0.03] px-6 py-7 text-center">
      <p className="text-[1.05rem] font-semibold tracking-[-0.04em] text-white">{title}</p>
      <p className="mt-2 text-sm leading-6 text-white/46">{description}</p>
      {actionLabel && onAction ? (
        <Button className="mt-5" onClick={onAction}>
          {actionLabel}
        </Button>
      ) : null}
    </div>
  );
}
