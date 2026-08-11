import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Briefcase, CalendarDays, ChevronRight, Folder, MapPin, Plus, ReceiptText, Settings, Trash2, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate, useOutletContext, useParams, useSearchParams } from "react-router-dom";
import {
  createAddress,
  createProjectSession,
  createWorkProjectWithTotals,
  createWorkSession,
  deleteWorkRecord,
  getWorkRecord,
  getPreferences,
  listHourlyRates,
  listEmployments,
  listWorkRecordsInRange,
  listWorkProjects,
  listWorkTypes,
  updateWorkRecord,
  updateWorkSession
} from "../api/endpoints";
import { getApiError } from "../api/api-errors";
import { queryKeys } from "../api/query-keys";
import { SettingsSuccessMessage } from "../components/settings/settings-form-actions";
import { Button } from "../components/ui/button";
import { Card } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { ScreenMessage } from "../components/ui/screen-message";
import { Textarea } from "../components/ui/textarea";
import { LockedModalViewport } from "../components/ui/locked-modal-viewport";
import { ModalPanel } from "../components/ui/modal-panel";
import { useUnsavedChangesGuard } from "../hooks/use-unsaved-changes-guard";
import { useSafeBackNavigation } from "../hooks/use-safe-back-navigation";
import { useEmploymentScope } from "../features/employment/employment-scope";
import { addDays, isValidDate, parseLocalIsoDate, safeLocalIsoDate } from "../utils/date";
import { parseDecimalInput } from "../utils/decimal-input";
import { formatCurrency, formatMinutesAsDuration } from "../utils/format";
import {
  calculateGrossAmount,
  calculateWorkRecordTimeMinutes,
  findApplicableHourlyRate
} from "../features/work-records/work-record-calculations";
import { recommendWorkEntry } from "../features/work-records/work-type-recommendation";
import type { WorkType, WorkTypeFormulaMode } from "../types/configuration";
import type { Address, AddressPayload } from "../types/address";
import type {
  WorkRecord,
  WorkRecordLineCalculationMode,
  WorkRecordRequest
} from "../types/work-record";
import { APP_HOME_PATH } from "../routes/app-paths";
import { i18n } from "../i18n";

type OutletContext = {
  selectedDate?: Date;
  setSelectedDate?: (date: Date) => void;
};

type JobLineState = {
  id: string;
  workTypeId: string;
  calculationMode: WorkRecordLineCalculationMode | null;
  timeInputMode: "RANGE" | "DURATION";
  quantity: string;
  fixedAmount: string;
  currency: string;
  startTime: string;
  endTime: string;
  durationMinutes: string;
  unpaidBreakMinutes: string;
  extraPayPercentage: string;
  notes: string;
};

function newLine(): JobLineState {
  return {
    id: createClientLineId(),
    workTypeId: "",
    calculationMode: null,
    timeInputMode: "RANGE",
    quantity: "0",
    fixedAmount: "",
    currency: "EUR",
    startTime: "08:00",
    endTime: "16:30",
    durationMinutes: "",
    unpaidBreakMinutes: "30",
    extraPayPercentage: "0",
    notes: ""
  };
}

