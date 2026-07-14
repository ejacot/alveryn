import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "../ui/button";

type Props = {
  submitting?: boolean;
  submitLabel?: string;
  successMessage?: string | null;
  onDelete?: () => void;
  deleteLabel?: string;
  deleteDisabled?: boolean;
};

export function SettingsFormActions({
  submitting = false,
  submitLabel,
  successMessage,
  onDelete,
  deleteLabel,
  deleteDisabled = false
}: Props) {
  const { t } = useTranslation("common");
  const [visibleSuccess, setVisibleSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (!successMessage) {
      setVisibleSuccess(null);
      return;
    }

    setVisibleSuccess(successMessage);
    const timeoutId = window.setTimeout(() => {
      setVisibleSuccess(null);
    }, 2000);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [successMessage]);

  return (
    <div className="flex flex-col gap-3 pt-2">
      {visibleSuccess ? <p className="text-sm text-white/58">{visibleSuccess}</p> : null}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        {onDelete && deleteLabel ? (
          <Button
            type="button"
            variant="secondary"
            onClick={onDelete}
            disabled={deleteDisabled}
            className="border-red-400/18 bg-red-400/[0.05] text-white hover:bg-red-400/[0.08]"
          >
            {deleteLabel}
          </Button>
        ) : (
          <span />
        )}
        <Button type="submit" disabled={submitting} className="sm:min-w-[170px]">
          {submitting ? t("actions.saving") : submitLabel ?? t("actions.saveChanges")}
        </Button>
      </div>
    </div>
  );
}
