import { useEffect, useId, useRef } from "react";
import { useTranslation } from "react-i18next";
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
  const { t } = useTranslation("common");
  const titleId = useId();
  const descriptionId = useId();
  const overlayRef = useRef<HTMLDivElement | null>(null);
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const cancelButtonRef = useRef<HTMLButtonElement | null>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) {
      return;
    }

    previousFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    cancelButtonRef.current?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onCancel();
        return;
      }

      if (event.key !== "Tab") {
        return;
      }

      const focusable = dialogRef.current?.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
      );

      if (!focusable?.length) {
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKeyDown);
      previousFocusRef.current?.focus();
    };
  }, [onCancel, open]);

  if (!open) {
    return null;
  }

  return (
    <div
      ref={overlayRef}
      role="presentation"
      className="fixed inset-0 z-[80] flex items-end justify-center bg-black/50 px-4 pb-6 pt-10 backdrop-blur-sm sm:items-center"
      onMouseDown={(event) => {
        if (event.target === overlayRef.current) {
          onCancel();
        }
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        className="w-full max-w-md rounded-[32px] border border-white/[0.06] bg-[#0b0b0b]/95 px-6 py-6 shadow-[0_30px_80px_rgba(0,0,0,0.45)]"
      >
        <div className="space-y-3">
          <h2 id={titleId} className="text-[1.2rem] font-semibold tracking-[-0.05em] text-white">{title}</h2>
          <p id={descriptionId} className="text-sm leading-6 text-white/50">{description}</p>
        </div>
        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-end">
          <Button ref={cancelButtonRef} type="button" variant="secondary" onClick={onCancel} disabled={pending}>
            {t("actions.cancel")}
          </Button>
          <Button
            type="button"
            onClick={onConfirm}
            disabled={pending}
            className="bg-white text-black hover:bg-white/90"
          >
            {pending ? t("actions.working") : confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
