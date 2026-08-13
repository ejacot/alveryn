import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Check, Download, Eye, FileText, Languages } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useSearchParams } from "react-router-dom";
import {
  getProfile, listAbsencesInRange, listEmployments, listRestDays,
  listFullWorkRecordsInRange, recordPdfExport
} from "../api/endpoints";
import { getApiError } from "../api/api-errors";
import { queryKeys } from "../api/query-keys";
import { SettingsNavigationHeader } from "../components/settings/settings-navigation-header";
import { Card } from "../components/ui/card";
import { Input } from "../components/ui/input";
import {
  buildPdfReportRows, generateAlverynPdf, getPdfWorkTypeColumns,
  type PdfExportField, type PdfExportSelection, type PdfReportRow
} from "../features/pdf-export/pdf-report";
import { useSafeBackNavigation } from "../hooks/use-safe-back-navigation";
import { i18n } from "../i18n";

const exportFields: PdfExportField[] = ["intervals", "hours", "quantity", "extra", "earnings", "notes"];
const initialSelection: PdfExportSelection = {
  intervals: true, hours: true, quantity: true, extra: true, earnings: true, notes: true
};
const languageOptions = ["ro", "de", "en", "ru"] as const;

function currentMonth() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function monthRange(month: string) {
  const [year, value] = month.split("-").map(Number);
  return {
    from: `${month}-01`,
    to: `${month}-${String(new Date(year, value, 0).getDate()).padStart(2, "0")}`
  };
}

