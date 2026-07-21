import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Check, Download } from "lucide-react";
import { useTranslation } from "react-i18next";
import { getApiError } from "../api/api-errors";
import { listAbsencesInRange, listEmployments, listWorkRecordsInRange, recordPdfExport } from "../api/endpoints";
import { queryKeys } from "../api/query-keys";
import { SettingsNavigationHeader } from "../components/settings/settings-navigation-header";
import { Card } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { useEmploymentScope } from "../features/employment/employment-scope";
import {
  buildPdfReportRows,
  filterWorkRecordsByEmployment,
  generateAlverynPdf,
  type PdfExportField,
  type PdfExportSelection
} from "../features/pdf-export/pdf-report";
import { useSafeBackNavigation } from "../hooks/use-safe-back-navigation";
import { i18n } from "../i18n";
import { firstDayOfCurrentMonthLocalIsoDate, todayLocalIsoDate } from "../utils/date";

const exportFields: PdfExportField[] = ["intervals", "hours", "quantity", "extra", "earnings", "notes"];

const initialSelection: PdfExportSelection = {
  intervals: true,
  hours: true,
  quantity: true,
  extra: true,
  earnings: true,
  notes: true
};

export function PdfExportPage() {
  const { t } = useTranslation(["settings", "common"]);
  const safeBack = useSafeBackNavigation({ fallback: "/profile" });
  const selectedEmploymentId = useEmploymentScope();
  const [from, setFrom] = useState(firstDayOfCurrentMonthLocalIsoDate());
  const [to, setTo] = useState(todayLocalIsoDate());
  const [selection, setSelection] = useState<PdfExportSelection>(initialSelection);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const employmentsQuery = useQuery({
    queryKey: queryKeys.employments.all(),
    queryFn: listEmployments
  });

  const employmentName = useMemo(() => {
    if (!selectedEmploymentId) return t("settings:employment.all");
    return employmentsQuery.data?.find((employment) => employment.id === selectedEmploymentId)?.name
      ?? t("settings:employment.none");
  }, [employmentsQuery.data, selectedEmploymentId, t]);
  const hasSelection = exportFields.some((field) => selection[field]);

  async function handleExport() {
    if (from > to) {
      setError(t("settings:pdfExport.errors.dateRange"));
      return;
    }
    if (!hasSelection) {
      setError(t("settings:pdfExport.errors.fields"));
      return;
    }

    setPending(true);
    setError(null);
    try {
      const [records, absences] = await Promise.all([
        listWorkRecordsInRange({ from, to }),
        listAbsencesInRange({ from, to })
      ]);
      const scopedRecords = filterWorkRecordsByEmployment(records, selectedEmploymentId);
      const scopedAbsences = selectedEmploymentId
        ? absences.filter((absence) => absence.employmentId === selectedEmploymentId)
        : absences;
      const sessionRows = buildPdfReportRows(
        scopedRecords,
        selection,
        i18n.resolvedLanguage || "en"
      );
      if (sessionRows.length === 0 && scopedAbsences.length === 0) {
        setError(t("settings:pdfExport.errors.empty"));
        return;
      }
      const rows = buildPdfReportRows(
        scopedRecords,
        selection,
        i18n.resolvedLanguage || "en",
        { from, to, absences: scopedAbsences }
      );
      await generateAlverynPdf({
        rows,
        selection,
        from,
        to,
        locale: i18n.resolvedLanguage || "en",
        labels: {
          report: t("settings:pdfExport.pdf.report"),
          generated: t("settings:pdfExport.pdf.generated"),
          workedDays: t("settings:pdfExport.pdf.workedDays"),
          absences: t("settings:pdfExport.pdf.absences"),
          totalHours: t("settings:pdfExport.pdf.totalHours"),
          totalExtraHours: t("settings:pdfExport.pdf.totalExtraHours"),
          date: t("settings:pdfExport.fields.date"),
          activity: t("settings:pdfExport.fields.activity"),
          intervals: t("settings:pdfExport.fields.intervals"),
          hours: t("settings:pdfExport.fields.hours"),
          quantity: t("settings:pdfExport.fields.quantity"),
          extra: t("settings:pdfExport.fields.extra"),
          earnings: t("settings:pdfExport.fields.earnings"),
          notes: t("settings:pdfExport.fields.notes"),
          generatedWith: t("settings:pdfExport.pdf.generatedWith"),
          mixedCurrencies: t("settings:pdfExport.pdf.mixedCurrencies")
        }
      });
      void recordPdfExport().catch(() => undefined);
    } catch (cause) {
      setError(cause instanceof Error && cause.message
        ? t("settings:pdfExport.errors.generation", { reason: cause.message })
        : getApiError(cause).message);
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-[560px] space-y-6 pb-10 pt-8">
      <SettingsNavigationHeader
        title={t("settings:pdfExport.title")}
        backLabel={t("common:actions.back")}
        onBack={safeBack}
      />

      <Card className="px-5 py-4">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-white/36">
          {t("settings:pdfExport.employment")}
        </p>
        <p className="font-name mt-2 truncate text-lg font-semibold tracking-[-0.04em] text-white">
          {employmentName}
        </p>
        <p className="mt-1 text-sm leading-5 text-white/46">{t("settings:pdfExport.scopeHint")}</p>
      </Card>

      <section className="space-y-2">
        <p className="hairline-text">{t("settings:pdfExport.period")}</p>
        <Card className="grid grid-cols-2 gap-3 p-5">
          <Input label={t("settings:pdfExport.from")} type="date" value={from} onChange={(event) => setFrom(event.currentTarget.value)} />
          <Input label={t("settings:pdfExport.to")} type="date" value={to} onChange={(event) => setTo(event.currentTarget.value)} />
        </Card>
      </section>

      <section className="space-y-2">
        <p className="hairline-text">{t("settings:pdfExport.include")}</p>
        <Card className="grid grid-cols-2 overflow-hidden">
          {exportFields.map((field, index) => (
            <label
              key={field}
              className={`flex min-h-14 cursor-pointer items-center gap-3 px-5 py-3 transition hover:bg-white/[0.05] ${
                index % 2 === 0 ? "border-r border-white/[0.06]" : ""
              } ${index >= 2 ? "border-t border-white/[0.06]" : ""}`}
            >
              <input
                type="checkbox"
                checked={selection[field]}
                onChange={(event) => {
                  const checked = event.currentTarget.checked;
                  setSelection((current) => ({ ...current, [field]: checked }));
                  setError(null);
                }}
                className="peer sr-only"
              />
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md border border-white/[0.18] bg-white/[0.04] text-transparent peer-checked:border-white peer-checked:bg-white peer-checked:text-black">
                <Check className="h-3.5 w-3.5" strokeWidth={3} />
              </span>
              <span className="text-sm font-semibold text-white/76">{t(`settings:pdfExport.fields.${field}`)}</span>
            </label>
          ))}
        </Card>
      </section>

      <Card className="px-5 py-4">
        <p className="text-sm leading-6 text-white/50">{t("settings:pdfExport.singlePageHint")}</p>
      </Card>

      {error ? <p role="alert" className="px-1 text-sm text-red-300">{error}</p> : null}
      <button
        type="button"
        disabled={pending || employmentsQuery.isLoading}
        onClick={() => void handleExport()}
        className="flex h-14 w-full items-center justify-center gap-2 rounded-full bg-white text-sm font-semibold text-black transition active:scale-[0.99] disabled:cursor-wait disabled:opacity-45"
      >
        <Download className="h-4 w-4" />
        {pending ? t("settings:pdfExport.generating") : t("settings:pdfExport.generate")}
      </button>
    </div>
  );
}
