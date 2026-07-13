import { Button } from "../ui/button";

type Props = {
  open: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  pending?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
};

export function SettingsConfirmDialog({
  open,
  title,
  description,
  confirmLabel,
  pending = false,
  onCancel,
  onConfirm
}: Props) {
  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/50 px-4 pb-6 pt-10 backdrop-blur-sm sm:items-center">
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="w-full max-w-md rounded-[32px] border border-white/[0.06] bg-[#0b0b0b]/95 px-6 py-6 shadow-[0_30px_80px_rgba(0,0,0,0.45)]"
      >
        <div className="space-y-3">
          <h2 className="text-[1.2rem] font-semibold tracking-[-0.05em] text-white">{title}</h2>
          <p className="text-sm leading-6 text-white/50">{description}</p>
        </div>
        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-end">
          <Button type="button" variant="secondary" onClick={onCancel} disabled={pending}>
            Cancel
          </Button>
          <Button
            type="button"
            onClick={onConfirm}
            disabled={pending}
            className="bg-white text-black hover:bg-white/90"
          >
            {pending ? "Working..." : confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
