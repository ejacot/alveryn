import { useEffect, useId, useRef } from "react";
import { useTranslation } from "react-i18next";
import { LockedModalViewport } from "../ui/locked-modal-viewport";
import { ModalActions } from "../ui/modal-actions";

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
      document.removeEventListener("keydown", handleKeyDown);
      previousFocusRef.current?.focus();
    };
  }, [onCancel, open]);

  if (!open) {
    return null;
  }

  return (
    <LockedModalViewport
      ref={overlayRef}
      role="presentation"
      className="bg-black/50 px-4 py-4 backdrop-blur-sm"
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
        className="relative z-10 w-full max-w-sm rounded-[32px] border border-white/[0.08] bg-[#090909]/95 p-5 shadow-[0_28px_90px_rgba(0,0,0,0.55)]"
      >
        <div className="space-y-3">
          <h2 id={titleId} className="text-[1.2rem] font-semibold tracking-[-0.05em] text-white">{title}</h2>
          <p id={descriptionId} className="text-sm leading-6 text-white/50">{description}</p>
        </div>
        <ModalActions
          className="mt-6"
          cancelRef={cancelButtonRef}
          cancelLabel={t("actions.cancel")}
          saveLabel={pending ? t("actions.working") : confirmLabel}
          pending={pending}
          onCancel={onCancel}
          onSave={onConfirm}
        />
      </div>
    </LockedModalViewport>
  );
}
