import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { getApiError } from "../api/api-errors";
import { importScheduleWorkbook } from "../api/endpoints";
import { queryKeys } from "../api/query-keys";
import { SettingsPageHeader } from "../components/settings/settings-page-header";
import { SettingsSection } from "../components/settings/settings-section";
import type { ExcelImportResult } from "../types/imports";

export function SettingsImportPage() {
  const { t } = useTranslation(["settings", "common"]);
  const queryClient = useQueryClient();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [result, setResult] = useState<ExcelImportResult | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const importMutation = useMutation({
    mutationFn: importScheduleWorkbook,
    onSuccess: async (data) => {
      setResult(data);
      setErrorMessage(null);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.workEntries.all() }),
        queryClient.invalidateQueries({ queryKey: queryKeys.absences.all() }),
        queryClient.invalidateQueries({ queryKey: queryKeys.workTypes.all() }),
        queryClient.invalidateQueries({ queryKey: queryKeys.dashboard() })
      ]);
    },
    onError: (error) => {
      setErrorMessage(getApiError(error).message);
    }
  });

  return (
    <div className="space-y-8 pb-10">
      <SettingsPageHeader
        title={t("settings:import.title")}
        description={t("settings:import.description")}
        fallbackHref="/profile"
      />

      <SettingsSection
        title={t("settings:import.uploadTitle")}
        description={t("settings:import.uploadDescription")}
      >
        <div className="space-y-4">
          <label className="block space-y-3">
            <span className="text-sm text-white/68">{t("settings:import.fileLabel")}</span>
            <input
              type="file"
              accept=".xlsx"
              onChange={(event) => {
                setSelectedFile(event.target.files?.[0] ?? null);
                setResult(null);
                setErrorMessage(null);
              }}
              className="block w-full rounded-[22px] border border-white/[0.06] bg-white/[0.04] px-4 py-4 text-base text-white file:mr-4 file:rounded-full file:border-0 file:bg-white/[0.92] file:px-4 file:py-2 file:text-sm file:font-semibold file:text-black"
            />
          </label>

          <button
            type="button"
            onClick={() => {
              if (!selectedFile || importMutation.isPending) {
                return;
              }
              void importMutation.mutateAsync(selectedFile);
            }}
            disabled={!selectedFile || importMutation.isPending}
            className="inline-flex min-h-12 items-center justify-center rounded-full border border-white/[0.08] bg-white/[0.92] px-5 py-3 text-sm font-semibold text-black transition disabled:cursor-not-allowed disabled:opacity-40"
          >
            {importMutation.isPending
              ? t("settings:import.importing")
              : t("settings:import.importAction")}
          </button>

          {errorMessage ? (
            <p className="text-sm leading-6 text-red-200">{errorMessage}</p>
          ) : null}
        </div>
      </SettingsSection>

      {result ? (
        <SettingsSection
          title={t("settings:import.resultTitle")}
          description={t("settings:import.resultDescription", { year: result.detectedYear })}
        >
          <div className="space-y-4">
            <SummaryRow label={t("settings:import.fileName")} value={result.fileName} />
            <SummaryRow label={t("settings:import.workType")} value={result.workTypeName} />
            <SummaryRow label={t("settings:import.entries")} value={String(result.importedEntries)} />
            <SummaryRow label={t("settings:import.absences")} value={String(result.importedAbsences)} />
            <SummaryRow label={t("settings:import.createdWorkTypes")} value={String(result.createdWorkTypes)} />
            <SummaryRow label={t("settings:import.skippedRows")} value={String(result.skippedRows)} />

            {result.warnings.length ? (
              <div className="space-y-2 rounded-[22px] border border-white/[0.05] bg-white/[0.03] px-4 py-4">
                <p className="text-sm font-medium text-white">{t("settings:import.warnings")}</p>
                <ul className="space-y-2 text-sm leading-6 text-white/56">
                  {result.warnings.map((warning) => (
                    <li key={warning}>{warning}</li>
                  ))}
                </ul>
              </div>
            ) : (
              <p className="text-sm text-white/56">{t("settings:import.noWarnings")}</p>
            )}
          </div>
        </SettingsSection>
      ) : null}
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
