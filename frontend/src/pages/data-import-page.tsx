import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  AlertTriangle, BriefcaseBusiness, CheckCircle2, ChevronRight, FileSpreadsheet,
  FileText, Files, Image as ImageIcon, Send, Sparkles, Upload
} from "lucide-react";
import { useTranslation } from "react-i18next";
import {
  analyzeDataImport, getDataImportSourceDocument,
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
  const [highlightedEntryId, setHighlightedEntryId] = useState<string | null>(null);
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
  const [quickPercentage, setQuickPercentage] = useState("");
  const [quickTargetId, setQuickTargetId] = useState("");
  const [importSummary, setImportSummary] = useState<string | null>(null);
  const [sourceOpening, setSourceOpening] = useState(false);
  const [entryEdits, setEntryEdits] = useState<Record<string, {
    notes: string;
    lineValues: number[];
  }>>({});
  const [periodYear, setPeriodYear] = useState("");
  const [periodMonth, setPeriodMonth] = useState("");
  const [confirmedAliases, setConfirmedAliases] = useState<Set<string>>(new Set());
  const [sheetPeriods, setSheetPeriods] =
    useState<Record<string, { year: string; month: string }>>({});

  const activeEmployments = useMemo(
    () => employments.data?.filter((employment) => employment.active) ?? [],
    [employments.data]
  );
  useEffect(() => {
    if (!employmentId && activeEmployments.length === 1) {
      setEmploymentId(activeEmployments[0].id);
    }
  }, [activeEmployments, employmentId]);
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
  useEffect(() => {
    const timeLines = currentQuestion?.entry.lines.filter(
      (line) => line.calculationMethod === "TIME_BASED") ?? [];
    setQuickTargetId(timeLines.length === 1 ? timeLines[0].workTypeId : "");
    setQuickPercentage("");
  }, [currentQuestion?.entry.lines, currentQuestion?.question.id]);
  const clearEntries = useMemo(() => preview?.entries.filter((entry) =>
    entry.status !== "DUPLICATE"
    && (entry.lines.length > 0 || entry.classification !== "WORK")
    && entry.questions.every((question) => Boolean(resolutions[question.id]))
  ) ?? [], [preview, resolutions]);
  const totalHours = useMemo(() => clearEntries.reduce((total, entry) =>
    total + entry.lines.reduce((entryTotal, line, index) =>
      entryTotal + (line.calculationMethod === "TIME_BASED"
        ? entryEdits[entry.id]?.lineValues[index] ?? line.value : 0), 0), 0),
  [clearEntries, entryEdits]);
  const totalUnits = clearEntries.reduce((total, entry) =>
    total + entry.lines.reduce((entryTotal, line, index) =>
      entryTotal + (line.calculationMethod === "UNIT_BASED"
        ? entryEdits[entry.id]?.lineValues[index] ?? line.value : 0), 0), 0);
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
  const importIssues = useMemo(() => allQuestions.flatMap(({ entry, question }) => {
    const resolution = resolutions[question.id];
    if (question.type !== "SURCHARGE" || resolution?.action !== "ENTER_PERCENTAGE"
      || !resolution.targetWorkTypeId || resolution.eligibleHours == null) return [];
    const lineIndex = entry.lines.findIndex((line) => line.workTypeId === resolution.targetWorkTypeId);
    if (lineIndex < 0) return [];
    const line = entry.lines[lineIndex];
    const baseHours = entryEdits[entry.id]?.lineValues[lineIndex] ?? line.value;
    if (resolution.eligibleHours <= baseHours) return [];
    const totalBaseHours = entry.lines.reduce((total, candidate, index) => total
      + (candidate.calculationMethod === "TIME_BASED"
        ? entryEdits[entry.id]?.lineValues[index] ?? candidate.value
        : 0), 0);
    if (Math.abs(totalBaseHours - resolution.eligibleHours) < 0.001) return [];
    return [{
      entryId: entry.id,
      date: entry.date,
      activity: line.workTypeName,
      baseHours,
      eligibleHours: resolution.eligibleHours,
      sourceLabel: question.sourceLabel ?? ""
    }];
  }), [allQuestions, entryEdits, resolutions]);

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

  function resolveSurchargeQuickly() {
    if (!currentQuestion || !quickTargetId) return;
    const percentage = numberValue(quickPercentage);
    if (!percentage) return;
    const source = currentQuestion.question;
    const targets = unresolvedQuestions.filter(({ question }) =>
      question.type === "SURCHARGE" && question.sourceLabel === source.sourceLabel);
    setResolutions((current) => {
      const next = { ...current };
      targets.forEach(({ entry, question }) => {
        const matchingLine = entry.lines.find((line) => line.workTypeId === quickTargetId)
          ?? (entry.lines.filter((line) => line.calculationMethod === "TIME_BASED").length === 1
            ? entry.lines.find((line) => line.calculationMethod === "TIME_BASED")
            : undefined);
        if (!matchingLine) return;
        next[question.id] = {
          action: "ENTER_PERCENTAGE",
          percentage,
          targetWorkTypeId: matchingLine.workTypeId,
          eligibleHours: numberValue(question.value) ?? matchingLine.value
        };
      });
      return next;
    });
  }

  async function importData() {
    if (!result || clearEntries.length === 0 || unresolvedQuestions.length > 0) return;
    if (importIssues.length > 0) {
      revealImportIssue(importIssues[0].entryId);
      return;
    }
    setPending(true);
    setError(null);
    try {
      const importResolutions = { ...resolutions };
      allQuestions.forEach(({ entry, question }) => {
        const resolution = importResolutions[question.id];
        if (question.type !== "SURCHARGE" || resolution?.action !== "ENTER_PERCENTAGE"
          || resolution.eligibleHours == null) return;
        const timeLines = entry.lines.map((line, index) => ({ line, index }))
          .filter(({ line }) => line.calculationMethod === "TIME_BASED");
        const allocations = timeLines.map(({ line, index }) => ({
          workTypeId: line.workTypeId,
          eligibleHours: entryEdits[entry.id]?.lineValues[index] ?? line.value
        }));
        const total = allocations.reduce((sum, allocation) => sum + allocation.eligibleHours, 0);
        if (allocations.length > 1 && Math.abs(total - resolution.eligibleHours) < 0.001) {
          importResolutions[question.id] = { ...resolution, allocations };
        }
      });
      const imported = await executeDataImport(
        result.batchId, clearEntries.map((entry) => entry.id), importResolutions, entryEdits);
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

  function revealImportIssue(entryId: string) {
    setHighlightedEntryId(entryId);
    window.setTimeout(() => document.getElementById(`import-entry-${entryId}`)?.scrollIntoView({
      behavior: "smooth",
      block: "center"
    }), 30);
  }

  function reset() {
    setResult(null);
    setPreview(null);
    setFile(null);
    setPayrollFiles([]);
    setResolutions({});
    setAssistantMessages([]);
    setImportSummary(null);
    setEntryEdits({});
  }

  async function openSourceDocument() {
    if (!result || sourceOpening) return;
    const viewer = window.open("", "_blank");
    setSourceOpening(true);
    setError(null);
    try {
      const blob = await getDataImportSourceDocument(result.batchId);
      const url = URL.createObjectURL(blob);
      if (viewer) viewer.location.href = url;
      else {
        const link = document.createElement("a");
        link.href = url;
        link.target = "_blank";
        link.click();
      }
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (cause) {
      viewer?.close();
      setError(getApiError(cause).message);
    } finally {
      setSourceOpening(false);
    }
  }

  return (
    <div className="settings-detail-content mx-auto w-full max-w-[560px] space-y-6 pb-32 pt-5">
      <SettingsNavigationHeader
        title={t("settings:dataImport.title")}
        backLabel={t("common:actions.back")}
        onBack={safeBack}
      />
      <Progress stage={!file ? 1 : !result ? 2 : !preview ? 3 : unresolvedQuestions.length > 0 ? 4 : 5} />

      {!result ? (
        <>
          <header className="pt-1">
            <p className="hairline-text mb-2">01 · {t("settings:dataImport.chooseFile")}</p>
            <h1 className="text-[2rem] font-semibold leading-tight tracking-[-0.055em] text-white">
              {t("settings:dataImport.simpleSourceTitle")}
            </h1>
            <p className="mt-2 text-sm leading-6 text-white/50">
              {t("settings:dataImport.simpleSourceHint")}
            </p>
          </header>
          <Card variant="ambient" className="overflow-hidden p-1.5">
            <input ref={fileInput} hidden type="file"
              accept=".xlsx,.txt,text/plain,.pdf,application/pdf,.jpg,.jpeg,.png,.webp,image/*"
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
              className="group relative flex min-h-44 w-full flex-col items-center justify-center rounded-[26px] border border-dashed border-[#10b981]/25 bg-[radial-gradient(circle_at_50%_0%,rgba(16,185,129,0.12),transparent_58%)] p-6 text-center transition active:scale-[0.99]">
              <span className="grid h-16 w-16 shrink-0 place-items-center rounded-[22px] border border-white/[0.12] bg-white/[0.07] text-[#10b981] shadow-[inset_0_1px_0_rgba(255,255,255,0.12),0_18px_40px_rgba(0,0,0,0.24)]">
                {file ? <FileSpreadsheet className="h-7 w-7" />
                  : <Upload className="h-7 w-7" />}
              </span>
              <span className="mt-4 min-w-0 max-w-full">
                <span className="block truncate text-[1.05rem] font-semibold tracking-[-0.03em] text-white">
                  {file?.name ?? t("settings:dataImport.chooseFile")}
                </span>
                <span className="mt-1.5 block text-sm leading-5 text-white/42">
                  {t("settings:dataImport.simpleFileHint")}
                </span>
              </span>
            </button>
            <div className="flex items-center justify-center gap-5 py-3 text-white/28">
              <FileSpreadsheet className="h-4 w-4" /><FileText className="h-4 w-4" />
              <ImageIcon className="h-4 w-4" /><Files className="h-4 w-4" />
            </div>
          </Card>

          {file && activeEmployments.length !== 1 ? (
            <Card variant="ambient" className="overflow-hidden">
              <div className="flex items-center gap-3 px-5 py-4">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-[14px] bg-[#10b981]/10 text-[#10b981]"><BriefcaseBusiness className="h-5 w-5" /></span>
                <label className="min-w-0 flex-1">
                  <span className="mb-1 block text-xs uppercase tracking-[0.18em] text-white/35">{t("settings:dataImport.employment")}</span>
                  <select value={employmentId}
                    onChange={(event) => setEmploymentId(event.currentTarget.value)}
                    className="w-full appearance-none border-0 bg-transparent py-1 text-[1rem] font-medium text-white outline-none">
                    <option value="">{t("settings:dataImport.chooseEmployment")}</option>
                    {activeEmployments.map((employment) => (
                      <option key={employment.id} value={employment.id}>{employment.name}</option>
                    ))}
                  </select>
                </label>
                <ChevronRight className="h-4 w-4 text-white/25" />
              </div>
            </Card>
          ) : null}

          {file ? (
            <Card className="space-y-3 p-4">
            <input ref={payrollInput} hidden multiple type="file" accept=".pdf"
              onChange={(event) => setPayrollFiles(
                Array.from(event.currentTarget.files ?? []))} />
            <button type="button" onClick={() => payrollInput.current?.click()}
              className="flex min-h-14 w-full items-center gap-3 rounded-2xl px-2 text-left transition hover:bg-white/[0.035]">
              <Files className="h-5 w-5 text-white/45" />
              <span className="text-sm text-white/65">
                {payrollFiles.length
                  ? t("settings:dataImport.payrollSelected", { count: payrollFiles.length })
                  : t("settings:dataImport.optionalEvidence")}
              </span>
            </button>
            </Card>
          ) : null}
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
            <p className="text-sm font-medium text-[#10b981]">
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
              <div className="mb-4 rounded-2xl border border-[#10b981]/20 bg-[#10b981]/[0.08] px-4 py-3">
                <p className="text-sm font-semibold text-[#6ee7b7]">
                  {result.analysis.sheets.length} of {result.analysis.sheetCount} sheets read
                </p>
                <p className="mt-1 text-xs leading-5 text-[#10b981]/60">
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
                      : <CheckCircle2 className="mt-0.5 h-5 w-5 text-[#10b981]" />}
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
                            className="min-h-12 w-full rounded-xl bg-[#10b981] px-3 text-sm font-semibold text-black">
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
                                      ? "border-[#10b981]/40 bg-[#10b981]/15 text-[#6ee7b7]"
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
                                  ? "border-[#10b981]/40 bg-[#10b981]/15 text-[#6ee7b7]"
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
                                  ? "border-[#10b981]/40 bg-[#10b981]/15 text-[#6ee7b7]"
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
                            className="min-h-12 rounded-xl border border-[#10b981]/20 bg-[#10b981]/[0.08] px-2 text-xs font-medium text-[#6ee7b7]">
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
            <p className="text-sm font-medium text-[#10b981]">
              {t("settings:dataImport.onlyExceptions", {
                resolved: allQuestions.length - unresolvedQuestions.length,
                total: allQuestions.length
              })}
            </p>
            <h1 className="mt-1 text-2xl font-semibold text-white">
              {t("settings:dataImport.clarifyTitle")}
            </h1>
            <p className="mt-2 text-sm leading-6 text-white/50">
              {t("settings:dataImport.clarifyHint")}
            </p>
          </header>
          <Card variant="ambient" className="overflow-hidden">
            <div className="border-b border-white/[0.07] bg-[#10b981]/[0.045] p-5">
              <div className="flex items-start gap-3">
                <Sparkles className="mt-0.5 h-5 w-5 text-[#10b981]" />
                <div>
                  <p className="font-metric text-sm font-semibold text-white">
                    {currentQuestion?.entry.date} · {currentQuestion?.question.sourceLabel
                      ?? t("settings:dataImport.noteOrInterval")}
                  </p>
                  <p className="mt-1 text-sm leading-5 text-white/55">
                    {currentQuestion?.question.type === "SURCHARGE"
                      ? t("settings:dataImport.surchargeQuestion", {
                          hours: currentQuestion.question.value,
                          label: currentQuestion.question.sourceLabel
                        })
                      : t("settings:dataImport.genericQuestion")}
                  </p>
                </div>
              </div>
            </div>
            <div className="space-y-5 p-5">
              {currentQuestion?.question.type === "SURCHARGE" ? (
                <>
                  <label className="block">
                    <span className="mb-2 block text-xs uppercase tracking-[0.16em] text-white/35">{t("settings:dataImport.baseActivityLabel")}</span>
                    <select value={quickTargetId} onChange={(event) => setQuickTargetId(event.currentTarget.value)}
                      className="h-14 w-full rounded-2xl border border-white/[0.09] bg-black/20 px-4 text-white outline-none focus:border-[#10b981]/40">
                      <option value="">{t("settings:dataImport.chooseBaseActivity")}</option>
                      {currentQuestion.entry.lines.filter((line) => line.calculationMethod === "TIME_BASED").map((line) => (
                        <option key={line.workTypeId} value={line.workTypeId}>{line.workTypeName} · {line.value} h</option>
                      ))}
                    </select>
                  </label>
                  <label className="block">
                    <span className="mb-2 block text-xs uppercase tracking-[0.16em] text-white/35">{t("settings:dataImport.percentageLabel")}</span>
                    <div className="relative">
                      <input value={quickPercentage} onChange={(event) => setQuickPercentage(event.currentTarget.value)}
                        type="text" inputMode="decimal" placeholder="50"
                        className="font-metric h-14 w-full rounded-2xl border border-white/[0.09] bg-black/20 px-4 pr-12 text-lg font-semibold text-white outline-none focus:border-[#10b981]/40" />
                      <span className="absolute right-4 top-1/2 -translate-y-1/2 text-white/35">%</span>
                    </div>
                  </label>
                  <button type="button" onClick={resolveSurchargeQuickly}
                    disabled={!quickTargetId || !numberValue(quickPercentage)}
                    className="min-h-14 w-full rounded-full bg-[#f1f1f1] px-5 font-semibold text-black transition active:scale-[0.985] disabled:opacity-35">
                    {t("settings:dataImport.confirmSimilar", {
                      count: unresolvedQuestions.filter(({ question }) => question.type === "SURCHARGE" && question.sourceLabel === currentQuestion.question.sourceLabel).length
                    })}
                  </button>
                </>
              ) : (
                <div className="grid gap-2">
                  {currentQuestion?.question.options.map((option) => (
                    <button key={option} type="button"
                      onClick={() => resolveManually(option as DataImportQuestionResolution["action"])}
                      className="min-h-13 rounded-2xl border border-white/[0.09] bg-white/[0.04] px-4 text-left text-sm text-white/70 transition active:scale-[0.99]">
                      {t(`settings:dataImport.questionActions.${option}`)}
                    </button>
                  ))}
                </div>
              )}
              <details className="border-t border-white/[0.06] pt-4">
                <summary className="cursor-pointer list-none text-center text-sm text-white/38">{t("settings:dataImport.needAiHelp")}</summary>
                <div className="mt-4 space-y-3">
                  {assistantMessages.slice(-2).map((message, index) => (
                    <p key={index} className="rounded-2xl bg-white/[0.045] px-4 py-3 text-sm leading-5 text-white/60">{message.content}</p>
                  ))}
                  {assistantProposal ? (
                    <button type="button" onClick={applyProposalToSimilar}
                      className="min-h-12 w-full rounded-2xl border border-[#10b981]/25 bg-[#10b981]/10 px-4 text-sm font-semibold text-[#6ee7b7]">
                      {assistantProposal.confirmation ?? t("settings:dataImport.applyAiProposal")}
                    </button>
                  ) : null}
                  <div className="flex items-end gap-2">
                    <textarea rows={2} value={assistantInput} onChange={(event) => setAssistantInput(event.currentTarget.value)}
                      placeholder={t("settings:dataImport.globalAiPlaceholder")}
                      className="min-h-14 flex-1 resize-none rounded-2xl border border-white/[0.09] bg-black/20 px-4 py-3 text-sm text-white outline-none placeholder:text-white/25" />
                    <button type="button" onClick={() => void sendToAssistant()} disabled={!assistantInput.trim() || assistantPending}
                      className="grid h-14 w-14 place-items-center rounded-2xl bg-[#10b981] text-black disabled:opacity-35"><Send className="h-5 w-5" /></button>
                  </div>
                </div>
              </details>
            </div>
          </Card>
          {error ? <ErrorMessage message={error} /> : null}
        </>
      ) : (
        <>
          <header>
            <p className="text-sm font-medium text-[#10b981]">
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
            <div className="rounded-2xl bg-[#10b981]/[0.08] p-4">
              <div className="flex items-center gap-2 text-sm font-semibold text-[#6ee7b7]">
                <CheckCircle2 className="h-5 w-5" />
                {t("settings:dataImport.noUnresolvedData")}
              </div>
              <p className="mt-1 text-xs leading-5 text-white/45">
                {t("settings:dataImport.extraHoursSafety")}
              </p>
            </div>
          </Card>
          <button type="button" onClick={() => void openSourceDocument()}
            disabled={sourceOpening}
            className="flex min-h-14 w-full items-center justify-between rounded-2xl border border-white/[0.08] bg-white/[0.035] px-4 text-left transition active:scale-[0.99] disabled:opacity-50">
            <span className="flex min-w-0 items-center gap-3">
              <FileText className="h-5 w-5 shrink-0 text-[#10b981]" />
              <span className="min-w-0">
                <span className="block text-xs uppercase tracking-[0.16em] text-white/32">{t("settings:dataImport.originalDocument")}</span>
                <span className="block truncate text-sm font-medium text-white/75">{result.filename}</span>
              </span>
            </span>
            <ChevronRight className="h-4 w-4 text-white/25" />
          </button>
          <section className="space-y-3">
            <div className="flex items-end justify-between gap-4 px-1">
              <div>
                <p className="hairline-text">{t("settings:dataImport.finalCheck")}</p>
                <h2 className="mt-1 text-xl font-semibold tracking-[-0.045em] text-white">{t("settings:dataImport.reviewDays", { count: clearEntries.length })}</h2>
              </div>
              <span className="text-xs text-white/35">{t("settings:dataImport.tapDayToReview")}</span>
            </div>
            <div className="space-y-2">
              {clearEntries.map((entry) => (
                <details id={`import-entry-${entry.id}`} key={entry.id} open={highlightedEntryId === entry.id || undefined} className={`group rounded-[22px] border bg-white/[0.035] open:bg-white/[0.05] ${highlightedEntryId === entry.id ? "border-red-300/35 ring-1 ring-red-300/15" : "border-white/[0.08]"}`}>
                  <summary className="flex min-h-16 cursor-pointer list-none items-center gap-3 px-4 py-3">
                    <span className="font-metric min-w-[5.7rem] text-sm font-semibold text-white">{entry.date}</span>
                    <span className="min-w-0 flex-1 truncate text-sm text-white/55">
                      {entry.classification === "WORK"
                        ? entry.lines.map((line) => line.workTypeName).join(" · ")
                        : entry.classification === "ABSENCE"
                          ? entry.absenceType
                          : t("settings:dataImport.restDaysDetected")}
                    </span>
                    <ChevronRight className="h-4 w-4 text-white/25 transition group-open:rotate-90" />
                  </summary>
                  <div className="space-y-3 border-t border-white/[0.06] px-4 py-4">
                    {entry.lines.map((line, index) => (
                      <div key={`${line.workTypeId}-${index}`} className="flex items-center justify-between gap-4 text-sm">
                        <label className="text-white/55" htmlFor={`${entry.id}-line-${index}`}>{line.workTypeName}</label>
                        <span className="flex items-center gap-2">
                          <input id={`${entry.id}-line-${index}`} type="number" min="0.01" step="0.01" inputMode="decimal"
                            value={entryEdits[entry.id]?.lineValues[index] ?? line.value}
                            onChange={(event) => {
                              const value = Number(event.currentTarget.value);
                              setEntryEdits((current) => {
                                const existing = current[entry.id] ?? {
                                  notes: entry.notes ?? "",
                                  lineValues: entry.lines.map((item) => item.value)
                                };
                                const lineValues = [...existing.lineValues];
                                lineValues[index] = Number.isFinite(value) ? value : line.value;
                                return { ...current, [entry.id]: { ...existing, lineValues } };
                              });
                            }}
                            className="font-metric h-10 w-20 rounded-xl border border-white/[0.09] bg-black/20 px-2 text-right font-semibold text-white outline-none focus:border-[#10b981]/40" />
                          <span className="text-xs text-white/35">{line.calculationMethod === "TIME_BASED" ? "h" : "u"}</span>
                        </span>
                      </div>
                    ))}
                    <textarea rows={2}
                      aria-label="Notes"
                      value={entryEdits[entry.id]?.notes ?? entry.notes ?? ""}
                      onChange={(event) => {
                        const notes = event.currentTarget.value;
                        setEntryEdits((current) => ({
                          ...current,
                          [entry.id]: current[entry.id]
                            ? { ...current[entry.id], notes }
                            : { notes, lineValues: entry.lines.map((item) => item.value) }
                        }));
                      }}
                      placeholder="Notes"
                      className="min-h-14 w-full resize-none rounded-xl border border-white/[0.08] bg-black/20 px-3 py-2 text-xs leading-5 text-white/60 outline-none placeholder:text-white/25 focus:border-[#10b981]/40" />
                  </div>
                </details>
              ))}
            </div>
          </section>
          {importIssues.length > 0 ? (
            <div role="alert" className="space-y-2 rounded-[22px] border border-red-300/15 bg-red-400/10 p-4">
              <div className="flex items-start gap-3">
                <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-red-200" />
                <div>
                  <p className="font-semibold text-red-100">{t("settings:dataImport.importIssuesTitle", { count: importIssues.length })}</p>
                  <p className="mt-1 text-sm leading-5 text-red-100/70">{t("settings:dataImport.importIssuesHint")}</p>
                </div>
              </div>
              {importIssues.map((issue) => (
                <button key={`${issue.entryId}-${issue.sourceLabel}`} type="button" onClick={() => revealImportIssue(issue.entryId)} className="flex w-full items-center justify-between gap-3 rounded-2xl bg-black/20 px-4 py-3 text-left transition active:scale-[0.99]">
                  <span>
                    <span className="font-metric block text-sm font-semibold text-white">{issue.date} · {issue.activity}</span>
                    <span className="mt-1 block text-xs text-white/48">{t("settings:dataImport.extraHoursProblem", { eligible: issue.eligibleHours, base: issue.baseHours })}</span>
                  </span>
                  <ChevronRight className="h-4 w-4 shrink-0 text-white/35" />
                </button>
              ))}
            </div>
          ) : null}
          {error ? <ErrorMessage message={error} /> : null}
          {importSummary ? (
            <p className="rounded-2xl bg-[#10b981]/10 px-4 py-3 text-sm text-[#6ee7b7]">
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
    <div className="flex items-center gap-2 px-0.5" aria-label={`Step ${stage} of 5`}>
      {[1, 2, 3, 4, 5].map((item) => (
        <span key={item}
          className={`h-1 flex-1 rounded-full transition-all duration-300 ${
            item <= stage ? "bg-[#10b981] shadow-[0_0_12px_rgba(16,185,129,0.22)]" : "bg-white/[0.08]"
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
