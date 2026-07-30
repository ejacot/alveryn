import { useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  AlertTriangle, CheckCircle2, FileSpreadsheet, Files, Send, Sparkles, Upload
} from "lucide-react";
import { useTranslation } from "react-i18next";
import {
  analyzeDataImport,
  chatAboutDataImportQuestion,
  confirmDataImport,
  executeDataImport,
  listEmployments,
  listWorkTypes,
  previewDataImport,
  setDataImportPeriod,
  setDataImportSheetPeriods
} from "../api/endpoints";
import { getApiError } from "../api/api-errors";
import { queryKeys } from "../api/query-keys";
import { SettingsNavigationHeader } from "../components/settings/settings-navigation-header";
import { Button } from "../components/ui/button";
import { Card } from "../components/ui/card";
import { useSafeBackNavigation } from "../hooks/use-safe-back-navigation";
import type {
  DataImportAnalysisResponse,
  DataImportCandidate,
  DataImportCandidateDecision,
  DataImportChatMessage,
  DataImportChatResponse,
  DataImportPreviewResponse,
  DataImportQuestionResolution,
  DataImportScope
} from "../types/data-import";

const monthWords = [
  ["january", "januar", "ianuarie", "jan"],
  ["february", "februar", "februarie", "feb"],
  ["march", "märz", "marz", "martie", "mar"],
  ["april", "aprilie", "apr"],
  ["may", "mai"],
  ["june", "juni", "iunie", "iun"],
  ["july", "juli", "iulie", "iul"],
  ["august"],
  ["september", "septembrie", "sep"],
  ["october", "oktober", "octombrie", "oct"],
  ["november", "noiembrie", "nov"],
  ["december", "dezember", "decembrie", "dec"]
];

function detectedPeriod(result: DataImportAnalysisResponse) {
  if (result.analysis.periodContext) return result.analysis.periodContext;
  const text = `${result.filename} ${result.analysis.sheets.map((sheet) => sheet.name).join(" ")}`
    .toLocaleLowerCase();
  const year = text.match(/\b(20\d{2})\b/)?.[1];
  const monthIndex = monthWords.findIndex((words) => words.some((word) => text.includes(word)));
  return year && monthIndex >= 0
    ? { year: Number(year), month: monthIndex + 1, source: "DETECTED" }
    : null;
}

function detectPeriodFromText(text: string) {
  const normalized = text.toLocaleLowerCase();
  const year = normalized.match(/\b(20\d{2})\b/)?.[1];
  const monthIndex = monthWords.findIndex(
    (words) => words.some((word) => normalized.includes(word)));
  return year && monthIndex >= 0
    ? { year: Number(year), month: monthIndex + 1 } : null;
}

function detectSheetPeriod(sheetName: string, filename: string) {
  const normalizedSheet = sheetName.toLocaleLowerCase();
  const numericPeriod = normalizedSheet.match(/\b(20\d{2})[-_. /](0?[1-9]|1[0-2])\b/);
  if (numericPeriod) {
    return { year: Number(numericPeriod[1]), month: Number(numericPeriod[2]) };
  }
  const monthIndex = monthWords.findIndex(
    (words) => words.some((word) => normalizedSheet.includes(word)));
  const year = `${sheetName} ${filename}`.match(/\b(20\d{2})\b/)?.[1];
  return year && monthIndex >= 0
    ? { year: Number(year), month: monthIndex + 1 } : null;
}

function initialSheetPeriods(result: DataImportAnalysisResponse) {
  const saved = new Map(result.analysis.sheetPeriodContexts?.map(
    (period) => [period.sheet, { year: String(period.year), month: String(period.month) }]));
  return Object.fromEntries(result.analysis.sheets.map((sheet) => {
    const detected = saved.get(sheet.name)
      ?? detectSheetPeriod(sheet.name, result.filename);
    return [sheet.name, {
      year: detected ? String(detected.year) : "",
      month: detected ? String(detected.month) : ""
    }];
  }));
}

function hasDetectedSheetPeriods(result: DataImportAnalysisResponse) {
  return result.analysis.sheets.length > 1
    && result.analysis.sheets.every(
      (sheet) => Boolean(detectSheetPeriod(sheet.name, result.filename)));
}

function initialDecision(candidate: DataImportCandidate): DataImportCandidateDecision {
  const suggested = candidate.suggestedCalculationType;
  const ignored = candidate.semanticRole === "IGNORE";
  const calculationMethod = suggested === "TIME_BASED" ? "TIME_BASED"
    : suggested === "UNITS_PER_HOUR_BASED" ? "UNITS_PER_HOUR_BASED"
      : suggested === "FIXED_AMOUNT" ? "FIXED_PRICE_BASED"
        : suggested === "UNIT_BASED" ? "UNIT_BASED" : undefined;
  return {
    sourceLabel: candidate.sourceLabel,
    action: ignored ? "IGNORE"
      : candidate.semanticRole === "REST_DAY" ? "MARK_REST_DAY"
        : candidate.semanticRole === "ABSENCE" ? "IMPORT_AS_ABSENCE"
      : candidate.semanticRole === "SURCHARGE" ? "REVIEW_PER_ENTRY"
        : candidate.matchedWorkTypeId ? "MATCH_EXISTING" : "CREATE_NEW",
    name: candidate.matchedWorkTypeName ?? candidate.sourceLabel,
    workTypeId: candidate.matchedWorkTypeId,
    calculationMethod,
    compensationMethod: candidate.suggestedCompensationMethod,
    unitsPerHour: candidate.suggestedUnitsPerHour,
    ratePerUnit: candidate.suggestedRatePerUnit,
    teamworkEnabled: candidate.suggestedTeamworkEnabled,
    currency: candidate.suggestedRatePerUnit ? "EUR" : undefined
  };
}