function createClientLineId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `line-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

function createLineForWorkType(workType: WorkType, fallbackCurrency: string) {
  const line = newLine();
  line.workTypeId = workType.id;
  line.calculationMode = workTypeCalculationMode(workType);
  line.currency = workType.currency ?? fallbackCurrency;
  line.unpaidBreakMinutes = String(workType.defaultBreakMinutes ?? 0);
  return line;
}

function createLineFromRecommendation(
  workType: WorkType,
  historicalLine: NonNullable<WorkRecord["workLines"]>[number],
  fallbackCurrency: string
) {
  const line = createLineForWorkType(workType, fallbackCurrency);
  line.startTime = historicalLine.startTime?.slice(0, 5) ?? line.startTime;
  line.endTime = historicalLine.endTime?.slice(0, 5) ?? line.endTime;
  line.unpaidBreakMinutes = String(historicalLine.breakMinutes ?? workType.defaultBreakMinutes ?? 0);
  line.durationMinutes = historicalLine.durationMinutes
    ? formatDecimalHours(historicalLine.durationMinutes)
    : "";
  line.timeInputMode = historicalLine.durationMinutes ? "DURATION" : "RANGE";
  line.quantity = historicalLine.quantity ? String(Number(historicalLine.quantity)) : line.quantity;
  line.fixedAmount = historicalLine.fixedAmountSnapshot
    ? String(Number(historicalLine.fixedAmountSnapshot))
    : line.fixedAmount;
  line.currency = historicalLine.currencySnapshot ?? workType.currency ?? fallbackCurrency;
  line.extraPayPercentage = String(historicalLine.extraPayPercentage ?? 0);
  return line;
}

async function invalidateWorkRecordQueries(queryClient: ReturnType<typeof useQueryClient>) {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: queryKeys.dashboard() }),
    queryClient.invalidateQueries({ queryKey: queryKeys.workRecords.all() }),
    queryClient.invalidateQueries({ queryKey: queryKeys.calendar.activityRange() }),
    queryClient.invalidateQueries({ queryKey: queryKeys.statistics.all() }),
    queryClient.invalidateQueries({ queryKey: queryKeys.workProjects.all() })
  ]);
}

function recordToLines(record: WorkRecord): JobLineState[] {
  if (record.workLines?.length) {
    return record.workLines.map((line) => ({
      id: line.id,
      workTypeId: line.workTypeId,
      calculationMode: line.calculationMode,
      timeInputMode: line.durationMinutes ? "DURATION" : "RANGE",
      quantity: line.quantity ? String(Number(line.quantity)) : "0",
      fixedAmount: line.fixedAmountSnapshot ? String(Number(line.fixedAmountSnapshot)) : "",
      currency: line.currencySnapshot ?? "EUR",
      startTime: line.startTime?.slice(0, 5) ?? "08:00",
      endTime: line.endTime?.slice(0, 5) ?? "16:30",
      durationMinutes: line.durationMinutes ? formatDecimalHours(line.durationMinutes) : "",
      unpaidBreakMinutes: String(line.breakMinutes ?? 0),
      extraPayPercentage: String(line.extraPayPercentage ?? 0),
      notes: line.notes ?? "",
      quantities: {}
    }));
  }
  return [];
}

export function WorkRecordEditorPage() {
  const { t } = useTranslation(["records", "common"]);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const { recordId } = useParams();
  const isEditing = Boolean(recordId);
  const selectedEmploymentId = useEmploymentScope();
  const outletContext = useOutletContext<OutletContext | null>();
  const selectedDate = useMemo(() => {
    const fromUrl = searchParams.get("date");
    if (fromUrl) {
      return parseLocalIsoDate(fromUrl);
    }
    return isValidDate(outletContext?.selectedDate) ? outletContext.selectedDate : new Date();
  }, [outletContext, searchParams]);

  const [workDate, setWorkDate] = useState(safeLocalIsoDate(selectedDate));
  const [editorEmploymentId, setEditorEmploymentId] = useState(selectedEmploymentId ?? "");
  const [dateMode, setDateMode] = useState<"SINGLE_DAY" | "DATE_RANGE">("SINGLE_DAY");
  const [workEndDate, setWorkEndDate] = useState(safeLocalIsoDate(selectedDate));
  const [projectTitle, setProjectTitle] = useState("");
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [addressId, setAddressId] = useState("");
  const [addressExpanded, setAddressExpanded] = useState(false);
  const [detailsExpanded, setDetailsExpanded] = useState(false);
  const [addressDraft, setAddressDraft] = useState<AddressPayload>({
    street: "",
    street2: "",
    postalCode: "",
    city: "",
    region: "",
    country: ""
  });
  const [teamSize, setTeamSize] = useState("");
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<JobLineState[]>([]);
  const [activeLineId, setActiveLineId] = useState<string | null>(null);
  const [workTypePickerOpen, setWorkTypePickerOpen] = useState(false);
  const [dateEditorOpen, setDateEditorOpen] = useState(false);
  const [recommendationRejected, setRecommendationRejected] = useState(false);
  const manualPickerOpenedRef = useRef(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const backButtonRef = useRef<HTMLButtonElement | null>(null);
  const largeTitleRef = useRef<HTMLHeadingElement | null>(null);
  const [compactTitleVisible, setCompactTitleVisible] = useState(false);
  const safeBack = useSafeBackNavigation({ fallback: APP_HOME_PATH });

  function returnToDashboard() {
    const returnDate = searchParams.get("returnDate") ?? searchParams.get("date");
    if (returnDate) {
      outletContext?.setSelectedDate?.(parseLocalIsoDate(returnDate));
    }
    navigate(APP_HOME_PATH, { replace: true });
  }

  const workTypesQuery = useQuery({
    queryKey: queryKeys.workTypes.all(),
    queryFn: listWorkTypes
  });
  const employmentsQuery = useQuery({
    queryKey: queryKeys.employments.all(),
    queryFn: listEmployments
  });
  const hourlyRatesQuery = useQuery({
    queryKey: queryKeys.hourlyRates.all(),
    queryFn: listHourlyRates
  });
  const preferencesQuery = useQuery({
    queryKey: queryKeys.preferences(),
    queryFn: getPreferences
  });
  const projectsQuery = useQuery({
    queryKey: queryKeys.workProjects.all(),
    queryFn: listWorkProjects
  });
  const historyFrom = safeLocalIsoDate(addDays(parseLocalIsoDate(workDate), -90));
  const historyTo = safeLocalIsoDate(addDays(parseLocalIsoDate(workDate), -1));
  const workHistoryQuery = useQuery({
    queryKey: queryKeys.workRecords.range({ from: historyFrom, to: historyTo }),
    queryFn: () => listWorkRecordsInRange({ from: historyFrom, to: historyTo }),
    enabled: !isEditing
  });
  const recordQuery = useQuery({
    queryKey: queryKeys.workRecords.detail(recordId ?? ""),
    queryFn: () => getWorkRecord(recordId!),
    enabled: Boolean(recordId)
  });

  const createMutation = useMutation({
    mutationFn: async ({
      payload,
      projectId,
      projectName,
      employmentId
    }: {
      payload: WorkRecordRequest;
      projectId?: string | null;
      projectName?: string | null;
      employmentId?: string | null;
    }) => {
      if (payload.workEndDate) {
        if (!projectName?.trim() || !employmentId) {
          throw new Error("Project name and employment are required");
        }
        return createWorkProjectWithTotals(
          {
            employmentId,
            title: projectName.trim(),
            startDate: payload.workDate,
            endDate: payload.workEndDate,
            status: "ACTIVE",
            notes: payload.notes,
            addressId: payload.addressId
          },
          payload
        );
      }
      if (projectId) {
        return createProjectSession(projectId, payload);
      }
      return createWorkSession(payload);
    },
    onSuccess: async () => {
      setSuccess(true);
      await invalidateWorkRecordQueries(queryClient);
      window.setTimeout(returnToDashboard, 520);
    }
  });
  const updateMutation = useMutation({
    mutationFn: (payload: WorkRecordRequest) => payload.workEndDate
      ? updateWorkRecord(recordId!, payload)
      : updateWorkSession(recordId!, payload),
    onSuccess: async () => {
      setSuccess(true);
      await invalidateWorkRecordQueries(queryClient);
      window.setTimeout(returnToDashboard, 520);
    }
  });
  const deleteMutation = useMutation({
    mutationFn: () => deleteWorkRecord(recordId!),
    onSuccess: async () => {
      await invalidateWorkRecordQueries(queryClient);
      returnToDashboard();
    }
  });
  const createAddressMutation = useMutation({
    mutationFn: createAddress
  });

  useEffect(() => {
    if (!recordQuery.data) {
      return;
    }
    setWorkDate(recordQuery.data.workDate);
    setEditorEmploymentId(recordQuery.data.employmentId ?? "");
    setDateMode(recordQuery.data.workEndDate ? "DATE_RANGE" : "SINGLE_DAY");
    setWorkEndDate(recordQuery.data.workEndDate ?? recordQuery.data.workDate);
    setProjectTitle(recordQuery.data.projectTitle ?? "");
    setSelectedProjectId(recordQuery.data.projectId ?? "");
    setAddressId(recordQuery.data.addressId ?? "");
    if (recordQuery.data.address) {
      setAddressDraft({
        street: recordQuery.data.address.street ?? "",
        street2: recordQuery.data.address.street2 ?? "",
        postalCode: recordQuery.data.address.postalCode ?? "",
        city: recordQuery.data.address.city ?? "",
        region: recordQuery.data.address.region ?? "",
        country: recordQuery.data.address.country ?? ""
      });
    }
    setTeamSize(recordQuery.data.teamSize ? String(recordQuery.data.teamSize) : "");
    setNotes(recordQuery.data.notes ?? "");
    setLines(recordToLines(recordQuery.data));
    setActiveLineId(recordQuery.data.workLines?.[0]?.id ?? null);
  }, [recordQuery.data]);

  const isDirty =
    !success &&
    (dateMode === "DATE_RANGE" ||
      projectTitle.trim() !== "" ||
      selectedProjectId !== "" ||
      addressId !== "" ||
      hasAddressValues(addressDraft) ||
      teamSize !== "" ||
      notes.trim() !== "" ||
      lines.length > 0 ||
      lines.some(
        (line) =>
          line.workTypeId ||
              line.quantity !== "0" ||
          line.durationMinutes !== "" ||
          line.notes.trim()
      ));
  const { confirmOrRun, dialog } = useUnsavedChangesGuard({
    isDirty: isDirty && !createMutation.isPending && !updateMutation.isPending && !deleteMutation.isPending
  });

  useEffect(() => {
    let frameId = 0;
    const updateCompactTitle = () => {
      window.cancelAnimationFrame(frameId);
      frameId = window.requestAnimationFrame(() => {
        const titleRect = largeTitleRef.current?.getBoundingClientRect();
        const buttonRect = backButtonRef.current?.getBoundingClientRect();
        setCompactTitleVisible(Boolean(titleRect && buttonRect && titleRect.top <= buttonRect.top));
      });
    };
    updateCompactTitle();
    window.addEventListener("scroll", updateCompactTitle, { passive: true });
    window.addEventListener("resize", updateCompactTitle);
    return () => {
      window.cancelAnimationFrame(frameId);
      window.removeEventListener("scroll", updateCompactTitle);
      window.removeEventListener("resize", updateCompactTitle);
    };
  }, []);

  const isLoading =
    workTypesQuery.isLoading ||
    employmentsQuery.isLoading ||
    hourlyRatesQuery.isLoading ||
    preferencesQuery.isLoading ||
    projectsQuery.isLoading ||
    recordQuery.isLoading;
  const loadingError =
    workTypesQuery.error ?? employmentsQuery.error ?? hourlyRatesQuery.error ?? preferencesQuery.error ?? projectsQuery.error ?? recordQuery.error;

  const activeEmployments = useMemo(
    () => (employmentsQuery.data ?? []).filter((employment) => employment.active),
    [employmentsQuery.data]
  );
  const recordEmploymentId = recordQuery.data?.employmentId
    ?? (editorEmploymentId || null)
    ?? (activeEmployments.length === 1 ? activeEmployments[0].id : null);
  useEffect(() => {
    if (!isEditing && !editorEmploymentId && activeEmployments.length === 1) {
      setEditorEmploymentId(activeEmployments[0].id);
    }
  }, [activeEmployments, editorEmploymentId, isEditing]);
  const workTypes = useMemo(
    () => (workTypesQuery.data ?? []).filter(
      (workType) => workType.active && (!recordEmploymentId || workType.employmentId === recordEmploymentId)
    ),
    [recordEmploymentId, workTypesQuery.data]
  );
  const recommendedWorkEntry = useMemo(
    () => recommendWorkEntry(
      (workHistoryQuery.data ?? []).filter((record) => !recordEmploymentId || record.employmentId === recordEmploymentId),
      workTypes,
      workDate
    ),
    [recordEmploymentId, workDate, workHistoryQuery.data, workTypes]
  );
  const availableProjects = useMemo(
    () => (projectsQuery.data ?? []).filter((project) =>
      project.status !== "ARCHIVED" &&
      (!recordEmploymentId || project.employmentId === recordEmploymentId) &&
      project.startDate <= workDate &&
      (project.endDate == null || project.endDate >= workDate)
    ),
    [projectsQuery.data, recordEmploymentId, workDate]
  );
  const groupedLines = useMemo(() => {
    const groups: Array<{ key: string; parent: WorkType | null; lines: JobLineState[] }> = [];
    for (const line of lines) {
      const workType = workTypes.find((item) => item.id === line.workTypeId);
      const parent = workType?.parentId ? workTypes.find((item) => item.id === workType.parentId) ?? null : null;
      const key = parent?.id ?? line.id;
      const existing = groups.find((group) => group.key === key);
      if (existing) existing.lines.push(line);
      else groups.push({ key, parent, lines: [line] });
    }
    return groups;
  }, [lines, workTypes]);
  const hasTeamworkLine = useMemo(
    () => lines.some((line) => {
      const workType = workTypes.find((item) => item.id === line.workTypeId);
      const parent = workType?.parentId ? workTypes.find((item) => item.id === workType.parentId) : null;
      return Boolean(workType?.teamworkEnabled || parent?.teamworkEnabled);
    }),
    [lines, workTypes]
  );
  const liveSummary = useMemo(
    () => buildGroupSummary(lines, workTypes, hourlyRatesQuery.data ?? [], workDate, teamSize),
    [hourlyRatesQuery.data, lines, teamSize, workDate, workTypes]
  );

  useEffect(() => {
    if (isEditing || searchParams.get("suggest") === "1" || lines.length || workTypes.length !== 1) return;
    const onlyWorkType = workTypes[0];
    const historicalEntry = recommendWorkEntry(
      (workHistoryQuery.data ?? []).filter((record) => !recordEmploymentId || record.employmentId === recordEmploymentId),
      [onlyWorkType],
      workDate
    );
    const line = historicalEntry
      ? createLineFromRecommendation(onlyWorkType, historicalEntry.line, preferencesQuery.data?.currency ?? "EUR")
      : createLineForWorkType(onlyWorkType, preferencesQuery.data?.currency ?? "EUR");
    setLines([line]);
    setActiveLineId(line.id);
  }, [isEditing, lines.length, preferencesQuery.data?.currency, recordEmploymentId, searchParams, workDate, workHistoryQuery.data, workTypes]);

  useEffect(() => {
    if (
      isEditing ||
      searchParams.get("manual") !== "1" ||
      manualPickerOpenedRef.current ||
      lines.length ||
      workTypes.length <= 1
    ) return;
    manualPickerOpenedRef.current = true;
    setWorkTypePickerOpen(true);
  }, [isEditing, lines.length, searchParams, workTypes.length]);

  function updateLine(lineId: string, patch: Partial<JobLineState>) {
    setLines((current) =>
      current.map((line) => {
        if (line.id !== lineId) {
          return line;
        }
        return { ...line, ...patch };
      })
    );
  }

  function addWorkTypeLine(workType: WorkType) {
    addWorkTypeLines([workType]);
  }

  function addWorkTypeGroup(parent: WorkType) {
    const children = workTypes
      .filter((item) => item.active && item.parentId === parent.id)
      .sort((left, right) => left.displayOrder - right.displayOrder || left.name.localeCompare(right.name));
    addWorkTypeLines(children.length ? children : [parent], true);
  }

  function addWorkTypeLines(selectedWorkTypes: WorkType[], grouped = false) {
    const nextLines = selectedWorkTypes.map((workType) => {
      const historicalEntry = recommendWorkEntry(
        (workHistoryQuery.data ?? []).filter((record) => !recordEmploymentId || record.employmentId === recordEmploymentId),
        [workType],
        workDate
      );
      const line = historicalEntry
        ? createLineFromRecommendation(workType, historicalEntry.line, preferencesQuery.data?.currency ?? "EUR")
        : createLineForWorkType(workType, preferencesQuery.data?.currency ?? "EUR");
      if (grouped && line.calculationMode === "TIME_HOURLY") {
        if (!historicalEntry) {
          line.startTime = "";
          line.endTime = "";
        }
      }
      if (grouped && line.calculationMode === "FIXED_AMOUNT") {
        if (!historicalEntry) line.fixedAmount = "0";
      }
      return line;
    });
    setLines((current) => [...current, ...nextLines]);
    setActiveLineId(nextLines[0]?.id ?? null);
    setWorkTypePickerOpen(false);
  }

  async function handleSubmit() {
    setFormError(null);
    let resolvedAddressId = addressId;
    if (hasAddressValues(addressDraft) && !matchesAddress(addressDraft, recordQuery.data?.address)) {
      try {
        const address = await createAddressMutation.mutateAsync(normalizeAddressPayload(addressDraft));
        resolvedAddressId = address.id;
        setAddressId(address.id);
        await queryClient.invalidateQueries({ queryKey: queryKeys.addresses.all() });
      } catch (error) {
        setFormError(getApiError(error).message);
        return;
      }
    } else if (!hasAddressValues(addressDraft)) {
      resolvedAddressId = "";
    }
    const validation = buildPayload({
      t,
      workDate,
      workEndDate: dateMode === "DATE_RANGE" ? workEndDate : null,
      addressId: resolvedAddressId,
      teamSize,
      notes,
      lines,
      workTypes
    });
    if ("error" in validation) {
      setFormError(validation.error);
      return;
    }
    try {
      if (isEditing) {
        await updateMutation.mutateAsync(validation.payload);
      } else {
        const employmentId = recordEmploymentId
          ?? workTypes.find((workType) => lines.some((line) => line.workTypeId === workType.id))?.employmentId
          ?? null;
        if (dateMode === "DATE_RANGE" && !projectTitle.trim()) {
          setFormError(t("records:job.projectNameRequired"));
          return;
        }
        await createMutation.mutateAsync({
          payload: validation.payload,
          projectId: dateMode === "SINGLE_DAY" ? selectedProjectId || null : null,
          projectName: dateMode === "DATE_RANGE" ? projectTitle : null,
          employmentId
        });
      }
    } catch {
      // The mutation error is rendered below and input state is preserved.
    }
  }

  async function acceptRecommendedWorkEntry() {
    if (!recommendedWorkEntry) return;
    setFormError(null);
    const line = createLineFromRecommendation(
      recommendedWorkEntry.workType,
      recommendedWorkEntry.line,
      preferencesQuery.data?.currency ?? "EUR"
    );
    const suggestedTeamSize = recommendedWorkEntry.record.teamSize
      ? String(recommendedWorkEntry.record.teamSize)
      : "";
    const validation = buildPayload({
      t,
      workDate,
      workEndDate: null,
      addressId: "",
      teamSize: suggestedTeamSize,
      notes: "",
      lines: [line],
      workTypes
    });
    if ("error" in validation) {
      setLines([line]);
      setActiveLineId(line.id);
      setTeamSize(suggestedTeamSize);
      setFormError(validation.error);
      return;
    }
    try {
      await createMutation.mutateAsync({
        payload: validation.payload,
        projectId: null,
        projectName: null,
        employmentId: recommendedWorkEntry.workType.employmentId ?? recordEmploymentId
      });
    } catch {
      // The mutation error is rendered below and the recommendation remains available.
    }
  }

  if (isLoading) {
    return (
      <ScreenMessage
        title={t("records:job.loading")}
        description={t("records:editor.loadingDescription")}
      />
    );
  }

  if (loadingError) {
    return (
      <ScreenMessage
        title={t("records:editor.unavailableTitle")}
        description={getApiError(loadingError).message}
      />
    );
  }

  if (!workTypes.length) {
    return (
      <ScreenMessage
        title={t("records:editor.noWorkTypesTitle")}
        description={t("records:editor.noWorkTypesDescription")}
      />
    );
  }

  const predictionMode = !isEditing && searchParams.get("suggest") === "1";

  if (predictionMode && recommendedWorkEntry && !recommendationRejected && !lines.length) {
    return (
      <div className="mx-auto flex min-h-[calc(100dvh-7rem)] w-full max-w-[560px] items-center px-0 py-8">
        <Card as="section" variant="ambient" className="editor-prediction-gate w-full overflow-hidden p-0" aria-labelledby="prediction-title">
          <button
            type="button"
            onClick={returnToDashboard}
            aria-label={t("common:actions.close")}
            className="absolute right-4 top-4 z-10 grid h-10 w-10 place-items-center rounded-full bg-white/[0.06] text-white/48 transition-colors hover:bg-white/[0.1] hover:text-white focus:outline-none focus:ring-2 focus:ring-white/24"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
          <div className="px-6 pb-7 pt-8 text-center">
            <span className="mx-auto grid h-14 w-14 place-items-center rounded-full border border-[#10b981]/10 bg-[#10b981]/[0.075] text-[#34d399]">
              <Briefcase className="h-6 w-6" strokeWidth={1.8} aria-hidden="true" />
            </span>
            <p className="mt-5 text-[0.64rem] font-semibold uppercase tracking-[0.16em] text-[#10b981]/70">
              {t("records:job.suggested")}
            </p>
            <h1 id="prediction-title" className="mx-auto mt-2 max-w-[18rem] text-[1.9rem] font-semibold leading-[1.12] tracking-[-0.06em] text-white">
              {t("records:job.predictionQuestion", { name: recommendedWorkEntry.workType.name })}
            </h1>
            <p className="mt-4 text-base font-medium tabular-nums text-white/48">
              {formatRecommendedInterval(
                recommendedWorkEntry.line,
                t("records:job.noInterval"),
                t("records:job.breakShort")
              )}
            </p>
          </div>
          <div className="grid grid-cols-2 border-t border-white/[0.075]">
            <button
              type="button"
              disabled={createMutation.isPending}
              className="min-h-14 border-r border-white/[0.075] text-base font-semibold text-white/58 transition-colors hover:bg-white/[0.04] hover:text-white disabled:opacity-50"
              onClick={() => setRecommendationRejected(true)}
            >
              {t("records:job.rejectSuggestion")}
            </button>
            <button
              type="button"
              disabled={createMutation.isPending || success}
              className="min-h-14 text-base font-semibold text-[#34d399] transition-colors hover:bg-[#10b981]/[0.06] disabled:opacity-50"
              onClick={() => void acceptRecommendedWorkEntry()}
            >
              {createMutation.isPending ? t("records:job.saving") : t("records:job.acceptSuggestion")}
            </button>
          </div>
          {createMutation.error ? (
            <p className="border-t border-white/[0.075] px-5 py-3 text-center text-sm text-red-300">
              {getApiError(createMutation.error).message}
            </p>
          ) : null}
        </Card>
      </div>
    );
  }

  const saveMutation = isEditing ? updateMutation : createMutation;
  const saveError = saveMutation.error ? getApiError(saveMutation.error).message : null;
  const pageTitle = isEditing ? t("records:job.editTitle") : t("records:job.title");
  const largePageTitle = isEditing ? pageTitle : t("records:job.promptTitle");
  const workDateLabel = new Intl.DateTimeFormat(i18n.resolvedLanguage, {
    weekday: "long",
    day: "numeric",
    month: "long"
  }).format(parseLocalIsoDate(workDate));

  return (
    <div className="work-record-editor-page mx-auto min-w-0 w-full max-w-[560px] space-y-6 overflow-x-clip pb-6 pt-8">
      <header className="settings-sticky-header dashboard-sticky-header editor-sticky-header fixed inset-x-0 top-0 z-40 mx-auto flex w-full max-w-[560px] items-start px-5 pt-2">
        <button
          ref={backButtonRef}
          type="button"
          onClick={() => confirmOrRun(safeBack)}
          aria-label={t("common:actions.back")}
          className="settings-sticky-header-control flex h-9 items-center gap-1.5 rounded-md px-0 text-[1rem] font-bold leading-none tracking-[-0.035em] text-white transition active:scale-95 focus:outline-none focus:ring-2 focus:ring-white/24"
        >
          <ArrowLeft className="h-[1.22rem] w-[1.22rem]" aria-hidden="true" />
          <span>{t("common:actions.back")}</span>
        </button>
        <div
          aria-hidden="true"
          className={`settings-sticky-header-title pointer-events-none absolute left-1/2 flex h-9 -translate-x-1/2 items-center text-[1rem] font-bold leading-none tracking-[-0.035em] text-white transition duration-300 ${
            compactTitleVisible ? "translate-y-0 opacity-100 delay-100" : "translate-y-1 opacity-0"
          }`}
        >
          {pageTitle}
        </div>
      </header>

      <div className={`transition duration-200 ${compactTitleVisible ? "-translate-y-1 opacity-0" : "translate-y-0 opacity-100 delay-75"}`}>
        <h1
          ref={largeTitleRef}
          className="max-w-[22rem] text-[2.45rem] font-semibold leading-[1.02] tracking-[-0.065em] text-white"
        >
          {largePageTitle}
        </h1>
      </div>

      <section>
        <Card
          as="button"
          type="button"
          variant="ambient"
          className="editor-date-card flex min-h-[76px] w-full items-center gap-4 px-5 py-3.5 text-left transition-colors hover:bg-white/[0.055] focus:outline-none focus:ring-2 focus:ring-white/24"
          onClick={() => setDateEditorOpen(true)}
          aria-label={t("records:job.editDates")}
        >
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full border border-[#10b981]/15 bg-[#10b981]/[0.08] text-[#34d399]">
            <CalendarDays className="h-5 w-5" aria-hidden="true" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[0.62rem] font-semibold uppercase tracking-[0.16em] text-white/36">
              {dateMode === "SINGLE_DAY" ? t("records:job.oneDay") : t("records:job.dateRange")}
            </span>
            <span className="mt-1 block truncate text-base font-semibold capitalize tracking-[-0.025em] text-white">
              {dateMode === "SINGLE_DAY" ? workDateLabel : `${workDate} – ${workEndDate}`}
            </span>
          </span>
          <ChevronRight className="h-5 w-5 shrink-0 text-white/30" aria-hidden="true" />
        </Card>
      </section>

      {dateEditorOpen ? (
        <LockedModalViewport
          className="items-end bg-black/45 px-4 pb-[calc(env(safe-area-inset-bottom)+1rem)] pt-[calc(env(safe-area-inset-top)+1rem)] backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="date-editor-title"
        >
          <button
            type="button"
            tabIndex={-1}
            aria-label={t("records:job.closeDateEditor")}
            className="absolute inset-0"
            onClick={() => setDateEditorOpen(false)}
          />
          <ModalPanel className="date-editor-sheet max-h-[85dvh] max-w-[430px] overflow-y-auto !rounded-[30px] p-5">
            <div className="mb-5 flex items-center justify-between gap-4">
              <div>
                <p className="hairline-text">{t("records:job.dates")}</p>
                <h2 id="date-editor-title" className="mt-1 text-[1.5rem] font-semibold tracking-[-0.055em] text-white">
                  {t("records:job.chooseDates")}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setDateEditorOpen(false)}
                className="grid h-10 w-10 place-items-center rounded-full bg-white/[0.06] text-white/55 transition-colors hover:text-white focus:outline-none focus:ring-2 focus:ring-white/24"
                aria-label={t("records:job.closeDateEditor")}
              >
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>
            <div className="space-y-4">
          {!isEditing && activeEmployments.length > 1 ? (
            <label className="block space-y-2">
              <span className="text-sm font-medium text-white/70">{t("records:job.employment")}</span>
              <select
                value={editorEmploymentId}
                onChange={(event) => {
                  setEditorEmploymentId(event.currentTarget.value);
                  setLines([]);
                  setActiveLineId(null);
                }}
                className="h-12 w-full rounded-2xl border border-white/[0.12] bg-[#111713] px-4 text-sm font-semibold text-white outline-none focus:border-white/[0.28] focus:ring-2 focus:ring-white/24"
              >
                <option value="">{t("records:job.chooseEmployment")}</option>
                {activeEmployments.map((employment) => (
                  <option key={employment.id} value={employment.id}>{employment.name}</option>
                ))}
              </select>
            </label>
          ) : null}
          <div className="editor-segmented-control grid grid-cols-2 gap-1 rounded-2xl border p-1">
            <button
              type="button"
              className={`min-h-10 rounded-xl px-3 text-sm font-semibold transition-colors ${dateMode === "SINGLE_DAY" ? "editor-segment-selected" : "text-white/58 hover:text-white"}`}
              onClick={() => setDateMode("SINGLE_DAY")}
            >
              {t("records:job.oneDay")}
            </button>
            <button
              type="button"
              className={`min-h-10 rounded-xl px-3 text-sm font-semibold transition-colors ${dateMode === "DATE_RANGE" ? "editor-segment-selected" : "text-white/58 hover:text-white"}`}
              onClick={() => {
                setDateMode("DATE_RANGE");
                if (workEndDate < workDate) setWorkEndDate(workDate);
              }}
            >
              {t("records:job.dateRange")}
            </button>
          </div>
          <div className={`grid items-end gap-3 ${dateMode === "DATE_RANGE" ? "grid-cols-2" : "grid-cols-1"}`}>
            <label className="block space-y-2">
              <span className="text-sm font-medium text-white/78">
                {dateMode === "DATE_RANGE" ? t("records:fields.workStartDate") : t("records:fields.workDate")}
              </span>
              <input
                type="date"
                aria-label={t("records:fields.workDate")}
                value={workDate}
                onChange={(event) => {
                  const nextDate = event.currentTarget.value;
                  setWorkDate(nextDate);
                  if (dateMode === "DATE_RANGE" && workEndDate < nextDate) setWorkEndDate(nextDate);
                }}
                className="h-12 w-full appearance-none rounded-2xl border border-white/[0.12] bg-white/[0.06] px-3 text-center text-sm font-medium text-white outline-none transition focus:border-white/[0.28] focus:bg-white/[0.09] focus:ring-2 focus:ring-white/24"
              />
            </label>
            {dateMode === "DATE_RANGE" ? (
              <label className="block min-w-0 space-y-2">
                <span className="text-sm font-medium text-white/78">{t("records:fields.workEndDate")}</span>
                <input
                  type="date"
                  min={workDate}
                  aria-label={t("records:fields.workEndDate")}
                  value={workEndDate}
                  onChange={(event) => setWorkEndDate(event.currentTarget.value)}
                  className="h-12 w-full min-w-0 appearance-none rounded-2xl border border-white/[0.12] bg-white/[0.06] px-2 text-center text-sm font-medium text-white outline-none transition focus:border-white/[0.28] focus:bg-white/[0.09] focus:ring-2 focus:ring-white/24"
                />
              </label>
            ) : null}
          </div>
          {dateMode === "DATE_RANGE" ? (
            isEditing && recordQuery.data?.projectId ? (
              <div className="border-t border-white/[0.08] pt-4">
                <p className="hairline-text mb-1">{t("records:job.projectName")}</p>
                <p className="text-sm font-semibold text-white/82">{projectTitle}</p>
              </div>
            ) : (
              <Input
                label={t("records:job.projectName")}
                value={projectTitle}
                maxLength={160}
                placeholder={t("records:job.projectNamePlaceholder")}
                onChange={(event) => setProjectTitle(event.currentTarget.value)}
              />
            )
          ) : !isEditing && availableProjects.length > 0 ? (
            <label className="block space-y-2 border-t border-white/[0.08] pt-4">
              <span className="text-sm font-medium text-white/78">{t("records:job.addToProject")}</span>
              <select
                value={selectedProjectId}
                onChange={(event) => setSelectedProjectId(event.currentTarget.value)}
                className="h-12 w-full rounded-2xl border border-white/[0.12] bg-[#111713] px-4 text-sm font-medium text-white outline-none focus:border-white/[0.28] focus:ring-2 focus:ring-white/24"
              >
                <option value="">{t("records:job.noProject")}</option>
                {availableProjects.map((project) => (
                  <option key={project.id} value={project.id}>{project.title}</option>
                ))}
              </select>
            </label>
          ) : null}
              <Button className="w-full" type="button" onClick={() => setDateEditorOpen(false)}>
                {t("common:actions.apply")}
              </Button>
            </div>
          </ModalPanel>
        </LockedModalViewport>
      ) : null}

      <section className="space-y-4">
        <div className="flex items-center justify-between gap-4">
          <p className="hairline-text">{t("records:job.activitySection")}</p>
          <button
            type="button"
            onClick={() => {
              const suffix = recordEmploymentId
                ? `?employmentId=${encodeURIComponent(recordEmploymentId)}`
                : "";
              navigate(`/settings/work-types${suffix}`);
            }}
            aria-label={t("records:job.manageWorkTypes")}
            title={t("records:job.manageWorkTypes")}
            className="flex h-9 w-9 items-center justify-center rounded-full border border-white/[0.1] bg-white/[0.04] text-white/58 transition hover:bg-white/[0.09] hover:text-white focus:outline-none focus:ring-2 focus:ring-white/24"
          >
            <Settings className="h-[1.1rem] w-[1.1rem]" aria-hidden="true" />
          </button>
        </div>
        {lines.length === 0 ? (
          <div className="space-y-3">
            {recommendedWorkEntry && !recommendationRejected ? (
              <Card variant="ambient" className="editor-work-suggestion overflow-hidden p-0">
                <div className="flex min-h-[92px] items-center gap-4 px-5 py-4">
                <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-[#10b981]/10 text-[#34d399]">
                  <Briefcase className="h-5 w-5" strokeWidth={1.8} aria-hidden="true" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[0.6rem] font-semibold uppercase tracking-[0.16em] text-[#10b981]/70">
                    {t("records:job.suggested")}
                  </span>
                  <span className="mt-1 block truncate text-base font-semibold text-white">{recommendedWorkEntry.workType.name}</span>
                  <span className="mt-0.5 block text-sm font-medium tabular-nums text-white/48">
                    {formatRecommendedInterval(
                      recommendedWorkEntry.line,
                      t("records:job.noInterval"),
                      t("records:job.breakShort")
                    )}
                  </span>
                </span>
                </div>
                <div className="grid grid-cols-2 border-t border-white/[0.075]">
                  <button
                    type="button"
                    className="min-h-12 border-r border-white/[0.075] text-sm font-semibold text-white/58 transition-colors hover:bg-white/[0.04] hover:text-white"
                    onClick={() => setWorkTypePickerOpen(true)}
                  >
                    {t("records:job.rejectSuggestion")}
                  </button>
                  <button
                    type="button"
                    disabled={createMutation.isPending || success}
                    className="min-h-12 text-sm font-semibold text-[#34d399] transition-colors hover:bg-[#10b981]/[0.06]"
                    onClick={() => void acceptRecommendedWorkEntry()}
                  >
                    {createMutation.isPending ? t("records:job.saving") : t("records:job.acceptSuggestion")}
                  </button>
                </div>
              </Card>
            ) : null}
            {!recommendedWorkEntry || recommendationRejected ? <Card
              as="button"
              type="button"
              onClick={() => setWorkTypePickerOpen(true)}
              variant="ambient"
              className="editor-add-activity flex min-h-36 w-full flex-col items-center justify-center gap-3 transition-colors hover:bg-white/[0.065] focus:outline-none focus:ring-2 focus:ring-white/24"
              aria-label={t("records:job.addActivity")}
            >
              <span className="flex h-14 w-14 items-center justify-center rounded-full border border-white/[0.12] bg-white/[0.07] text-white">
                <Plus className="h-6 w-6" aria-hidden="true" />
              </span>
              <span className="text-sm font-semibold text-white/72">
                {t("records:job.addActivity")}
              </span>
            </Card> : null}
          </div>
        ) : (
          <div className="space-y-4">
            {groupedLines.map((group) =>
              group.parent ? (
                <Card as="section" variant="ambient" key={group.key} className="overflow-hidden px-4 py-3">
                  <div className="flex items-center gap-3 pb-2">
                    <span className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: group.parent.color }} />
                    <div className="min-w-0 flex-1">
                      <p className="font-name truncate text-base font-semibold text-white">{group.parent.name}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        const childIds = new Set(group.lines.map((line) => line.id));
                        setLines((current) => current.filter((line) => !childIds.has(line.id)));
                      }}
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-white/42 transition hover:bg-white/[0.07] hover:text-white focus:outline-none focus:ring-2 focus:ring-white/24"
                      aria-label={t("records:job.removeLine")}
                    >
                      <Trash2 className="h-4 w-4" aria-hidden="true" />
                    </button>
                  </div>
                  <div className="divide-y divide-white/[0.07]">
                    {group.lines.map((line) => (
                      <WorkRecordLineCard
                        key={line.id}
                        embedded
                        index={lines.indexOf(line)}
                        line={line}
                        workTypes={workTypes}
                        workDate={workDate}
                        hourlyRates={hourlyRatesQuery.data ?? []}
                        teamSize={teamSize}
                        onChange={updateLine}
                        onRemove={null}
                      />
                    ))}
                  </div>
                  {(group.parent.extraPayEnabled || group.lines.some((line) =>
                    workTypes.find((item) => item.id === line.workTypeId)?.extraPayEnabled)) ? (
                    <div className="border-t border-white/[0.07] pt-3">
                      <Input
                        label={t("records:fields.extraPay")}
                        type="number"
                        inputMode="decimal"
                        min={0}
                        max={1000}
                        step="0.01"
                        value={group.lines[0]?.extraPayPercentage ?? "0"}
                        onFocus={() => {
                          if (group.lines[0]?.extraPayPercentage === "0") {
                            const ids = new Set(group.lines.map((line) => line.id));
                            setLines((current) => current.map((line) => ids.has(line.id)
                              ? { ...line, extraPayPercentage: "" }
                              : line));
                          }
                        }}
                        onChange={(event) => {
                          const value = event.currentTarget.value;
                          const ids = new Set(group.lines.map((line) => line.id));
                          setLines((current) => current.map((line) => ids.has(line.id)
                            ? { ...line, extraPayPercentage: value }
                            : line));
                        }}
                      />
                    </div>
                  ) : null}
                  <WorkTypeGroupSummary
                    lines={group.lines}
                    workTypes={workTypes}
                    hourlyRates={hourlyRatesQuery.data ?? []}
                    workDate={workDate}
                    teamSize={teamSize}
                  />
                </Card>
              ) : (
                activeLineId === group.lines[0].id ? (
                  <WorkRecordLineCard
                    key={group.key}
                    index={lines.indexOf(group.lines[0])}
                    line={group.lines[0]}
                    workTypes={workTypes}
                    workDate={workDate}
                    hourlyRates={hourlyRatesQuery.data ?? []}
                    teamSize={teamSize}
                    onChange={updateLine}
                    onRemove={() => {
                      setLines((current) => current.filter((item) => item.id !== group.lines[0].id));
                      setActiveLineId(null);
                    }}
                  />
                ) : (
                  <CollapsedWorkLine
                    key={group.key}
                    line={group.lines[0]}
                    workTypes={workTypes}
                    hourlyRates={hourlyRatesQuery.data ?? []}
                    workDate={workDate}
                    teamSize={teamSize}
                    onOpen={() => setActiveLineId(group.lines[0].id)}
                  />
                )
              )
            )}
            {hasTeamworkLine ? (
              <Card className="flex items-center justify-between gap-4 px-4 py-3">
                <label htmlFor="job-team-size" className="text-sm font-semibold text-white">
                  {t("records:job.teamSize")}
                </label>
                <input
                  id="job-team-size"
                  type="number"
                  inputMode="numeric"
                  min={1}
                  step={1}
                  value={teamSize}
                  onFocus={() => {
                    if (teamSize === "0") setTeamSize("");
                  }}
                  onChange={(event) => setTeamSize(event.currentTarget.value)}
                  className="h-10 w-20 rounded-2xl border border-white/[0.12] bg-white/[0.06] px-3 text-center text-base font-semibold text-white outline-none transition focus:border-white/[0.28] focus:ring-2 focus:ring-white/24"
                />
              </Card>
            ) : null}
            <button
              type="button"
              onClick={() => setWorkTypePickerOpen(true)}
              className="flex min-h-10 w-full items-center justify-center gap-2 rounded-2xl text-sm font-semibold text-white/52 transition hover:bg-white/[0.035] hover:text-white focus:outline-none focus:ring-2 focus:ring-white/24"
            >
              <Plus className="h-4 w-4" aria-hidden="true" />
              {t("records:job.addAnotherActivity")}
            </button>
          </div>
        )}
      </section>

      {liveSummary ? (
        <Card as="section" variant="ambient" className="editor-live-summary overflow-hidden p-5">
          <div className="flex items-center gap-3">
            <span className="grid h-11 w-11 place-items-center rounded-[16px] border border-[#10b981]/15 bg-[#10b981]/[0.08] text-[#34d399]">
              <ReceiptText className="h-5 w-5" aria-hidden="true" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[0.62rem] font-medium uppercase tracking-[0.16em] text-white/34">{t("records:summary.title")}</p>
              <p className="mt-1 font-metric text-xl font-medium text-white">
                {formatMinutesAsDuration(liveSummary.actualMinutes + liveSummary.equivalentMinutes)}
              </p>
            </div>
            <div className="shrink-0 text-right font-metric text-base font-medium text-[#34d399]">
              {liveSummary.amounts.map((amount) => (
                <p key={amount.currency}>{formatCurrency(String(amount.value), amount.currency)}</p>
              ))}
            </div>
          </div>
        </Card>
      ) : null}

      {lines.length ? <section className="space-y-3">
        <button
          type="button"
          aria-expanded={detailsExpanded}
          onClick={() => setDetailsExpanded((value) => !value)}
          className="universal-glass-card glass-card--ambient editor-details-card flex w-full items-center gap-3 rounded-[24px] p-4 text-left focus:outline-none focus:ring-2 focus:ring-white/24"
        >
          <span className="grid h-11 w-11 place-items-center rounded-[16px] border border-white/[0.08] bg-white/[0.05] text-[#34d399]">
            <MapPin className="h-5 w-5" aria-hidden="true" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block font-semibold text-white">{t("records:job.details")}</span>
            <span className="mt-1 block text-xs text-white/40">{t("records:job.detailsHint")}</span>
          </span>
          <ChevronRight className={`h-5 w-5 text-white/38 transition-transform ${detailsExpanded ? "rotate-90" : ""}`} />
        </button>
        {detailsExpanded ? (
          <div className="space-y-4">
            <button
              type="button"
              aria-expanded={addressExpanded}
              onClick={() => setAddressExpanded((value) => !value)}
              className="flex w-full items-center justify-between px-1 text-left text-sm font-semibold text-white/70"
            >
              {t("records:job.address")}
              <ChevronRight className={`h-4 w-4 transition-transform ${addressExpanded ? "rotate-90" : ""}`} />
            </button>
            {addressExpanded ? <AddressFields draft={addressDraft} onDraftChange={setAddressDraft} /> : null}
            <Textarea
              label={t("records:fields.notes")}
              rows={3}
              className="min-h-24 resize-none bg-white/[0.04]"
              placeholder={t("records:job.notesPlaceholder")}
              value={notes}
              onChange={(event) => setNotes(event.currentTarget.value)}
            />
          </div>
        ) : null}
      </section> : null}

      {formError ? <p className="text-sm text-red-300">{formError}</p> : null}
      {saveError ? <p className="text-sm text-red-300">{saveError}</p> : null}

      {lines.length ? <div className={isEditing
        ? "sticky bottom-[calc(env(safe-area-inset-bottom)+5.75rem)] z-30 -mx-1 space-y-3 rounded-[28px] border border-white/[0.09] bg-black/55 p-2 backdrop-blur-2xl"
        : "sticky bottom-[calc(env(safe-area-inset-bottom)+5.75rem)] z-30"
      }>
        <Button className="w-full" type="button" disabled={saveMutation.isPending || createAddressMutation.isPending || success} onClick={() => void handleSubmit()}>
          {saveMutation.isPending || createAddressMutation.isPending
            ? t("records:job.saving")
            : success
              ? t("records:saved")
              : t("common:actions.save")}
        </Button>
        {isEditing ? (
          <Button
            className="w-full border-red-300/20 bg-red-500/12 text-red-100 hover:bg-red-500/18"
            type="button"
            variant="secondary"
            disabled={deleteMutation.isPending}
            onClick={() => {
              if (window.confirm(t("records:job.deleteConfirm"))) {
                deleteMutation.mutate();
              }
            }}
          >
            {deleteMutation.isPending ? t("records:job.deleting") : t("records:job.delete")}
          </Button>
        ) : null}
      </div> : null}
      {deleteMutation.error ? <p className="text-sm text-red-300">{getApiError(deleteMutation.error).message}</p> : null}

      <SettingsSuccessMessage message={success ? t("records:job.savedToast") : null} />
      {workTypePickerOpen ? (
        <WorkTypePickerDialog
          workTypes={workTypes}
          onSelect={addWorkTypeLine}
          onSelectGroup={addWorkTypeGroup}
          onClose={() => setWorkTypePickerOpen(false)}
        />
      ) : null}
      {dialog}
    </div>
  );
}

function AddressFields({
  draft,
  onDraftChange
}: {
  draft: AddressPayload;
  onDraftChange: (value: AddressPayload) => void;
}) {
  const { t } = useTranslation("settings");

  return (
    <Card variant="ambient" className="p-5">
        <div className="space-y-3">
          <Input
            label={t("profileEditor.fields.street")}
            value={draft.street ?? ""}
            onChange={(event) => onDraftChange({ ...draft, street: event.currentTarget.value })}
          />
          <Input
            label={t("profileEditor.fields.street2Optional")}
            value={draft.street2 ?? ""}
            onChange={(event) => onDraftChange({ ...draft, street2: event.currentTarget.value })}
          />
          <div className="grid grid-cols-2 gap-3">
            <Input
              label={t("profileEditor.fields.city")}
              value={draft.city ?? ""}
              onChange={(event) => onDraftChange({ ...draft, city: event.currentTarget.value })}
            />
            <Input
              label={t("profileEditor.fields.postalCode")}
              value={draft.postalCode ?? ""}
              onChange={(event) => onDraftChange({ ...draft, postalCode: event.currentTarget.value })}
            />
          </div>
          <div className="grid grid-cols-[minmax(0,1fr),6rem] gap-3">
            <Input
              label={t("profileEditor.fields.region")}
              value={draft.region ?? ""}
              onChange={(event) => onDraftChange({ ...draft, region: event.currentTarget.value })}
            />
            <Input
              label={t("profileEditor.fields.countryCode")}
              value={draft.country ?? ""}
              maxLength={2}
              onChange={(event) => onDraftChange({ ...draft, country: event.currentTarget.value.toUpperCase() })}
            />
          </div>
        </div>
    </Card>
  );
}

function WorkTypePickerDialog({
  workTypes,
  onSelect,
  onSelectGroup,
  onClose
}: {
  workTypes: WorkType[];
  onSelect: (workType: WorkType) => void;
  onSelectGroup: (workType: WorkType) => void;
  onClose: () => void;
}) {
  const { t } = useTranslation("records");
  const activeWorkTypes = workTypes.filter((item) => item.active);
  const childrenByParent = activeWorkTypes.reduce<Record<string, WorkType[]>>((groups, item) => {
    if (item.active && item.parentId) {
      groups[item.parentId] = [...(groups[item.parentId] ?? []), item]
        .sort((left, right) => left.displayOrder - right.displayOrder || left.name.localeCompare(right.name));
    }
    return groups;
  }, {});
  // Only top-level choices belong in Add activity. Children are opened together
  // through their category and must never be duplicated as standalone choices.
  const topLevelChoices = activeWorkTypes
    .filter((item) => !item.parentId)
    .sort((left, right) => left.displayOrder - right.displayOrder || left.name.localeCompare(right.name));

  return (
    <LockedModalViewport className="work-type-picker-backdrop items-end bg-black/52 px-4 pb-[calc(env(safe-area-inset-bottom)+6.75rem)] pt-[calc(env(safe-area-inset-top)+1rem)] backdrop-blur-md">
      <button type="button" className="absolute inset-0" onClick={onClose} aria-label={t("job.closePicker")} />
      <ModalPanel
        as="section"
        role="dialog"
        aria-modal="true"
        aria-labelledby="work-type-picker-title"
        className="work-type-picker-panel flex max-h-[calc(100dvh-env(safe-area-inset-top)-env(safe-area-inset-bottom)-8.5rem)] max-w-[430px] flex-col overflow-hidden !rounded-[30px] !border-[#10b981]/[0.14] !bg-[linear-gradient(150deg,rgba(22,22,22,0.98),rgba(8,10,9,0.98))] !p-0 shadow-[0_28px_90px_rgba(0,0,0,0.7)]"
      >
        <div className="flex h-5 items-center justify-center" aria-hidden="true">
          <span className="work-type-picker-handle h-1 w-10 rounded-full" />
        </div>
        <header className="relative flex items-center justify-between gap-4 border-b border-white/[0.07] px-5 pb-4 pt-2">
          <div>
            <p className="text-[0.6rem] font-semibold uppercase tracking-[0.2em] text-[#10b981]/60">
              {t("job.lines")}
            </p>
            <h2 id="work-type-picker-title" className="mt-1 text-[1.35rem] font-semibold tracking-[-0.055em] text-[#f5f5f5]">
              {t("job.chooseActivity")}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-10 w-10 items-center justify-center rounded-full border border-white/[0.08] bg-white/[0.05] text-white/52 transition active:scale-95 hover:bg-white/[0.08] hover:text-white focus:outline-none focus:ring-2 focus:ring-white/24"
            aria-label={t("job.closePicker")}
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 pb-4 pt-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <div className="work-type-picker-list overflow-hidden rounded-[22px] border">
          {topLevelChoices.map((parent) => {
            const children = childrenByParent[parent.id] ?? [];
            const isCategory = parent.compositeEnabled || children.length > 0;
            return (
              <div key={parent.id} className="work-type-picker-option overflow-hidden">
                <button
                  type="button"
                  onClick={() => children.length ? onSelectGroup(parent) : onSelect(parent)}
                  className="flex min-h-[3.65rem] w-full items-center gap-3 px-4 py-2.5 text-left transition active:scale-[0.99] hover:bg-white/[0.06] focus:outline-none focus:ring-2 focus:ring-[#10b981]/25 focus:ring-inset"
                >
                  <span className="work-type-picker-option-icon grid h-9 w-9 shrink-0 place-items-center rounded-[13px] border">
                    {isCategory
                      ? <Folder className="h-4 w-4 text-white/42" aria-hidden="true" />
                      : <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: parent.color }} />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="font-name block truncate text-base font-semibold text-white">{parent.name}</span>
                    <span className="mt-0.5 block text-xs text-white/38">
                      {children.length
                        ? t("job.activityCount", { count: children.length })
                        : workTypeMethodLabel(parent, t)}
                    </span>
                  </span>
                  <ChevronRight className="h-5 w-5 shrink-0 text-white/30" aria-hidden="true" />
                </button>
              </div>
            );
          })}
          </div>
        </div>
      </ModalPanel>
    </LockedModalViewport>
  );
}

function WorkRecordLineCard({
  embedded = false,
  index,
  line,
  workTypes,
  workDate,
  hourlyRates,
  teamSize,
  onChange,
  onRemove
}: {
  embedded?: boolean;
  index: number;
  line: JobLineState;
  workTypes: WorkType[];
  workDate: string;
  hourlyRates: Awaited<ReturnType<typeof listHourlyRates>>;
  teamSize: string;
  onChange: (lineId: string, patch: Partial<JobLineState>) => void;
  onRemove: (() => void) | null;
}) {
  const { t } = useTranslation(["records", "common"]);
  const selectedWorkType = workTypes.find((workType) => workType.id === line.workTypeId) ?? null;
  const preview = buildLinePreview(line, selectedWorkType, hourlyRates, workDate, teamSize);

  useEffect(() => {
    if (!selectedWorkType) {
      return;
    }
    const mode = workTypeCalculationMode(selectedWorkType);
    if (line.calculationMode === mode) {
      return;
    }
    onChange(line.id, { calculationMode: mode });
  }, [line.calculationMode, line.id, onChange, selectedWorkType]);

  return (
    <div className={embedded
      ? "relative space-y-2 py-3 first:pt-2 last:pb-0"
      : "universal-glass-card glass-card--ambient editor-work-line-card relative space-y-4 p-5"}
    >
      <div className="flex items-center justify-between gap-4">
        <div className="flex min-w-0 items-center gap-3">
          {!embedded ? (
            <span className="editor-work-type-icon grid h-10 w-10 shrink-0 place-items-center rounded-full">
              <Briefcase className="h-[1.1rem] w-[1.1rem]" strokeWidth={1.8} aria-hidden="true" />
            </span>
          ) : null}
          <p className={`font-name min-w-0 truncate font-semibold tracking-[-0.03em] text-white ${embedded ? "text-sm" : "text-base"}`}>
            {selectedWorkType ? selectedWorkType.name : t("records:job.lineTitle", { count: index + 1 })}
          </p>
        </div>
        {onRemove ? (
          <button
            type="button"
            onClick={onRemove}
            className="rounded-full border border-white/[0.08] bg-white/[0.06] p-2 text-white/62 transition hover:bg-white/[0.1] hover:text-white focus:outline-none focus:ring-2 focus:ring-white/24"
            aria-label={t("records:job.removeLine")}
          >
            <Trash2 className="h-4 w-4" />
          </button>
        ) : null}
      </div>

      {selectedWorkType && line.calculationMode === "TIME_HOURLY" ? (
        <div className="space-y-3">
          <div className="editor-segmented-control grid grid-cols-2 gap-1 rounded-2xl border p-1">
            <button
              type="button"
              className={`rounded-xl px-4 py-2 text-sm font-semibold transition-colors ${line.timeInputMode === "RANGE" ? "editor-segment-selected" : "text-white/62 hover:text-white"}`}
              onClick={() => onChange(line.id, { timeInputMode: "RANGE" })}
            >
              {t("records:fields.timeRange")}
            </button>
            <button
              type="button"
              className={`rounded-xl px-4 py-2 text-sm font-semibold transition-colors ${line.timeInputMode === "DURATION" ? "editor-segment-selected" : "text-white/62 hover:text-white"}`}
              onClick={() => onChange(line.id, { timeInputMode: "DURATION" })}
            >
              {t("records:fields.duration")}
            </button>
          </div>
          {line.timeInputMode === "RANGE" ? (
            <div className="grid min-w-0 grid-cols-2 gap-3 overflow-hidden">
              <Input
                label={t("records:fields.startTime")}
                type="time"
                wrapperClassName="min-w-0 overflow-hidden"
                className="!w-full !min-w-0 !max-w-full appearance-none overflow-hidden px-1 text-center text-sm [&::-webkit-calendar-picker-indicator]:hidden [&::-webkit-date-and-time-value]:text-center"
                value={line.startTime}
                onChange={(event) => onChange(line.id, { startTime: event.currentTarget.value })}
              />
              <Input
                label={t("records:fields.endTime")}
                type="time"
                wrapperClassName="min-w-0 overflow-hidden"
                className="!w-full !min-w-0 !max-w-full appearance-none overflow-hidden px-1 text-center text-sm [&::-webkit-calendar-picker-indicator]:hidden [&::-webkit-date-and-time-value]:text-center"
                value={line.endTime}
                onChange={(event) => onChange(line.id, { endTime: event.currentTarget.value })}
              />
            </div>
          ) : (
            <div className={embedded ? "grid grid-cols-1 items-end gap-2" : "grid grid-cols-[minmax(0,1fr)_6.5rem] items-end gap-2"}>
              <Input
                label={t("records:fields.durationHours")}
                type="text"
                inputMode="decimal"
                pattern="[0-9]*[,.]?[0-9]*"
                min={0}
                value={line.durationMinutes}
                onFocus={() => {
                  if (line.durationMinutes === "0") onChange(line.id, { durationMinutes: "" });
                }}
                onChange={(event) => onChange(line.id, { durationMinutes: event.currentTarget.value })}
              />
              {selectedWorkType.extraPayEnabled && !embedded ? (
                <Input
                  label={t("records:fields.extraPay")}
                  type="number"
                  inputMode="decimal"
                  min={0}
                  max={1000}
                  step="0.01"
                  wrapperClassName="min-w-0"
                  className="min-w-0 px-2 text-center"
                  value={line.extraPayPercentage}
                  onFocus={() => {
                    if (line.extraPayPercentage === "0") onChange(line.id, { extraPayPercentage: "" });
                  }}
                  onChange={(event) => onChange(line.id, { extraPayPercentage: event.currentTarget.value })}
                />
              ) : null}
            </div>
          )}
          {line.timeInputMode === "RANGE" ? (
            <div className={embedded ? "grid grid-cols-1 gap-2" : "grid grid-cols-2 gap-3"}>
              <Input
                label={t("records:fields.breakMinutes")}
                type="number"
                inputMode="numeric"
                min={0}
                wrapperClassName="min-w-0"
                className="min-w-0 px-2 text-center text-base"
                value={line.unpaidBreakMinutes}
                onFocus={() => onChange(line.id, { unpaidBreakMinutes: "" })}
                onChange={(event) => onChange(line.id, { unpaidBreakMinutes: event.currentTarget.value })}
              />
              {selectedWorkType.extraPayEnabled && !embedded ? <Input
                label={t("records:fields.extraPay")}
                type="number"
                inputMode="decimal"
                min={0}
                max={1000}
                step="0.01"
                wrapperClassName="min-w-0"
                className="min-w-0 px-2 text-center text-base"
                value={line.extraPayPercentage}
                onFocus={() => {
                  if (line.extraPayPercentage === "0") onChange(line.id, { extraPayPercentage: "" });
                }}
                onChange={(event) => onChange(line.id, { extraPayPercentage: event.currentTarget.value })}
              /> : null}
            </div>
          ) : null}
        </div>
      ) : null}

      {selectedWorkType && line.calculationMode === "FIXED_AMOUNT" ? (
        <div className="space-y-3">
          <div className="grid grid-cols-[minmax(0,1fr),5.5rem] gap-3">
            <Input
              type="text"
              inputMode="decimal"
              placeholder="500"
              label={t("records:fields.fixedAmount")}
                value={line.fixedAmount}
                onFocus={() => {
                  if (line.fixedAmount === "0") onChange(line.id, { fixedAmount: "" });
                }}
              onChange={(event) => onChange(line.id, { fixedAmount: event.currentTarget.value })}
            />
            <Input
              label={t("records:fields.currency")}
              maxLength={3}
              value={line.currency}
              onChange={(event) => onChange(line.id, { currency: event.currentTarget.value.toUpperCase() })}
            />
          </div>
        </div>
      ) : null}

      {selectedWorkType && line.calculationMode !== "TIME_HOURLY" && line.calculationMode !== "FIXED_AMOUNT" ? (
        <div className="space-y-3">
            <div className="grid grid-cols-[minmax(0,1fr),auto] items-center gap-2">
              <div className="min-w-0">
                <p className="text-xs text-white/44">{workTypeRateLabel(selectedWorkType)}</p>
              </div>
              <div className="flex min-w-0 items-center justify-end gap-2">
              <input
                type="text"
                inputMode="decimal"
                pattern="[0-9]*[,.]?[0-9]*"
                value={line.quantity}
                onFocus={() => {
                  if (line.quantity === "0") onChange(line.id, { quantity: "" });
                }}
                onChange={(event) => onChange(line.id, { quantity: event.currentTarget.value })}
                className={`${embedded ? "h-10 w-[6.5rem]" : "h-11 w-32"} min-w-0 rounded-2xl border border-white/[0.12] bg-white/[0.06] px-3 text-right text-base font-semibold text-white outline-none transition focus:border-white/[0.28] focus:ring-2 focus:ring-white/24`}
                aria-label={`${selectedWorkType.unitLabel ?? selectedWorkType.name} ${t("records:unitRows.quantity")}`}
              />
                <span className="max-w-24 truncate text-xs font-semibold text-white/48">
                  {selectedWorkType.unitSymbol ?? selectedWorkType.unitLabel}
                </span>
              </div>
            </div>
          {line.calculationMode === "UNITS_PER_HOUR" && selectedWorkType.extraPayEnabled && !embedded ? (
            <div className="grid grid-cols-1 gap-3">
              <Input
                label={t("records:fields.extraPay")}
                type="number"
                inputMode="decimal"
                min={0}
                max={1000}
                step="0.01"
                value={line.extraPayPercentage}
                onFocus={() => {
                  if (line.extraPayPercentage === "0") onChange(line.id, { extraPayPercentage: "" });
                }}
                onChange={(event) => onChange(line.id, { extraPayPercentage: event.currentTarget.value })}
              />
            </div>
          ) : null}
        </div>
      ) : null}

      {selectedWorkType?.extraPayEnabled && !embedded &&
      (line.calculationMode === "UNITS_PER_UNIT" || line.calculationMode === "FIXED_AMOUNT") ? (
        <Input
          label={t("records:fields.extraPay")}
          type="number"
          inputMode="decimal"
          min={0}
          max={1000}
          step="0.01"
          value={line.extraPayPercentage}
          onFocus={() => {
            if (line.extraPayPercentage === "0") onChange(line.id, { extraPayPercentage: "" });
          }}
          onChange={(event) => onChange(line.id, { extraPayPercentage: event.currentTarget.value })}
        />
      ) : null}

      {preview && !embedded ? (
        <div className="editor-line-result border-t border-white/[0.07] pt-3 text-sm text-white/62">
          <div className="flex items-center justify-between gap-4">
            <span>{preview.label}</span>
            {preview.amount ? <span className="font-semibold text-white">{preview.amount}</span> : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function CollapsedWorkLine({
  line,
  workTypes,
  hourlyRates,
  workDate,
  teamSize,
  onOpen
}: {
  line: JobLineState;
  workTypes: WorkType[];
  hourlyRates: Awaited<ReturnType<typeof listHourlyRates>>;
  workDate: string;
  teamSize: string;
  onOpen: () => void;
}) {
  const selectedWorkType = workTypes.find((workType) => workType.id === line.workTypeId) ?? null;
  const preview = buildLinePreview(line, selectedWorkType, hourlyRates, workDate, teamSize);

  return (
    <button
      type="button"
      onClick={onOpen}
      className="universal-glass-card flex min-h-16 w-full items-center gap-3 rounded-[22px] px-4 py-3 text-left transition active:scale-[0.985]"
    >
      <span
        className="h-3 w-3 shrink-0 rounded-full"
        style={{ backgroundColor: selectedWorkType?.color ?? "#10b981" }}
      />
      <span className="min-w-0 flex-1">
        <span className="font-name block truncate font-semibold text-white">
          {selectedWorkType?.name ?? "—"}
        </span>
        <span className="mt-1 block truncate text-xs text-white/42">{preview?.label ?? "—"}</span>
      </span>
      {preview?.amount ? (
        <span className="shrink-0 font-metric text-sm font-medium text-[#34d399]">{preview.amount}</span>
      ) : null}
      <ChevronRight className="h-4 w-4 shrink-0 text-white/30" aria-hidden="true" />
    </button>
  );
}

function WorkTypeGroupSummary({
  lines,
  workTypes,
  hourlyRates,
  workDate,
  teamSize
}: {
  lines: JobLineState[];
  workTypes: WorkType[];
  hourlyRates: Awaited<ReturnType<typeof listHourlyRates>>;
  workDate: string;
  teamSize: string;
}) {
  const summary = buildGroupSummary(lines, workTypes, hourlyRates, workDate, teamSize);
  if (!summary) return null;

  return (
    <div className="mt-3 flex items-center justify-between gap-4 border-t border-white/[0.08] pt-3 text-sm">
      <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 text-white/58">
        {summary.actualMinutes > 0 ? <span>{formatMinutesAsDuration(summary.actualMinutes)}</span> : null}
        {summary.equivalentMinutes > 0 ? <span>≈ {formatMinutesAsDuration(summary.equivalentMinutes)}</span> : null}
      </div>
      {summary.amounts.length ? (
        <div className="shrink-0 text-right font-semibold text-white">
          {summary.amounts.map((amount) => (
            <div key={amount.currency}>{formatCurrency(String(amount.value), amount.currency)}</div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function buildGroupSummary(
  lines: JobLineState[],
  workTypes: WorkType[],
  hourlyRates: Awaited<ReturnType<typeof listHourlyRates>>,
  workDate: string,
  teamSize: string
) {
  let actualMinutes = 0;
  let equivalentMinutes = 0;
  const amounts = new Map<string, number>();
  const hourlyRate = findApplicableHourlyRate(hourlyRates, workDate);

  const addAmount = (value: number, currency?: string | null) => {
    if (!Number.isFinite(value) || value <= 0 || !currency) return;
    amounts.set(currency, (amounts.get(currency) ?? 0) + value);
  };

  for (const line of lines) {
    const workType = workTypes.find((item) => item.id === line.workTypeId);
    if (!workType || !hasMeaningfulLineInput(line)) continue;
    const mode = workTypeCalculationMode(workType);
    const extraMultiplier = 1 + Math.max(0, Number(line.extraPayPercentage || 0)) / 100;

    if (mode === "TIME_HOURLY") {
      const minutes = line.timeInputMode === "DURATION"
        ? Math.round(parseDecimalInput(line.durationMinutes) * 60)
        : calculateWorkRecordTimeMinutes({
            startTime: line.startTime,
            endTime: line.endTime,
            breakMinutes: Number(line.unpaidBreakMinutes || 0)
          })?.workedMinutes ?? 0;
      actualMinutes += minutes;
      if (hourlyRate) addAmount(calculateGrossAmount(minutes, hourlyRate.hourlyRate) * extraMultiplier, hourlyRate.currency);
      continue;
    }

    if (mode === "UNITS_PER_HOUR") {
      const quantity = parseDecimalInput(line.quantity);
      const unitsPerHour = Number(workType.unitsPerHour);
      const parent = workType.parentId ? workTypes.find((item) => item.id === workType.parentId) : null;
      const teamworkEnabled = workType.teamworkEnabled || parent?.teamworkEnabled;
      const workers = teamworkEnabled ? Number(teamSize) : 1;
      const minutes = unitsPerHour > 0 && workers > 0
        ? Math.round((quantity / unitsPerHour / workers) * 60)
        : 0;
      equivalentMinutes += minutes;
      if (hourlyRate) addAmount(calculateGrossAmount(minutes, hourlyRate.hourlyRate) * extraMultiplier, hourlyRate.currency);
      continue;
    }

    if (mode === "UNITS_PER_UNIT") {
      const quantity = parseDecimalInput(line.quantity);
      const rate = Number(workType.ratePerUnit);
      const parent = workType.parentId ? workTypes.find((item) => item.id === workType.parentId) : null;
      const workers = workType.teamworkEnabled || parent?.teamworkEnabled ? Number(teamSize) : 1;
      if (Number.isFinite(rate) && workers > 0) addAmount(((quantity * rate) / workers) * extraMultiplier, workType.currency);
      const unitsPerHour = Number(workType.unitsPerHour);
      if (unitsPerHour > 0) equivalentMinutes += Math.round((quantity / unitsPerHour) * 60);
      continue;
    }

    if (mode === "FIXED_AMOUNT") {
      addAmount(parseDecimalInput(line.fixedAmount) * extraMultiplier, line.currency);
    }
  }

  if (!actualMinutes && !equivalentMinutes && !amounts.size) return null;
  return {
    actualMinutes,
    equivalentMinutes,
    amounts: Array.from(amounts, ([currency, value]) => ({ currency, value }))
  };
}

function buildLinePreview(
  line: JobLineState,
  workType: WorkType | null,
  hourlyRates: Awaited<ReturnType<typeof listHourlyRates>>,
  workDate: string,
  teamSize: string
) {
  if (!workType) {
    return null;
  }
  const mode = workTypeCalculationMode(workType);
  if (mode === "FIXED_AMOUNT") {
    const fixedAmount = parseDecimalInput(line.fixedAmount);
    const currency = line.currency.trim().toUpperCase();
    if (!Number.isFinite(fixedAmount) || fixedAmount <= 0 || !/^[A-Z]{3}$/.test(currency)) {
      return null;
    }
    return {
      label: workType.name,
      amount: formatCurrency(String(fixedAmount), currency)
    };
  }
  if (mode === "TIME_HOURLY") {
    if (line.timeInputMode === "DURATION") {
      const durationHours = parseDecimalInput(line.durationMinutes);
      if (!Number.isFinite(durationHours) || durationHours <= 0) {
        return null;
      }
      const durationMinutes = Math.round(durationHours * 60);
      const rate = findApplicableHourlyRate(hourlyRates, workDate);
      const gross = rate ? calculateGrossAmount(durationMinutes, rate.hourlyRate) : 0;
      return {
        label: formatMinutesAsDuration(durationMinutes),
        amount: rate ? formatCurrency(String(gross), rate.currency) : null
      };
    }
    const calculation = calculateWorkRecordTimeMinutes({
      startTime: line.startTime,
      endTime: line.endTime,
      breakMinutes: Number(line.unpaidBreakMinutes || 0)
    });
    if (!calculation) {
      return null;
    }
    const rate = findApplicableHourlyRate(hourlyRates, workDate);
    const gross = rate ? calculateGrossAmount(calculation.workedMinutes, rate.hourlyRate) : 0;
    return {
      label: formatMinutesAsDuration(calculation.workedMinutes),
      amount: rate ? formatCurrency(String(gross), rate.currency) : null
    };
  }
  const quantity = parseDecimalInput(line.quantity);
  if (!Number.isFinite(quantity) || quantity <= 0) {
    return null;
  }
  const unit = workType.unitSymbol ?? workType.unitLabel ?? workType.name;
  if (mode === "UNITS_PER_UNIT") {
    const rate = Number(workType.ratePerUnit ?? NaN);
    const workers = workType.teamworkEnabled ? Number(teamSize) : 1;
    const amount = Number.isFinite(rate) && workers > 0 ? (quantity * rate) / workers : null;
    return {
      label: `${quantity} ${unit}`,
      amount: amount !== null && workType.currency ? formatCurrency(String(amount), workType.currency) : null
    };
  }
  return {
    label: `${quantity} ${unit}`,
    amount: null
  };
}

function workTypeRateLabel(workType: WorkType) {
  const mode = workTypeCalculationMode(workType);
  if (mode === "UNITS_PER_UNIT") {
    return `${workType.ratePerUnit ?? ""} ${workType.currency ?? ""}/${workType.unitSymbol ?? workType.unitLabel ?? workType.name}`;
  }
  if (mode === "UNITS_PER_HOUR") {
    const unit = workType.unitSymbol ?? workType.unitLabel ?? workType.name;
    return `${workType.unitsPerHour ?? ""} ${unit}/h`;
  }
  return "";
}

function workTypeMethodLabel(workType: WorkType, t: (key: string) => string) {
  const mode = workTypeCalculationMode(workType);
  if (mode === "TIME_HOURLY") return t("workTypePicker.timeBased");
  if (mode === "FIXED_AMOUNT") return t("workTypePicker.fixedBased");
  return t("workTypePicker.unitBased");
}

function workTypeCalculationMode(workType: WorkType | null): WorkTypeFormulaMode | null {
  if (!workType) return null;
  if (workType.calculationMethod === "TIME_BASED") return "TIME_HOURLY";
  if (workType.calculationMethod === "UNITS_PER_HOUR_BASED") return "UNITS_PER_HOUR";
  if (workType.calculationMethod === "FIXED_PRICE_BASED") return "FIXED_AMOUNT";
  return "UNITS_PER_UNIT";
}

function buildPayload({
  t,
  workDate,
  workEndDate,
  addressId,
  teamSize,
  notes,
  lines,
  workTypes
}: {
  t: ReturnType<typeof useTranslation<["records", "common"]>>["t"];
  workDate: string;
  workEndDate: string | null;
  addressId: string;
  teamSize: string;
  notes: string;
  lines: JobLineState[];
  workTypes: WorkType[];
}): { payload: WorkRecordRequest } | { error: string } {
  if (!workDate) {
    return { error: t("records:validation.dateRequired") };
  }
  if (workEndDate && workEndDate < workDate) {
    return { error: t("records:validation.endDateBeforeStart") };
  }
  if (!lines.length) {
    return { error: t("records:validation.addActivity") };
  }

  const hasTeamworkLine = lines.some((line) => {
    const workType = workTypes.find((item) => item.id === line.workTypeId);
    const parent = workType?.parentId ? workTypes.find((item) => item.id === workType.parentId) : null;
    return Boolean(workType?.teamworkEnabled || parent?.teamworkEnabled);
  });
  const normalizedTeamSize = Number(teamSize);
  if (hasTeamworkLine && (!Number.isInteger(normalizedTeamSize) || normalizedTeamSize <= 0)) {
    return { error: t("records:validation.teamSizeRequired") };
  }

  const payloadLines = [];
  for (const line of lines) {
    const workType = workTypes.find((item) => item.id === line.workTypeId);
    if (!workType) {
      return { error: t("records:validation.chooseWorkType") };
    }
    const parentWorkType = workType.parentId
      ? workTypes.find((item) => item.id === workType.parentId)
      : null;
    const extraPayEnabled = workType.extraPayEnabled || Boolean(parentWorkType?.extraPayEnabled);
    if (workType.parentId && !hasMeaningfulLineInput(line)) {
      continue;
    }
    const baseLine = {
      workTypeId: line.workTypeId,
      notes: emptyToNull(line.notes)
    };
    if (line.calculationMode === "TIME_HOURLY") {
      if (line.timeInputMode === "DURATION") {
        const durationHours = parseDecimalInput(line.durationMinutes);
        if (!Number.isFinite(durationHours) || durationHours <= 0) {
          return { error: t("records:validation.positiveDuration") };
        }
        const durationMinutes = Math.round(durationHours * 60);
        payloadLines.push({
          ...baseLine,
          durationMinutes,
          extraPayPercentage: extraPayEnabled ? Number(line.extraPayPercentage || 0) : 0
        });
        continue;
      }
      if (!line.startTime || !line.endTime) {
        return { error: t("records:validation.timeRequired") };
      }
      payloadLines.push({
        ...baseLine,
        startTime: line.startTime,
        endTime: line.endTime,
        unpaidBreakMinutes: Number(line.unpaidBreakMinutes || 0),
        extraPayPercentage: extraPayEnabled ? Number(line.extraPayPercentage || 0) : 0
      });
      continue;
    }
    if (line.calculationMode === "FIXED_AMOUNT") {
      const fixedAmount = parseDecimalInput(line.fixedAmount);
      const currency = line.currency.trim().toUpperCase();
      if (!Number.isFinite(fixedAmount) || fixedAmount <= 0) {
        return { error: t("records:validation.positiveFixedAmount") };
      }
      if (!/^[A-Z]{3}$/.test(currency)) {
        return { error: t("records:validation.currency") };
      }
      payloadLines.push({
        ...baseLine,
        fixedAmount,
        currency,
        extraPayPercentage: extraPayEnabled ? Number(line.extraPayPercentage || 0) : 0
      });
      continue;
    }
    const quantity = parseDecimalInput(line.quantity);
    if (!Number.isFinite(quantity) || quantity <= 0) {
      return { error: t("records:validation.positiveUnitQuantity") };
    }
    payloadLines.push({
      ...baseLine,
      quantity,
      extraPayPercentage: extraPayEnabled ? Number(line.extraPayPercentage || 0) : 0
    });
  }

  if (!payloadLines.length) {
    return { error: t("records:validation.addActivity") };
  }

  return {
    payload: {
      workDate,
      workEndDate,
      addressId: emptyToNull(addressId),
      teamSize: hasTeamworkLine ? normalizedTeamSize : null,
      notes: emptyToNull(notes),
      lines: payloadLines
    }
  };
}

function hasMeaningfulLineInput(line: JobLineState) {
  if (line.calculationMode === "TIME_HOURLY") {
    return line.timeInputMode === "DURATION"
      ? parseDecimalInput(line.durationMinutes) > 0
      : Boolean(line.startTime && line.endTime);
  }
  if (line.calculationMode === "FIXED_AMOUNT") {
    return parseDecimalInput(line.fixedAmount) > 0;
  }
  return parseDecimalInput(line.quantity) > 0;
}

function emptyToNull(value?: string | null) {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

function formatDecimalHours(minutes: number) {
  return String(Number((minutes / 60).toFixed(2)));
}

function formatRecommendedInterval(
  line: NonNullable<WorkRecord["workLines"]>[number],
  fallback: string,
  breakLabel: string
) {
  const start = line.startTime?.slice(0, 5);
  const end = line.endTime?.slice(0, 5);
  if (start && end) {
    const breakMinutes = line.breakMinutes ?? 0;
    return breakMinutes > 0 ? `${start}–${end} · ${breakLabel} ${breakMinutes} min` : `${start}–${end}`;
  }
  if (line.durationMinutes) return formatMinutesAsDuration(line.durationMinutes);
  return fallback;
}

function hasAddressValues(address: AddressPayload) {
  return [address.street, address.street2, address.postalCode, address.city, address.region, address.country]
    .some((value) => Boolean(value?.trim()));
}

function normalizeAddressPayload(address: AddressPayload): AddressPayload {
  return {
    street: emptyToNull(address.street),
    street2: emptyToNull(address.street2),
    postalCode: emptyToNull(address.postalCode),
    city: emptyToNull(address.city),
    region: emptyToNull(address.region),
    country: emptyToNull(address.country)?.toUpperCase() ?? null
  };
}

function matchesAddress(draft: AddressPayload, address?: Address | null) {
  if (!address) return false;
  const normalized = normalizeAddressPayload(draft);
  return normalized.street === address.street &&
    normalized.street2 === (address.street2 ?? null) &&
    normalized.postalCode === (address.postalCode ?? null) &&
    normalized.city === address.city &&
    normalized.region === (address.region ?? null) &&
    normalized.country === address.country;
}