export function PdfExportPage() {
  const { t } = useTranslation(["settings", "common"]);
  const [searchParams] = useSearchParams();
  const returnTo = searchParams.get("returnTo");
  const safeBack = useSafeBackNavigation({
    fallback: returnTo === "/calendar" || returnTo === "/statistics" ? returnTo : "/profile"
  });
  const requestedFrom = searchParams.get("from");
  const requestedTo = searchParams.get("to");
  const hasRequestedRange = Boolean(
    requestedFrom && requestedTo && /^\d{4}-\d{2}-\d{2}$/.test(requestedFrom)
      && /^\d{4}-\d{2}-\d{2}$/.test(requestedTo) && requestedFrom <= requestedTo
  );
  const initialMonth = hasRequestedRange ? requestedFrom!.slice(0, 7) : currentMonth();
  const initialRange = hasRequestedRange
    ? { from: requestedFrom!, to: requestedTo! }
    : monthRange(initialMonth);
  const [month, setMonth] = useState(initialMonth);
  const [from, setFrom] = useState(initialRange.from);
  const [to, setTo] = useState(initialRange.to);
  const [employmentIds, setEmploymentIds] = useState<string[]>([]);
  const [language, setLanguage] = useState(i18n.resolvedLanguage?.split("-")[0] ?? "en");
  const [selection, setSelection] = useState<PdfExportSelection>(initialSelection);
  const [previewRows, setPreviewRows] = useState<PdfReportRow[] | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const employmentsQuery = useQuery({ queryKey: queryKeys.employments.all(), queryFn: listEmployments });
  const profileQuery = useQuery({ queryKey: queryKeys.profile(), queryFn: getProfile });
  const activeEmployments = useMemo(
    () => (employmentsQuery.data ?? []).filter((employment) => employment.active),
    [employmentsQuery.data]
  );
  const selectedEmployments = employmentIds.length === 0
    ? activeEmployments
    : activeEmployments.filter((employment) => employmentIds.includes(employment.id));
  const employmentName = selectedEmployments.length === activeEmployments.length
    ? t("settings:employment.all")
    : selectedEmployments.map((employment) => employment.name).join(", ");
  const userName = profileQuery.data?.displayName
    || [profileQuery.data?.firstName, profileQuery.data?.lastName].filter(Boolean).join(" ")
    || "Alveryn";
  const hasSelection = exportFields.some((field) => selection[field]);

  function invalidatePreview() {
    setPreviewRows(null);
    setError(null);
  }

  async function loadRows() {
    if (from > to) throw new Error(t("settings:pdfExport.errors.dateRange"));
    if (!hasSelection) throw new Error(t("settings:pdfExport.errors.fields"));
    const [records, absences, restGroups] = await Promise.all([
      listFullWorkRecordsInRange({ from, to }),
      listAbsencesInRange({ from, to }),
      Promise.all(selectedEmployments.map((employment) => listRestDays(employment.id, from, to)))
    ]);
    const selectedSet = new Set(selectedEmployments.map((employment) => employment.id));
    const scopedRecords = employmentIds.length === 0
      ? records : records.filter((record) => Boolean(record.employmentId && selectedSet.has(record.employmentId)));
    const scopedAbsences = employmentIds.length === 0
      ? absences : absences.filter((absence) => Boolean(absence.employmentId && selectedSet.has(absence.employmentId)));
    return buildPdfReportRows(scopedRecords, selection, language, {
      from, to, absences: scopedAbsences, restDays: restGroups.flat()
    });
  }

  async function handlePreview() {
    setPending(true); setError(null);
    try {
      setPreviewRows(await loadRows());
      window.setTimeout(() => {
        const preview = document.getElementById("pdf-preview");
        if (preview && typeof preview.scrollIntoView === "function") preview.scrollIntoView({ behavior: "smooth" });
      }, 40);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : getApiError(cause).message);
    } finally { setPending(false); }
  }

  async function handleExport() {
    if (!previewRows) return;
    setPending(true); setError(null);
    const fixedT = i18n.getFixedT(language, ["settings", "common"]);
    try {
      await generateAlverynPdf({
        rows: previewRows, selection, from, to, locale: language, userName, employmentName,
        labels: {
          report: fixedT("settings:pdfExport.pdf.report"), generated: fixedT("settings:pdfExport.pdf.generated"),
          workedDays: fixedT("settings:pdfExport.pdf.workedDays"), absences: fixedT("settings:pdfExport.pdf.absences"),
          totalHours: fixedT("settings:pdfExport.pdf.totalHours"), totalExtraHours: fixedT("settings:pdfExport.pdf.totalExtraHours"),
          totalEarnings: fixedT("settings:pdfExport.pdf.totalEarnings"),
          date: fixedT("settings:pdfExport.fields.date"), activity: fixedT("settings:pdfExport.fields.activity"),
          status: fixedT("settings:pdfExport.fields.status"),
          intervals: fixedT("settings:pdfExport.fields.intervals"), hours: fixedT("settings:pdfExport.fields.hours"),
          quantity: fixedT("settings:pdfExport.fields.quantity"), extra: fixedT("settings:pdfExport.fields.extra"),
          workDetails: fixedT("settings:pdfExport.fields.workDetails"),
          earnings: fixedT("settings:pdfExport.fields.earnings"), notes: fixedT("settings:pdfExport.fields.notes"),
          generatedWith: fixedT("settings:pdfExport.pdf.generatedWith"), mixedCurrencies: fixedT("settings:pdfExport.pdf.mixedCurrencies"),
          restDay: fixedT("settings:pdfExport.pdf.restDay"), noActivity: fixedT("settings:pdfExport.pdf.noActivity"),
          page: fixedT("settings:pdfExport.pdf.page")
        }
      });
      void recordPdfExport().catch(() => undefined);
    } catch (cause) {
      setError(cause instanceof Error && cause.message
        ? t("settings:pdfExport.errors.generation", { reason: cause.message }) : getApiError(cause).message);
    } finally { setPending(false); }
  }

  return (
    <div className="pdf-export-page mx-auto w-full max-w-[760px] space-y-5 pb-28 pt-5">
      <SettingsNavigationHeader title={t("settings:pdfExport.title")} backLabel={t("common:actions.back")} onBack={safeBack} />
      <header className="px-1">
        <p className="hairline-text">{t("settings:pdfExport.employerReport")}</p>
      </header>

      <Card className="space-y-5 p-5">
        <section>
          <p className="hairline-text">{t("settings:pdfExport.period")}</p>
          <input type="month" aria-label={t("settings:pdfExport.period")} value={month} onChange={(event) => {
            const next = event.currentTarget.value; if (!next) return;
            const range = monthRange(next); setMonth(next); setFrom(range.from); setTo(range.to); invalidatePreview();
          }} className="pdf-period-input font-metric mt-3 block h-14 w-full min-w-0 max-w-full appearance-none overflow-hidden rounded-2xl border border-white/10 bg-black/20 px-4 text-center font-semibold text-white outline-none" />
          <details className="mt-3 border-t border-white/[0.06] pt-3">
            <summary className="cursor-pointer text-sm text-white/42">{t("settings:pdfExport.customPeriod")}</summary>
            <div className="mt-3 grid grid-cols-2 gap-3">
              <Input label={t("settings:pdfExport.from")} type="date" value={from} onChange={(event) => { setFrom(event.currentTarget.value); invalidatePreview(); }} />
              <Input label={t("settings:pdfExport.to")} type="date" value={to} onChange={(event) => { setTo(event.currentTarget.value); invalidatePreview(); }} />
            </div>
          </details>
        </section>

        {activeEmployments.length > 1 ? (
          <section className="border-t border-white/[0.06] pt-4">
            <p className="hairline-text">{t("settings:pdfExport.employment")}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Choice active={employmentIds.length === 0} label={t("settings:employment.all")} onClick={() => { setEmploymentIds([]); invalidatePreview(); }} />
              {activeEmployments.map((employment) => <Choice key={employment.id} active={employmentIds.includes(employment.id)} label={employment.name} onClick={() => {
                setEmploymentIds((current) => current.includes(employment.id) ? current.filter((id) => id !== employment.id) : [...current, employment.id]); invalidatePreview();
              }} />)}
            </div>
          </section>
        ) : null}

        <section className="border-t border-white/[0.06] pt-4">
          <p className="hairline-text">{t("settings:pdfExport.documentLanguage")}</p>
          <div className="mt-3 flex items-center gap-2 overflow-x-auto">
            <Languages className="h-4 w-4 shrink-0 text-white/35" />
            {languageOptions.map((item) => <Choice key={item} active={language === item} label={item.toUpperCase()} onClick={() => { setLanguage(item); invalidatePreview(); }} />)}
          </div>
        </section>
      </Card>

      <section className="space-y-2">
        <div className="flex items-end justify-between px-1"><p className="hairline-text">{t("settings:pdfExport.include")}</p><span className="text-xs text-white/35">{t("settings:pdfExport.allDaysIncluded")}</span></div>
        <Card className="grid grid-cols-2 overflow-hidden sm:grid-cols-3">
          {exportFields.map((field) => (
            <label key={field} className="flex min-h-14 cursor-pointer items-center gap-3 border-b border-r border-white/[0.06] px-4 py-3">
              <input type="checkbox" checked={selection[field]} onChange={(event) => {
                const checked = event.currentTarget.checked;
                setSelection((current) => ({ ...current, [field]: checked }));
                invalidatePreview();
              }} className="peer sr-only" />
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md border border-white/[0.18] text-transparent peer-checked:border-[#10b981] peer-checked:bg-[#10b981] peer-checked:text-black"><Check className="h-3.5 w-3.5" /></span>
              <span className="text-sm font-semibold text-white/68">{t(`settings:pdfExport.fields.${field}`)}</span>
            </label>
          ))}
        </Card>
      </section>

      {error ? <p role="alert" className="rounded-2xl bg-red-400/10 px-4 py-3 text-sm text-red-200">{error}</p> : null}
      {!previewRows ? (
        <button type="button" disabled={pending || employmentsQuery.isLoading || profileQuery.isLoading} onClick={() => void handlePreview()} className="flex h-14 w-full items-center justify-center gap-2 rounded-full bg-white font-semibold text-black disabled:opacity-40"><Eye className="h-4 w-4" />{pending ? t("settings:pdfExport.preparing") : t("settings:pdfExport.preview")}</button>
      ) : (
        <>
          <ReportPreview rows={previewRows} userName={userName} employmentName={employmentName} from={from} to={to} selection={selection} t={t} />
          <button type="button" disabled={pending} onClick={() => void handleExport()} className="flex h-14 w-full items-center justify-center gap-2 rounded-full bg-white font-semibold text-black disabled:opacity-40"><Download className="h-4 w-4" />{pending ? t("settings:pdfExport.generating") : t("settings:pdfExport.generate")}</button>
        </>
      )}
    </div>
  );
}

