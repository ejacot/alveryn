import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { getApiError } from "../api/api-errors";
import {
  confirmScheduleWorkbook,
  listScheduleImports,
  previewScheduleWorkbook
} from "../api/endpoints";
import { queryKeys } from "../api/query-keys";
import { SettingsEmptyState } from "../components/settings/settings-empty-state";
import { SettingsPageHeader } from "../components/settings/settings-page-header";
import { SettingsSection } from "../components/settings/settings-section";
import type { ExcelImportConfirmResult, ExcelImportPreview } from "../types/imports";

export function SettingsImportPage() {
  const { t } = useTranslation(["settings", "common", "errors"]);
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fallbackYear, setFallbackYear] = useState("");
  const [preview, setPreview] = useState<ExcelImportPreview | null>(null);
  const [result, setResult] = useState<ExcelImportConfirmResult | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showWarnings, setShowWarnings] = useState(false);

  const historyQuery = useQuery({
    queryKey: queryKeys.imports.history(),
    queryFn: listScheduleImports
  });

  const previewMutation = useMutation({
    mutationFn: ({ file, fallbackYear }: { file: File; fallbackYear?: number }) =>
      previewScheduleWorkbook(file, fallbackYear),
    onSuccess: (data) => {
      setPreview(data);
      setResult(null);
      setErrorMessage(null);
      setShowWarnings(false);
    },
    onError: (error) => {
      setErrorMessage(getApiError(error).message);
      setPreview(null);
      setResult(null);
    }
  });

  const confirmMutation = useMutation({
    mutationFn: (previewToken: string) => confirmScheduleWorkbook(previewToken),
    onSuccess: async (data) => {
      setResult(data);
      setErrorMessage(null);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.workEntries.all() }),
        queryClient.invalidateQueries({ queryKey: queryKeys.absences.all() }),
        queryClient.invalidateQueries({ queryKey: queryKeys.workTypes.all() }),
        queryClient.invalidateQueries({ queryKey: queryKeys.dashboard() }),
        queryClient.invalidateQueries({ queryKey: queryKeys.statistics.all() }),
        queryClient.invalidateQueries({ queryKey: queryKeys.imports.all() })
      ]);
    },
    onError: (error) => {
      setErrorMessage(getApiError(error).message);
    }
  });

  const canConfirm = Boolean(preview?.previewToken && preview.canImport && !preview.conflicts.length);

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
                setPreview(null);
                setResult(null);
                setErrorMessage(null);
              }}
              className="block w-full rounded-[22px] border border-white/[0.06] bg-white/[0.04] px-4 py-4 text-base text-white file:mr-4 file:rounded-full file:border-0 file:bg-white/[0.92] file:px-4 file:py-2 file:text-sm file:font-semibold file:text-black"
            />
          </label>

          <label className="block space-y-3">
            <span className="text-sm text-white/68">{t("settings:import.fallbackYearLabel")}</span>
            <input
              inputMode="numeric"
              value={fallbackYear}
              onChange={(event) => setFallbackYear(event.target.value.replace(/[^\d]/g, "").slice(0, 4))}
              className="block w-full rounded-[22px] border border-white/[0.06] bg-white/[0.04] px-4 py-4 text-base text-white"
            />
          </label>

          <div className="flex flex-col gap-3 sm:flex-row">
            <button
              type="button"
              onClick={() => {
                if (!selectedFile || previewMutation.isPending) {
                  return;
                }
                const parsedFallbackYear = fallbackYear ? Number.parseInt(fallbackYear, 10) : undefined;
                void previewMutation.mutateAsync({ file: selectedFile, fallbackYear: parsedFallbackYear });
              }}
              disabled={!selectedFile || previewMutation.isPending}
              className="inline-flex min-h-12 items-center justify-center rounded-full border border-white/[0.08] bg-white/[0.92] px-5 py-3 text-sm font-semibold text-black transition disabled:cursor-not-allowed disabled:opacity-40"
            >
              {previewMutation.isPending
                ? t("settings:import.previewing")
                : t("settings:import.previewAction")}
            </button>

            <button
              type="button"
              onClick={() => {
                if (!preview?.previewToken || confirmMutation.isPending) {
                  return;
                }
                void confirmMutation.mutateAsync(preview.previewToken);
              }}
              disabled={!canConfirm || confirmMutation.isPending}
              className="inline-flex min-h-12 items-center justify-center rounded-full border border-white/[0.08] bg-white/[0.08] px-5 py-3 text-sm font-semibold text-white transition disabled:cursor-not-allowed disabled:opacity-40"
            >
              {confirmMutation.isPending
                ? t("settings:import.confirming")
                : t("settings:import.confirmAction")}
            </button>
          </div>

          {errorMessage ? <p className="text-sm leading-6 text-red-200">{errorMessage}</p> : null}
        </div>
      </SettingsSection>

      {preview ? (
        <SettingsSection
          title={t("settings:import.previewTitle")}
          description={t("settings:import.previewDescription")}
        >
          <div className="space-y-4">
            <SummaryRow label={t("settings:import.fileName")} value={preview.fileName} />
            <SummaryRow label={t("settings:import.year")} value={String(preview.detectedYear)} />
            <SummaryRow
              label={t("settings:import.summaryWillImport")}
              value={`${preview.totals.workEntries} · ${preview.totals.absences}`}
            />
            <SummaryRow
              label={t("settings:import.summarySkipped")}
              value={String(preview.totals.skippedRows)}
            />
            <SummaryRow
              label={t("settings:import.summaryConflicts")}
              value={String(preview.conflicts.length)}
            />
            <SummaryRow
              label={t("settings:import.summaryDuplicates")}
              value={String(preview.duplicateCandidates.length)}
            />

            <div className="space-y-2 rounded-[22px] border border-white/[0.05] bg-white/[0.03] px-4 py-4">
              <p className="text-sm font-medium text-white">{t("settings:import.months")}</p>
              <div className="space-y-2 text-sm text-white/60">
                {preview.recognizedSheets.map((sheet) => (
                  <div key={`${sheet.sheetName}-${sheet.month}`} className="flex items-center justify-between gap-4">
                    <span>{sheet.sheetName}</span>
                    <span>
                      {sheet.workEntries} · {sheet.absences}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {preview.ignoredSheets.length ? (
              <div className="space-y-2 rounded-[22px] border border-white/[0.05] bg-white/[0.03] px-4 py-4">
                <p className="text-sm font-medium text-white">{t("settings:import.ignoredSheets")}</p>
                <p className="text-sm leading-6 text-white/56">{preview.ignoredSheets.join(", ")}</p>
              </div>
            ) : (
              <p className="text-sm text-white/56">{t("settings:import.noIgnoredSheets")}</p>
            )}

            {preview.conflicts.length ? (
              <IssueList
                title={t("settings:import.conflicts")}
                items={preview.conflicts.map((conflict) => conflict.message)}
              />
            ) : null}

            {preview.duplicateCandidates.length ? (
              <IssueList
                title={t("settings:import.duplicates")}
                items={preview.duplicateCandidates.map((duplicate) => duplicate.message)}
              />
            ) : null}

            {preview.warnings.length ? (
              <div className="space-y-3 rounded-[22px] border border-white/[0.05] bg-white/[0.03] px-4 py-4">
                <button
                  type="button"
                  onClick={() => setShowWarnings((value) => !value)}
                  className="text-sm font-medium text-white"
                >
                  {t("settings:import.warnings")}
                </button>
                {showWarnings ? (
                  <ul className="space-y-2 text-sm leading-6 text-white/56">
                    {preview.warnings.map((warning) => (
                      <li key={`${warning.code}-${warning.message}`}>{warning.message}</li>
                    ))}
                  </ul>
                ) : null}
              </div>
            ) : (
              <p className="text-sm text-white/56">{t("settings:import.noWarnings")}</p>
            )}

            {!preview.canImport ? (
              <p className="text-sm leading-6 text-red-200">{t("settings:import.canImportFalse")}</p>
            ) : null}
          </div>
        </SettingsSection>
      ) : (
        <SettingsEmptyState
          title={t("settings:import.previewTitle")}
          description={t("settings:import.noPreview")}
        />
      )}

      {result ? (
        <SettingsSection
          title={t("settings:import.resultTitle")}
          description={t("settings:import.resultDescription", { year: result.detectedYear })}
        >
          <div className="space-y-4">
            <SummaryRow label={t("settings:import.fileName")} value={result.fileName} />
            <SummaryRow label={t("settings:import.entries")} value={String(result.importedEntries)} />
            <SummaryRow label={t("settings:import.absences")} value={String(result.importedAbsences)} />
            <SummaryRow label={t("settings:import.skippedRows")} value={String(result.skippedRows)} />
            <div className="flex flex-col gap-3 sm:flex-row">
              <button
                type="button"
                onClick={() => navigate("/calendar")}
                className="inline-flex min-h-12 items-center justify-center rounded-full border border-white/[0.08] bg-white/[0.92] px-5 py-3 text-sm font-semibold text-black"
              >
                {t("settings:import.goCalendar")}
              </button>
              <button
                type="button"
                onClick={() => navigate("/")}
                className="inline-flex min-h-12 items-center justify-center rounded-full border border-white/[0.08] bg-white/[0.08] px-5 py-3 text-sm font-semibold text-white"
              >
                {t("settings:import.goDashboard")}
              </button>
            </div>
          </div>
        </SettingsSection>
      ) : null}

      <SettingsSection
        title={t("settings:import.historyTitle")}
        description={t("settings:import.historyDescription")}
      >
        {historyQuery.data?.length ? (
          <div className="space-y-3">
            {historyQuery.data.map((batch) => (
              <Link
                key={batch.id}
                to={`/settings/import/${batch.id}`}
                className="flex items-center justify-between gap-4 rounded-[22px] border border-white/[0.05] bg-white/[0.03] px-4 py-4"
              >
                <div className="space-y-1">
                  <p className="text-sm font-medium text-white">{batch.fileName}</p>
                  <p className="text-xs text-white/50">
                    {batch.detectedYear} · {batch.importedEntriesCount} · {batch.importedAbsencesCount}
                  </p>
                </div>
                <div className="space-y-1 text-right">
                  <p className="text-xs uppercase tracking-[0.18em] text-white/38">
                    {t(`settings:import.status_${batch.status}`)}
                  </p>
                  <p className="text-xs text-white/50">{t("settings:import.openDetail")}</p>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <SettingsEmptyState
            title={t("settings:import.emptyHistoryTitle")}
            description={t("settings:import.emptyHistoryDescription")}
          />
        )}
      </SettingsSection>
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

function IssueList({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="space-y-2 rounded-[22px] border border-white/[0.05] bg-white/[0.03] px-4 py-4">
      <p className="text-sm font-medium text-white">{title}</p>
      <ul className="space-y-2 text-sm leading-6 text-white/56">
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </div>
  );
}
