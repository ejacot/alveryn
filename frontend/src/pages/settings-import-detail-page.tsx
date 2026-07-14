import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useParams } from "react-router-dom";
import { getApiError } from "../api/api-errors";
import { getScheduleImport, undoScheduleImport } from "../api/endpoints";
import { queryKeys } from "../api/query-keys";
import { SettingsConfirmDialog } from "../components/settings/settings-confirm-dialog";
import { SettingsEmptyState } from "../components/settings/settings-empty-state";
import { SettingsPageHeader } from "../components/settings/settings-page-header";
import { SettingsSection } from "../components/settings/settings-section";

export function SettingsImportDetailPage() {
  const { t } = useTranslation(["settings", "errors", "common"]);
  const { batchId = "" } = useParams();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const detailQuery = useQuery({
    queryKey: queryKeys.imports.detail(batchId),
    queryFn: () => getScheduleImport(batchId),
    enabled: Boolean(batchId)
  });

  const undoMutation = useMutation({
    mutationFn: () => undoScheduleImport(batchId),
    onSuccess: async () => {
      setDialogOpen(false);
      setErrorMessage(null);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.imports.all() }),
        queryClient.invalidateQueries({ queryKey: queryKeys.workEntries.all() }),
        queryClient.invalidateQueries({ queryKey: queryKeys.absences.all() }),
        queryClient.invalidateQueries({ queryKey: queryKeys.workTypes.all() }),
        queryClient.invalidateQueries({ queryKey: queryKeys.dashboard() }),
        queryClient.invalidateQueries({ queryKey: queryKeys.statistics.all() })
      ]);
    },
    onError: (error) => setErrorMessage(getApiError(error).message)
  });

  const batch = detailQuery.data;

  return (
    <div className="space-y-8 pb-10">
      <SettingsPageHeader
        title={t("settings:import.detailTitle")}
        description={t("settings:import.detailDescription")}
        fallbackHref="/settings/import"
      />

      {errorMessage ? <p className="text-sm leading-6 text-red-200">{errorMessage}</p> : null}

      {!batch ? (
        <SettingsEmptyState
          title={t("settings:import.detailTitle")}
          description={
            detailQuery.isLoading ? t("common:messages.loading") : t("errors:EXCEL_BATCH_NOT_FOUND")
          }
        />
      ) : (
        <>
          <SettingsSection title={t("settings:import.status")}>
            <div className="space-y-4">
              <SummaryRow label={t("settings:import.fileName")} value={batch.fileName} />
              <SummaryRow label={t("settings:import.year")} value={String(batch.detectedYear)} />
              <SummaryRow label={t("settings:import.status")} value={t(`settings:import.status_${batch.status}`)} />
              <SummaryRow label={t("settings:import.entries")} value={String(batch.importedEntriesCount)} />
              <SummaryRow label={t("settings:import.absences")} value={String(batch.importedAbsencesCount)} />
              <SummaryRow label={t("settings:import.skippedRows")} value={String(batch.skippedRowsCount)} />
              <SummaryRow label={t("settings:import.warnings")} value={String(batch.warningCount)} />
            </div>
          </SettingsSection>

          {batch.warnings.length ? (
            <SettingsSection title={t("settings:import.warnings")}>
              <ul className="space-y-2 text-sm leading-6 text-white/56">
                {batch.warnings.map((warning) => (
                  <li key={warning}>{warning}</li>
                ))}
              </ul>
            </SettingsSection>
          ) : null}

          {batch.undoAvailable ? (
            <SettingsSection title={t("settings:import.undoAction")}>
              <button
                type="button"
                onClick={() => setDialogOpen(true)}
                className="inline-flex min-h-12 items-center justify-center rounded-full border border-white/[0.08] bg-white/[0.08] px-5 py-3 text-sm font-semibold text-white"
              >
                {undoMutation.isPending ? t("settings:import.undoing") : t("settings:import.undoAction")}
              </button>
            </SettingsSection>
          ) : null}
        </>
      )}

      <SettingsConfirmDialog
        open={dialogOpen}
        title={t("settings:import.undoTitle")}
        description={t("settings:import.undoDescription")}
        confirmLabel={t("settings:import.undoAction")}
        pending={undoMutation.isPending}
        onCancel={() => setDialogOpen(false)}
        onConfirm={() => void undoMutation.mutateAsync()}
      />
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-[22px] border border-white/[0.05] bg-white/[0.03] px-4 py-3">
      <span className="text-sm text-white/52">{label}</span>
      <span className="text-sm font-medium text-white">{value}</span>
    </div>
  );
}