function Choice({ active, label, onClick }: { active: boolean; label: string; onClick: () => void }) {
  return <button type="button" aria-pressed={active} onClick={onClick} className={`inline-flex min-h-10 items-center gap-2 rounded-full border px-4 text-sm font-semibold ${active ? "border-[#10b981]/45 bg-[#10b981]/12 text-[#6ee7b7]" : "border-white/[0.08] bg-white/[0.035] text-white/50"}`}>{active ? <Check className="h-3.5 w-3.5" /> : null}{label}</button>;
}

function ReportPreview({ rows, userName, employmentName, from, to, selection, t }: { rows: PdfReportRow[]; userName: string; employmentName: string; from: string; to: string; selection: PdfExportSelection; t: ReturnType<typeof useTranslation<["settings", "common"]>>["t"] }) {
  const workTypes = getPdfWorkTypeColumns(rows);
  const columns = `7rem 8rem repeat(${Math.max(workTypes.length, 1)}, minmax(10rem, 1fr))${selection.notes ? " minmax(10rem, 1fr)" : ""}${selection.earnings ? " 8rem" : ""}`;
  return (
    <section id="pdf-preview" className="space-y-2">
      <div className="flex items-center justify-between px-1"><p className="hairline-text">{t("settings:pdfExport.preview")}</p><span className="flex items-center gap-1 text-xs text-white/35"><FileText className="h-3.5 w-3.5" />A4</span></div>
      <div className="overflow-hidden rounded-[26px] bg-[#f4f4f4] text-[#111] shadow-[0_24px_70px_rgba(0,0,0,0.35)]">
        <div className="flex items-start justify-between bg-[#111] px-5 py-5 text-white">
          <div>
            <div className="flex items-center gap-2.5">
              <img src="/brand/alveryn-mark.png" alt="" className="h-7 w-7 object-contain" />
              <p className="text-xs font-bold tracking-[0.28em]">ALVERYN</p>
            </div>
            <p className="mt-2 text-sm font-semibold">{userName}</p>
          </div>
          <div className="text-right text-[0.65rem] text-white/55"><p>{employmentName}</p><p>{from} – {to}</p></div>
        </div>
        <div className="max-h-[34rem] overflow-auto p-3">
          <div className="min-w-max">
            <div className="grid gap-2 rounded-t-xl bg-[#111] px-2 py-2 text-[0.62rem] font-bold uppercase text-white" style={{ gridTemplateColumns: columns }}>
              <span>{t("settings:pdfExport.fields.date")}</span>
              <span>{t("settings:pdfExport.fields.status")}</span>
              {workTypes.length ? workTypes.map((type) => <span key={type.id}>{type.name}</span>) : <span>{t("settings:pdfExport.fields.activity")}</span>}
              {selection.notes ? <span>{t("settings:pdfExport.fields.notes")}</span> : null}
              {selection.earnings ? <span>{t("settings:pdfExport.fields.earnings")}</span> : null}
            </div>
            {rows.map((row) => <div key={row.key} className="grid gap-2 border-b border-black/[0.07] px-2 py-2 text-[0.64rem]" style={{ gridTemplateColumns: columns }}>
              <span className="font-semibold">{row.date}</span>
              <span>{row.status}</span>
              {workTypes.length ? workTypes.map((type) => <span key={type.id}>{row.workTypeCells.find((cell) => cell.workTypeId === type.id)?.value ?? ""}</span>) : <span />}
              {selection.notes ? <span>{row.notes}</span> : null}
              {selection.earnings ? <span>{row.earnings}</span> : null}
            </div>)}
          </div>
        </div>
      </div>
      <p className="px-1 text-xs leading-5 text-white/38">{from.slice(0, 7) === to.slice(0, 7) ? t("settings:pdfExport.onePageConfirmed") : t("settings:pdfExport.multiPageHint")}</p>
    </section>
  );
}