function decisionReady(decision?: DataImportCandidateDecision) {
  if (!decision) return false;
  if (decision.action === "IGNORE" || decision.action === "REVIEW_PER_ENTRY"
      || decision.action === "MARK_REST_DAY") return true;
  if (decision.action === "IMPORT_AS_ABSENCE") {
    return Boolean(decision.absenceType)
      && decision.absencePaid !== undefined
      && (!decision.absencePaid || Boolean(decision.absencePaidMinutesPerDay));
  }
  if (decision.action === "MATCH_EXISTING") return Boolean(decision.workTypeId);
  if (!decision.name?.trim() || !decision.calculationMethod) return false;
  if (decision.calculationMethod === "UNIT_BASED") return Boolean(decision.ratePerUnit);
  if (decision.calculationMethod === "UNITS_PER_HOUR_BASED") {
    return Boolean(decision.unitsPerHour);
  }
  return true;
}

function numberValue(value: string) {
  const parsed = Number(value.replace(",", "."));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}

export function DataImportPage() {
  const { t } = useTranslation(["settings", "common"]);
  const safeBack = useSafeBackNavigation({ fallback: "/profile" });
  const fileInput = useRef<HTMLInputElement | null>(null);
  const payrollInput = useRef<HTMLInputElement | null>(null);
  const employments = useQuery({
    queryKey: queryKeys.employments.all(), queryFn: listEmployments
  });
  const workTypes = useQuery({
    queryKey: queryKeys.workTypes.all(), queryFn: listWorkTypes
  });
  const [scope] = useState<DataImportScope>("SINGLE");
  const [employmentId, setEmploymentId] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [payrollFiles, setPayrollFiles] = useState<File[]>([]);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<DataImportAnalysisResponse | null>(null);
  const [drafts, setDrafts] = useState<Record<string, DataImportCandidateDecision>>({});
  const [preview, setPreview] = useState<DataImportPreviewResponse | null>(null);
  const [resolutions, setResolutions] =
    useState<Record<string, DataImportQuestionResolution>>({});
  const [assistantMessages, setAssistantMessages] = useState<DataImportChatMessage[]>([]);
  const [assistantInput, setAssistantInput] = useState("");
  const [assistantProposal, setAssistantProposal] =
    useState<NonNullable<DataImportChatResponse["proposal"]> | null>(null);
  const [assistantPending, setAssistantPending] = useState(false);
  const [importSummary, setImportSummary] = useState<string | null>(null);
  const [periodYear, setPeriodYear] = useState("");
  const [periodMonth, setPeriodMonth] = useState("");
  const [confirmedAliases, setConfirmedAliases] = useState<Set<string>>(new Set());
  const [sheetPeriods, setSheetPeriods] =
    useState<Record<string, { year: string; month: string }>>({});

  const activeEmployments = useMemo(
    () => employments.data?.filter((employment) => employment.active) ?? [],
    [employments.data]
  );
  const unresolvedCandidates = useMemo(() => {
    if (!result || preview) return [];
    return result.analysis.workTypeCandidates.filter(
      (candidate) => !decisionReady(drafts[candidate.normalizedLabel])
        || Boolean(candidate.matchedWorkTypeId && candidate.confidence < 0.99
          && !confirmedAliases.has(candidate.normalizedLabel))
    );
  }, [confirmedAliases, drafts, preview, result]);
  const allQuestions = useMemo(() => preview?.entries.flatMap((entry) =>
    entry.questions.map((question) => ({ entry, question }))) ?? [], [preview]);
  const unresolvedQuestions = useMemo(() => allQuestions.filter(
    ({ question }) => !resolutions[question.id]), [allQuestions, resolutions]);
  const currentQuestion = unresolvedQuestions[0] ?? null;
  const clearEntries = useMemo(() => preview?.entries.filter((entry) =>
    entry.status !== "DUPLICATE"
    && (entry.lines.length > 0 || entry.classification !== "WORK")
    && entry.questions.every((question) => Boolean(resolutions[question.id]))
  ) ?? [], [preview, resolutions]);
  const totalHours = useMemo(() => clearEntries.reduce((total, entry) =>
    total + entry.lines.reduce((entryTotal, line) =>
      entryTotal + (line.calculationMethod === "TIME_BASED" ? line.value : 0), 0), 0),
  [clearEntries]);
  const totalUnits = clearEntries.reduce((total, entry) =>
    total + entry.lines.reduce((entryTotal, line) =>
      entryTotal + (line.calculationMethod === "UNIT_BASED" ? line.value : 0), 0), 0);
  const teamSizedDays = clearEntries.filter((entry) => Boolean(entry.teamSize)).length;
  const extraEligibleHours = useMemo(() => allQuestions
    .filter(({ entry }) => clearEntries.some((candidate) => candidate.id === entry.id))
    .reduce((total, item) =>
    total + (item.question.type === "SURCHARGE"
      ? numberValue(item.question.value) ?? 0 : 0), 0), [allQuestions, clearEntries]);
  const restDayCount = clearEntries.filter(
    (entry) => entry.classification === "REST_DAY").length;
  const absenceCount = clearEntries.filter(
    (entry) => entry.classification === "ABSENCE").length;
  const notesCount = clearEntries.filter((entry) => Boolean(entry.notes?.trim())).length;

  async function analyze() {
    if (!file || (scope === "SINGLE" && !employmentId)) return;
    setPending(true);
    setError(null);
    try {
      const analyzed = await analyzeDataImport(
        file, scope, employmentId || undefined, payrollFiles);
      setResult(analyzed);
      const period = detectedPeriod(analyzed);
      setPeriodYear(period ? String(period.year) : "");
      setPeriodMonth(period ? String(period.month) : "");
      setSheetPeriods(initialSheetPeriods(analyzed));
      setDrafts(Object.fromEntries(analyzed.analysis.workTypeCandidates.map((candidate) => [
        candidate.normalizedLabel, initialDecision(candidate)
      ])));
      setResolutions({});
      setAssistantMessages([]);
      setAssistantProposal(null);
      setImportSummary(null);
      setConfirmedAliases(new Set());
      if (analyzed.status === "READY" || analyzed.status === "IMPORTED") {
        setPreview(await previewDataImport(analyzed.batchId));
      } else {
        setPreview(null);
      }
    } catch (cause) {
      setError(getApiError(cause).message);
    } finally {
      setPending(false);
    }
  }

  function updateDecision(candidate: DataImportCandidate, patch: Partial<DataImportCandidateDecision>) {
    setDrafts((current) => ({
      ...current,
      [candidate.normalizedLabel]: { ...current[candidate.normalizedLabel], ...patch }
    }));
  }

  async function prepareImport() {
    if (!result || unresolvedCandidates.length > 0) return;
    const multipleSheets = result.analysis.sheets.length > 1;
    const sheetPeriodsReady = Object.values(sheetPeriods).every(
      (period) => Boolean(period.year && period.month));
    if (!result.analysis.datesAreExplicit
      && (multipleSheets ? !sheetPeriodsReady : !periodYear || !periodMonth)) return;
    setPending(true);
    setError(null);
    try {
      if (multipleSheets && !result.analysis.datesAreExplicit) {
        await setDataImportSheetPeriods(result.batchId,
          result.analysis.sheets.map((sheet) => ({
            sheet: sheet.name,
            year: Number(sheetPeriods[sheet.name].year),
            month: Number(sheetPeriods[sheet.name].month)
          })));
      } else if (!result.analysis.datesAreExplicit
        && !multipleSheets && !detectedPeriod(result)) {
        await setDataImportPeriod(result.batchId, Number(periodYear), Number(periodMonth));
      }
      if (result.status !== "READY" && result.status !== "IMPORTED") {
        await confirmDataImport(
          result.batchId,
          result.analysis.workTypeCandidates.map(
            (candidate) => drafts[candidate.normalizedLabel])
        );
        await workTypes.refetch();
      }
      const next = await previewDataImport(result.batchId);
      setPreview(next);
      setAssistantMessages([{
        role: "ASSISTANT",
        content: next.questionCount > 0
          ? t("settings:dataImport.assistantIntro", { count: next.questionCount })
          : t("settings:dataImport.assistantAllClear")
      }]);
    } catch (cause) {
      setError(getApiError(cause).message);
    } finally {
      setPending(false);
    }
  }

  async function sendToAssistant() {
    if (!result || !currentQuestion || !assistantInput.trim() || assistantPending) return;
    const conversation = [
      ...assistantMessages,
      { role: "USER" as const, content: assistantInput.trim() }
    ].slice(-12);
    setAssistantMessages(conversation);
    setAssistantInput("");
    setAssistantProposal(null);
    setAssistantPending(true);
    setError(null);
    try {
      const response = await chatAboutDataImportQuestion(
        result.batchId, currentQuestion.question.id, conversation);
      setAssistantMessages((current) => [
        ...current,
        { role: "ASSISTANT", content: response.message }
      ]);
      setAssistantProposal(response.proposal ?? null);
    } catch (cause) {
      setError(getApiError(cause).message);
    } finally {
      setAssistantPending(false);
    }
  }

  function applyProposalToSimilar() {
    if (!assistantProposal || !currentQuestion) return;
    const source = currentQuestion.question;
    const targets = source.type === "SURCHARGE"
      ? unresolvedQuestions.filter(({ question }) =>
          question.type === source.type && question.sourceLabel === source.sourceLabel)
      : [currentQuestion];
    const applicable: Array<{
      questionId: string;
      targetWorkTypeId?: string;
      eligibleHours?: number;
    }> = [];
    for (const { entry, question } of targets) {
      if (assistantProposal.action !== "ENTER_PERCENTAGE") {
        applicable.push({
          questionId: question.id,
          eligibleHours: assistantProposal.eligibleHours ?? undefined
        });
        continue;
      }
      const eligibleHours = numberValue(question.value);
      const timeLines = entry.lines.filter(
        (line) => line.calculationMethod === "TIME_BASED");
      const proposedTarget = timeLines.find(
        (line) => line.workTypeId === assistantProposal.targetWorkTypeId
          && Boolean(eligibleHours && eligibleHours <= line.value));
      const onlyTarget = timeLines.length === 1 && eligibleHours
        && eligibleHours <= timeLines[0].value ? timeLines[0] : undefined;
      const target = proposedTarget ?? onlyTarget;
      if (target) {
        applicable.push({
          questionId: question.id,
          targetWorkTypeId: target.workTypeId,
          eligibleHours
        });
      }
    }
    setResolutions((current) => {
      const next = { ...current };
      for (const item of applicable) {
        next[item.questionId] = {
          action: assistantProposal.action,
          percentage: assistantProposal.percentage ?? undefined,
          targetWorkTypeId: item.targetWorkTypeId,
          eligibleHours: item.eligibleHours
        };
      }
      return next;
    });
    setAssistantMessages((current) => [...current, {
      role: "ASSISTANT",
      content: t("settings:dataImport.appliedSimilar", { count: applicable.length })
    }]);
    setAssistantProposal(null);
  }

  function resolveManually(action: DataImportQuestionResolution["action"]) {
    if (!currentQuestion) return;
    const question = currentQuestion.question;
    const timeLines = currentQuestion.entry.lines.filter(
      (line) => line.calculationMethod === "TIME_BASED");
    setResolutions((current) => ({
      ...current,
      [question.id]: {
        action,
        targetWorkTypeId: action === "ENTER_PERCENTAGE" && timeLines.length === 1
          ? timeLines[0].workTypeId : undefined,
        eligibleHours: action === "ENTER_PERCENTAGE"
          ? numberValue(question.value) : undefined
      }
    }));
    setAssistantProposal(null);
  }

  async function importData() {
    if (!result || clearEntries.length === 0 || unresolvedQuestions.length > 0) return;
    setPending(true);
    setError(null);
    try {
      const imported = await executeDataImport(
        result.batchId, clearEntries.map((entry) => entry.id), resolutions);
      setImportSummary(t("settings:dataImport.importedSummary", {
        records: imported.importedRecords, lines: imported.importedLines
      }));
      setPreview(await previewDataImport(result.batchId));
    } catch (cause) {
      setError(getApiError(cause).message);
    } finally {
      setPending(false);
    }
  }

  function reset() {
    setResult(null);
    setPreview(null);
    setFile(null);
    setPayrollFiles([]);
    setResolutions({});
    setAssistantMessages([]);
    setImportSummary(null);
  }

  return (
    <div className="settings-detail-content mx-auto w-full max-w-[620px] space-y-5 px-5 pb-32 pt-5">
      <SettingsNavigationHeader
        title={t("settings:dataImport.title")}
        backLabel={t("common:actions.back")}
        onBack={safeBack}
      />
      <Progress stage={!result ? 1 : !preview ? 2 : unresolvedQuestions.length > 0 ? 3 : 4} />

      {!result ? (
        <>
          <header>
            <h1 className="text-2xl font-semibold text-white">
              {t("settings:dataImport.simpleSourceTitle")}
            </h1>
            <p className="mt-2 text-sm leading-6 text-white/50">
              {t("settings:dataImport.simpleSourceHint")}
            </p>
          </header>
          <Card className="space-y-4 p-5">
            <label>
              <span className="mb-2 block text-sm font-medium text-white/70">
                {t("settings:dataImport.employment")}
              </span>
              <select value={employmentId}
                onChange={(event) => setEmploymentId(event.currentTarget.value)}
                className="h-14 w-full rounded-2xl border border-white/10 bg-[#111] px-4 text-white">
                <option value="">{t("settings:dataImport.chooseEmployment")}</option>
                {activeEmployments.map((employment) => (
                  <option key={employment.id} value={employment.id}>{employment.name}</option>
                ))}
              </select>
            </label>
            <input ref={fileInput} hidden type="file" accept=".xlsx,.txt,text/plain"
              onChange={(event) => {
                const selected = event.currentTarget.files?.[0] ?? null;
                setFile(selected);
                setResult(null);
                setPreview(null);
                setError(null);
              }} />
            <button type="button" onClick={() => {
              if (fileInput.current) {
                fileInput.current.value = "";
                fileInput.current.click();
              }
            }}
              className="flex min-h-28 w-full items-center gap-4 rounded-[24px] border border-dashed border-emerald-300/30 bg-emerald-300/[0.06] p-5 text-left">
              <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-emerald-300/15">
                {file ? <FileSpreadsheet className="h-6 w-6 text-emerald-200" />
                  : <Upload className="h-6 w-6 text-emerald-200" />}
              </span>
              <span>
                <span className="block font-semibold text-white">
                  {file?.name ?? t("settings:dataImport.chooseFile")}
                </span>
                <span className="mt-1 block text-sm text-white/45">
                  {t("settings:dataImport.simpleFileHint")}
                </span>
              </span>
            </button>
            <input ref={payrollInput} hidden multiple type="file" accept=".pdf"
              onChange={(event) => setPayrollFiles(
                Array.from(event.currentTarget.files ?? []))} />
            <button type="button" onClick={() => payrollInput.current?.click()}
              className="flex min-h-14 w-full items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.035] px-4 text-left">
              <Files className="h-5 w-5 text-white/45" />
              <span className="text-sm text-white/65">
                {payrollFiles.length
                  ? t("settings:dataImport.payrollSelected", { count: payrollFiles.length })
                  : t("settings:dataImport.optionalEvidence")}
              </span>
            </button>
          </Card>
          {error ? <ErrorMessage message={error} /> : null}
          <Button className="w-full" disabled={!file || !employmentId || pending}
            onClick={() => void analyze()}>
            {pending ? t("settings:dataImport.analyzing")
              : t("settings:dataImport.startSmartImport")}
          </Button>
        </>
      ) : !preview ? (
        <>
          <header>
            <p className="text-sm font-medium text-emerald-200">
              {t("settings:dataImport.aiReadFile")}
            </p>
            <h1 className="mt-1 text-2xl font-semibold text-white">
              {t("settings:dataImport.understoodTitle")}
            </h1>
          </header>
          <Card className="p-5">
            <div className="grid grid-cols-3 gap-3 text-center">
              <Metric value={result.analysis.sheetCount} label={t("settings:dataImport.sheets")} />
              <Metric value={result.analysis.rowCount} label={t("settings:dataImport.rows")} />
              <Metric value={result.analysis.workTypeCandidates.length}
                label={t("settings:dataImport.detectedKinds")} />
            </div>
          </Card>
          {!result.analysis.datesAreExplicit
            && result.analysis.sheets.length > 1 && !hasDetectedSheetPeriods(result) ? (
            <Card className="border-amber-300/20 p-5">
              <div className="mb-4 rounded-2xl border border-emerald-300/20 bg-emerald-300/[0.08] px-4 py-3">
                <p className="text-sm font-semibold text-emerald-100">
                  {result.analysis.sheets.length} of {result.analysis.sheetCount} sheets read
                </p>
                <p className="mt-1 text-xs leading-5 text-emerald-100/60">
                  {result.analysis.rowCount} rows are stored. Confirming the periods below applies
                  to every sheet, not only the first visible ones.
                </p>
              </div>
              <p className="font-semibold text-white">
                {t("settings:dataImport.periodsBySheet")}
              </p>
              <p className="mt-1 text-sm leading-5 text-white/50">
                {t("settings:dataImport.periodsBySheetHint")}
              </p>
              <div className="mt-4 space-y-3">
                {result.analysis.sheets.map((sheet) => (
                  <div key={sheet.name}>
                    <p className="mb-2 text-xs font-medium text-white/55">{sheet.name}</p>
                    <div className="grid grid-cols-2 gap-3">
                      <select value={sheetPeriods[sheet.name]?.month ?? ""}
                        onChange={(event) => {
                          const month = event.currentTarget.value;
                          setSheetPeriods((current) => ({
                            ...current,
                            [sheet.name]: {
                              ...current[sheet.name],
                              month
                            }
                          }));
                        }}
                        className="h-12 rounded-xl border border-white/10 bg-[#111] px-3 text-white">
                        <option value="">{t("settings:dataImport.month")}</option>
                        {Array.from({ length: 12 }, (_, index) => (
                          <option key={index + 1} value={index + 1}>{index + 1}</option>
                        ))}
                      </select>
                      <input type="number" inputMode="numeric" min="2000" max="2100"
                        value={sheetPeriods[sheet.name]?.year ?? ""}
                        placeholder={t("settings:dataImport.year")}
                        onChange={(event) => {
                          const year = event.currentTarget.value;
                          setSheetPeriods((current) => ({
                            ...current,
                            [sheet.name]: {
                              ...current[sheet.name],
                              year
                            }
                          }));
                        }}
                        className="h-12 rounded-xl border border-white/10 bg-[#111] px-3 text-white" />
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          ) : !result.analysis.datesAreExplicit
            && result.analysis.sheets.length === 1 && !detectedPeriod(result) ? (
            <Card className="border-amber-300/20 p-5">
              <p className="font-semibold text-white">
                {t("settings:dataImport.periodQuestion")}
              </p>
              <p className="mt-1 text-sm leading-5 text-white/50">
                {t("settings:dataImport.periodQuestionHint")}
              </p>
              <div className="mt-4 grid grid-cols-2 gap-3">
                <select value={periodMonth}
                  onChange={(event) => setPeriodMonth(event.currentTarget.value)}
                  className="h-12 rounded-xl border border-white/10 bg-[#111] px-3 text-white">
                  <option value="">{t("settings:dataImport.month")}</option>
                  {Array.from({ length: 12 }, (_, index) => (
                    <option key={index + 1} value={index + 1}>{index + 1}</option>
                  ))}
                </select>
                <input type="number" inputMode="numeric" min="2000" max="2100"
                  value={periodYear} placeholder={t("settings:dataImport.year")}
                  onChange={(event) => setPeriodYear(event.currentTarget.value)}
                  className="h-12 rounded-xl border border-white/10 bg-[#111] px-3 text-white" />
              </div>
            </Card>
          ) : null}
          <div className="space-y-3">
            {result.analysis.workTypeCandidates.map((candidate) => {
              const draft = drafts[candidate.normalizedLabel];
              const needsAnswer = !decisionReady(draft);
              const needsAliasConfirmation = Boolean(candidate.matchedWorkTypeId
                && candidate.confidence < 0.99
                && !confirmedAliases.has(candidate.normalizedLabel));
              return (
                <Card key={candidate.normalizedLabel}
                  className={`p-4 ${
                    needsAnswer || needsAliasConfirmation ? "border-amber-300/25" : ""
                  }`}>
                  <div className="flex items-start gap-3">
                    {needsAnswer || needsAliasConfirmation
                      ? <AlertTriangle className="mt-0.5 h-5 w-5 text-amber-300" />
                      : <CheckCircle2 className="mt-0.5 h-5 w-5 text-emerald-300" />}
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-white">{candidate.sourceLabel}</p>
                      <p className="mt-1 text-sm leading-5 text-white/50">
                        {needsAliasConfirmation
                          ? t("settings:dataImport.sameAsQuestion", {
                              source: candidate.sourceLabel,
                              existing: candidate.matchedWorkTypeName
                            })
                          : draft?.action === "MATCH_EXISTING"
                          ? t("settings:dataImport.willUseExisting", { name: candidate.matchedWorkTypeName })
                          : candidate.markerCandidate && needsAnswer
                            ? t("settings:dataImport.markerMeaning", {
                                marker: candidate.sourceLabel
                              })
                          : draft?.action === "REVIEW_PER_ENTRY"
                            ? t("settings:dataImport.willClarifyExtra")
                            : draft?.action === "MARK_REST_DAY"
                              ? t("settings:dataImport.willMarkRest")
                              : draft?.action === "IMPORT_AS_ABSENCE"
                                ? t("settings:dataImport.willImportAbsence")
                            : draft?.action === "IGNORE"
                              ? t("settings:dataImport.willNotImportAsWork")
                              : needsAnswer
                                ? t("settings:dataImport.needOneAnswer")
                                : t("settings:dataImport.willCreate", { name: draft?.name })}
                      </p>
                      {needsAliasConfirmation ? (
                        <div className="mt-3 space-y-2">
                          <button type="button"
                            onClick={() => setConfirmedAliases((current) =>
                              new Set(current).add(candidate.normalizedLabel))}
                            className="min-h-12 w-full rounded-xl bg-emerald-300 px-3 text-sm font-semibold text-black">
                            {t("settings:dataImport.yesSameWorkType")}
                          </button>
                          <select value={draft?.workTypeId ?? ""}
                            onChange={(event) => {
                              const id = event.currentTarget.value;
                              const selected = workTypes.data?.find((type) => type.id === id);
                              updateDecision(candidate, {
                                action: "MATCH_EXISTING",
                                workTypeId: id,
                                name: selected?.name,
                                calculationMethod: selected?.calculationMethod
                              });
                              setConfirmedAliases((current) =>
                                new Set(current).add(candidate.normalizedLabel));
                            }}
                            className="h-12 w-full rounded-xl border border-white/10 bg-[#111] px-3 text-sm text-white">
                            <option value="">{t("settings:dataImport.chooseDifferentWorkType")}</option>
                            {workTypes.data?.filter((type) =>
                              !type.employmentId || type.employmentId === employmentId)
                              .map((type) => (
                                <option key={type.id} value={type.id}>{type.name}</option>
                              ))}
                          </select>
                        </div>
                      ) : draft?.action === "IMPORT_AS_ABSENCE" ? (
                        <div className="mt-3 space-y-3">
                          <div className="grid grid-cols-2 gap-2">
                            {(["SICK_LEAVE", "VACATION", "DAY_OFF", "PUBLIC_HOLIDAY"] as const)
                              .map((type) => (
                                <button key={type} type="button"
                                  onClick={() => updateDecision(candidate, { absenceType: type })}
                                  className={`min-h-12 rounded-xl border px-2 text-xs font-medium ${
                                    draft.absenceType === type
                                      ? "border-emerald-300/40 bg-emerald-300/15 text-emerald-200"
                                      : "border-white/10 bg-white/[0.05] text-white/70"
                                  }`}>
                                  {t(`settings:dataImport.absenceTypes.${type}`)}
                                </button>
                              ))}
                          </div>
                          <p className="text-sm text-white/60">
                            {t("settings:dataImport.historicalAbsencePayment")}
                          </p>
                          <div className="grid grid-cols-2 gap-2">
                            <button type="button"
                              onClick={() => updateDecision(candidate, {
                                absencePaid: true
                              })}
                              className={`min-h-12 rounded-xl border text-sm ${
                                draft.absencePaid === true
                                  ? "border-emerald-300/40 bg-emerald-300/15 text-emerald-200"
                                  : "border-white/10 bg-white/[0.05] text-white/70"
                              }`}>
                              {t("settings:dataImport.paidAbsence")}
                            </button>
                            <button type="button"
                              onClick={() => updateDecision(candidate, {
                                absencePaid: false,
                                absencePaidMinutesPerDay: 0
                              })}
                              className={`min-h-12 rounded-xl border text-sm ${
                                draft.absencePaid === false
                                  ? "border-emerald-300/40 bg-emerald-300/15 text-emerald-200"
                                  : "border-white/10 bg-white/[0.05] text-white/70"
                              }`}>
                              {t("settings:dataImport.unpaidAbsence")}
                            </button>
                          </div>
                          {draft.absencePaid === true ? (
                            <input type="number" min="0.25" max="24" step="0.25"
                              inputMode="decimal"
                              value={draft.absencePaidMinutesPerDay
                                ? draft.absencePaidMinutesPerDay / 60 : ""}
                              placeholder={t("settings:dataImport.paidHoursPerDay")}
                              onChange={(event) => {
                                const hours = numberValue(event.currentTarget.value);
                                updateDecision(candidate, {
                                  absencePaidMinutesPerDay: hours
                                    ? Math.round(hours * 60) : undefined
                                });
                              }}
                              className="h-12 w-full rounded-xl border border-white/10 bg-[#111] px-3 text-sm text-white" />
                          ) : null}
                        </div>
                      ) : candidate.markerCandidate && needsAnswer ? (
                        <div className="mt-3 grid grid-cols-2 gap-2">
                          <button type="button"
                            onClick={() => updateDecision(candidate, {
                              action: "CREATE_NEW",
                              name: candidate.sourceLabel,
                              calculationMethod: "TIME_BASED",
                              compensationMethod: "HOURLY"
                            })}
                            className="min-h-12 rounded-xl border border-emerald-300/20 bg-emerald-300/[0.08] px-2 text-xs font-medium text-emerald-100">
                            {t("settings:dataImport.classifyWorkType")}
                          </button>
                          <button type="button"
                            onClick={() => updateDecision(candidate, {
                              action: "MARK_REST_DAY",
                              calculationMethod: undefined
                            })}
                            className="min-h-12 rounded-xl border border-white/10 bg-white/[0.05] px-2 text-xs font-medium text-white/70">
                            {t("settings:dataImport.classifyRest")}
                          </button>
                          <button type="button"
                            onClick={() => updateDecision(candidate, {
                              action: "IMPORT_AS_ABSENCE",
                              calculationMethod: undefined
                            })}
                            className="min-h-12 rounded-xl border border-white/10 bg-white/[0.05] px-2 text-xs font-medium text-white/70">
                            {t("settings:dataImport.classifyAbsence")}
                          </button>
                          <button type="button"
                            onClick={() => updateDecision(candidate, {
                              action: "IGNORE",
                              calculationMethod: undefined
                            })}
                            className="min-h-12 rounded-xl border border-white/10 bg-white/[0.05] px-2 text-xs font-medium text-white/70">
                            {t("settings:dataImport.ignoreMarker")}
                          </button>
                        </div>
                      ) : needsAnswer ? (
                        <div className="mt-3 grid grid-cols-3 gap-2">
                          {([
                            ["TIME_BASED", "hoursChoice"],
                            ["UNIT_BASED", "unitsChoice"],
                            ["FIXED_PRICE_BASED", "fixedChoice"]
                          ] as const).map(([method, key]) => (
                            <button key={method} type="button"
                              onClick={() => updateDecision(candidate, {
                                calculationMethod: method,
                                compensationMethod: method === "UNIT_BASED" ? "PER_UNIT" : "HOURLY"
                              })}
                              className="min-h-12 rounded-xl border border-white/10 bg-white/[0.05] px-2 text-xs font-medium text-white/70">
                              {t(`settings:dataImport.${key}`)}
                            </button>
                          ))}
                        </div>
                      ) : null}
                      {draft?.calculationMethod === "UNIT_BASED" && !draft.ratePerUnit ? (
                        <input type="number" min="0.01" step="0.01"
                          placeholder={t("settings:dataImport.ratePerUnitRequired")}
                          onChange={(event) => updateDecision(candidate, {
                            ratePerUnit: numberValue(event.currentTarget.value),
                            currency: "EUR"
                          })}
                          className="mt-3 h-12 w-full rounded-xl border border-white/10 bg-[#111] px-3 text-sm text-white" />
                      ) : null}
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
          {error ? <ErrorMessage message={error} /> : null}
          <Button className="w-full"
            disabled={pending || unresolvedCandidates.length > 0
              || (!result.analysis.datesAreExplicit
                && (result.analysis.sheets.length > 1
                  ? !Object.values(sheetPeriods).every(
                      (period) => Boolean(period.year && period.month))
                  : !periodYear || !periodMonth))}
            onClick={() => void prepareImport()}>
            {pending ? t("settings:dataImport.saving")
              : unresolvedCandidates.length
                ? t("settings:dataImport.answersRemaining", {
                    count: unresolvedCandidates.length
                  })
                : t("settings:dataImport.prepareData")}
          </Button>
          <button type="button" onClick={reset}
            className="w-full py-2 text-sm text-white/45">
            {t("settings:dataImport.changeFile")}
          </button>
        </>
      ) : unresolvedQuestions.length > 0 ? (
        <>
          <header>
            <p className="text-sm font-medium text-emerald-200">
              {t("settings:dataImport.onlyExceptions", {
                resolved: allQuestions.length - unresolvedQuestions.length,
                total: allQuestions.length
              })}
            </p>
            <h1 className="mt-1 text-2xl font-semibold text-white">
              {t("settings:dataImport.talkToAssistant")}
            </h1>
            <p className="mt-2 text-sm leading-6 text-white/50">
              {t("settings:dataImport.talkToAssistantHint")}
            </p>
          </header>
          <Card className="overflow-hidden">
            <div className="border-b border-white/[0.07] bg-amber-300/[0.05] p-4">
              <div className="flex items-start gap-3">
                <Sparkles className="mt-0.5 h-5 w-5 text-amber-200" />
                <div>
                  <p className="text-sm font-semibold text-white">
                    {currentQuestion?.entry.date} · {currentQuestion?.question.sourceLabel
                      ?? t("settings:dataImport.noteOrInterval")}
                  </p>
                  <p className="mt-1 text-sm leading-5 text-white/55">
                    {currentQuestion?.question.prompt}
                  </p>
                </div>
              </div>
            </div>
            <div className="max-h-[42vh] space-y-3 overflow-y-auto p-4">
              {assistantMessages.map((message, index) => (
                <div key={index}
                  className={`max-w-[90%] rounded-2xl px-4 py-3 text-sm leading-5 ${
                    message.role === "USER"
                      ? "ml-auto bg-emerald-300/15 text-emerald-50"
                      : "bg-white/[0.06] text-white/70"
                  }`}>
                  {message.content}
                </div>
              ))}
              {assistantProposal ? (
                <div className="rounded-2xl border border-emerald-300/25 bg-emerald-300/[0.08] p-4">
                  <p className="text-sm font-semibold text-emerald-100">
                    {t("settings:dataImport.aiProposal")}
                  </p>
                  <p className="mt-2 text-sm leading-5 text-white/65">
                    {assistantProposal.confirmation}
                  </p>
                  <Button className="mt-3 w-full" onClick={applyProposalToSimilar}>
                    {currentQuestion?.question.type === "SURCHARGE"
                      ? t("settings:dataImport.applyEverywhere")
                      : t("settings:dataImport.applyAiProposal")}
                  </Button>
                </div>
              ) : null}
            </div>
            <div className="border-t border-white/[0.07] p-4">
              <div className="flex items-end gap-2">
                <textarea rows={2} value={assistantInput}
                  onChange={(event) => setAssistantInput(event.currentTarget.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" && !event.shiftKey) {
                      event.preventDefault();
                      void sendToAssistant();
                    }
                  }}
                  placeholder={t("settings:dataImport.globalAiPlaceholder")}
                  className="min-h-14 flex-1 resize-none rounded-2xl border border-white/10 bg-[#111] px-4 py-3 text-sm text-white outline-none placeholder:text-white/30" />
                <button type="button" onClick={() => void sendToAssistant()}
                  disabled={!assistantInput.trim() || assistantPending}
                  className="grid h-14 w-14 place-items-center rounded-2xl bg-emerald-300 text-black disabled:opacity-35">
                  <Send className="h-5 w-5" />
                </button>
              </div>
              <details className="mt-3">
                <summary className="cursor-pointer text-center text-xs text-white/35">
                  {t("settings:dataImport.manualFallback")}
                </summary>
                <div className="mt-3 flex flex-wrap justify-center gap-2">
                  {currentQuestion?.question.options
                    .filter((option) => option !== "ENTER_PERCENTAGE")
                    .map((option) => (
                    <button key={option} type="button"
                      onClick={() => resolveManually(
                        option as DataImportQuestionResolution["action"])}
                      className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-2 text-xs text-white/60">
                      {t(`settings:dataImport.questionActions.${option}`)}
                    </button>
                  ))}
                </div>
              </details>
            </div>
          </Card>
          {error ? <ErrorMessage message={error} /> : null}
        </>
      ) : (
        <>
          <header>
            <p className="text-sm font-medium text-emerald-200">
              {t("settings:dataImport.readyForImport")}
            </p>
            <h1 className="mt-1 text-2xl font-semibold text-white">
              {t("settings:dataImport.finalCheck")}
            </h1>
          </header>
          <Card className="space-y-4 p-5">
            <SummaryRow label={t("settings:dataImport.daysToCreate")}
              value={String(clearEntries.length)} />
            <SummaryRow label={t("settings:dataImport.workedHours")}
              value={`${totalHours} h`} />
            <SummaryRow label="Units to import" value={String(totalUnits)} />
            <SummaryRow label="Days divided by team size"
              value={String(teamSizedDays)} />
            <SummaryRow label={t("settings:dataImport.restDaysDetected")}
              value={String(restDayCount)} />
            <SummaryRow label={t("settings:dataImport.absencesDetected")}
              value={String(absenceCount)} />
            <SummaryRow label={t("settings:dataImport.notesPreserved")}
              value={String(notesCount)} />
            <SummaryRow label={t("settings:dataImport.extraEligibleNotAdded")}
              value={`${extraEligibleHours} h`} />
            <SummaryRow label={t("settings:dataImport.duplicatesSkipped")}
              value={String(preview.duplicateCount)} />
            <div className="rounded-2xl bg-emerald-300/[0.08] p-4">
              <div className="flex items-center gap-2 text-sm font-semibold text-emerald-100">
                <CheckCircle2 className="h-5 w-5" />
                {t("settings:dataImport.noUnresolvedData")}
              </div>
              <p className="mt-1 text-xs leading-5 text-white/45">
                {t("settings:dataImport.extraHoursSafety")}
              </p>
            </div>
          </Card>
          {error ? <ErrorMessage message={error} /> : null}
          {importSummary ? (
            <p className="rounded-2xl bg-emerald-300/10 px-4 py-3 text-sm text-emerald-100">
              {importSummary}
            </p>
          ) : null}
          <Button className="w-full" disabled={pending || clearEntries.length === 0}
            onClick={() => void importData()}>
            {pending ? t("settings:dataImport.importing")
              : t("settings:dataImport.importDays", { count: clearEntries.length })}
          </Button>
          <p className="text-center text-xs leading-5 text-white/40">
            {t("settings:dataImport.importSafety")}
          </p>
        </>
      )}
    </div>
  );
}

function Progress({ stage }: { stage: number }) {
  return (
    <div className="flex items-center gap-2" aria-label={`Step ${stage} of 4`}>
      {[1, 2, 3, 4].map((item) => (
        <span key={item}
          className={`h-1.5 flex-1 rounded-full ${
            item <= stage ? "bg-emerald-300" : "bg-white/10"
          }`} />
      ))}
    </div>
  );
}

function Metric({ value, label }: { value: number; label: string }) {
  return (
    <div>
      <p className="text-xl font-semibold text-white">{value}</p>
      <p className="mt-1 text-xs text-white/40">{label}</p>
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-sm text-white/50">{label}</span>
      <span className="font-semibold text-white">{value}</span>
    </div>
  );
}

function ErrorMessage({ message }: { message: string }) {
  return (
    <p role="alert" className="rounded-2xl bg-red-400/10 px-4 py-3 text-sm text-red-200">
      {message}
    </p>
  );
}
